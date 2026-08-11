const { getDb } = require('./db');

function initDatabase() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
      is_banned INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gifts (
      id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      theme TEXT DEFAULT 'general',
      canvas_json TEXT DEFAULT '{}',
      thumbnail TEXT DEFAULT '',
      is_draft INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS gift_deliveries (
      id TEXT PRIMARY KEY,
      gift_id TEXT NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      sent_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_gifts_creator ON gifts(creator_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_sender ON gift_deliveries(sender_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_recipient ON gift_deliveries(recipient_id);
    CREATE INDEX IF NOT EXISTS idx_deliveries_gift ON gift_deliveries(gift_id);
  `);

  // Seed admin user if none exists (password: admin123)
  const { v4: uuidv4 } = require('uuid');
  const bcrypt = require('bcryptjs');
  const adminExists = db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(
      'INSERT OR IGNORE INTO users (id, username, email, password_hash, display_name, role) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), 'admin', 'admin@holidaygifts.local', hash, 'Administrator', 'admin');
    console.log('✓ Admin user seeded (username: admin, password: admin123)');
  }

  console.log('✓ Database initialized');
}

module.exports = { initDatabase };
