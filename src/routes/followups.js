const express = require('express');
const { query } = require('../db');
const { auth } = require('../middleware/auth');
const { parseFilters } = require('../utils/filters');

const router = express.Router();

// GET /followups/summary
router.get('/summary', auth, async (req, res) => {
  try {
    const { managerId } = req.query;
    const params = [];
    const mgrFilter = managerId && managerId !== 'all'
      ? `AND manager_id = $${params.push(managerId)}`
      : '';

    const { rows } = await query(`
      SELECT
        COUNT(*) FILTER (WHERE status='Pending' AND due_date < CURRENT_DATE)::int AS overdue,
        COUNT(*) FILTER (WHERE status='Pending' AND due_date = CURRENT_DATE)::int AS due_today,
        COUNT(*) FILTER (WHERE status='Done')::int    AS completed,
        COUNT(*) FILTER (WHERE status='Missed')::int  AS missed,
        COUNT(*) FILTER (WHERE status='Done' AND verification_status='Verified')::int   AS verified,
        COUNT(*) FILTER (WHERE status='Done' AND verification_status='Unverified')::int AS unverified
      FROM followups WHERE 1=1 ${mgrFilter}
    `, params);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /followups
router.get('/', auth, async (req, res) => {
  try {
    const { managerId } = parseFilters(req.query);
    const { status, page = 1, per_page = 30 } = req.query;
    const offset = (page - 1) * per_page;

    const params = [];
    const wheres = ['1=1'];
    if (managerId && managerId !== 'all') wheres.push(`f.manager_id = $${params.push(managerId)}`);
    if (status) wheres.push(`f.status = $${params.push(status)}`);

    const { rows } = await query(`
      SELECT f.*, l.lead_name AS lead_full_name, l.lead_status,
        mg.full_name AS manager_name, mg.initials, mg.avatar_color
      FROM followups f
      JOIN leads l ON l.lead_id = f.lead_id
      JOIN managers mg ON mg.manager_id = f.manager_id
      WHERE ${wheres.join(' AND ')}
      ORDER BY
        CASE f.status WHEN 'Pending' THEN 0 WHEN 'Missed' THEN 1 ELSE 2 END,
        f.due_date ASC
      LIMIT ${Number(per_page)} OFFSET ${offset}
    `, params);

    const { rows: countRows } = await query(`SELECT COUNT(*)::int AS total FROM followups f WHERE ${wheres.join(' AND ')}`, params);

    const followups = rows.map(r => ({
      ...r,
      lead: { lead_id: r.lead_id, lead_name: r.lead_full_name, lead_status: r.lead_status },
      manager: { manager_id: r.manager_id, full_name: r.manager_name, initials: r.initials, avatar_color: r.avatar_color },
    }));

    res.json({ success: true, data: followups, total: countRows[0].total, page: Number(page), per_page: Number(per_page) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /followups
router.post('/', auth, async (req, res) => {
  try {
    const { lead_id, manager_id, task_type, due_date, priority, notes } = req.body;
    const { rows: lead } = await query(`SELECT lead_name, lead_status FROM leads WHERE lead_id=$1`, [lead_id]);
    const { rows } = await query(`
      INSERT INTO followups (lead_id, manager_id, task_type, lead_name, lead_sentiment_at_creation, due_date, priority, notes, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Manager') RETURNING *
    `, [lead_id, manager_id, task_type, lead[0]?.lead_name, lead[0]?.lead_status, due_date, priority || 'Medium', notes]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /followups/:id/done
router.patch('/:id/done', auth, async (req, res) => {
  try {
    const { rows } = await query(`
      UPDATE followups SET status='Done', completed_at=NOW() WHERE followup_id=$1 RETURNING *
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Task not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
