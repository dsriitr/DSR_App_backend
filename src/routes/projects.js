const express = require('express');
const { query } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await query(`SELECT * FROM projects ORDER BY status DESC, project_name ASC`);
    res.json({ success: true, data: rows });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/', auth, adminOnly, async (req, res) => {
  try {
    const { project_name } = req.body;
    if (!project_name?.trim()) return res.status(400).json({ success: false, message: 'Project name required' });
    const { rows } = await query(`INSERT INTO projects (project_name) VALUES ($1) RETURNING *`, [project_name.trim()]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ success: false, message: 'Project name already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', auth, adminOnly, async (req, res) => {
  try {
    const { project_name } = req.body;
    if (!project_name?.trim()) return res.status(400).json({ success: false, message: 'Project name required' });
    const { rows } = await query(`UPDATE projects SET project_name=$1 WHERE project_id=$2 RETURNING *`, [project_name.trim(), req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ success: false, message: 'Project name already exists' });
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['Active', 'Inactive'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be Active or Inactive' });
    const { rows } = await query(`UPDATE projects SET status=$1 WHERE project_id=$2 RETURNING *`, [status, req.params.id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Project not found' });
    res.json({ success: true, data: rows[0] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
