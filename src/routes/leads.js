const express = require('express');
const { query } = require('../db');
const { auth } = require('../middleware/auth');
const { parseFilters } = require('../utils/filters');

const router = express.Router();


// GET /leads/summary
router.get('/summary', auth, async (req, res) => {
  try {
    const { managerId } = req.query;
    const params = [];
    const mgrFilter = managerId && managerId !== 'all'
      ? `AND l.owner_manager_id = ${params.push(managerId)}`
      : '';
    const [s1,s2,s3,s4] = await Promise.all([
      query(`SELECT lead_status AS label, COUNT(*)::int AS count FROM leads l WHERE 1=1 ${mgrFilter} GROUP BY lead_status ORDER BY count DESC`, [...params]),
      query(`SELECT COALESCE(project_name,'Unknown') AS label, COUNT(*)::int AS count FROM leads l WHERE 1=1 ${mgrFilter} GROUP BY project_name ORDER BY count DESC`, [...params]),
      query(`SELECT mg.full_name AS label, COUNT(*)::int AS count FROM leads l JOIN managers mg ON mg.manager_id = l.owner_manager_id WHERE 1=1 ${mgrFilter} GROUP BY mg.full_name ORDER BY count DESC`, [...params]),
      query(`SELECT COALESCE(unit_type,'Unknown') AS label, COUNT(*)::int AS count FROM leads l WHERE 1=1 ${mgrFilter} GROUP BY unit_type ORDER BY count DESC`, [...params]),
    ]);
    res.json({ success: true, data: { by_status: s1.rows, by_project: s2.rows, by_team: s3.rows, by_unit_type: s4.rows } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /leads/movement
router.get('/movement', auth, async (req, res) => {
  try {
    const { from, to, managerId } = parseFilters(req.query);
    const params = [from, to];
    const mgrFilter = managerId && managerId !== 'all'
      ? `AND l.owner_manager_id = $${params.push(managerId)}`
      : '';
    const dateFilter = `h.changed_at >= $1 AND h.changed_at <= ($2::date + interval '1 day')`;

    const [entered, exited, s2, s3, s4] = await Promise.all([
      // count transitions INTO each status
      query(`
        SELECT h.new_status AS label, COUNT(*)::int AS count
        FROM lead_status_history h JOIN leads l ON l.lead_id = h.lead_id
        WHERE ${dateFilter} ${mgrFilter}
        GROUP BY h.new_status
      `, [...params]),
      // count transitions OUT of each status
      query(`
        SELECT h.old_status AS label, COUNT(*)::int AS count
        FROM lead_status_history h JOIN leads l ON l.lead_id = h.lead_id
        WHERE ${dateFilter} ${mgrFilter} AND h.old_status IS NOT NULL
        GROUP BY h.old_status
      `, [...params]),
      // by_project: total status changes per project
      query(`
        SELECT COALESCE(l.project_name, 'Unknown') AS label, COUNT(*)::int AS count
        FROM lead_status_history h JOIN leads l ON l.lead_id = h.lead_id
        WHERE ${dateFilter} ${mgrFilter}
        GROUP BY l.project_name ORDER BY count DESC
      `, [...params]),
      // by_team: total status changes per manager
      query(`
        SELECT mg.full_name AS label, COUNT(*)::int AS count
        FROM lead_status_history h JOIN leads l ON l.lead_id = h.lead_id
        JOIN managers mg ON mg.manager_id = l.owner_manager_id
        WHERE ${dateFilter} ${mgrFilter}
        GROUP BY mg.full_name ORDER BY count DESC
      `, [...params]),
      // by_unit_type
      query(`
        SELECT COALESCE(l.unit_type, 'Unknown') AS label, COUNT(*)::int AS count
        FROM lead_status_history h JOIN leads l ON l.lead_id = h.lead_id
        WHERE ${dateFilter} ${mgrFilter}
        GROUP BY l.unit_type ORDER BY count DESC
      `, [...params]),
    ]);

    // Compute net = entered - exited per status
    const enteredMap = Object.fromEntries(entered.rows.map(r => [r.label, r.count]));
    const exitedMap = Object.fromEntries(exited.rows.map(r => [r.label, r.count]));
    const allStatuses = [...new Set([...Object.keys(enteredMap), ...Object.keys(exitedMap)])];
    const byStatus = allStatuses.map(s => ({
      label: s,
      count: (enteredMap[s] || 0) - (exitedMap[s] || 0),
    })).sort((a, b) => Math.abs(b.count) - Math.abs(a.count));

    res.json({ success: true, data: { by_status: byStatus, by_project: s2.rows, by_team: s3.rows, by_unit_type: s4.rows } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /leads/status-distribution
router.get('/status-distribution', auth, async (req, res) => {
  try {
    const { managerId } = req.query;
    const params = [];
    const mgrFilter = managerId && managerId !== 'all'
      ? `AND owner_manager_id = $${params.push(managerId)}`
      : '';

    const { rows } = await query(`
      SELECT lead_status AS status,
             COUNT(*)::int AS count,
             COALESCE(SUM(net_change_this_period),0)::int AS net_change
      FROM leads
      WHERE 1=1 ${mgrFilter}
      GROUP BY lead_status
      ORDER BY count DESC
    `, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /leads — list with filters
router.get('/', auth, async (req, res) => {
  try {
    const { managerId } = parseFilters(req.query);
    const { page = 1, per_page = 20, status, search } = req.query;
    const offset = (page - 1) * per_page;

    const params = [];
    const wheres = ['1=1'];

    if (managerId && managerId !== 'all') wheres.push(`l.owner_manager_id = $${params.push(managerId)}`);
    if (status) wheres.push(`l.lead_status = $${params.push(status)}`);
    if (search) wheres.push(`(l.lead_name ILIKE $${params.push(`%${search}%`)} OR l.phone_number ILIKE $${params.push(`%${search}%`)})`);

    const whereStr = wheres.join(' AND ');

    const { rows } = await query(`
      SELECT l.*,
        mg.full_name AS manager_name, mg.initials, mg.avatar_color
      FROM leads l
      JOIN managers mg ON mg.manager_id = l.owner_manager_id
      WHERE ${whereStr}
      ORDER BY l.updated_at DESC
      LIMIT ${Number(per_page)} OFFSET ${offset}
    `, params);

    const { rows: countRows } = await query(`SELECT COUNT(*)::int AS total FROM leads l WHERE ${whereStr}`, params);

    const leads = rows.map(r => ({
      ...r,
      owner_manager: { manager_id: r.owner_manager_id, full_name: r.manager_name, initials: r.initials, avatar_color: r.avatar_color },
    }));

    res.json({ success: true, data: leads, total: countRows[0].total, page: Number(page), per_page: Number(per_page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /leads/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT l.*, mg.full_name AS manager_name, mg.initials, mg.avatar_color
      FROM leads l JOIN managers mg ON mg.manager_id = l.owner_manager_id
      WHERE l.lead_id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Lead not found' });
    const r = rows[0];
    res.json({ success: true, data: { ...r, owner_manager: { manager_id: r.owner_manager_id, full_name: r.manager_name, initials: r.initials, avatar_color: r.avatar_color } } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /leads
router.post('/', auth, async (req, res) => {
  try {
    const { lead_name, phone_number, lead_source, owner_manager_id, project_name, unit_type, budget_min, budget_max } = req.body;
    const { rows } = await query(`
      INSERT INTO leads (lead_name, phone_number, lead_source, owner_manager_id, project_name, unit_type, budget_min, budget_max)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *
    `, [lead_name, phone_number, lead_source, owner_manager_id, project_name, unit_type, budget_min, budget_max]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /leads/:id
router.put('/:id', auth, async (req, res) => {
  try {
    const { lead_name, phone_number, project_name, unit_type, budget_min, budget_max, hometown, profession, decision_maker, deal_value, preferences } = req.body;
    const { rows } = await query(`
      UPDATE leads SET lead_name=$1, phone_number=$2, project_name=$3, unit_type=$4,
        budget_min=$5, budget_max=$6, hometown=$7, profession=$8, decision_maker=$9,
        deal_value=COALESCE($10, deal_value), updated_at=NOW()
      WHERE lead_id=$11 RETURNING *
    `, [lead_name, phone_number, project_name, unit_type, budget_min, budget_max, hometown, profession, decision_maker, deal_value, req.params.id]);

    if (preferences) {
      const p = preferences;
      await query(`INSERT INTO lead_preferences (lead_id, unit_type, unit_size_sqft, budget_min, budget_max, budget_clarity, purchase_timeline, urgency_level, financing_mode, loan_amount, reason_for_buying, project_preference)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (lead_id) DO UPDATE SET
          unit_type=COALESCE($2,lead_preferences.unit_type), unit_size_sqft=COALESCE($3,lead_preferences.unit_size_sqft),
          budget_min=COALESCE($4,lead_preferences.budget_min), budget_max=COALESCE($5,lead_preferences.budget_max),
          budget_clarity=COALESCE($6,lead_preferences.budget_clarity), purchase_timeline=COALESCE($7,lead_preferences.purchase_timeline),
          urgency_level=COALESCE($8,lead_preferences.urgency_level), financing_mode=COALESCE($9,lead_preferences.financing_mode),
          loan_amount=COALESCE($10,lead_preferences.loan_amount), reason_for_buying=COALESCE($11,lead_preferences.reason_for_buying),
          project_preference=COALESCE($12,lead_preferences.project_preference), updated_at=NOW()`,
        [req.params.id, p.unit_type || null, p.unit_size_sqft || null, p.budget_min || null, p.budget_max || null, p.budget_clarity || null, p.purchase_timeline || null, p.urgency_level || null, p.financing_mode || null, p.loan_amount || null, p.reason_for_buying || null, p.project_preference || null]);
    }

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /leads/:id/status
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { lead_status, deal_value } = req.body;
    const { rows: current } = await query(`SELECT lead_status FROM leads WHERE lead_id = $1`, [req.params.id]);
    const old_status = current[0]?.lead_status;

    const { rows } = await query(`
      UPDATE leads SET lead_status=$1, deal_value=COALESCE($2, deal_value),
        status_changed_at=NOW(), updated_at=NOW(),
        pipeline_entered_date = CASE WHEN $1 = 'Pipeline' AND pipeline_entered_date IS NULL THEN CURRENT_DATE ELSE pipeline_entered_date END
      WHERE lead_id=$3 RETURNING *
    `, [lead_status, deal_value, req.params.id]);

    await query(`
      INSERT INTO lead_status_history (lead_id, old_status, new_status, changed_by, changed_by_manager_id)
      VALUES ($1,$2,$3,'Manager',$4)
    `, [req.params.id, old_status, lead_status, req.manager.manager_id]);

    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /leads/:id/reassign
router.post('/:id/reassign', auth, async (req, res) => {
  try {
    const { to_manager_id, notes } = req.body;
    const { rows: current } = await query(`SELECT owner_manager_id FROM leads WHERE lead_id = $1`, [req.params.id]);
    const from_mgr = current[0]?.owner_manager_id;

    await query(`UPDATE leads SET owner_manager_id=$1, updated_at=NOW() WHERE lead_id=$2`, [to_manager_id, req.params.id]);
    await query(`
      INSERT INTO lead_reassignment_history (lead_id, from_manager_id, to_manager_id, reason, reassigned_by)
      VALUES ($1,$2,$3,$4,$5)
    `, [req.params.id, from_mgr, to_manager_id, notes, req.manager.manager_id]);

    res.json({ success: true, message: 'Lead reassigned' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /leads/:id/preferences
router.get('/:id/preferences', auth, async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM lead_preferences WHERE lead_id = $1 ORDER BY updated_at DESC LIMIT 1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Preferences not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /leads/:id/status-history
router.get('/:id/status-history', auth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT h.*, mg.full_name AS manager_name
      FROM lead_status_history h
      LEFT JOIN managers mg ON mg.manager_id = h.changed_by_manager_id
      WHERE h.lead_id = $1 ORDER BY h.changed_at DESC
    `, [req.params.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /leads/:id/objections
router.get('/:id/objections', auth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT o.*, m.meeting_date FROM lead_objections o
      LEFT JOIN meetings m ON m.meeting_id = o.meeting_id
      WHERE o.lead_id = $1 ORDER BY o.created_at DESC
    `, [req.params.id]);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
