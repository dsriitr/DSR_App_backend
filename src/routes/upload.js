const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { auth } = require('../middleware/auth');
const { runPipeline } = require('../services/pipeline');

const router = express.Router();
const UPLOAD_DIR = '/tmp/recordings';
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `rec_${Date.now()}${path.extname(file.originalname) || '.m4a'}`),
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

router.post('/recording', auth, upload.single('audio'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No audio file' });
    const { lead_id, lead_name, phone_number, project_name, project_id, meeting_type = 'New', duration_seconds, meeting_date, start_time, manager_id } = req.body;
    const managerId = req.manager.manager_id;
    console.log(`[Upload] From manager ${managerId}, file: ${req.file.filename}, size: ${(req.file.size/1024/1024).toFixed(2)}MB`);

    let resolvedLeadId = lead_id ? parseInt(lead_id) : null;
    if (!resolvedLeadId && lead_name && phone_number) {
      const { rows: ex } = await query(`SELECT lead_id FROM leads WHERE phone_number=$1 LIMIT 1`, [phone_number]);
      if (ex[0]) { resolvedLeadId = ex[0].lead_id; }
      else {
        const { rows: nl } = await query(`INSERT INTO leads (lead_name, phone_number, owner_manager_id, project_name, lead_status, lead_source) VALUES ($1,$2,$3,$4,'Open','Field') RETURNING lead_id`, [lead_name, phone_number, managerId, project_name || null]);
        resolvedLeadId = nl[0].lead_id;
      }
    }
    if (!resolvedLeadId) { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); return res.status(400).json({ success: false, message: 'lead_id or lead_name+phone required' }); }

    // Resolve project_id from project_name if needed
    let resolvedProjectId = project_id ? parseInt(project_id) : null;
    if (!resolvedProjectId && project_name) {
      const { rows: pr } = await query(`SELECT project_id FROM projects WHERE project_name ILIKE $1 LIMIT 1`, [project_name]);
      if (pr[0]) resolvedProjectId = pr[0].project_id;
    }

    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toTimeString().slice(0,5);
    const { rows: mr } = await query(`INSERT INTO meetings (lead_id, manager_id, project_id, meeting_date, start_time, duration_minutes, meeting_type, meeting_category, recording_url, recording_duration_seconds, transcript_status, ai_analysis_status, uploaded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,'Field',$8,$9,'Pending','Pending',NOW()) RETURNING meeting_id`, [resolvedLeadId, managerId, resolvedProjectId, meeting_date || today, start_time || now, duration_seconds ? Math.round(parseInt(duration_seconds)/60) : 0, meeting_type === 'Repeat' ? 'Repeat' : 'New', filePath, duration_seconds || null]);
    const meetingId = mr[0].meeting_id;
    console.log(`[Upload] Meeting created: ${meetingId}`);

    res.json({ success: true, message: 'Uploaded! AI analysis starting...', data: { meeting_id: meetingId, lead_id: resolvedLeadId, status: 'processing' } });
    runPipeline(meetingId, filePath).catch(err => console.error(`[Upload] Pipeline error:`, err.message));

  } catch (err) {
    console.error('[Upload] Error:', err.message);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/status/:meetingId', auth, async (req, res) => {
  try {
    const { rows } = await query(`SELECT m.meeting_id, m.transcript_status, m.ai_analysis_status, m.duration_minutes, l.lead_name, l.lead_status, a.meeting_score, a.meeting_sentiment, a.lead_status_suggested, t.word_count, t.language FROM meetings m JOIN leads l ON l.lead_id=m.lead_id LEFT JOIN meeting_ai_analysis a ON a.meeting_id=m.meeting_id LEFT JOIN meeting_transcripts t ON t.meeting_id=m.meeting_id WHERE m.meeting_id=$1`, [req.params.meetingId]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Not found' });
    const m = rows[0];
    res.json({ success: true, data: { meeting_id: m.meeting_id, transcript_status: m.transcript_status, ai_analysis_status: m.ai_analysis_status, is_complete: m.transcript_status === 'Completed' && m.ai_analysis_status === 'Completed', is_failed: m.transcript_status === 'Failed' || m.ai_analysis_status === 'Failed', lead_name: m.lead_name, lead_status: m.lead_status, score: m.meeting_score, sentiment: m.meeting_sentiment, suggested_status: m.lead_status_suggested, word_count: m.word_count, language: m.language } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
