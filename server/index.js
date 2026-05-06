'use strict';
// CLAUDE.md Optimizer — server entry.
// Path-based deploy under /apps/optimizer/ on stopmetzoeken.store (Hetzner pinky-vps).
// Pinky Creative Studio.

require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const { db } = require('./lib/db');
const { accessMiddleware, event } = require('./lib/logger');
const masterAdmin = require('./lib/master-admin');
const checkoutRoute = require('./routes/checkout');
const webhookModule = require('./routes/webhook');
const downloadRoute = require('./routes/download');
const returnRoute = require('./routes/return');
const adminRoute = require('./routes/admin');

const PORT = parseInt(process.env.PORT || '3260', 10);
const BASE_PATH = (process.env.BASE_PATH || '/apps/optimizer').replace(/\/$/, '');
const VERSION = process.env.PRODUCT_VERSION || '1.0.0';
const START_TS = Date.now();

const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security headers. CSP off here because the landing is served by nginx alias and
// has its own CSP; this server only does API + thank-you HTML.
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(compression());

// Access log middleware on every request.
app.use(accessMiddleware());

// JSON body parser. Webhook uses urlencoded internally so we mount JSON globally.
app.use(express.json({ limit: '64kb' }));

// --- Routes ---
const apiBase = `${BASE_PATH}/api`;

app.use(apiBase, checkoutRoute);
app.use(apiBase, webhookModule.router);
app.use(apiBase, downloadRoute);
app.use(apiBase, returnRoute);
app.use(apiBase, adminRoute);

// Health endpoint at both prefixed and root path so beacon and direct check both work.
function healthHandler(_req, res) {
  let downloadsTotal = 0;
  try {
    downloadsTotal = db.prepare('SELECT COUNT(*) as n FROM downloads').get().n;
  } catch (_) {}
  res.json({
    status: 'ok',
    service: 'claude-md-optimizer',
    version: VERSION,
    uptime_s: Math.floor((Date.now() - START_TS) / 1000),
    downloads_total: downloadsTotal,
    base_path: BASE_PATH,
    ts: Date.now()
  });
}
app.get(`${BASE_PATH}/healthz`, healthHandler);
app.get('/healthz', healthHandler);

// --- 404 + error handler ---
app.use((req, res) => {
  res.status(404).json({ error: 'not_found', path: req.originalUrl });
});

app.use((err, _req, res, _next) => {
  event('server.error', { msg: err && err.message, stack: err && err.stack });
  if (!res.headersSent) res.status(500).json({ error: 'server_error' });
});

// --- Boot ---
const server = app.listen(PORT, () => {
  const banner = [
    '',
    '  ╭─────────────────────────────────────────────╮',
    '  │  CLAUDE.md Optimizer · server               │',
    `  │  port :${String(PORT).padEnd(38, ' ')}│`,
    `  │  base ${BASE_PATH.padEnd(39, ' ')}│`,
    `  │  ver  ${VERSION.padEnd(39, ' ')}│`,
    '  │  Pinky Creative Studio                      │',
    '  ╰─────────────────────────────────────────────╯',
    ''
  ].join('\n');
  process.stdout.write(banner);
  event('server.start', { port: PORT, basePath: BASE_PATH, version: VERSION });
});

// Master-admin auto-registration. No-op when MASTER_ADMIN_SECRET unset.
const adminCtl = masterAdmin.start(console);

function shutdown(signal) {
  event('server.shutdown', { signal });
  try { adminCtl && adminCtl.stop(); } catch (_) {}
  server.close(() => {
    try { db.close(); } catch (_) {}
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (e) => event('unhandled_rejection', { msg: (e && e.message) || String(e) }));
process.on('uncaughtException', (e) => event('uncaught_exception', { msg: e.message, stack: e.stack }));

module.exports = app;

/*
       ___  __   ____  __  __  ____  ____  __  ____  ____  ____
      / __)(  ) / ___)(  )(  )(_  _)( ___)(  )(_   )( ___)(  _ \
     ( (__  )(__\___ \ )(__)(   )(   )__)  )(  / /_  )__)  )   /
      \___)(____)____/(______) (__) (____)(__)(____)(____)(_)\_)

   Built by Pinky Creative Studio · Den Bosch, NL
   This is the optimizer server. It only handles checkout, license,
   webhook, download. Your CLAUDE.md never leaves your browser.

   EN: Hi there. If you're reading this, you found the source.
       Buy a license at stopmetzoeken.store/apps/optimizer.
   PL: Czesc. Jesli to czytasz, znalazles zrodlo.
       Kup licencje na stopmetzoeken.store/apps/optimizer.
   NL: Hoi. Als je dit leest, heb je de bron gevonden.
       Koop een licentie op stopmetzoeken.store/apps/optimizer.
*/
