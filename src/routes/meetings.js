const express = require(‘express’);
const { query } = require(’../db’);
const { auth } = require(’../middleware/auth’);
const { parseFilters } = require(’../utils/filters’);

const router = express.Router();

// GET /meetings/summary
router.get(’/summary’, auth, async (req, res) => {
try {
const { from, to, managerId } = parseFilters(req.query);
const params = [from, to];
const mgrFilter = managerId && managerId !== ‘all’
? `AND m.manager_id = $${params.push(managerId)}`
: ‘’;

```
const { rows } = await query(`
  SELECT
    COUNT(m.meeting_id)::int AS total_meetings,
    ROUND(AVG(a.meeting_score)::numeric, 2) AS avg_score,
    COALESCE(SUM(m.duration_minutes),0)::int AS total_duration_minutes,
    ROUND(AVG(m.duration_minutes)::numeric) AS avg_meeting_minutes,
    COUNT(*) FILTER (WHERE m.meeting_category='Field')::int  AS field_meetings,
    COUNT(*) FILTER (WHERE m.meeting_category='Office')::int AS office_meetings,
    COUNT(*) FILTER (WHERE m.meeting_type='New')::int    AS new_meetings,
    COUNT(*) FILTER (WHERE m.meeting_type='Repeat')::int AS repeat_meetings,
    COUNT(*) FILTER (WHERE a.meeting_sentiment='Super')::int       AS super_meetings,
    COUNT(*) FILTER (WHERE a.meeting_sentiment='Progressive')::int AS progressive_meetings,
    COUNT(*) FILTER (WHERE a.meeting_sentiment='Time Waste')::int  AS timewaste_meetings
  FROM meetings m
  LEFT JOIN meeting_ai_analysis a ON a.meeting_id = m.meeting_id
  WHERE m.meeting_date BETWEEN $1 AND $2 ${mgrFilter}
`, params);

const params2 = [from, to];
const mgrFilter2 = managerId && managerId !== 'all'
  ? `AND manager_id = $${params2.push(managerId)}`
  : '';
const { rows: activity } = await query(`
  SELECT
    COALESCE(SUM(calls_made),0)::int          AS calls_made,
    COALESCE(SUM(whatsapp_sent),0)::int        AS whatsapp_sent,
    COALESCE(SUM(followups_completed),0)::int  AS followups_done,
    COALESCE(SUM(followups_missed),0)::int     AS followups_missed
  FROM daily_report_snapshots
  WHERE snapshot_date BETWEEN $1 AND $2 ${mgrFilter2}
`, params2);

res.json({ success: true, data: { ...rows[0], ...activity[0] } });
```

} catch (err) {
res.status(500).json({ success: false, message: err.message });
}
});

// GET /meetings — list
router.get(’/’, auth, async (req, res) => {
try {
const { from, to, managerId } = parseFilters(req.query);
const { page = 1, per_page = 20 } = req.query;
const offset = (page - 1) * per_page;

```
const params = [from, to];
const mgrFilter = managerId && managerId !== 'all'
  ? `AND m.manager_id = $${params.push(managerId)}`
  : '';

const { rows } = await query(`
  SELECT
    m.*,
    l.lead_name, l.phone_number, l.lead_status, l.unit_type,
    l.budget_min, l.budget_max, l.lead_source,
    mg.full_name AS manager_name, mg.initials, mg.avatar_color,
    p.project_name,
    a.meeting_score, a.meeting_sentiment, a.meeting_summary,
    a.lead_status_suggested, a.deal_probability_percent, a.dm_present
  FROM meetings m
  JOIN leads l ON l.lead_id = m.lead_id
  JOIN managers mg ON mg.manager_id = m.manager_id
  LEFT JOIN projects p ON p.project_id = m.project_id
  LEFT JOIN meeting_ai_analysis a ON a.meeting_id = m.meeting_id
  WHERE m.meeting_date BETWEEN $1 AND $2 ${mgrFilter}
  ORDER BY m.meeting_date DESC, m.start_time DESC
  LIMIT ${Number(per_page)} OFFSET ${offset}
`, params);

const { rows: countRows } = await query(`
  SELECT COUNT(*)::int AS total FROM meetings m
  WHERE m.meeting_date BETWEEN $1 AND $2 ${mgrFilter}
`, params);

const meetings = rows.map(r => ({
  ...r,
  lead: { lead_id: r.lead_id, lead_name: r.lead_name, phone_number: r.phone_number, lead_status: r.lead_status, unit_type: r.unit_type, budget_min: r.budget_min, budget_max: r.budget_max, lead_source: r.lead_source },
  manager: { manager_id: r.manager_id, full_name: r.manager_name, initials: r.initials, avatar_color: r.avatar_color },
  project: r.project_name ? { project_id: r.project_id, project_name: r.project_name } : null,
  ai_analysis: r.meeting_score != null ? { meeting_score: r.meeting_score, meeting_sentiment: r.meeting_sentiment, meeting_summary: r.meeting_summary, lead_status_suggested: r.lead_status_suggested, deal_probability_percent: r.deal_probability_percent, dm_present: r.dm_present } : null,
}));

res.json({ success: true, data: meetings, total: countRows[0].total, page: Number(page), per_page: Number(per_page) });
```

} catch (err) {
res.status(500).json({ success: false, message: err.message });
}
});

