'use strict';
// Standalone init script: ensures tables exist, prints state.

const { db, DB_PATH } = require('./db');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
const counts = {};
for (const t of tables) {
  if (t.name.startsWith('sqlite_')) continue;
  try {
    counts[t.name] = db.prepare(`SELECT COUNT(*) as n FROM ${t.name}`).get().n;
  } catch (_) {
    counts[t.name] = '?';
  }
}

console.log('[init-db] path:', DB_PATH);
console.log('[init-db] tables:', counts);
process.exit(0);
