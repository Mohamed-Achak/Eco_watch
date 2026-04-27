// backend/server.js
// EcoWatch API Server — Node.js + Express + SQLite

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initDb } = require('./db/database');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));                // In production: restrict to your domain
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// ─── INITIALISE DB ────────────────────────────────────────────────────────────
initDb().catch(err => console.error('Database initialization error:', err));

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use('/api/reports', require('./routes/reports'));
app.use('/api/alerts',  require('./routes/alerts'));
app.use('/api/labels',  require('./routes/labels'));
app.use('/api/users',   require('./routes/users'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'EcoWatch API', version: '1.0.0', timestamp: new Date().toISOString() });
});

// Catch-all: serve frontend index for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌿 EcoWatch API running at http://localhost:${PORT}`);
  console.log(`   API docs: http://localhost:${PORT}/api/health\n`);
});

module.exports = app;
