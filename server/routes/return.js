'use strict';
// GET /api/return?id=<MOLLIE_ID> — Mollie redirects here after the checkout flow.
// We render a thank-you page (or a "still processing" page) without disclosing the license.
// In dev (stub Mollie), we also force-process the webhook so the email goes out.

const express = require('express');
const { db } = require('../lib/db');
const { getPayment } = require('../lib/mollie');
const { handlePayment } = require('./webhook');

const router = express.Router();

const TEXTS = {
  en: {
    title: 'Thanks for your purchase',
    paid: 'Payment confirmed. Check your inbox, we just emailed your license key and download link.',
    pending: 'Payment received but still processing. You will get the email within a minute or two.',
    failed: 'Payment did not complete. You can retry from the optimizer page.',
    unknown: 'Could not look up that payment. If you were charged, reply to klantenservice@stopmetzoeken.store with your email.',
    home: 'Back to optimizer'
  },
  nl: {
    title: 'Bedankt voor je aankoop',
    paid: 'Betaling bevestigd. Check je inbox, we hebben je licentiesleutel en downloadlink net gemaild.',
    pending: 'Betaling ontvangen, nog even verwerken. De e-mail komt binnen een paar minuten aan.',
    failed: 'Betaling is niet voltooid. Je kunt het opnieuw proberen vanaf de optimizer pagina.',
    unknown: 'Konden de betaling niet vinden. Als er wel afgeschreven is, mail klantenservice@stopmetzoeken.store met je e-mailadres.',
    home: 'Terug naar optimizer'
  },
  pl: {
    title: 'Dziekujemy za zakup',
    paid: 'Platnosc potwierdzona. Sprawdz skrzynke, wlasnie wyslalismy klucz licencji i link do pobrania.',
    pending: 'Platnosc przyjeta, jeszcze sie przetwarza. Mail przyjdzie w ciagu paru minut.',
    failed: 'Platnosc nie zostala zakonczona. Mozesz sprobowac ponownie ze strony optimizera.',
    unknown: 'Nie udalo sie znalezc tej platnosci. Jesli kwota zostala pobrana, napisz na klantenservice@stopmetzoeken.store z adresu mailowego uzytego do zakupu.',
    home: 'Wroc do optimizera'
  }
};

function pickLang(s) {
  const l = (s || '').toString().toLowerCase().slice(0, 2);
  return ['nl', 'pl', 'en'].includes(l) ? l : 'en';
}

function renderPage(state, lang) {
  const t = TEXTS[lang] || TEXTS.en;
  const basePath = process.env.BASE_PATH || '/apps/optimizer';
  const homeUrl = `${basePath}/`;
  const stateText = t[state] || t.unknown;
  const stateColor = state === 'paid' ? '#16a34a' : state === 'failed' ? '#dc2626' : '#1B4BFF';
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t.title} · CLAUDE.md Optimizer</title><meta name="robots" content="noindex,nofollow"><style>
*{box-sizing:border-box}html,body{margin:0;padding:0;background:#0A0A0A;color:#fafaf8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;min-height:100%;overflow-x:hidden;max-width:100vw;width:100%;touch-action:pan-y;overscroll-behavior-x:none}
main{max-width:560px;margin:0 auto;padding:80px 24px 60px 24px;text-align:center}
.kicker{font-size:11px;letter-spacing:1.6px;text-transform:uppercase;color:#a78bfa;margin-bottom:14px}
h1{font-size:clamp(1.8rem,5vw,2.4rem);font-weight:600;line-height:1.2;margin:0 0 18px 0;color:#fff}
p{font-size:16px;line-height:1.6;color:#cfcfcf;margin:0 0 24px 0}
.dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:${stateColor};margin-right:8px;vertical-align:middle;box-shadow:0 0 12px ${stateColor}}
a.cta{display:inline-block;background:#1B4BFF;color:#fff;text-decoration:none;padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;margin-top:8px}
a.cta:hover{background:#2d5cff}
footer{margin-top:60px;font-size:12px;color:#666}
footer a{color:#888;text-decoration:none}
</style></head><body><main><div class="kicker">CLAUDE.md Optimizer</div><h1><span class="dot"></span>${t.title}</h1><p>${stateText}</p><a class="cta" href="${homeUrl}">${t.home}</a><footer>Powered by <a href="https://stopmetzoeken.store">Pinky Creative Studio</a></footer></main></body></html>`;
}

router.get('/return', async (req, res) => {
  const id = (req.query && req.query.id) ? String(req.query.id) : '';
  const langCookie = (req.headers.cookie || '').match(/(?:^|; )lang=([a-z]{2})/);
  const lang = pickLang(req.query.lang || (langCookie && langCookie[1]) || req.headers['accept-language']);
  res.type('text/html');

  if (!id) return res.send(renderPage('unknown', lang));

  try {
    const payment = await getPayment(id);
    if (!payment) return res.send(renderPage('unknown', lang));

    // Dev stub: process webhook inline so the user gets a working flow without Mollie hitting us.
    if (payment._stub && payment.status === 'paid') {
      try { await handlePayment(id); } catch (_) {}
    }

    if (payment.status === 'paid') return res.send(renderPage('paid', lang));
    if (['canceled', 'expired', 'failed'].includes(payment.status)) return res.send(renderPage('failed', lang));
    return res.send(renderPage('pending', lang));
  } catch (e) {
    return res.send(renderPage('unknown', lang));
  }
});

module.exports = router;
