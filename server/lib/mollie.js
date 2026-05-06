'use strict';
// Mollie wrapper. Falls back to a stub when MOLLIE_API_KEY is missing,
// so dev environments can still exercise the flow.

const PRICE_CENTS = parseInt(process.env.PRICE_CENTS || '900', 10);
const CURRENCY = process.env.CURRENCY || 'EUR';

let clientCache = null;
function client() {
  if (clientCache) return clientCache;
  if (!process.env.MOLLIE_API_KEY || process.env.MOLLIE_API_KEY.startsWith('test_REPLACE')) {
    return null;
  }
  const { createMollieClient } = require('@mollie/api-client');
  clientCache = createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
  return clientCache;
}

function priceString() {
  return (PRICE_CENTS / 100).toFixed(2);
}

async function createPayment({ orderId, email, lang, returnUrl, webhookUrl }) {
  const c = client();
  if (!c) {
    // Dev stub: deterministic fake id, link points back at our return endpoint.
    const fakeId = `tr_DEV_${orderId}_${Date.now().toString(36)}`;
    return {
      id: fakeId,
      status: 'open',
      checkoutUrl: `${returnUrl}?id=${fakeId}&dev=1`,
      amount: { value: priceString(), currency: CURRENCY },
      _stub: true
    };
  }
  const payment = await c.payments.create({
    amount: { currency: CURRENCY, value: priceString() },
    description: 'CLAUDE.md Optimizer (lifetime)',
    redirectUrl: returnUrl,
    webhookUrl,
    metadata: { orderId, email, lang },
    locale: localeFromLang(lang)
  });
  return {
    id: payment.id,
    status: payment.status,
    checkoutUrl: payment.getCheckoutUrl(),
    amount: payment.amount
  };
}

async function getPayment(id) {
  const c = client();
  if (!c) {
    // Dev stub: any id starting with tr_DEV_ is "paid" once we are asked about it.
    if (typeof id === 'string' && id.startsWith('tr_DEV_')) {
      return { id, status: 'paid', amount: { value: priceString(), currency: CURRENCY }, metadata: {}, _stub: true };
    }
    return null;
  }
  return c.payments.get(id);
}

function localeFromLang(lang) {
  const l = (lang || '').toLowerCase().slice(0, 2);
  if (l === 'nl') return 'nl_NL';
  if (l === 'pl') return 'pl_PL';
  if (l === 'de') return 'de_DE';
  if (l === 'fr') return 'fr_FR';
  return 'en_US';
}

module.exports = { createPayment, getPayment, priceString, PRICE_CENTS, CURRENCY };
