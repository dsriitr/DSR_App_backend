const fs = require('fs');
const { query } = require('../db');
const { transcribeAudio } = require('./transcription');
const { analyzeMeeting } = require('./aiAnalysis');

async function runPipeline(meetingId, filePath) {
  console.log(`[Pipeline] Starting for meeting ${meetingId}`);
  try {
    const { rows } = await query(`SELECT m.*, l.lead_name, l.lead_status, p.project_name, mg.full_name AS manager_name FROM meetings m JOIN leads l ON l.lead_id = m.lead_id LEFT JOIN projects p ON p.project_id = m.project_id JOIN managers mg ON mg.manager_id = m.manager_id WHERE m.meeting_id = $1`, [meetingId]);
    if (!rows[0]) throw new Error('Meeting not found');
    const meeting = rows[0];

    await query(`UPDATE meetings SET transcript_status='Processing' WHERE meeting_id=$1`, [meetingId]);
    const transcription = await transcribeAudio(filePath);
    await query(`INSERT INTO meeting_transcripts (meeting_id, transcript_text, language, word_count, confidence_score) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (meeting_id) DO UPDATE SET transcript_text=$2, language=$3, word_count=$4, confidence_score=$5, generated_at=NOW()`, [meetingId, transcription.transcript, transcription.language, transcription.word_count, transcription.confidence_score]);
    await query(`UPDATE meetings SET transcript_status='Completed', recording_url=NULL WHERE meeting_id=$1`, [meetingId]);
    if (fs.existsSync(filePath)) { fs.unlinkSync(filePath); console.log(`[Pipeline] Audio file deleted`); }

    await query(`UPDATE meetings SET ai_analysis_status='Processing' WHERE meeting_id=$1`, [meetingId]);
    const analysis = await analyzeMeeting({ transcript: transcription.transcript, leadName: meeting.lead_name, projectName: meeting.project_name, meetingType: meeting.meeting_type, managerName: meeting.manager_name });

    await query(`INSERT INTO meeting_ai_analysis (meeting_id, meeting_summary, lead_status_suggested, lead_intent, site_visit_status, deal_probability_percent, meeting_sentiment, meeting_score, talk_ratio_manager_percent, talk_ratio_client_percent, questions_asked_count, needs_analysis_done, budget_qualification_done, objection_handling_score, close_attempt_detected, next_step_defined, confidence_level, manager_strengths, manager_improvement, expected_next_status, dm_present, decision_maker_identified) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) ON CONFLICT (meeting_id) DO UPDATE SET meeting_summary=$2, lead_status_suggested=$3, lead_intent=$4, site_visit_status=$5, deal_probability_percent=$6, meeting_sentiment=$7, meeting_score=$8, talk_ratio_manager_percent=$9, talk_ratio_client_percent=$10, questions_asked_count=$11, needs_analysis_done=$12, budget_qualification_done=$13, objection_handling_score=$14, close_attempt_detected=$15, next_step_defined=$16, confidence_level=$17, manager_strengths=$18, manager_improvement=$19, expected_next_status=$20, dm_present=$21, decision_maker_identified=$22, generated_at=NOW()`, [meetingId, analysis.meeting_summary, analysis.lead_status_suggested, analysis.lead_intent, analysis.site_visit_status, analysis.deal_probability_percent, analysis.meeting_sentiment, analysis.meeting_score, analysis.talk_ratio_manager_percent, analysis.talk_ratio_client_percent, analysis.questions_asked_count, analysis.needs_analysis_done, analysis.budget_qualification_done, analysis.objection_handling_score, analysis.close_attempt_detected, analysis.next_step_defined, analysis.confidence_level, analysis.manager_strengths, analysis.manager_improvement, analysis.expected_next_status, analysis.dm_present, analysis.decision_maker_identified]);
    await query(`UPDATE meetings SET ai_analysis_status='Completed' WHERE meeting_id=$1`, [meetingId]);

    const lp = analysis.lead_profile || {};
    const fields = []; const vals = []; let i = 1;
    if (lp.unit_type) { fields.push(`unit_type=$${i++}`); vals.push(lp.unit_type); }
    if (lp.budget_min) { fields.push(`budget_min=$${i++}`); vals.push(lp.budget_min); }
    if (lp.budget_max) { fields.push(`budget_max=$${i++}`); vals.push(lp.budget_max); }
    if (lp.buying_timeline) { fields.push(`buying_timeline=$${i++}`); vals.push(lp.buying_timeline); }
    if (lp.urgency_level) { fields.push(`urgency_level=$${i++}`); vals.push(lp.urgency_level); }
    if (lp.funding_type) { fields.push(`funding_type=$${i++}`); vals.push(lp.funding_type); }
    if (lp.hometown) { fields.push(`hometown=$${i++}`); vals.push(lp.hometown); }
    if (lp.profession) { fields.push(`profession=$${i++}`); vals.push(lp.profession); }
    if (lp.employment_type) { fields.push(`employment_type=$${i++}`); vals.push(lp.employment_type); }
    if (analysis.dm_present !== null) { fields.push(`dm_met=$${i++}`); vals.push(analysis.dm_present); }
    if (analysis.lead_status_suggested) { fields.push(`lead_status=$${i++}`); vals.push(analysis.lead_status_suggested); }
    fields.push(`days_no_activity=$${i++}`); vals.push(0);
    fields.push(`last_meeting_or_sv_date=$${i++}`); vals.push(new Date().toISOString().split('T')[0]);
    vals.push(meeting.lead_id);
    if (fields.length > 0) await query(`UPDATE leads SET ${fields.join(', ')} WHERE lead_id=$${i}`, vals);

    if (analysis.lead_status_suggested && analysis.lead_status_suggested !== meeting.lead_status) {
      await query(`INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by_manager_id, meeting_id, change_reason) VALUES ($1,$2,$3,$4,$5,'AI suggested based on meeting analysis')`, [meeting.lead_id, meeting.lead_status, analysis.lead_status_suggested, meeting.manager_id, meetingId]);
    }

    if (lp.unit_type || lp.budget_min) {
      await query(`INSERT INTO lead_preferences (lead_id, unit_type, budget_min, budget_max, buying_timeline, urgency_level, funding_type, purpose) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (lead_id) DO UPDATE SET unit_type=COALESCE($2,lead_preferences.unit_type), budget_min=COALESCE($3,lead_preferences.budget_min), budget_max=COALESCE($4,lead_preferences.budget_max), buying_timeline=COALESCE($5,lead_preferences.buying_timeline), urgency_level=COALESCE($6,lead_preferences.urgency_level), funding_type=COALESCE($7,lead_preferences.funding_type), purpose=COALESCE($8,lead_preferences.purpose), updated_at=NOW()`, [meeting.lead_id, lp.unit_type, lp.budget_min, lp.budget_max, lp.buying_timeline, lp.urgency_level, lp.funding_type, lp.purpose]);
    }

    if (analysis.objections?.length > 0) {
      for (const obj of analysis.objections) {
        await query(`INSERT INTO lead_objections (meeting_id, lead_id, objection_type, objection_detail, resolution_status, resolution_method, raised_at_minute) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [meetingId, meeting.lead_id, obj.objection_type, obj.objection_detail, obj.resolution_status, obj.resolution_method, obj.raised_at_minute]);
      }
    }

    if (analysis.followup_tasks?.length > 0) {
      for (const task of analysis.followup_tasks) {
        const due = new Date(); due.setDate(due.getDate() + (task.due_days_from_now || 2));
        await query(`INSERT INTO followups (lead_id, manager_id, meeting_id, task_type, description, due_date, priority, status, is_ai_created) VALUES ($1,$2,$3,$4,$5,$6,$7,'Pending',true)`, [meeting.lead_id, meeting.manager_id, meetingId, task.task_type, task.description, due.toISOString().split('T')[0], task.priority || 'Medium']);
      }
    }

    await query(`INSERT INTO recording_processing_log (meeting_id, status, transcript_word_count, ai_score, processing_completed_at) VALUES ($1,'Completed',$2,$3,NOW()) ON CONFLICT (meeting_id) DO UPDATE SET status='Completed', processing_completed_at=NOW()`, [meetingId, transcription.word_count, analysis.meeting_score]).catch(()=>{});
    console.log(`[Pipeline] ✅ Done! Score: ${analysis.meeting_score}`);
    return { success: true };

  } catch (err) {
    console.error(`[Pipeline] ❌ Error:`, err.message);
    await query(`UPDATE meetings SET transcript_status=CASE WHEN transcript_status='Processing' THEN 'Failed' ELSE transcript_status END, ai_analysis_status=CASE WHEN ai_analysis_status='Processing' THEN 'Failed' ELSE ai_analysis_status END WHERE meeting_id=$1`, [meetingId]).catch(()=>{});
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    throw err;
  }
}

module.exports = { runPipeline };
