const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDatabase } = require('./database/schema');
const { setUser, checkBanned, requireAuth } = require('./middleware/auth');
const { getDb } = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Crash protection — log errors but don't die
process.on('uncaughtException', (err) => { console.error('UNCAUGHT:', err.message); });
process.on('unhandledRejection', (err) => { console.error('UNHANDLED:', err.message); });

// Database
initDatabase();

// Session store
const SqliteStore = require('better-sqlite3-session-store')(session);

// Middleware
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Log JSON parse errors
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large' || err.type === 'entity.parse.failed') {
    console.error('Body parse error:', err.message);
    return res.status(400).json({ error: 'Request too large or invalid JSON. Try reducing canvas data.' });
  }
  next(err);
});

app.use(session({
  store: new SqliteStore({
    client: getDb(),
    expired: { clear: true, intervalMs: 900000 }
  }),
  secret: process.env.SESSION_SECRET || 'holiday-gifts-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    sameSite: 'lax'
  }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Global middleware
app.use(setUser);
app.use(checkBanned);

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));

// Delete sent gift delivery record
app.post('/delivery-delete', requireAuth, (req, res) => {
  const db = getDb();
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Missing delivery ID' });
  const delivery = db.prepare(
    'SELECT * FROM gift_deliveries WHERE id = ? AND sender_id = ?'
  ).get(id, req.user.id);
  if (!delivery) return res.status(403).json({ error: 'Not authorized or not found' });
  db.prepare('DELETE FROM gift_deliveries WHERE id = ?').run(delivery.id);
  res.json({ success: true });
});

app.use('/gifts', require('./routes/gifts'));
app.use('/admin', require('./routes/admin'));

// Home page
app.get('/', (req, res) => {
  res.render('index', { title: 'Holiday Gifts' });
});

// Dashboard
app.get('/dashboard', (req, res) => {
  if (!req.user) return res.redirect('/auth/login');
  const db = getDb();

  const draftCount = db.prepare(
    'SELECT COUNT(*) as count FROM gifts WHERE creator_id = ? AND is_draft = 1'
  ).get(req.user.id).count;

  const sentCount = db.prepare(
    'SELECT COUNT(*) as count FROM gift_deliveries WHERE sender_id = ?'
  ).get(req.user.id).count;

  const receivedCount = db.prepare(
    'SELECT COUNT(*) as count FROM gift_deliveries WHERE recipient_id = ?'
  ).get(req.user.id).count;

  const unreadCount = db.prepare(
    'SELECT COUNT(*) as count FROM gift_deliveries WHERE recipient_id = ? AND is_read = 0'
  ).get(req.user.id).count;

  const recentDrafts = db.prepare(
    'SELECT * FROM gifts WHERE creator_id = ? AND is_draft = 1 ORDER BY updated_at DESC LIMIT 3'
  ).all(req.user.id);

  const recentReceived = db.prepare(`
    SELECT gd.*, g.title, g.thumbnail, g.theme, u.username as sender_name
    FROM gift_deliveries gd
    JOIN gifts g ON gd.gift_id = g.id
    JOIN users u ON gd.sender_id = u.id
    WHERE gd.recipient_id = ?
    ORDER BY gd.sent_at DESC LIMIT 3
  `).all(req.user.id);

  res.render('dashboard', {
    title: 'Dashboard',
    draftCount,
    sentCount,
    receivedCount,
    unreadCount,
    recentDrafts,
    recentReceived
  });
});

// Error page
app.get('/error', (req, res) => {
  res.render('error', {
    title: 'Error',
    message: req.query.message || 'Something went wrong.'
  });
});

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Not Found',
    message: 'The page you are looking for does not exist.'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Server Error',
    message: 'An unexpected error occurred. Please try again later.'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  console.log(`\n🎄 Holiday Gifts platform running at:\n`);
  console.log(`  Local:    http://localhost:${PORT}`);
  // Show network addresses for sharing
  Object.values(ifaces).forEach(iface => {
    iface.forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) {
        console.log(`  Network:  http://${addr.address}:${PORT}`);
      }
    });
  });
  console.log('');
});
