'use strict';
// Strato SMTP (port 587 STARTTLS) — Hetzner blocks 465.
// Renders multilingual email templates and sends them.

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const EMAIL_DIR = path.join(__dirname, '..', 'emails');
const SUPPORTED_LANGS = ['nl', 'pl', 'en'];

let transporterCache = null;

function transporter() {
  if (transporterCache) return transporterCache;
  if (!process.env.STRATO_SMTP_USER || !process.env.STRATO_SMTP_PASS) {
    return null;
  }
  transporterCache = nodemailer.createTransport({
    host: process.env.STRATO_SMTP_HOST || 'smtp.strato.com',
    port: parseInt(process.env.STRATO_SMTP_PORT || '587', 10),
    secure: false, // STARTTLS on 587
    requireTLS: true,
    auth: {
      user: process.env.STRATO_SMTP_USER,
      pass: process.env.STRATO_SMTP_PASS
    },
    tls: { minVersion: 'TLSv1.2' }
  });
  return transporterCache;
}

function pickLang(lang) {
  if (typeof lang !== 'string') return 'en';
  const l = lang.toLowerCase().slice(0, 2);
  return SUPPORTED_LANGS.includes(l) ? l : 'en';
}

function loadTemplate(lang, name) {
  const file = path.join(EMAIL_DIR, lang, `${name}.json`);
  if (!fs.existsSync(file)) {
    const fallback = path.join(EMAIL_DIR, 'en', `${name}.json`);
    return JSON.parse(fs.readFileSync(fallback, 'utf8'));
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function renderTemplate(tpl, vars) {
  function replace(s) {
    return s.replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
  }
  return {
    subject: replace(tpl.subject),
    text: replace(tpl.text),
    html: replace(tpl.html)
  };
}

async function sendLicenseEmail({ to, lang, licenseKey, downloadUrl, orderId, amountEur }) {
  const useLang = pickLang(lang);
  const tpl = loadTemplate(useLang, 'license');
  const vars = {
    licenseKey,
    downloadUrl,
    orderId,
    amountEur,
    productName: 'CLAUDE.md Optimizer',
    supportEmail: 'klantenservice@stopmetzoeken.store',
    websiteUrl: 'https://stopmetzoeken.store',
    year: new Date().getFullYear()
  };
  const rendered = renderTemplate(tpl, vars);

  const fromName = process.env.SMTP_FROM_NAME || 'Pinky Creative Studio';
  const fromEmail = process.env.SMTP_FROM_EMAIL || 'administrator@stopmetzoeken.store';
  const replyTo = process.env.SMTP_REPLY_TO || 'klantenservice@stopmetzoeken.store';

  const mail = {
    from: `"${fromName}" <${fromEmail}>`,
    to,
    replyTo,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
    headers: {
      'X-Pinky-Product': 'claude-md-optimizer',
      'X-Pinky-Lang': useLang
    }
  };

  const t = transporter();
  if (!t) {
    return { ok: false, skipped: true, reason: 'smtp_not_configured' };
  }
  const info = await t.sendMail(mail);
  return { ok: true, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected };
}

async function verifyTransport() {
  const t = transporter();
  if (!t) return { ok: false, reason: 'not_configured' };
  try {
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { sendLicenseEmail, verifyTransport, pickLang };
