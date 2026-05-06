'use strict';
// POST /api/checkout — body { email, lang } -> creates Mollie payment, returns checkoutUrl

const express = require('express');
const rateLimit = require('express-rate-limit');
const { db } = require('../lib/db');
const { createPayment, PRICE_CENTS, CURRENCY } = require('../lib/mollie');
const { event } = require('../lib/logger');

const router = express.Router();

const SUPPORTED_LANGS = ['nl', 'pl', 'en'];

function pickLang(lang) {
  const l = (lang || '').toString().toLowerCase().slice(0, 2);
  return SUPPORTED_LANGS.includes(l) ? l : 'en';
}

function isEmail(s) {
  if (typeof s !== 'string') return false;
  if (s.length > 200) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'rate_limited', message: 'Too many checkout attempts, try again in 15 minutes.' }
});

router.post('/checkout', limiter, async (req, res) => {
  try {
    const email = (req.body && req.body.email) ? String(req.body.email).trim().toLowerCase() : '';
    const lang = pickLang(req.body && req.body.lang);
    if (!isEmail(email)) {
      return res.status(400).json({ error: 'invalid_email' });
    }

    const now = Date.now();
    const baseUrl = process.env.BASE_URL || 'https://stopmetzoeken.store';
    const basePath = process.env.BASE_PATH || '/apps/optimizer';
    const returnUrl = `${baseUrl}${basePath}/api/return`;
    const webhookUrl = process.env.MOLLIE_WEBHOOK_URL || `${baseUrl}${basePath}/api/webhook`;

    // Upsert customer.
    let customer = db.prepare('SELECT id FROM customers WHERE email = ?').get(email);
    if (!customer) {
      const info = db.prepare('INSERT INTO customers (email, lang, created) VALUES (?, ?, ?)').run(email, lang, now);
      customer = { id: info.lastInsertRowid };
    } else {
      db.prepare('UPDATE customers SET lang = ? WHERE id = ?').run(lang, customer.id);
    }

    // Insert pending order.
    const orderInfo = db.prepare(
      'INSERT INTO orders (customer_id, amount_cents, currency, status, created, updated) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(customer.id, PRICE_CENTS, CURRENCY, 'pending', now, now);
    const orderId = orderInfo.lastInsertRowid;

    // Create Mollie payment. Mollie appends its own query string; for the dev stub
    // we let mollie.js build `returnUrl?id=<fakeId>&dev=1`.
    const payment = await createPayment({
      orderId,
      email,
      lang,
      returnUrl,
      webhookUrl
    });

    db.prepare(
      'UPDATE orders SET mollie_payment_id = ?, updated = ? WHERE id = ?'
    ).run(payment.id, Date.now(), orderId);

    db.prepare('UPDATE customers SET mollie_id = ? WHERE id = ?').run(payment.id, customer.id);

    event('checkout.created', { orderId, email, lang, mollie: payment.id, stub: !!payment._stub });

    return res.json({
      ok: true,
      orderId,
      checkoutUrl: payment.checkoutUrl,
      amount: payment.amount,
      currency: CURRENCY
    });
  } catch (e) {
    event('checkout.error', { msg: e.message });
    return res.status(500).json({ error: 'server_error', message: 'Could not create checkout. Please retry.' });
  }
});

module.exports = router;
