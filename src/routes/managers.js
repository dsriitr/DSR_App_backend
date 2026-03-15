const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');
const { parseFilters } = require('../utils/filters');

const router = express.Router();

// GET /managers/all/list — all including inactive (admin only)
router.get('/all/list', auth, adminOnly, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT manager_id, full_name, initials, avatar_color, phone_number,
             email, role, status, created_at
      FROM managers ORDER BY status DESC, full_name ASC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /managers — list active only
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT manager_id, full_name, initials, avatar_color, phone_number,
             role, is_online, last_checkin_site, last_checkin_at,
             checkin_elapsed_minutes, status, created_at
      FROM managers WHERE status = 'Active' ORDER BY full_name
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /managers/leaderboard
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const { from, to, managerId } = parseFilters(req.query);
    const params = [from, to];
    const mgrFilter = managerId && managerId !== 'all' ? `AND m.manager_id = $${params.push(managerId)}` : '';

    const { rows } = await query(`
      SELECT
        m.manager_id, m.full_name, m.initials, m.avatar_color,
        COUNT(mt.meeting_id)::int        AS total_meetings,
        ROUND(AVG(a.meeting_score)::numeric, 2) AS avg_score,
        COALESCE(SUM(ds.calls_made),0)::int  AS calls_made,
        COALESCE(SUM(ds.followups_completed),0)::int AS followups_done
      FROM managers m
      LEFT JOIN meetings mt ON mt.manager_id = m.manager_id
        AND mt.meeting_date BETWEEN $1 AND $2
      LEFT JOIN meeting_ai_analysis a ON a.meeting_id = mt.meeting_id
      LEFT JOIN daily_report_snapshots ds ON ds.manager_id = m.manager_id
        AND ds.snapshot_date BETWEEN $1 AND $2
      WHERE m.status = 'Active' AND m.role != 'Admin' ${mgrFilter}
      GROUP BY m.manager_id
      ORDER BY avg_score DESC NULLS LAST
    `, params);

    const ranked = rows.map((r, i) => ({ ...r, rank: i + 1 }));
    res.json({ success: true, data: ranked });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /managers/performance — table for dashboard
router.get('/performance', auth, async (req, res) => {
  try {
    const { from, to } = parseFilters(req.query);

    const { rows } = await query(`
      SELECT
        m.manager_id, m.full_name, m.initials, m.avatar_color,
        COUNT(mt.meeting_id)::int AS total_meetings,
        COUNT(mt.meeting_id) FILTER (WHERE mt.meeting_category = 'Field')::int  AS field_meetings,
        COUNT(mt.meeting_id) FILTER (WHERE mt.meeting_category = 'Office')::int AS office_meetings,
        COUNT(mt.meeting_id) FILTER (WHERE mt.meeting_type = 'New')::int        AS new_meetings,
        COALESCE(SUM(mt.duration_minutes),0)::int AS total_duration_minutes,
        ROUND(AVG(a.meeting_score)::numeric, 2)   AS avg_score
      FROM managers m
      LEFT JOIN meetings mt ON mt.manager_id = m.manager_id
        AND mt.meeting_date BETWEEN $1 AND $2
      LEFT JOIN meeting_ai_analysis a ON a.meeting_id = mt.meeting_id
      WHERE m.status = 'Active' AND m.role != 'Admin'
      GROUP BY m.manager_id
      ORDER BY total_meetings DESC
    `, [from, to]);

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /managers/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT manager_id, full_name, initials, avatar_color, phone_number,
             email, role, is_online, last_checkin_site, last_checkin_at, status, created_at
      FROM managers WHERE manager_id = $1
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Manager not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /managers — admin only
router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { full_name, initials, avatar_color, phone_number, email, password, role } = req.body;
    if (!full_name || !phone_number || !password) {
      return res.status(400).json({ success: false, message: 'full_name, phone_number and password are required' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(`
      INSERT INTO managers (full_name, initials, avatar_color, phone_number, email, password_hash, role)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING manager_id, full_name, phone_number, role, status
    `, [
      full_name,
      initials || full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
      avatar_color || '#6366f1',
      phone_number,
      email || null,
      hash,
      role || 'Sales Manager'
    ]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /managers/:id — admin only
router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { full_name, initials, avatar_color, phone_number, email, role } = req.body;
    const { rows } = await query(`
      UPDATE managers
      SET full_name=$1, initials=$2, avatar_color=$3, phone_number=$4, email=$5, role=$6
      WHERE manager_id=$7
      RETURNING manager_id, full_name, role, status
    `, [full_name, initials, avatar_color, phone_number, email || null, role, req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Manager not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /managers/:id/status — activate/deactivate
router.patch('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be Active or Inactive' });
    }
    const { rows } = await query(`
      UPDATE managers SET status=$1 WHERE manager_id=$2
      RETURNING manager_id, full_name, status
    `, [status, req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Manager not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH /managers/:id/password — reset password
router.patch('/:id/password', auth, adminOnly, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(`
      UPDATE managers SET password_hash=$1 WHERE manager_id=$2
      RETURNING manager_id, full_name
    `, [hash, req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Manager not found' });
    res.json({ success: true, message: 'Password reset successfully', data: rows[0] });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = router;
