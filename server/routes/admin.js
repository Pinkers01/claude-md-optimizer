'use strict';
// GET /api/stats — HMAC-protected basic counters for master admin and Pinky.
// Auth header: X-Pinky-Auth: <hex hmac of "stats" with STATS_HMAC_SECRET>
//   curl -H "X-Pinky-Auth: $(node -e 'console.log(require("crypto").createHmac("sha256",process.env.STATS_HMAC_SECRET).update("stats").digest("hex"))')" \
//        https://stopmetzoeken.store/apps/optimizer/api/stats

const express = require('express');
const crypto = require('crypto');
const { db } = require('../lib/db');

const router = express.Router();

function authOk(req) {
  const secret = process.env.STATS_HMAC_SECRET;
  if (!secret) return false;
  const provided = req.headers['x-pinky-auth'];
  if (!provided || typeof provided !== 'string') return false;
  const expected = crypto.createHmac('sha256', secret).update('stats').digest('hex');
  if (provided.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, 'hex'), Buffer.from(expected, 'hex'));
  } catch (_) {
    return false;
  }
}

router.get('/stats', (req, res) => {
  if (!authOk(req)) return res.status(401).json({ error: 'unauthorized' });

  const ordersCount = db.prepare("SELECT COUNT(*) as n FROM orders WHERE status = 'paid'").get().n;
  const revenue = db.prepare("SELECT COALESCE(SUM(amount_cents),0) as total FROM orders WHERE status = 'paid'").get().total;
  const since = Date.now() - 86400 * 1000;
  const downloadsToday = db.prepare('SELECT COUNT(*) as n FROM downloads WHERE downloaded_at >= ?').get(since).n;
  const downloadsTotal = db.prepare('SELECT COUNT(*) as n FROM downloads').get().n;
  const customers = db.prepare('SELECT COUNT(*) as n FROM customers').get().n;
  const pending = db.prepare("SELECT COUNT(*) as n FROM orders WHERE status = 'pending'").get().n;

  res.json({
    orders_count: ordersCount,
    revenue_cents: revenue,
    revenue_eur: (revenue / 100).toFixed(2),
    downloads_today: downloadsToday,
    downloads_total: downloadsTotal,
    customers_count: customers,
    pending_count: pending,
    now: Date.now()
  });
});

module.exports = router;
