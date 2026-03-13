const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// POST /auth/login
router.post('/login', async (req, res) => {
  try {
    const { phone_number, password } = req.body;
    if (!phone_number || !password) {
      return res.status(400).json({ success: false, message: 'Phone and password required' });
    }

    const { rows } = await query(
      `SELECT * FROM managers WHERE phone_number = $1 AND status = 'Active'`,
      [phone_number]
    );
    const manager = rows[0];
    if (!manager) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, manager.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { manager_id: manager.manager_id, role: manager.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );

    const { password_hash, ...safeManager } = manager;
    res.json({ success: true, data: { token, manager: safeManager } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /auth/logout
router.post('/logout', auth, async (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

// GET /auth/me
router.get('/me', auth, async (req, res) => {
  res.json({ success: true, data: req.manager });
});

module.exports = router;
