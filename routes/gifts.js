const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET create gift editor
router.get('/create', requireAuth, (req, res) => {
  res.render('editor', {
    title: 'Create Gift',
    gift: null,
    mode: 'create',
    giftId: null
  });
});

// POST create/save gift
router.post('/create', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const { title, theme, canvas_json, thumbnail, action } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Gift title is required.' });
    }

    const id = uuidv4();
    const isDraft = action === 'save_draft' ? 1 : 0;
    // Truncate thumbnail if present to avoid oversized payload issues
    const thumb = thumbnail && thumbnail.length > 200000 ? '' : (thumbnail || '');

    db.prepare(`
      INSERT INTO gifts (id, creator_id, title, theme, canvas_json, thumbnail, is_draft, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(id, req.user.id, title.trim(), theme || 'general', canvas_json || '{}', thumb, isDraft);

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ success: true, id, is_draft: isDraft });
    }

    res.redirect(303, '/dashboard?success=' + (isDraft ? 'Draft saved' : 'Gift created'));
  } catch (err) {
    console.error('Create gift error:', err.message);
    res.status(500).json({ error: 'Save failed: ' + err.message });
  }
});

// GET edit gift
router.get('/:id/edit', requireAuth, (req, res) => {
  const db = getDb();
  const gift = db.prepare('SELECT * FROM gifts WHERE id = ?').get(req.params.id);

  if (!gift) {
    return res.redirect('/dashboard?error=Gift not found');
  }
  if (gift.creator_id !== req.user.id) {
    return res.redirect('/dashboard?error=You can only edit your own gifts');
  }
  if (!gift.is_draft) {
    return res.redirect('/dashboard?error=Cannot edit a sent gift');
  }

  res.render('editor', {
    title: 'Edit Gift',
    gift,
    mode: 'edit',
    giftId: gift.id
  });
});

// POST update gift
router.post('/:id/edit', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const gift = db.prepare('SELECT * FROM gifts WHERE id = ?').get(req.params.id);

    if (!gift || gift.creator_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { title, theme, canvas_json, thumbnail, action } = req.body;
    const thumb = thumbnail && thumbnail.length > 200000 ? '' : (thumbnail || gift.thumbnail);

    db.prepare(`
      UPDATE gifts SET title = ?, theme = ?, canvas_json = ?, thumbnail = ?, is_draft = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      title || gift.title,
      theme || gift.theme,
      canvas_json || gift.canvas_json,
      thumb,
      action === 'save_draft' ? 1 : 0,
      gift.id
    );

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ success: true, id: gift.id });
    }

    res.redirect(303, '/dashboard?success=Gift saved');
  } catch (err) {
    console.error('Update gift error:', err.message);
    res.status(500).json({ error: 'Save failed: ' + err.message });
  }
});

// POST send gift
router.post('/:id/send', requireAuth, (req, res) => {
  const db = getDb();
  const { recipient_id, message } = req.body;

  const gift = db.prepare('SELECT * FROM gifts WHERE id = ?').get(req.params.id);
  if (!gift || gift.creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (!recipient_id || !recipient_id.trim()) {
    return res.status(400).json({ error: 'Please specify a recipient.' });
  }

  const recipient = db.prepare(
    'SELECT id FROM users WHERE (id = ? OR username = ?) AND is_banned = 0 AND id != ?'
  ).get(recipient_id.trim(), recipient_id.trim(), req.user.id);

  if (!recipient) {
    return res.status(400).json({ error: 'Recipient not found. Check the user ID or username.' });
  }

  // Mark gift as not draft
  db.prepare('UPDATE gifts SET is_draft = 0, updated_at = datetime(\'now\') WHERE id = ?').run(gift.id);

  // Create delivery
  const deliveryId = uuidv4();
  db.prepare(`
    INSERT INTO gift_deliveries (id, gift_id, sender_id, recipient_id, message)
    VALUES (?, ?, ?, ?, ?)
  `).run(deliveryId, gift.id, req.user.id, recipient.id, message || '');

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true, message: 'Gift sent!' });
  }

  res.redirect(303, '/gifts/sent?success=Gift sent successfully');
});

