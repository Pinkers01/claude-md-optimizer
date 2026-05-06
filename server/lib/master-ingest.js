'use strict';
// Master admin ingest helper. Signs HMAC and POSTs new orders so Pinky sees
// them in stopmetzoeken.store/apps/#/orders cross-tenant.

const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');

const SECRET = process.env.ORDERS_HMAC_SECRET || '';
const BASE = process.env.MASTER_ADMIN_BASE || 'https://stopmetzoeken.store/apps';
const APP_SLUG = 'optimizer';
const APP_NAME = 'CLAUDE.md Optimizer';

function ingestOrder({ customer_email, customer_lang, product_sku, amount_cents, currency, payment_method }) {
  return new Promise((resolve) => {
    if (!SECRET) {
      return resolve({ ok: false, skipped: 'no_secret' });
    }
    const ts = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      app_slug: APP_SLUG,
      app_name: APP_NAME,
      customer_email,
      customer_lang,
      product_sku: product_sku || 'opt-pro-1y',
      amount_cents,
      currency: currency || 'EUR',
      payment_method,
    });
    const sig = crypto.createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');
    const u = new URL(`${BASE}/api/orders/ingest`);
    const opts = {
      hostname: u.hostname,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-App-Auth': sig,
        'X-App-Timestamp': String(ts),
      },
      timeout: 8000,
    };
    const req = https.request(opts, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try {
          const j = JSON.parse(raw);
          resolve({ ok: res.statusCode < 400, status: res.statusCode, ...j });
        } catch (_) {
          resolve({ ok: false, status: res.statusCode, raw });
        }
      });
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.write(body);
    req.end();
  });
}

function verifyMasterCallback({ ts, body, signature }) {
  if (!SECRET || !signature) return false;
  const skew = Math.abs(Math.floor(Date.now() / 1000) - parseInt(ts, 10));
  if (Number.isNaN(skew) || skew > 600) return false;
  const expected = crypto.createHmac('sha256', SECRET).update(`${ts}.${body}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (_) {
    return false;
  }
}

module.exports = { ingestOrder, verifyMasterCallback, APP_SLUG, APP_NAME };
