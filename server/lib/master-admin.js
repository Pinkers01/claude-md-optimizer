'use strict';
// Auto-registration with master admin Apps registry.
// Beacons every N minutes with HMAC-signed metadata.

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { db } = require('./db');

const SLUG = 'optimizer';
const NAME = 'CLAUDE.md Optimizer';
const DESCRIPTION = 'Lokalna webapp do optymalizacji plikow CLAUDE.md. Wykrywa duplikaty, konflikty, dzieli na slim master + memory tree. 9 EUR lifetime.';
const VERSION = process.env.PRODUCT_VERSION || '1.0.0';
const PORT = parseInt(process.env.PORT || '3280', 10);
const BASE_PATH = process.env.BASE_PATH || '/apps/optimizer';
const BASE_URL = process.env.BASE_URL || 'https://stopmetzoeken.store';

function buildPayload(downloadsTotal) {
  return {
    slug: SLUG,
    name: NAME,
    description: DESCRIPTION,
    version: VERSION,
    port: PORT,
    base_path: BASE_PATH,
    status: 'live',
    healthz_url: `${BASE_URL}${BASE_PATH}/healthz`,
    admin_url: `${BASE_URL}${BASE_PATH}/`,
    downloads_total: downloadsTotal,
    registered_at: Date.now()
  };
}

function sign(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

function postJson(url, bodyStr, headers, timeoutMs) {
  return new Promise((resolve) => {
    let parsed;
    try { parsed = new URL(url); }
    catch (e) { return resolve({ ok: false, error: 'invalid_url' }); }
    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = {
      method: 'POST',
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'User-Agent': 'pinky-fleet-beacon/1.0 (optimizer)'
      }, headers || {})
    };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => { data += c.toString(); });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: data }));
    });
    req.on('error', (e) => resolve({ ok: false, error: e.message }));
    req.setTimeout(timeoutMs || 10000, () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    req.write(bodyStr);
    req.end();
  });
}

function downloadsTotal() {
  try {
    return db.prepare('SELECT COUNT(*) as n FROM downloads').get().n;
  } catch (_) {
    return 0;
  }
}

async function beaconOnce(logger) {
  if (!process.env.MASTER_ADMIN_SECRET || process.env.MASTER_ADMIN_SECRET === 'REPLACE_ME_FROM_VAULT') {
    return { ok: false, skipped: true, reason: 'no_secret' };
  }
  if (String(process.env.OFFLINE || '').toLowerCase() === 'true') {
    return { ok: false, skipped: true, reason: 'offline' };
  }
  const url = process.env.MASTER_ADMIN_REGISTRY_URL;
  if (!url) return { ok: false, skipped: true, reason: 'no_url' };

  const payload = buildPayload(downloadsTotal());
  const body = JSON.stringify(payload);
  const sig = sign(body, process.env.MASTER_ADMIN_SECRET);
  const result = await postJson(url, body, {
    'X-Pinky-Signature': sig,
    'X-Pinky-Slug': SLUG
  });
  if (logger) {
    if (result.ok) logger.info(`[master-admin] beacon ok (status=${result.status})`);
    else logger.warn(`[master-admin] beacon failed: ${result.error || result.status}`);
  }
  return result;
}

function start(logger = console) {
  const interval = parseInt(process.env.MASTER_ADMIN_REGISTER_INTERVAL_MS || '300000', 10);
  // First beacon shortly after boot, then every interval.
  const t1 = setTimeout(() => beaconOnce(logger), 8000);
  const t2 = setInterval(() => beaconOnce(logger), interval);
  return {
    stop() { clearTimeout(t1); clearInterval(t2); }
  };
}

module.exports = { start, beaconOnce, buildPayload, SLUG, VERSION };
