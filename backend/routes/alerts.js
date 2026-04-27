// backend/routes/alerts.js
const express = require('express');
const router = express.Router();
const { getDb, runQuery, runUpdate } = require('../db/database');

// GET all alerts
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const alerts = await runQuery(db, `
      SELECT a.*, r.report_code, r.type, r.description, r.latitude, r.longitude
      FROM alerts a
      JOIN reports r ON a.report_id = r.id
      ORDER BY a.sent_at DESC
    `);
    res.json({ success: true, data: alerts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH acknowledge alert
router.patch('/:id/acknowledge', async (req, res) => {
  try {
    const db = getDb();
    await runUpdate(db, 'UPDATE alerts SET acknowledged = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Alert acknowledged.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
