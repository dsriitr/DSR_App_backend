const jwt = require('jsonwebtoken');
const { query } = require('../db');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await query(
      'SELECT manager_id, full_name, initials, avatar_color, phone_number, role, status FROM managers WHERE manager_id = $1',
      [decoded.manager_id]
    );
    if (!rows[0] || rows[0].status !== 'Active') {
      return res.status(401).json({ success: false, message: 'Invalid or inactive account' });
    }
    req.manager = rows[0];
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token invalid or expired' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.manager.role !== 'Admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

module.exports = { auth, adminOnly }
