function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/auth/login?error=Please log in first');
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.userId && req.session.userRole === 'admin') {
    return next();
  }
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  res.status(403).render('error', {
    user: req.session.user || null,
    title: 'Access Denied',
    message: 'You do not have permission to access this page.'
  });
}

function setUser(req, res, next) {
  if (req.session.userId) {
    const { getDb } = require('../database/db');
    const db = getDb();
    const user = db.prepare(
      'SELECT id, username, email, display_name, role, is_banned, created_at FROM users WHERE id = ?'
    ).get(req.session.userId);
    req.user = user || null;
    res.locals.user = user || null;
  } else {
    req.user = null;
    res.locals.user = null;
  }
  next();
}

function checkBanned(req, res, next) {
  if (req.user && req.user.is_banned) {
    req.session.destroy();
    return res.redirect('/auth/login?error=Your account has been suspended');
  }
  next();
}

module.exports = { requireAuth, requireAdmin, setUser, checkBanned };
