// backend/routes/users.js
const express = require('express');
const router = express.Router();
const { getDb, runQuery, runQueryOne, runUpdate } = require('../db/database');

// GET all users (admin)
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const users = await runQuery(db, 'SELECT id, username, email, role, created_at FROM users ORDER BY id');
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST login (simplified - no JWT for demo, just validates role)
router.post('/login', async (req, res) => {
  try {
    const db = getDb();
    const { username } = req.body;
    const user = await runQueryOne(db, 'SELECT id, username, email, role FROM users WHERE username = ?', [username]);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH update user role (admin)
router.patch('/:id/role', async (req, res) => {
  try {
    const db = getDb();
    const { role } = req.body;
    if (!['civilian','authority','admin','agency'].includes(role))
      return res.status(400).json({ success: false, error: 'Invalid role.' });
    await runUpdate(db, "UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?", [role, req.params.id]);
    res.json({ success: true, message: `User role updated to ${role}.` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
