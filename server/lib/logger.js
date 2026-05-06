'use strict';
// Daily-rotated access log. Plain text, one line per request.

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function todayStamp() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function logFilePath() {
  return path.join(LOG_DIR, `access-${todayStamp()}.log`);
}

function writeLine(line) {
  try {
    fs.appendFileSync(logFilePath(), line + '\n');
  } catch (e) {
    // never throw from logger
    process.stderr.write(`[logger] write failed: ${e.message}\n`);
  }
}

function accessMiddleware() {
  return (req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim();
      const ua = (req.headers['user-agent'] || '-').toString().replace(/\s+/g, ' ').slice(0, 200);
      const durMs = Date.now() - start;
      const line = [
        new Date().toISOString(),
        ip || '-',
        req.method,
        req.originalUrl,
        res.statusCode,
        durMs + 'ms',
        JSON.stringify(ua)
      ].join(' ');
      writeLine(line);
    });
    next();
  };
}

function event(kind, payload) {
  const line = [new Date().toISOString(), 'EVENT', kind, JSON.stringify(payload || {})].join(' ');
  writeLine(line);
}

module.exports = { accessMiddleware, event, LOG_DIR };
