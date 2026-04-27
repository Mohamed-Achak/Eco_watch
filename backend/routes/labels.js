// backend/routes/labels.js
const express = require('express');
const router = express.Router();
const { getDb, runQuery, runQueryOne, runUpdate } = require('../db/database');

// GET all map labels
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const q = req.query.category
      ? await runQuery(db, 'SELECT * FROM map_labels WHERE category = ? ORDER BY name', [req.query.category])
      : await runQuery(db, 'SELECT * FROM map_labels ORDER BY category, name');
    res.json({ success: true, data: q });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST create label
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const { name, category, latitude, longitude, description, icon } = req.body;
    if (!name || !category || latitude == null || longitude == null)
      return res.status(400).json({ success: false, error: 'name, category, latitude, longitude are required.' });

    const result = await runUpdate(db, `
      INSERT INTO map_labels (name, category, latitude, longitude, description, icon)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [name, category, latitude, longitude, description || null, icon || '📍']);

    const label = await runQueryOne(db, 'SELECT * FROM map_labels WHERE id = ?', [result.lastID]);
    res.status(201).json({ success: true, data: label });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE label
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const result = await runUpdate(db, 'DELETE FROM map_labels WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ success: false, error: 'Label not found.' });
    res.json({ success: true, message: 'Label deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
