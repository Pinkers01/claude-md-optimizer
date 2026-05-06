'use strict';
// License key generator + verifier.
// Format: OPT-XXXX-XXXX-XXXX-XXXX (Crockford base32, no I/O/L/U)

const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSegment(len = 4) {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

function generate() {
  return ['OPT', randomSegment(4), randomSegment(4), randomSegment(4), randomSegment(4)].join('-');
}

function isValidShape(key) {
  if (typeof key !== 'string') return false;
  return /^OPT-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
}

function sign(key, secret) {
  return crypto.createHmac('sha256', secret).update(key).digest('hex');
}

function verifySignature(key, sig, secret) {
  if (!isValidShape(key)) return false;
  const expected = sign(key, secret);
  if (typeof sig !== 'string' || sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch (_) {
    return false;
  }
}

module.exports = { generate, isValidShape, sign, verifySignature };
