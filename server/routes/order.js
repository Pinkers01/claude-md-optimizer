'use strict';
// POST /api/order  -> creates a pending manual-payment order, ingests to master
// admin, returns instructions URL the landing redirects to.
// GET  /api/order/:ref -> instructions page (Revolut + IBAN payment details).
// POST /api/manual-confirm -> master admin callback after Pinky confirms payment.
//   Verifies HMAC, generates license, emails customer, returns license + status.

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { db } = require('../lib/db');
const { event } = require('../lib/logger');
const { generateLicense } = require('../lib/license');
const { sendLicenseEmail } = require('../lib/mailer');
const { ingestOrder, verifyMasterCallback } = require('../lib/master-ingest');

const PRODUCT_PRICE_CENTS = parseInt(process.env.PRODUCT_PRICE_CENTS || '900', 10);
const PRODUCT_CURRENCY = process.env.PRODUCT_CURRENCY || 'EUR';
const PRODUCT_SKU = 'opt-pro-1y';
const BASE_URL = process.env.BASE_URL || 'https://stopmetzoeken.store';
const BASE_PATH = (process.env.BASE_PATH || '/apps/optimizer').replace(/\/$/, '');

const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Ensure local mirror table for orders (so server can resolve license by ref).
db.exec(`
  CREATE TABLE IF NOT EXISTS local_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ref TEXT UNIQUE,
    customer_email TEXT NOT NULL,
    customer_lang TEXT,
    payment_method TEXT,
    amount_cents INTEGER,
    status TEXT DEFAULT 'pending',
    license_key TEXT,
    master_ingest_ok INTEGER DEFAULT 0,
    master_ingest_response TEXT,
    confirmed_at INTEGER,
    email_sent INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE INDEX IF NOT EXISTS idx_local_orders_ref ON local_orders(ref);
  CREATE INDEX IF NOT EXISTS idx_local_orders_email ON local_orders(customer_email);
`);

function isValidEmail(e) {
  return typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && e.length < 200;
}
function isValidLang(l) {
  return ['nl', 'pl', 'en'].includes(String(l || '').toLowerCase());
}
function isValidMethod(m) {
  return ['revolut', 'iban'].includes(String(m || '').toLowerCase());
}

router.post('/order', orderLimiter, async (req, res) => {
  const { email, lang, payment_method } = req.body || {};
  if (!isValidEmail(email)) return res.status(400).json({ error: 'invalid_email' });
  if (!isValidLang(lang)) return res.status(400).json({ error: 'invalid_lang' });
  const method = (payment_method || 'revolut').toLowerCase();
  if (!isValidMethod(method)) return res.status(400).json({ error: 'invalid_method' });

  const insert = db.prepare(`
    INSERT INTO local_orders (customer_email, customer_lang, payment_method, amount_cents)
    VALUES (?, ?, ?, ?)
  `);
  const info = insert.run(email, lang, method, PRODUCT_PRICE_CENTS);
  const localId = info.lastInsertRowid;
  const ref = `OPT-${String(localId).padStart(4, '0')}`;
  db.prepare('UPDATE local_orders SET ref = ? WHERE id = ?').run(ref, localId);

  let ingestResult = { ok: false, skipped: 'no_secret' };
  try {
    ingestResult = await ingestOrder({
      customer_email: email,
      customer_lang: lang,
      product_sku: PRODUCT_SKU,
      amount_cents: PRODUCT_PRICE_CENTS,
      currency: PRODUCT_CURRENCY,
      payment_method: method,
    });
  } catch (e) {
    ingestResult = { ok: false, error: e.message };
  }
  db.prepare('UPDATE local_orders SET master_ingest_ok = ?, master_ingest_response = ? WHERE id = ?')
    .run(ingestResult.ok ? 1 : 0, JSON.stringify(ingestResult).slice(0, 500), localId);

  event('order_created', { ref, email, method, master_ok: ingestResult.ok });

  res.json({
    ok: true,
    ref,
    instructions_url: `${BASE_PATH}/payment.html?ref=${encodeURIComponent(ref)}&method=${method}&lang=${lang}`,
    amount_cents: PRODUCT_PRICE_CENTS,
    currency: PRODUCT_CURRENCY,
  });
});

router.post('/manual-confirm', express.json(), async (req, res) => {
  const sig = req.header('X-Master-Signature') || '';
  const ts = req.header('X-Master-Timestamp') || '';
  const rawBody = JSON.stringify(req.body);
  if (!verifyMasterCallback({ ts, body: rawBody, signature: sig })) {
    event('manual_confirm_rejected', { reason: 'bad_signature' });
    return res.status(401).json({ error: 'invalid_signature' });
  }
  const { ext_order_id, customer_email, master_order_id } = req.body || {};
  if (!ext_order_id) return res.status(400).json({ error: 'missing_ext_order_id' });

  const order = db.prepare('SELECT * FROM local_orders WHERE ref = ?').get(ext_order_id);
  if (!order) {
    event('manual_confirm_rejected', { reason: 'unknown_ref', ext_order_id });
    return res.status(404).json({ error: 'order_not_found' });
  }

  let licenseKey = order.license_key;
  if (!licenseKey) {
    licenseKey = generateLicense();
    db.prepare(`UPDATE local_orders
      SET status = 'paid', license_key = ?, confirmed_at = strftime('%s','now')
      WHERE id = ?`).run(licenseKey, order.id);
  }

  let emailSent = false;
  try {
    await sendLicenseEmail({
      to: customer_email || order.customer_email,
      lang: order.customer_lang || 'en',
      licenseKey,
      ref: ext_order_id,
    });
    emailSent = true;
    db.prepare('UPDATE local_orders SET email_sent = 1 WHERE id = ?').run(order.id);
  } catch (e) {
    event('manual_confirm_email_fail', { ref: ext_order_id, err: e.message });
  }

  event('manual_confirm_ok', { ref: ext_order_id, master_order_id, email_sent: emailSent });
  res.json({ ok: true, license_key: licenseKey, email_sent: emailSent });
});

router.get('/order/:ref', (req, res) => {
  const o = db.prepare('SELECT id, ref, customer_email, payment_method, amount_cents, status, created_at FROM local_orders WHERE ref = ?').get(req.params.ref);
  if (!o) return res.status(404).json({ error: 'not_found' });
  res.json(o);
});

module.exports = router;
