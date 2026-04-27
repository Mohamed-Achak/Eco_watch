// backend/routes/reports.js
// CRUD routes for wildlife & fire reports

const express = require('express');
const router = express.Router();
const { getDb, runQuery, runQueryOne, runUpdate } = require('../db/database');

// ─── HELPERS ──────────────────────────────────────────────────────────────────

async function generateCode(db) {
  const row = await runQueryOne(db, 'SELECT MAX(id) as max FROM reports');
  const next = (row?.max || 0) + 1;
  return 'RPT-' + String(next).padStart(4, '0');
}

async function checkDuplicate(db, lat, lon, type, windowMs = 600000) {
  // Check within 50m radius (~0.00045 deg) and 10 min window
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const rows = await runQuery(db, `
    SELECT id, report_code FROM reports
    WHERE type = ? AND created_at > ?
      AND ABS(latitude  - ?) < 0.0005
      AND ABS(longitude - ?) < 0.0005
  `, [type, cutoff, lat, lon]);
  return rows.length > 0 ? rows[0] : null;
}

// ─── GET ALL REPORTS ──────────────────────────────────────────────────────────
// GET /api/reports?type=fire&status=new&range=24h&lat=33.53&lon=-5.10&radius=5
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    let query = `
      SELECT r.*, u.username AS reporter_name
      FROM reports r
      LEFT JOIN users u ON r.reporter_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (req.query.type && req.query.type !== 'all') {
      query += ' AND r.type = ?'; params.push(req.query.type);
    }
    if (req.query.status && req.query.status !== 'all') {
      query += ' AND r.status = ?'; params.push(req.query.status);
    }
    if (req.query.severity && req.query.severity !== 'all') {
      query += ' AND r.severity = ?'; params.push(req.query.severity);
    }
    if (req.query.range === '24h') {
      query += ` AND r.created_at > datetime('now', '-1 day')`;
    } else if (req.query.range === '7d') {
      query += ` AND r.created_at > datetime('now', '-7 days')`;
    }

    // Filter by radius (km) from a lat/lon
    if (req.query.lat && req.query.lon && req.query.radius) {
      const lat = parseFloat(req.query.lat);
      const lon = parseFloat(req.query.lon);
      const deg = parseFloat(req.query.radius) / 111; // 1 deg ≈ 111km
      query += ' AND ABS(r.latitude - ?) < ? AND ABS(r.longitude - ?) < ?';
      params.push(lat, deg, lon, deg);
    }

    query += ' ORDER BY r.created_at DESC';

    const reports = await runQuery(db, query, params);
    res.json({ success: true, count: reports.length, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET SINGLE REPORT ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const db = getDb();
    const report = await runQueryOne(db, `
      SELECT r.*, u.username AS reporter_name, a.username AS verifier_name
      FROM reports r
      LEFT JOIN users u ON r.reporter_id = u.id
      LEFT JOIN users a ON r.verified_by  = a.id
      WHERE r.id = ? OR r.report_code = ?
    `, [req.params.id, req.params.id]);

    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── CREATE REPORT ────────────────────────────────────────────────────────────
// POST /api/reports
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const { type, description, latitude, longitude, severity, species, image_url, reporter_id } = req.body;

    // Validation
    if (!type || !['fire','wildlife'].includes(type))
      return res.status(400).json({ success: false, error: 'Invalid type. Must be fire or wildlife.' });
    if (!description || description.trim().length < 5)
      return res.status(400).json({ success: false, error: 'Description too short (min 5 chars).' });
    if (latitude == null || longitude == null)
      return res.status(400).json({ success: false, error: 'Latitude and longitude are required.' });
    if (type === 'fire' && !severity)
      return res.status(400).json({ success: false, error: 'Severity required for fire reports.' });

    // Duplicate check (FR-11)
    const dup = await checkDuplicate(db, latitude, longitude, type);
    if (dup) {
      return res.status(409).json({
        success: false,
        error: `Duplicate report detected. Similar ${type} report ${dup.report_code} already exists within 50m and 10 minutes.`,
        duplicate_id: dup.report_code,
      });
    }

    const code = await generateCode(db);
    const result = await runUpdate(db, `
      INSERT INTO reports (report_code, type, description, latitude, longitude, severity, species, image_url, reporter_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [code, type, description.trim(), latitude, longitude, severity || null, species || null, image_url || null, reporter_id || null]);

    const newReport = await runQueryOne(db, 'SELECT * FROM reports WHERE id = ?', [result.lastID]);

    // Auto-alert for high severity fires (FR-06, FR-09)
    if (type === 'fire' && severity === 'high') {
      await runUpdate(db, `
        INSERT INTO alerts (report_id, message)
        VALUES (?, ?)
      `, [result.lastID, `HIGH SEVERITY fire reported: "${description.trim()}" at (${latitude}, ${longitude}). Immediate response required.`]);
    }

    res.status(201).json({ success: true, data: newReport, message: 'Report submitted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── UPDATE REPORT STATUS ─────────────────────────────────────────────────────
// PATCH /api/reports/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const db = getDb();
    const { status, status_comment, verified_by } = req.body;

    if (!['new','verified','false','resolved'].includes(status))
      return res.status(400).json({ success: false, error: 'Invalid status.' });

    const report = await runQueryOne(db, 'SELECT * FROM reports WHERE id = ? OR report_code = ?', [req.params.id, req.params.id]);
    if (!report) return res.status(404).json({ success: false, error: 'Report not found.' });

    const verifiedAt = ['verified','resolved'].includes(status) ? new Date().toISOString() : null;

    await runUpdate(db, `
      UPDATE reports
      SET status = ?, status_comment = ?, verified_by = ?,
          verified_at = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [status, status_comment || null, verified_by || null, verifiedAt, report.id]);

    const updated = await runQueryOne(db, 'SELECT * FROM reports WHERE id = ?', [report.id]);
    res.json({ success: true, data: updated, message: `Report marked as ${status}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE REPORT (admin only) ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await runUpdate(db, 'DELETE FROM reports WHERE id = ? OR report_code = ?', [req.params.id, req.params.id]);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Report not found.' });
    res.json({ success: true, message: 'Report deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── STATS ────────────────────────────────────────────────────────────────────
router.get('/meta/stats', async (req, res) => {
  try {
    const db = getDb();
    const total      = (await runQueryOne(db, 'SELECT COUNT(*) as n FROM reports'))?.n || 0;
    const fire       = (await runQueryOne(db, "SELECT COUNT(*) as n FROM reports WHERE type='fire'"))?.n || 0;
    const wildlife   = (await runQueryOne(db, "SELECT COUNT(*) as n FROM reports WHERE type='wildlife'"))?.n || 0;
    const high       = (await runQueryOne(db, "SELECT COUNT(*) as n FROM reports WHERE severity='high' AND status!='resolved'"))?.n || 0;
    const pending    = (await runQueryOne(db, "SELECT COUNT(*) as n FROM reports WHERE status='new'"))?.n || 0;
    const verified   = (await runQueryOne(db, "SELECT COUNT(*) as n FROM reports WHERE status='verified'"))?.n || 0;
    const resolved   = (await runQueryOne(db, "SELECT COUNT(*) as n FROM reports WHERE status='resolved'"))?.n || 0;
    const today      = (await runQueryOne(db, "SELECT COUNT(*) as n FROM reports WHERE created_at > datetime('now','-1 day')"))?.n || 0;
    res.json({ success: true, data: { total, fire, wildlife, high, pending, verified, resolved, today } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
