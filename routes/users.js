const express = require('express');
const { getDb } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// View own profile
router.get('/me', requireAuth, (req, res) => {
  res.render('profile', {
    title: 'My Profile',
    success: req.query.success || null,
    error: null
  });
});

// Update profile
router.post('/me', requireAuth, (req, res) => {
  const { display_name, bio, email } = req.body;
  const db = getDb();

  const newEmail = email ? email.trim().toLowerCase() : req.user.email;

  // Check email uniqueness if changed
  if (newEmail !== req.user.email) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(newEmail, req.user.id);
    if (existing) {
      return res.render('profile', {
        title: 'My Profile',
        success: null,
        error: 'Email is already in use by another account.'
      });
    }
  }

  db.prepare('UPDATE users SET display_name = ?, bio = ?, email = ? WHERE id = ?')
    .run(display_name || req.user.display_name, bio || '', newEmail, req.user.id);

  res.redirect(303, '/users/me?success=Profile updated');
});

// Search users (JSON API for gift sending)
router.get('/search', requireAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  const db = getDb();

  if (!q) return res.json([]);

  const users = db.prepare(`
    SELECT id, username, display_name
    FROM users
    WHERE (username LIKE ? OR display_name LIKE ? OR id LIKE ?)
      AND id != ?
      AND is_banned = 0
    LIMIT 10
  `).all(`%${q}%`, `%${q}%`, `%${q}%`, req.user.id);

  res.json(users);
});

// View user profile by ID
router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const profileUser = db.prepare(
    'SELECT id, username, display_name, bio, created_at FROM users WHERE id = ? AND is_banned = 0'
  ).get(req.params.id);

  if (!profileUser) {
    return res.redirect('/dashboard?error=User not found');
  }

  res.render('profile-view', {
    title: `${profileUser.display_name || profileUser.username}'s Profile`,
    profileUser
  });
});

module.exports = router;
