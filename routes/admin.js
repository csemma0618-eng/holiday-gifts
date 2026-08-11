const express = require('express');
const { getDb } = require('../database/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin role
router.use(requireAdmin);

// Dashboard
router.get('/dashboard', (req, res) => {
  const db = getDb();

  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const activeUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_banned = 0').get().count;
  const bannedUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_banned = 1').get().count;
  const totalGifts = db.prepare('SELECT COUNT(*) as count FROM gifts').get().count;
  const draftGifts = db.prepare('SELECT COUNT(*) as count FROM gifts WHERE is_draft = 1').get().count;
  const sentGifts = db.prepare('SELECT COUNT(*) as count FROM gift_deliveries').get().count;
  const totalDeliveries = db.prepare('SELECT COUNT(*) as count FROM gift_deliveries').get().count;
  const unreadDeliveries = db.prepare('SELECT COUNT(*) as count FROM gift_deliveries WHERE is_read = 0').get().count;

  const recentUsers = db.prepare(
    'SELECT * FROM users ORDER BY created_at DESC LIMIT 5'
  ).all();

  const recentGifts = db.prepare(`
    SELECT g.*, u.username as creator_name
    FROM gifts g JOIN users u ON g.creator_id = u.id
    ORDER BY g.created_at DESC LIMIT 5
  `).all();

  res.render('admin/dashboard', {
    title: 'Admin Dashboard',
    stats: {
      totalUsers, activeUsers, bannedUsers, totalGifts,
      draftGifts, sentGifts, totalDeliveries, unreadDeliveries
    },
    recentUsers,
    recentGifts
  });
});

// User management
router.get('/users', (req, res) => {
  const db = getDb();
  const search = (req.query.search || '').trim();

  let users;
  if (search) {
    users = db.prepare(`
      SELECT * FROM users
      WHERE username LIKE ? OR email LIKE ? OR display_name LIKE ?
      ORDER BY created_at DESC
    `).all(`%${search}%`, `%${search}%`, `%${search}%`);
  } else {
    users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  }

  users = users.map(u => {
    const giftCount = db.prepare('SELECT COUNT(*) as count FROM gifts WHERE creator_id = ?').get(u.id).count;
    const sentCount = db.prepare('SELECT COUNT(*) as count FROM gift_deliveries WHERE sender_id = ?').get(u.id).count;
    return { ...u, giftCount, sentCount };
  });

  res.render('admin/users', {
    title: 'Manage Users',
    users,
    search,
    success: req.query.success || null
  });
});

// Toggle ban
router.post('/users/:id/ban', (req, res) => {
  const db = getDb();
  const targetUser = db.prepare('SELECT * FROM users WHERE id = ? AND role != ?').get(req.params.id, 'admin');

  if (!targetUser) {
    return res.redirect('/admin/users?error=Cannot ban this user');
  }

  const newBanStatus = targetUser.is_banned ? 0 : 1;
  db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(newBanStatus, targetUser.id);

  res.redirect(303, '/admin/users?success=' + (newBanStatus ? 'User banned' : 'User unbanned'));
});

// Change role
router.post('/users/:id/role', (req, res) => {
  const db = getDb();
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    return res.redirect('/admin/users?error=Invalid role');
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ? AND role != ?').run(role, req.params.id, 'admin');

  res.redirect(303, '/admin/users?success=Role updated');
});

// Gift management
router.get('/gifts', (req, res) => {
  const db = getDb();
  const filter = req.query.filter || 'all';

  let gifts;
  const baseQuery = `
    SELECT g.*, u.username as creator_name
    FROM gifts g JOIN users u ON g.creator_id = u.id
  `;

  if (filter === 'drafts') {
    gifts = db.prepare(baseQuery + ' WHERE g.is_draft = 1 ORDER BY g.created_at DESC').all();
  } else if (filter === 'sent') {
    gifts = db.prepare(`
      SELECT DISTINCT g.*, u.username as creator_name
      FROM gifts g
      JOIN users u ON g.creator_id = u.id
      JOIN gift_deliveries gd ON g.id = gd.gift_id
      WHERE g.is_draft = 0
      ORDER BY g.created_at DESC
    `).all();
  } else {
    gifts = db.prepare(baseQuery + ' ORDER BY g.created_at DESC').all();
  }

  // Add delivery count
  gifts = gifts.map(g => {
    const deliveryCount = db.prepare(
      'SELECT COUNT(*) as count FROM gift_deliveries WHERE gift_id = ?'
    ).get(g.id).count;
    return { ...g, deliveryCount };
  });

  res.render('admin/gifts', {
    title: 'Manage Gifts',
    gifts,
    filter,
    success: req.query.success || null
  });
});

// Remove gift
router.post('/gifts/:id/remove', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM gifts WHERE id = ?').run(req.params.id);
  res.redirect(303, '/admin/gifts?success=Gift removed');
});

module.exports = router;
