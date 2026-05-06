'use strict';
// Quick sanity test for the license key generator.

const { generate, isValidShape, sign, verifySignature } = require('./license');

const SECRET = process.env.LICENSE_HMAC_SECRET || 'dev-secret';

for (let i = 0; i < 5; i++) {
  const k = generate();
  const s = sign(k, SECRET);
  const ok = isValidShape(k) && verifySignature(k, s, SECRET);
  console.log(`${k}  shape=${isValidShape(k)}  hmac=${s.slice(0, 12)}...  verify=${ok}`);
}
