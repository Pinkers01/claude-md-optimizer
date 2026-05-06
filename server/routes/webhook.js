'use strict';
// POST /api/webhook — Mollie posts the payment id, we look it up and act on status.

const express = require('express');
const { db } = require('../lib/db');
const { getPayment } = require('../lib/mollie');
const { generate, sign } = require('../lib/license');
const { sendLicenseEmail } = require('../lib/mailer');
const { event } = require('../lib/logger');

const router = express.Router();

async function handlePayment(paymentId) {
  const payment = await getPayment(paymentId);
  if (!payment) {
    event('webhook.payment_not_found', { paymentId });
    return { ok: false, reason: 'not_found' };
  }

  const order = db.prepare('SELECT * FROM orders WHERE mollie_payment_id = ?').get(paymentId);
  if (!order) {
    event('webhook.order_not_found', { paymentId });
    return { ok: false, reason: 'order_missing' };
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(order.customer_id);
  const now = Date.now();

  if (payment.status === 'paid') {
    if (order.status === 'paid' && order.license_key) {
      // Idempotent: already processed.
      event('webhook.duplicate_paid', { paymentId, orderId: order.id });
      return { ok: true, duplicate: true };
    }
    const licenseKey = generate();
    db.prepare(
      "UPDATE orders SET status = 'paid', license_key = ?, paid_at = ?, updated = ? WHERE id = ?"
    ).run(licenseKey, now, now, order.id);

    // Send the email. Failures must not break the webhook (Mollie retries on non-2xx).
    const baseUrl = process.env.BASE_URL || 'https://stopmetzoeken.store';
    const basePath = process.env.BASE_PATH || '/apps/optimizer';
    const downloadUrl = `${baseUrl}${basePath}/api/download?key=${encodeURIComponent(licenseKey)}`;
    const amountEur = (order.amount_cents / 100).toFixed(2);

    try {
      const sent = await sendLicenseEmail({
        to: customer.email,
        lang: customer.lang,
        licenseKey,
        downloadUrl,
        orderId: order.id,
        amountEur
      });
      event('webhook.paid', { orderId: order.id, paymentId, sent: sent.ok, skipped: !!sent.skipped });
    } catch (e) {
      event('webhook.email_error', { orderId: order.id, paymentId, msg: e.message });
    }
    return { ok: true, paid: true };
  }

  if (['canceled', 'expired', 'failed'].includes(payment.status)) {
    db.prepare('UPDATE orders SET status = ?, updated = ? WHERE id = ?').run(payment.status, now, order.id);
    event('webhook.terminal_state', { orderId: order.id, paymentId, status: payment.status });
    return { ok: true, status: payment.status };
  }

  // open / pending / authorized — keep waiting.
  db.prepare('UPDATE orders SET status = ?, updated = ? WHERE id = ?').run(payment.status, now, order.id);
  event('webhook.intermediate', { orderId: order.id, paymentId, status: payment.status });
  return { ok: true, status: payment.status };
}

router.post('/webhook', express.urlencoded({ extended: false }), async (req, res) => {
  // Mollie sends application/x-www-form-urlencoded with body { id: '...' }.
  // Some integrations also let us accept JSON.
  const id = (req.body && req.body.id) || (req.query && req.query.id);
  if (!id) return res.status(400).send('missing id');
  try {
    await handlePayment(String(id));
    return res.status(200).send('ok');
  } catch (e) {
    event('webhook.error', { id: String(id), msg: e.message });
    // 200 to avoid infinite retries when our internal logic is broken; we still log.
    return res.status(200).send('ok');
  }
});

module.exports = { router, handlePayment };
