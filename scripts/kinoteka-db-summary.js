'use strict';
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('SQLite file not found.');
  process.exit(2);
}

let db;
try {
  db = new DatabaseSync(file, { readOnly: true });
  const row = db.prepare('SELECT revision,payload FROM state WHERE id=1').get();
  if (!row) throw new Error('Canonical state row id=1 is missing.');
  const state = JSON.parse(String(row.payload || '{}'));
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('State payload must be an object.');
  for (const key of ['items','favorites','trash']) if (!Array.isArray(state[key])) throw new Error(`State array is invalid: ${key}`);
  process.stdout.write(JSON.stringify({
    items: state.items.length,
    favorites: state.favorites.length,
    trash: state.trash.length,
    revision: Number(row.revision)
  }));
} catch (error) {
  console.error(String(error && error.message ? error.message : error));
  process.exitCode = 1;
} finally {
  try { db?.close(); } catch {}
}
