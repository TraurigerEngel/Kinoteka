'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const SHA = '772905b6dac60f266bbc0ea131e085802dcf0b3f41b8f20b5bf23d4bfb90d436';
for (const rel of ['data/kinoteka.sqlite3','seed-data/kinoteka.sqlite3']) {
  const file = path.join(root, rel);
  const bytes = fs.readFileSync(file);
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== SHA) throw new Error('Unsafe/non-demo SQLite database: ' + rel);
  const db = new DatabaseSync(file,{readOnly:true});
  try {
    if (db.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('SQLite integrity failed');
    const row = db.prepare('SELECT revision, payload FROM state WHERE id=1').get();
    if (!row || row.revision !== 0) throw new Error('Demo revision is not zero');
    const s = JSON.parse(row.payload);
    if (s.app !== 'Кинотека' || s.formatVersion !== 1 ||
        !Array.isArray(s.items) || !Array.isArray(s.favorites) || !Array.isArray(s.trash) ||
        s.items.length !== 0 || s.favorites.length !== 0 || s.trash.length !== 0) throw new Error('Personal movies/favorites/trash detected');
    const ui = JSON.parse(db.prepare('SELECT payload FROM ui_state WHERE id=1').get().payload);
    if (ui.search !== '' || ui.quickFilter !== '' || ui.mediaCategory !== 'Все' || ui.mediaYear !== '') throw new Error('Personal UI state detected');
  } finally { db.close(); }
}
for (const name of ['Inter-Regular.woff2','Inter-Medium.woff2','Inter-SemiBold.woff2','Inter-Bold.woff2']) {
  if (fs.existsSync(path.join(root,'app/shared/fonts',name))) throw new Error('Unexpected bundled font file');
}
console.log('Kinoteka clean-demo privacy verified: zero films, zero favorites, zero trash, sealed SQLite SHA-256.');
