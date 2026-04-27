// backend/db/database.js
// SQLite database initialization using sqlite3

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'ecowatch.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) console.error('Database connection error:', err);
    });
    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');
  }
  return db;
}

function initDb() {
  return new Promise((resolve, reject) => {
    const database = getDb();
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
    const statements = schema.split(';').filter(s => s.trim().length > 0);
    
    database.serialize(() => {
      statements.forEach(stmt => {
        database.run(stmt + ';', (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('Schema error:', err.message.substring(0, 100));
          }
        });
      });
      console.log('✅ Database initialised at', DB_PATH);
      resolve(database);
    });
  });
}

// Helper: Run a query and get all rows
function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// Helper: Run a query and get first row
function runQueryOne(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

// Helper: Run an insert/update/delete
function runUpdate(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

module.exports = { getDb, initDb, runQuery, runQueryOne, runUpdate };