// GET /meetings/:id
router.get(’/:id’, auth, async (req, res) => {
try {
const { rows } = await query(`SELECT m.*, l.lead_id, l.lead_name, l.phone_number, l.lead_status, l.unit_type, l.budget_min, l.budget_max, l.lead_source, l.dm_met, l.days_no_activity, l.followup_due_date, mg.full_name AS manager_name, mg.initials, mg.avatar_color, p.project_name FROM meetings m JOIN leads l ON l.lead_id = m.lead_id JOIN managers mg ON mg.manager_id = m.manager_id LEFT JOIN projects p ON p.project_id = m.project_id WHERE m.meeting_id = $1`, [req.params.id]);

```
if (!rows[0]) return res.status(404).json({ success: false, message: 'Meeting not found' });

const r = rows[0];
const { rows: analysis } = await query(`SELECT * FROM meeting_ai_analysis WHERE meeting_id = $1`, [r.meeting_id]);
const { rows: followups } = await query(`SELECT task_type, description, due_date, priority, status FROM followups WHERE meeting_id = $1 ORDER BY followup_id ASC`, [r.meeting_id]);

const meeting = {
  ...r,
  lead: { lead_id: r.lead_id, lead_name: r.lead_name, phone_number: r.phone_number, lead_status: r.lead_status, unit_type: r.unit_type, budget_min: r.budget_min, budget_max: r.budget_max, lead_source: r.lead_source, dm_met: r.dm_met, days_no_activity: r.days_no_activity, followup_due_date: r.followup_due_date },
  manager: { manager_id: r.manager_id, full_name: r.manager_name, initials: r.initials, avatar_color: r.avatar_color },
  project: r.project_name ? { project_name: r.project_name } : null,
  ai_analysis: analysis[0] || null,
  followup_tasks: followups || [],
};

res.json({ success: true, data: meeting });
```

} catch (err) {
res.status(500).json({ success: false, message: err.message });
}
});

// GET /meetings/:id/analysis
router.get(’/:id/analysis’, auth, async (req, res) => {
try {
const { rows } = await query(`SELECT * FROM meeting_ai_analysis WHERE meeting_id = $1`, [req.params.id]);
if (!rows[0]) return res.status(404).json({ success: false, message: ‘Analysis not found’ });
res.json({ success: true, data: rows[0] });
} catch (err) {
res.status(500).json({ success: false, message: err.message });
}
});

// GET /meetings/:id/transcript
router.get(’/:id/transcript’, auth, async (req, res) => {
try {
const { rows } = await query(`SELECT * FROM meeting_transcripts WHERE meeting_id = $1`, [req.params.id]);
if (!rows[0]) return res.status(404).json({ success: false, message: ‘Transcript not found’ });
res.json({ success: true, data: rows[0] });
} catch (err) {
res.status(500).json({ success: false, message: err.message });
}
});

