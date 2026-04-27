-- ============================================================
-- EcoWatch Database Schema
-- Wildlife & Forest Fire Monitoring System - Ifrane, Morocco
-- ============================================================

PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

-- ─── USERS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    email       TEXT    NOT NULL UNIQUE,
    password    TEXT    NOT NULL,          -- bcrypt hash
    role        TEXT    NOT NULL DEFAULT 'civilian'
                        CHECK(role IN ('civilian','authority','admin','agency')),
    created_at  DATETIME DEFAULT (datetime('now')),
    updated_at  DATETIME DEFAULT (datetime('now'))
);

-- ─── REPORTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
    id              INTEGER  PRIMARY KEY AUTOINCREMENT,
    report_code     TEXT     NOT NULL UNIQUE,          -- RPT-0001 etc.
    type            TEXT     NOT NULL CHECK(type IN ('fire','wildlife')),
    description     TEXT     NOT NULL,
    latitude        REAL     NOT NULL,
    longitude       REAL     NOT NULL,
    severity        TEXT     CHECK(severity IN ('low','medium','high')),
    species         TEXT,                              -- wildlife only
    image_url       TEXT,
    status          TEXT     NOT NULL DEFAULT 'new'
                             CHECK(status IN ('new','verified','false','resolved')),
    status_comment  TEXT,
    reporter_id     INTEGER  REFERENCES users(id) ON DELETE SET NULL,
    verified_by     INTEGER  REFERENCES users(id) ON DELETE SET NULL,
    verified_at     DATETIME,
    created_at      DATETIME DEFAULT (datetime('now')),
    updated_at      DATETIME DEFAULT (datetime('now'))
);

-- ─── ALERTS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id   INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    message     TEXT    NOT NULL,
    sent_at     DATETIME DEFAULT (datetime('now')),
    acknowledged INTEGER DEFAULT 0
);

-- ─── MAP LABELS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS map_labels (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    category    TEXT    NOT NULL CHECK(category IN ('city','forest','lake','road','landmark','zone')),
    latitude    REAL    NOT NULL,
    longitude   REAL    NOT NULL,
    description TEXT,
    icon        TEXT    DEFAULT '📍',
    created_at  DATETIME DEFAULT (datetime('now'))
);

-- ─── INDEXES ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_reports_type     ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_status   ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_severity ON reports(severity);
CREATE INDEX IF NOT EXISTS idx_reports_created  ON reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_location ON reports(latitude, longitude);

-- ─── SEED: USERS ──────────────────────────────────────────────
INSERT OR IGNORE INTO users (username, email, password, role) VALUES
    ('civilian1',  'civilian@ecowatch.ma',  '$2b$10$hashed_pw_1', 'civilian'),
    ('authority1', 'authority@ecowatch.ma', '$2b$10$hashed_pw_2', 'authority'),
    ('admin1',     'admin@ecowatch.ma',     '$2b$10$hashed_pw_3', 'admin'),
    ('agency1',    'agency@ecowatch.ma',    '$2b$10$hashed_pw_4', 'agency');

-- ─── SEED: MAP LABELS (Ifrane, Morocco) ──────────────────────
INSERT OR IGNORE INTO map_labels (name, category, latitude, longitude, description, icon) VALUES
    ('Ifrane City Centre',       'city',     33.5333, -5.1067, 'Main urban area of Ifrane',                    '🏙'),
    ('Lac Ifrane',               'lake',     33.5270, -5.1050, 'Natural lake near the city',                   '💧'),
    ('Cèdre Gouraud Forest',     'forest',   33.4800, -5.2000, 'Ancient Cedar forest reserve',                 '🌲'),
    ('Jbel Hebri',               'landmark', 33.5100, -5.0500, 'Mountain peak east of Ifrane',                 '⛰'),
    ('National Park Entry',      'landmark', 33.5500, -5.0800, 'Ifrane National Park main gate',               '🏕'),
    ('Hôpital Ifrane',           'landmark', 33.5340, -5.1020, 'Regional hospital',                            '🏥'),
    ('Avenue Mohammed V',        'road',     33.5300, -5.1100, 'Main boulevard through the city',              '🛣'),
    ('N8 Highway Junction',      'road',     33.5450, -5.0750, 'National road N8 junction',                    '🛣'),
    ('Ain Vittel Spring',        'landmark', 33.5200, -5.1300, 'Natural spring used by locals',                '♨️'),
    ('Zone Rouge Forêt Nord',    'zone',     33.5600, -5.0900, 'High fire-risk northern forest zone',          '🚫'),
    ('Zone Faune Protégée',      'zone',     33.5100, -5.1400, 'Protected wildlife corridor',                  '🦌'),
    ('Al Akhawayn University',   'landmark', 33.5230, -5.1060, 'University campus in Ifrane',                  '🎓'),
    ('Ifrane Municipality',      'landmark', 33.5350, -5.1080, 'Local government offices',                     '🏛'),
    ('Oued Tizguit',             'lake',     33.5150, -5.1200, 'River running south of Ifrane',                '🌊'),
    ('Camping Les Cèdres',       'landmark', 33.4950, -5.1500, 'Popular forest campsite',                      '⛺');

-- Reports and alerts intentionally start empty.
-- New incident data is created only when users submit reports.
