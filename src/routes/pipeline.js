const express = require(‘express’);
const { query } = require(’../db’);
const { auth } = require(’../middleware/auth’);
const { parseFilters } = require(’../utils/filters’);

const router = express.Router();

// GET /pipeline/snapshot
router.get(’/snapshot’, auth, async (req, res) => {
try {
const { rows } = await query(`SELECT COALESCE(SUM(total_pipeline_leads),0)::int   AS total_pipeline_leads, COALESCE(SUM(total_pipeline_value),0)        AS total_pipeline_value, COALESCE(SUM(leads_added),0)::int            AS leads_added, COALESCE(SUM(leads_removed),0)::int          AS leads_removed, COALESCE(SUM(net_increase),0)::int           AS net_increase, COALESCE(SUM(value_added),0)                 AS value_added, COALESCE(SUM(value_removed),0)               AS value_removed, COALESCE(SUM(net_value_change),0)            AS net_value_change, COALESCE(SUM(booking_count),0)::int          AS booking_count, ROUND(AVG(booking_ratio_percent)::numeric,1) AS booking_ratio_percent, COALESCE(SUM(stuck_7d_count),0)::int         AS stuck_7d_count, COALESCE(SUM(stuck_7d_value),0)              AS stuck_7d_value, COALESCE(SUM(stuck_30d_count),0)::int        AS stuck_30d_count, COALESCE(SUM(stuck_30d_value),0)             AS stuck_30d_value FROM pipeline_snapshots WHERE snapshot_date = (SELECT MAX(snapshot_date) FROM pipeline_snapshots)`);
res.json({ success: true, data: rows[0] });
} catch (err) {
res.status(500).json({ success: false, message: err.message });
}
});

// GET /pipeline/leads
router.get(’/leads’, auth, async (req, res) => {
try {
const { managerId } = parseFilters(req.query);
const { tab = ‘pipeline’, sort } = req.query;

```
const params = [];
const wheres = [`l.lead_status IN ('Pipeline','Positive','SV Scheduled','SV Done')`];

if (managerId && managerId !== 'all') wheres.push(`l.owner_manager_id = $${params.push(managerId)}`);

if (tab === 'stuck_7d') wheres.push(`l.days_no_activity >= 7`);
if (tab === 'stuck_30d') wheres.push(`l.days_no_activity >= 30`);

const orderBy = tab === 'stuck_7d' || tab === 'stuck_30d'
  ? 'l.days_no_activity DESC'
  : 'l.deal_value DESC NULLS LAST';

const { rows } = await query(`
  SELECT l.*,
    mg.full_name AS manager_name, mg.initials, mg.avatar_color,
    COUNT(m.meeting_id)::int AS meeting_count,
    COALESCE(SUM(m.duration_minutes),0)::int AS total_meeting_min
  FROM leads l
  JOIN managers mg ON mg.manager_id = l.owner_manager_id
  LEFT JOIN meetings m ON m.lead_id = l.lead_id
  WHERE ${wheres.join(' AND ')}
  GROUP BY l.lead_id, mg.manager_id
  ORDER BY ${orderBy}
  LIMIT 50
`, params);

const leads = rows.map(r => ({
  ...r,
  owner_manager: { manager_id: r.owner_manager_id, full_name: r.manager_name, initials: r.initials, avatar_color: r.avatar_color },
}));

res.json({ success: true, data: leads });
```

} catch (err) {
res.status(500).json({ success: false, message: err.message });
}
});

// GET /pipeline/projects
router.get(’/projects’, auth, async (req, res) => {
try {
const { rows } = await query(`SELECT l.project_name, COUNT(l.lead_id)::int          AS lead_count, COALESCE(SUM(l.deal_value),0)  AS pipeline_value, COUNT(b.booking_id)::int       AS booking_count, CASE WHEN COUNT(l.lead_id) > 0 THEN ROUND((COUNT(b.booking_id)::numeric / COUNT(l.lead_id)) * 100, 1) ELSE 0 END                   AS booking_ratio, 0                              AS share_percent FROM leads l LEFT JOIN bookings b ON b.lead_id = l.lead_id AND b.booking_status = 'Active' WHERE l.lead_status IN ('Pipeline','Positive','SV Scheduled','SV Done','Booking') AND l.project_name IS NOT NULL GROUP BY l.project_name ORDER BY pipeline_value DESC`);

```
const totalValue = rows.reduce((s, r) => s + Number(r.pipeline_value), 0);
const withShare = rows.map(r => ({
  ...r,
  share_percent: totalValue > 0 ? Math.round((Number(r.pipeline_value) / totalValue) * 100) : 0,
  project: { project_name: r.project_name },
}));

res.json({ success: true, data: withShare });
```

} catch (err) {
res.status(500).json({ success: false, message: err.message });
}
});

// GET /pipeline/summary — 4 breakdowns: project, team, activity, unit_type
router.get(’/summary’, auth, async (req, res) => {
try {
const { managerId } = req.query;
const params = [];
const mgrFilter = managerId && managerId !== ‘all’
? `AND l.owner_manager_id = $${params.push(managerId)}`
: ‘’;

```
const pipelineStatuses = `('Pipeline','Positive','Booking')`;

const [projectRows, teamRows, activityRows, unitRows] = await Promise.all([
  query(`SELECT COALESCE(l.project_name,'Unknown') AS label, COUNT(*)::int AS count, SUM(l.deal_value)::bigint AS value FROM leads l WHERE l.lead_status IN ${pipelineStatuses} ${mgrFilter} GROUP BY l.project_name ORDER BY count DESC`, [...params]),
  query(`SELECT mg.full_name AS label, COUNT(*)::int AS count FROM leads l JOIN managers mg ON mg.manager_id = l.owner_manager_id WHERE l.lead_status IN ${pipelineStatuses} ${mgrFilter} GROUP BY mg.full_name ORDER BY count DESC`, [...params]),
  query(`SELECT CASE WHEN l.days_no_activity >= 30 THEN 'Stuck 30d' WHEN l.days_no_activity >= 7 THEN 'Stuck 7d' ELSE 'Active' END AS label, COUNT(*)::int AS count FROM leads l WHERE l.lead_status IN ${pipelineStatuses} ${mgrFilter} GROUP BY 1 ORDER BY count DESC`, [...params]),
  query(`SELECT COALESCE(l.unit_type,'Unknown') AS label, COUNT(*)::int AS count FROM leads l WHERE l.lead_status IN ${pipelineStatuses} ${mgrFilter} GROUP BY l.unit_type ORDER BY count DESC`, [...params]),
]);

res.json({
  success: true,
  data: {
    by_project: projectRows.rows,
    by_team: teamRows.rows,
    by_activity: activityRows.rows,
    by_unit_type: unitRows.rows,
  }
});
```

} catch (err) {
res.status(500).json({ success: false, message: err.message });
}
});

module.exports = router;
