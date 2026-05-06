# CLAUDE.md Optimizer · server

Express backend for the 9 EUR lifetime CLAUDE.md Optimizer product. Runs on Hetzner VPS pinky-vps under PM2, behind nginx at `https://stopmetzoeken.store/apps/optimizer/`.

## Quick start (local)

```bash
cd server
cp .env.example .env             # fill MOLLIE_API_KEY + STRATO_SMTP_PASS later
npm install
npm run init-db
npm run dev                      # http://localhost:3280/apps/optimizer/healthz
```

Without a Mollie key the checkout endpoint runs in **stub mode**: it returns a fake `tr_DEV_*` payment id, the return page processes it inline, and the license email goes out (if SMTP is configured) or silently skips.

## Endpoints

All under base path `/apps/optimizer`.

| Method | Path                  | Description                                                   |
|--------|-----------------------|---------------------------------------------------------------|
| POST   | `/api/checkout`       | `{email, lang}` -> Mollie payment, returns `{checkoutUrl}`    |
| POST   | `/api/webhook`        | Mollie posts payment id, we issue license + email it          |
| GET    | `/api/return?id=...`  | Mollie redirect target, renders thank-you page                |
| GET    | `/api/download?key=X` | Streams the ZIP if license is valid + within 30 days          |
| GET    | `/api/stats`          | HMAC-protected counters                                       |
| GET    | `/healthz`            | `{status, version, uptime, downloads_total}`                  |

## Files

```
server/
  index.js               # Express boot, routes, healthz, fleet beacon hook
  package.json           # express, better-sqlite3, @mollie/api-client, nodemailer, helmet, ...
  .env.example           # all required env vars
  nginx.conf             # snippet to append to /etc/nginx/sites-available/stopmetzoeken.store
  deploy.sh              # rsync + pm2 reload
  build-zip.sh           # builds build/claude-md-optimizer-v1.0.0.zip
  lib/
    db.js                # better-sqlite3 + schema (customers, orders, downloads, audit_log)
    license.js           # OPT-XXXX-XXXX-XXXX-XXXX generator + HMAC verify
    logger.js            # daily-rotated access log + event helper
    mailer.js            # Strato SMTP 587 STARTTLS + multilingual templates
    mollie.js            # Mollie wrapper with dev stub
    master-admin.js      # auto-registration POST to /api/admin/apps every 5 min
    init-db.js           # standalone schema init
    test-license.js      # license key sanity test
  routes/
    checkout.js          # POST /api/checkout (rate-limited 30/15min)
    webhook.js           # POST /api/webhook (idempotent, sets license, sends email)
    download.js          # GET  /api/download (streams ZIP, 30-day window)
    return.js            # GET  /api/return (thank-you page, 3 langs)
    admin.js             # GET  /api/stats (HMAC X-Pinky-Auth)
  emails/
    en/license.json      # subject + text + html templates with {{vars}}
    nl/license.json
    pl/license.json
  data/                  # data.db (gitignored)
  logs/                  # access-YYYY-MM-DD.log (gitignored)
```

## Auth + secrets

- `LICENSE_HMAC_SECRET` — used to sign license keys for offline verification (not strictly needed for the simple MVP, but keeps the door open).
- `STATS_HMAC_SECRET` — header `X-Pinky-Auth: <hmac_sha256("stats", secret)>` to access `/api/stats`.
- `MASTER_ADMIN_SECRET` — used to sign the auto-registration body; lives in `~/.pinky_launch/config` and Apple Note 'MASTER VAULT'.

## Deploy

```bash
./deploy.sh --first    # one-time: creates dirs, pm2 start optimizer-srv
./deploy.sh            # subsequent: rsync + reload
```

Then on the server:

```bash
sudo cat /srv/optimizer/server/nginx.conf >> /etc/nginx/sites-available/stopmetzoeken.store
# (or insert by hand inside the server { } block)
sudo cp /etc/nginx/sites-available/stopmetzoeken.store /etc/nginx/sites-enabled/stopmetzoeken.store
sudo nginx -t && sudo systemctl reload nginx
```

Smoke checks for Pinky (token economy: do this from the iPhone or browser, not from another agent run):

- `https://stopmetzoeken.store/apps/optimizer/healthz` → 200 JSON
- `POST` to `/apps/optimizer/api/checkout` with `{email, lang}` → `checkoutUrl`
- Master admin → Apps tab → `optimizer` tile shows up within 5 min

## Anti-patterns we avoid

- No Stripe (Mollie for NL per `feedback_code_style.md` and CLAUDE.md).
- No port 465 (Hetzner blocks it; we use 587 STARTTLS per `feedback_hetzner_smtp_ports.md`).
- No em-dash in email copy (per `feedback_language.md`).
- No keys in repo (env only).
- No 200-line CSS in the return page (mobile-safe boilerplate baked in).
- No bare 9 EUR figure without VAT awareness — Pinky decides VAT setup at Mollie level.

```
   ╭─ Pinky Creative Studio ─────────────────╮
   │  klantenservice@stopmetzoeken.store     │
   │  +31 6 38 90 94 16                      │
   │  Troelstradreef 72, 5237 VJ Den Bosch   │
   ╰─────────────────────────────────────────╯
```
