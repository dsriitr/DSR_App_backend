require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'DSR CRM API', sarvam: !!process.env.SARVAM_API_KEY, claude: !!process.env.ANTHROPIC_API_KEY }));

app.use('/api/v1/auth',     require('./routes/auth'));
app.use('/api/v1/managers', require('./routes/managers'));
app.use('/api/v1/meetings', require('./routes/meetings'));
app.use('/api/v1/leads',    require('./routes/leads'));
app.use('/api/v1/followups',require('./routes/followups'));
app.use('/api/v1/pipeline', require('./routes/pipeline'));
app.use('/api/v1/projects', require('./routes/projects'));
app.use('/api/v1/projects', require('./routes/projects'));
app.use('/api/v1/projects', require('./routes/projects'));
app.use('/api/v1/reports',  require('./routes/reports'));
app.use('/api/v1/alerts',   require('./routes/alerts'));
app.use('/api/v1/upload',   require('./routes/upload'));

app.use((_req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ success: false, message: 'File too large. Max 200MB.' });
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 DSR CRM API on port ${PORT}`);
  console.log(`   Sarvam STT: ${process.env.SARVAM_API_KEY ? '✅' : '❌ missing'}`);
  console.log(`   Claude AI:  ${process.env.ANTHROPIC_API_KEY ? '✅' : '❌ missing'}\n`);
});

module.exports = app;
