const express = require('express');
const { query } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET /alerts
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT a.*, l.lead_name, mg.full_name AS manager_name
      FROM alerts a
      LEFT JOIN leads l ON l.lead_id = a.lead_id
      LEFT JOIN managers mg ON mg.manager_id = a.manager_id
      ORDER BY CASE a.status WHEN 'Active' THEN 0 ELSE 1 END,
               CASE a.severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 ELSE 2 END,
               a.triggered_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /alerts/:id/resolve
router.patch('/:id/resolve', auth, async (req, res) => {
  try {
    const { rows } = await query(`
      UPDATE alerts SET status='Resolved', resolved_at=NOW()
      WHERE alert_id=$1 RETURNING *
    `, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