// GET /meetings/reports/activity
router.get(’/reports/activity’, auth, async (req, res) => {
try {
const { from, to, managerId } = parseFilters(req.query);
const params = [from, to];
const mgrFilter = managerId && managerId !== ‘all’
? `AND manager_id = $${params.push(managerId)}`
: ‘’;

```
const { rows } = await query(`
  SELECT
    COALESCE(SUM(total_meetings),0)::int       AS total_meetings,
    COALESCE(SUM(field_meetings),0)::int        AS field_meetings,
    COALESCE(SUM(office_meetings),0)::int       AS office_meetings,
    COALESCE(SUM(new_meetings),0)::int          AS new_meetings,
    COALESCE(SUM(repeat_meetings),0)::int       AS repeat_meetings,
    COALESCE(SUM(super_meetings),0)::int        AS super_meetings,
    COALESCE(SUM(progressive_meetings),0)::int  AS progressive_meetings,
    COALESCE(SUM(timewaste_meetings),0)::int    AS timewaste_meetings,
    COALESCE(SUM(total_duration_minutes),0)::int AS total_duration_minutes,
    COALESCE(SUM(calls_made),0)::int            AS calls_made,
    COALESCE(SUM(whatsapp_sent),0)::int         AS whatsapp_sent,
    COALESCE(SUM(site_visits),0)::int           AS site_visits,
    COALESCE(SUM(followups_completed),0)::int   AS followups_completed,
    COALESCE(SUM(followups_verified),0)::int    AS followups_verified,
    COALESCE(SUM(followups_unverified),0)::int  AS followups_unverified,
    COALESCE(SUM(followups_missed),0)::int      AS followups_missed
  FROM daily_report_snapshots
  WHERE snapshot_date BETWEEN $1 AND $2 ${mgrFilter}
`, params);

const { rows: perMgr } = await query(`
  SELECT
    mg.full_name AS manager_name,
    COALESCE(SUM(ds.total_meetings),0)::int      AS meetings,
    COALESCE(SUM(ds.calls_made),0)::int          AS calls,
    COALESCE(SUM(ds.followups_completed),0)::int AS done,
    COALESCE(SUM(ds.followups_missed),0)::int    AS missed
  FROM managers mg
  LEFT JOIN daily_report_snapshots ds ON ds.manager_id = mg.manager_id
    AND ds.snapshot_date BETWEEN $1 AND $2
  WHERE mg.role != 'Admin' ${managerId && managerId !== 'all' ? `AND mg.manager_id = $${params.length}` : ''}
  GROUP BY mg.manager_id ORDER BY meetings DESC
`, params);

res.json({ success: true, data: { ...rows[0], per_manager: perMgr } });
```

} catch (err) {
res.status(500).json({ success: false, message: err.message });
}
});

// GET /meetings/reports/quality
router.get(’/reports/quality’, auth, async (req, res) => {
try {
const { from, to, managerId } = parseFilters(req.query);
const params = [from, to];
const mgrFilter = managerId && managerId !== ‘all’
? `AND m.manager_id = $${params.push(managerId)}`
: ‘’;

```
const { rows } = await query(`
  SELECT
    ROUND(AVG(a.meeting_score)::numeric, 2) AS avg_score,
    ROUND(AVG(a.talk_ratio_manager_percent)::numeric) AS avg_talk_ratio_manager,
    ROUND(AVG(a.talk_ratio_client_percent)::numeric)  AS avg_talk_ratio_client,
    ROUND(AVG(a.questions_asked_count)::numeric, 1)   AS avg_questions,
    COUNT(*) FILTER (WHERE a.meeting_sentiment='Super')::int       AS super_count,
    COUNT(*) FILTER (WHERE a.meeting_sentiment='Progressive')::int AS progressive_count,
    COUNT(*) FILTER (WHERE a.meeting_sentiment='Time Waste')::int  AS timewaste_count,
    ROUND(AVG(a.objection_handling_score)::numeric,2) AS avg_objection_score,
    COUNT(*) FILTER (WHERE a.next_step_defined=true)::int AS next_step_defined_count,
    COUNT(*) FILTER (WHERE a.close_attempt_detected=true)::int AS close_attempts
  FROM meetings m
  JOIN meeting_ai_analysis a ON a.meeting_id = m.meeting_id
  WHERE m.meeting_date BETWEEN $1 AND $2 ${mgrFilter}
`, params);

res.json({ success: true, data: rows[0] });
```

} catch (err) {
res.status(500).json({ success: false, message: err.message });
}
});

module.exports = router;
