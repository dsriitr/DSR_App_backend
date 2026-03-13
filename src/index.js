require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logger (dev only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// ── HEALTH CHECK ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Sales Intelligence CRM API', version: '1.0.0' });
});

// ── ROUTES ────────────────────────────────────────────────────
app.use('/api/v1/auth',      require('./routes/auth'));
app.use('/api/v1/managers',  require('./routes/managers'));
app.use('/api/v1/meetings',  require('./routes/meetings'));
app.use('/api/v1/leads',     require('./routes/leads'));
app.use('/api/v1/followups', require('./routes/followups'));
app.use('/api/v1/pipeline',  require('./routes/pipeline'));
app.use('/api/v1/reports',   require('./routes/reports'));
app.use('/api/v1/alerts',    require('./routes/alerts'));

// ── 404 ───────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── GLOBAL ERROR HANDLER ──────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── START ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 Sales Intelligence CRM API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
