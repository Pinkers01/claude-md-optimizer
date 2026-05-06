'use strict';
// GET /api/download?key=OPT-... — validate license, stream the build ZIP, log the hit.

const express = require('express');
const fs = require('fs');
const path = require('path');
const { db } = require('../lib/db');
const { isValidShape } = require('../lib/license');
const { event } = require('../lib/logger');

const router = express.Router();

const DOWNLOAD_WINDOW_DAYS = 30;
const ZIP_NAME = process.env.BUILD_ZIP_NAME || 'claude-md-optimizer-v1.0.0.zip';

function resolveZipPath() {
  const cfg = process.env.BUILD_ZIP_PATH;
  if (cfg && fs.existsSync(cfg)) return cfg;
  // Local fallback for dev: ../build/<name> relative to server/.
  const local = path.join(__dirname, '..', '..', 'build', ZIP_NAME);
  if (fs.existsSync(local)) return local;
  return null;
}

router.get('/download', (req, res) => {
  const key = (req.query && req.query.key) ? String(req.query.key).trim().toUpperCase() : '';
  if (!isValidShape(key)) {
    return res.status(400).json({ error: 'invalid_license_format' });
  }

  const order = db.prepare(
    "SELECT * FROM orders WHERE license_key = ? AND status = 'paid'"
  ).get(key);
  if (!order || !order.paid_at) {
    event('download.invalid_key', { key, ip: req.ip });
    return res.status(403).json({ error: 'invalid_license' });
  }

  const ageMs = Date.now() - order.paid_at;
  const expired = ageMs > DOWNLOAD_WINDOW_DAYS * 86400 * 1000;
  if (expired) {
    event('download.expired', { key, orderId: order.id, ageMs });
    return res.status(410).json({
      error: 'link_expired',
      message: `Download link expired after ${DOWNLOAD_WINDOW_DAYS} days. Reply to your license email for a fresh link.`
    });
  }

  const zipPath = resolveZipPath();
  if (!zipPath) {
    event('download.no_artifact', { key, configured: process.env.BUILD_ZIP_PATH });
    return res.status(503).json({ error: 'artifact_unavailable', message: 'Build is being prepared, try again in a minute.' });
  }

  const stat = fs.statSync(zipPath);
  const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
  const ua = (req.headers['user-agent'] || '').toString().slice(0, 300);

  db.prepare(
    'INSERT INTO downloads (license_key, downloaded_at, ip, user_agent) VALUES (?, ?, ?, ?)'
  ).run(key, Date.now(), ip || null, ua || null);

  event('download.served', { key, orderId: order.id, bytes: stat.size, ip });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Content-Disposition', `attachment; filename="${ZIP_NAME}"`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('X-License-Key', key);

  const stream = fs.createReadStream(zipPath);
  stream.on('error', (e) => {
    event('download.stream_error', { key, msg: e.message });
    if (!res.headersSent) res.status(500).end();
    else res.end();
  });
  stream.pipe(res);
});

module.exports = router;