// GET sent gifts
router.get('/sent', requireAuth, (req, res) => {
  const db = getDb();
  const deliveries = db.prepare(`
    SELECT gd.*, g.title, g.thumbnail, g.theme, u.username as recipient_name, u.display_name as recipient_display
    FROM gift_deliveries gd
    JOIN gifts g ON gd.gift_id = g.id
    JOIN users u ON gd.recipient_id = u.id
    WHERE gd.sender_id = ?
    ORDER BY gd.sent_at DESC
  `).all(req.user.id);

  res.render('gifts/sent', {
    title: 'Sent Gifts',
    deliveries,
    success: req.query.success || null
  });
});

// GET received gifts
router.get('/received', requireAuth, (req, res) => {
  const db = getDb();
  const deliveries = db.prepare(`
    SELECT gd.*, g.title, g.thumbnail, g.theme, u.username as sender_name, u.display_name as sender_display
    FROM gift_deliveries gd
    JOIN gifts g ON gd.gift_id = g.id
    JOIN users u ON gd.sender_id = u.id
    WHERE gd.recipient_id = ?
    ORDER BY gd.sent_at DESC
  `).all(req.user.id);

  res.render('gifts/received', {
    title: 'Received Gifts',
    deliveries,
    success: req.query.success || null
  });
});

// GET view gift
router.get('/:id/view', requireAuth, (req, res) => {
  const db = getDb();

  const delivery = db.prepare(`
    SELECT gd.*, g.title, g.canvas_json, g.theme, g.thumbnail,
           u.username as sender_name, u.display_name as sender_display
    FROM gift_deliveries gd
    JOIN gifts g ON gd.gift_id = g.id
    JOIN users u ON gd.sender_id = u.id
    WHERE gd.id = ? AND (gd.recipient_id = ? OR gd.sender_id = ?)
  `).get(req.params.id, req.user.id, req.user.id);

  if (!delivery) {
    // Try to find as a gift the user sent but delivery doesn't match
    const gift = db.prepare('SELECT * FROM gifts WHERE id = ?').get(req.params.id);
    if (gift) {
      // Check if user is creator or recipient in any delivery
      const anyDelivery = db.prepare(`
        SELECT gd.*, u.username as sender_name, u.display_name as sender_display
        FROM gift_deliveries gd
        JOIN users u ON gd.sender_id = u.id
        WHERE gd.gift_id = ? AND (gd.recipient_id = ? OR gd.sender_id = ?)
      `).get(gift.id, req.user.id, req.user.id);

      if (!anyDelivery && gift.creator_id !== req.user.id) {
        return res.redirect('/dashboard?error=Gift not found');
      }

      if (anyDelivery) {
        return res.render('gifts/view', {
          title: `Gift: ${gift.title}`,
          delivery: { ...anyDelivery, title: gift.title, canvas_json: gift.canvas_json, theme: gift.theme, thumbnail: gift.thumbnail },
          gift: gift,
          isOwner: gift.creator_id === req.user.id
        });
      }
    }
    return res.redirect('/dashboard?error=Gift not found');
  }

  // Mark as read if recipient is viewing
  if (delivery.recipient_id === req.user.id && !delivery.is_read) {
    db.prepare('UPDATE gift_deliveries SET is_read = 1 WHERE id = ?').run(delivery.id);
  }

  res.render('gifts/view', {
    title: `Gift: ${delivery.title}`,
    delivery,
    gift: null,
    isOwner: false
  });
});

// POST delete draft
router.post('/:id/delete', requireAuth, (req, res) => {
  const db = getDb();
  const gift = db.prepare('SELECT * FROM gifts WHERE id = ?').get(req.params.id);

  if (!gift || gift.creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (!gift.is_draft) {
    return res.status(400).json({ error: 'Cannot delete a sent gift' });
  }

  db.prepare('DELETE FROM gifts WHERE id = ?').run(gift.id);

  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true });
  }

  res.redirect(303, '/dashboard?success=Draft deleted');
});

module.exports = router;
