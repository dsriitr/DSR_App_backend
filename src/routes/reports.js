const express = require('express');
const { query } = require('../db');
const { auth } = require('../middleware/auth');
const { parseFilters } = require('../utils/filters');

const router = express.Router();

// GET /reports/activity
router.get('/activity', auth, async (req, res) => {
  try {
    const { from, to, managerId } = parseFilters(req.query);
    const params = [from, to];
    const mgrFilter = managerId && managerId !== 'all'
      ? `AND manager_id = $${params.push(managerId)}`
      : '';

    const { rows } = await query(`
      SELECT
        COALESCE(SUM(total_meetings),0)::int      AS total_meetings,
        COALESCE(SUM(field_meetings),0)::int      AS field_meetings,
        COALESCE(SUM(office_meetings),0)::int     AS office_meetings,
        COALESCE(SUM(new_meetings),0)::int        AS new_meetings,
        COALESCE(SUM(repeat_meetings),0)::int     AS repeat_meetings,
        COALESCE(SUM(super_meetings),0)::int      AS super_meetings,
        COALESCE(SUM(progressive_meetings),0)::int AS progressive_meetings,
        COALESCE(SUM(timewaste_meetings),0)::int  AS timewaste_meetings,
        COALESCE(SUM(total_duration_minutes),0)::int AS total_duration_minutes,
        COALESCE(SUM(calls_made),0)::int          AS calls_made,
        COALESCE(SUM(whatsapp_sent),0)::int       AS whatsapp_sent,
        COALESCE(SUM(site_visits),0)::int         AS site_visits,
        COALESCE(SUM(followups_completed),0)::int AS followups_completed,
        COALESCE(SUM(followups_verified),0)::int  AS followups_verified,
        COALESCE(SUM(followups_unverified),0)::int AS followups_unverified,
        COALESCE(SUM(followups_missed),0)::int    AS followups_missed
      FROM daily_report_snapshots
      WHERE snapshot_date BETWEEN $1 AND $2 ${mgrFilter}
    `, params);

    const { rows: perMgr } = await query(`
      SELECT mg.full_name AS manager_name,
        COALESCE(SUM(ds.total_meetings),0)::int      AS meetings,
        COALESCE(SUM(ds.calls_made),0)::int          AS calls,
        COALESCE(SUM(ds.followups_completed),0)::int AS done,
        COALESCE(SUM(ds.followups_missed),0)::int    AS missed
      FROM managers mg
      LEFT JOIN daily_report_snapshots ds ON ds.manager_id = mg.manager_id
        AND ds.snapshot_date BETWEEN $1 AND $2
      WHERE mg.role != 'Admin'
      GROUP BY mg.manager_id ORDER BY meetings DESC
    `, [from, to]);

    const { rows: trend } = await query(`
      SELECT snapshot_date::text AS date,
        SUM(total_meetings)::int AS meetings,
        ROUND(AVG(avg_meeting_score)::numeric, 2) AS avg_score
      FROM daily_report_snapshots
      WHERE snapshot_date BETWEEN $1 AND $2 ${mgrFilter}
      GROUP BY snapshot_date ORDER BY snapshot_date
    `, params);

    res.json({ success: true, data: { ...rows[0], per_manager: perMgr, daily_trend: trend } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /reports/daily-trend
router.get('/daily-trend', auth, async (req, res) => {
  try {
    const { from, to, managerId } = parseFilters(req.query);
    const params = [from, to];
    const mgrFilter = managerId && managerId !== 'all'
      ? `AND manager_id = $${params.push(managerId)}`
      : '';

    const { rows } = await query(`
      SELECT snapshot_date::text AS date,
        SUM(total_meetings)::int AS meetings,
        ROUND(AVG(avg_meeting_score)::numeric,2) AS avg_score,
        SUM(calls_made)::int AS calls
      FROM daily_report_snapshots
      WHERE snapshot_date BETWEEN $1 AND $2 ${mgrFilter}
      GROUP BY snapshot_date ORDER BY snapshot_date
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /reports/meeting-quality
router.get('/meeting-quality', auth, async (req, res) => {
  try {
    const { from, to, managerId } = parseFilters(req.query);
    const params = [from, to];
    const mgrFilter = managerId && managerId !== 'all'
      ? `AND m.manager_id = $${params.push(managerId)}`
      : '';

    const { rows } = await query(`
      SELECT
        ROUND(AVG(a.meeting_score)::numeric,2)             AS avg_score,
        ROUND(AVG(a.talk_ratio_manager_percent)::numeric)  AS avg_talk_ratio_manager,
        ROUND(AVG(a.talk_ratio_client_percent)::numeric)   AS avg_talk_ratio_client,
        ROUND(AVG(a.questions_asked_count)::numeric,1)     AS avg_questions,
        COUNT(*) FILTER (WHERE a.meeting_sentiment='Super')::int       AS super_count,
        COUNT(*) FILTER (WHERE a.meeting_sentiment='Progressive')::int AS progressive_count,
        COUNT(*) FILTER (WHERE a.meeting_sentiment='Time Waste')::int  AS timewaste_count,
        ROUND(AVG(a.objection_handling_score)::numeric,2)  AS avg_objection_score,
        COUNT(*) FILTER (WHERE a.next_step_defined)::int   AS next_step_count,
        COUNT(*) FILTER (WHERE a.close_attempt_detected)::int AS close_attempt_count,
        COUNT(*) FILTER (WHERE a.dm_present)::int          AS dm_present_count
      FROM meetings m JOIN meeting_ai_analysis a ON a.meeting_id = m.meeting_id
      WHERE m.meeting_date BETWEEN $1 AND $2 ${mgrFilter}
    `, params);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /reports/conversion
router.get('/conversion', auth, async (req, res) => {
  try {
    const { managerId } = req.query;
    const params = [];
    const mgrFilter = managerId && managerId !== 'all'
      ? `AND owner_manager_id = $${params.push(managerId)}`
      : '';

    const statusOrder = ['Open','Cold Interested','Hot Interested','SV Scheduled','SV Done','Positive','Pipeline','Booking'];
    const { rows } = await query(`
      SELECT lead_status AS status, COUNT(*)::int AS count
      FROM leads WHERE 1=1 ${mgrFilter}
      GROUP BY lead_status
    `, params);

    const total = rows.reduce((s, r) => s + r.count, 0);
    const funnel = statusOrder.map(s => {
      const r = rows.find(x => x.status === s);
      return { status: s, count: r?.count ?? 0, pct: total > 0 ? Math.round(((r?.count ?? 0) / total) * 100) : 0 };
    }).filter(r => r.count > 0);

    res.json({ success: true, data: { funnel, total } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /reports/pipeline
router.get('/pipeline', auth, async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM pipeline_snapshots ORDER BY snapshot_date DESC LIMIT 2`);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /reports/lead-intelligence
router.get('/lead-intelligence', auth, async (req, res) => {
  try {
    const { managerId } = req.query;
    const params = [];
    const mgrFilter = managerId && managerId !== 'all'
      ? `AND owner_manager_id = $${params.push(managerId)}`
      : '';

    const { rows } = await query(`
      SELECT
        COUNT(*) FILTER (WHERE dm_met)::int  AS dm_met_count,
        COUNT(*) FILTER (WHERE NOT dm_met)::int AS dm_not_met_count,
        COUNT(*) FILTER (WHERE no_activity_7_days)::int  AS no_activity_7d,
        COUNT(*) FILTER (WHERE no_activity_30_days)::int AS no_activity_30d,
        ROUND(AVG(lead_score)::numeric,2) AS avg_lead_score,
        COUNT(DISTINCT project_name)::int AS projects_active
      FROM leads WHERE 1=1 ${mgrFilter}
    `, params);

    const { rows: bySource } = await query(`
      SELECT lead_source AS source, COUNT(*)::int AS count
      FROM leads WHERE 1=1 ${mgrFilter}
      GROUP BY lead_source ORDER BY count DESC
    `, params);

    res.json({ success: true, data: { ...rows[0], by_source: bySource } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /reports/objections
router.get('/objections', auth, async (req, res) => {
  try {
    const { from, to, managerId } = parseFilters(req.query);
    const params = [from, to];
    const mgrFilter = managerId && managerId !== 'all'
      ? `AND m.manager_id = $${params.push(managerId)}`
      : '';

    const { rows } = await query(`
      SELECT
        o.objection_type AS type,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE o.resolution_status='Resolved')::int AS resolved,
        CASE WHEN COUNT(*) > 0
          THEN ROUND((COUNT(*) FILTER (WHERE o.resolution_status='Resolved')::numeric / COUNT(*)) * 100)
          ELSE 0 END AS resolved_pct
      FROM lead_objections o
      JOIN meetings m ON m.meeting_id = o.meeting_id
      WHERE m.meeting_date BETWEEN $1 AND $2 ${mgrFilter}
      GROUP BY o.objection_type ORDER BY count DESC
    `, params);

    const { rows: summary } = await query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE resolution_status='Resolved')::int AS resolved,
        COUNT(*) FILTER (WHERE resolution_status='Open')::int AS open
      FROM lead_objections o
      JOIN meetings m ON m.meeting_id = o.meeting_id
      WHERE m.meeting_date BETWEEN $1 AND $2 ${params.length > 2 ? `AND m.manager_id = $3` : ''}
    `, params);

    res.json({ success: true, data: { by_type: rows, ...summary[0] } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /reports/manager-performance
router.get('/manager-performance', auth, async (req, res) => {
  try {
    const { from, to } = parseFilters(req.query);

    const { rows } = await query(`
      SELECT
        mg.manager_id, mg.full_name, mg.initials, mg.avatar_color,
        COUNT(mt.meeting_id)::int AS total_meetings,
        ROUND(AVG(a.meeting_score)::numeric,2) AS avg_score,
        ROUND(AVG(a.talk_ratio_manager_percent)::numeric) AS avg_talk_ratio,
        COUNT(*) FILTER (WHERE a.meeting_sentiment='Super')::int AS super_count,
        COALESCE(SUM(ds.followups_completed),0)::int AS followups_done,
        COALESCE(SUM(ds.followups_missed),0)::int    AS followups_missed,
        MODE() WITHIN GROUP (ORDER BY a.manager_strengths) AS strengths,
        MODE() WITHIN GROUP (ORDER BY a.manager_improvement) AS improvement
      FROM managers mg
      LEFT JOIN meetings mt ON mt.manager_id = mg.manager_id AND mt.meeting_date BETWEEN $1 AND $2
      LEFT JOIN meeting_ai_analysis a ON a.meeting_id = mt.meeting_id
      LEFT JOIN daily_report_snapshots ds ON ds.manager_id = mg.manager_id AND ds.snapshot_date BETWEEN $1 AND $2
      WHERE mg.role != 'Admin'
      GROUP BY mg.manager_id
      ORDER BY avg_score DESC NULLS LAST
    `, [from, to]);

    res.json({ success: true, data: { managers: rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /reports/revenue
router.get('/revenue', auth, async (req, res) => {
  try {
    const { from, to, managerId } = parseFilters(req.query);
    const params = [from, to];
    const mgrFilter = managerId && managerId !== 'all'
      ? `AND b.manager_id = $${params.push(managerId)}`
      : '';

    const { rows: bookings } = await query(`
      SELECT COUNT(*)::int AS total_bookings, COALESCE(SUM(booking_amount),0) AS total_revenue
      FROM bookings b WHERE booking_date BETWEEN $1 AND $2 AND booking_status='Active' ${mgrFilter}
    `, params);

    const { rows: pipeline } = await query(`
      SELECT COALESCE(SUM(deal_value),0) AS pipeline_value
      FROM leads WHERE lead_status IN ('Pipeline','Positive','SV Scheduled','SV Done')
    `);

    const { rows: weighted } = await query(`
      SELECT COALESCE(SUM(l.deal_value * a.deal_probability_percent / 100.0),0) AS weighted_forecast
      FROM leads l JOIN meetings m ON m.lead_id = l.lead_id
      JOIN meeting_ai_analysis a ON a.meeting_id = m.meeting_id
      WHERE l.lead_status IN ('Pipeline','Positive')
        AND a.deal_probability_percent IS NOT NULL
    `);

    res.json({
      success: true,
      data: {
        ...bookings[0],
        pipeline_value: Number(pipeline[0].pipeline_value),
        weighted_forecast: Math.round(Number(weighted[0].weighted_forecast)),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
