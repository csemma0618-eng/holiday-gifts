const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

const router = express.Router();

// GET login page
router.get('/login', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('login', {
    title: 'Login',
    error: req.query.error || null,
    success: req.query.success || null
  });
});

// POST login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.render('login', { title: 'Login', error: 'Please enter username and password.', success: null });
  }

  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());

  if (!user) {
    return res.render('login', { title: 'Login', error: 'Invalid username or password.', success: null });
  }

  if (user.is_banned) {
    return res.render('login', { title: 'Login', error: 'This account has been suspended.', success: null });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.render('login', { title: 'Login', error: 'Invalid username or password.', success: null });
  }

  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.save(() => res.redirect(303, '/dashboard'));
});

// GET register page
router.get('/register', (req, res) => {
  if (req.user) return res.redirect('/dashboard');
  res.render('register', { title: 'Create Account', error: null });
});

// POST register
router.post('/register', (req, res) => {
  const { username, email, password, confirm_password } = req.body;

  // Validation
  const errors = [];
  if (!username || username.trim().length < 3) errors.push('Username must be at least 3 characters.');
  if (!email || !email.includes('@')) errors.push('Please enter a valid email address.');
  if (!password || password.length < 6) errors.push('Password must be at least 6 characters.');
  if (password !== confirm_password) errors.push('Passwords do not match.');

  if (errors.length > 0) {
    return res.render('register', { title: 'Create Account', error: errors.join(' ') });
  }

  const db = getDb();

  const existingUser = db.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?'
  ).get(username.trim(), email.trim().toLowerCase());

  if (existingUser) {
    return res.render('register', {
      title: 'Create Account',
      error: 'Username or email is already taken.'
    });
  }

  const id = uuidv4();
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, display_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, username.trim(), email.trim().toLowerCase(), passwordHash, username.trim());

  req.session.userId = id;
  req.session.userRole = 'user';
  req.session.save(() => res.redirect(303, '/dashboard'));
});

// GET logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

module.exports = router;
