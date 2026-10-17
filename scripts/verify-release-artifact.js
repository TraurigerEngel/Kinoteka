'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');

const KINOTEKA_CATEGORIES = new Set(['Фильмы','Сериалы','Анимация']);
const KINOTEKA_ITEM_RATINGS = new Set(['Понравилось','Нормально','Не понравилось','Смотрю','Запланировано']);
const KINOTEKA_TRASH_RATINGS = new Set([...KINOTEKA_ITEM_RATINGS,'Избранное']);
function validCanonicalYear(value) {
  return value == null || (Number.isInteger(value) && value >= 1000 && value <= 9999);
}
function assertStateSemantics(state,label) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error(`State object is invalid: ${label}`);
  if (!Array.isArray(state.items) || !Array.isArray(state.favorites) || !Array.isArray(state.trash)) throw new Error(`State arrays are invalid: ${label}`);
  const itemKeys = new Set();
  for (const [index,item] of state.items.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Item ${index} is invalid: ${label}`);
    if (typeof item.name !== 'string' || !item.name.trim()) throw new Error(`Item ${index} name is invalid: ${label}`);
    if (!KINOTEKA_CATEGORIES.has(item.category)) throw new Error(`Item ${index} category is invalid: ${label}`);
    if (!validCanonicalYear(item.year)) throw new Error(`Item ${index} year is invalid: ${label}`);
    if (!KINOTEKA_ITEM_RATINGS.has(item.rating)) throw new Error(`Item ${index} rating is invalid: ${label}`);
    itemKeys.add(`${item.category}::${item.name}::${item.year == null ? '' : String(item.year)}`);
  }
  const seenFavorites = new Set();
  for (const key of state.favorites) {
    if (typeof key !== 'string' || !key.trim() || !itemKeys.has(key) || seenFavorites.has(key)) throw new Error(`Favorite reference is invalid: ${label}`);
    seenFavorites.add(key);
  }
  for (const [index,item] of state.trash.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Trash item ${index} is invalid: ${label}`);
    const name = typeof item.game === 'string' ? item.game : (typeof item.name === 'string' ? item.name : '');
    if (!name.trim()) throw new Error(`Trash item ${index} name is invalid: ${label}`);
    if (!Number.isSafeInteger(item.id) || item.id <= 0) throw new Error(`Trash item ${index} id is invalid: ${label}`);
    if (!KINOTEKA_CATEGORIES.has(item.category)) throw new Error(`Trash item ${index} category is invalid: ${label}`);
    if (!validCanonicalYear(item.year)) throw new Error(`Trash item ${index} year is invalid: ${label}`);
    if (!KINOTEKA_TRASH_RATINGS.has(item.rating)) throw new Error(`Trash item ${index} rating is invalid: ${label}`);
    if (typeof item.favorite !== 'boolean') throw new Error(`Trash item ${index} favorite flag is invalid: ${label}`);
  }
}
function assertUiSemantics(ui,label) {
  if (!ui || typeof ui !== 'object' || Array.isArray(ui)) throw new Error(`UI state is invalid: ${label}`);
  for (const key of ['search','sort','quickFilter','mediaCategory','mediaYear']) if (typeof ui[key] !== 'string') throw new Error(`UI key ${key} is invalid: ${label}`);
  if (!['game-asc','game-desc'].includes(ui.sort)) throw new Error(`UI sort is invalid: ${label}`);
  if (!['Все','Фильмы','Сериалы','Анимация'].includes(ui.mediaCategory)) throw new Error(`UI mediaCategory is invalid: ${label}`);
}



const target = path.resolve(process.argv[2] || '');
if (!target || !fs.existsSync(target)) throw new Error('Portable release directory was not found.');

const allowedFiles = new Set([
  'Kinoteka.exe',
  'data/kinoteka.sqlite3',
  'seed-data/kinoteka.sqlite3'
]);
const seenFiles = new Set();
function walk(dir) {
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    const full = path.join(dir,ent.name);
    const rel = path.relative(target,full).split(path.sep).join('/');
    if (ent.isDirectory()) walk(full);
    else if (ent.isFile()) {
      seenFiles.add(rel);
      if (!allowedFiles.has(rel)) throw new Error(`Unexpected filesystem entry in portable release: ${rel}`);
    }
  }
}
walk(target);
for (const rel of allowedFiles) if (!seenFiles.has(rel)) throw new Error(`Release artifact is missing: ${rel}`);

function verifyDb(rel) {
  const file = path.join(target, rel);
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const integrity = db.prepare('PRAGMA integrity_check').get();
    if (!integrity || Object.values(integrity)[0] !== 'ok') throw new Error(`SQLite integrity failed: ${rel}`);
    const journal = db.prepare('PRAGMA journal_mode').get();
    if (!journal || String(Object.values(journal)[0]).toLowerCase() !== 'delete') throw new Error(`SQLite journal_mode must be delete: ${rel}`);
    for (const table of ['state','ui_state']) {
      if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table)) throw new Error(`Missing SQLite table ${table} in ${rel}`);
    }
    const row = db.prepare('SELECT payload FROM state WHERE id=1').get();
    if (!row) throw new Error(`State row is missing: ${rel}`);
    const state = JSON.parse(row.payload);
    if (state.app !== 'Кинотека' || Number(state.formatVersion) !== 1) throw new Error(`Kinoteka state identity mismatch: ${rel}`);
    for (const key of ['items','favorites','trash']) if (!Array.isArray(state[key])) throw new Error(`State key ${key} is invalid: ${rel}`);
    assertStateSemantics(state, rel);
    const uiRow = db.prepare('SELECT payload FROM ui_state WHERE id=1').get();
    if (!uiRow) throw new Error(`UI state is missing: ${rel}`);
    const ui = JSON.parse(uiRow.payload);
    assertUiSemantics(ui, rel);
  } finally { db.close(); }
}

verifyDb('data/kinoteka.sqlite3');
verifyDb('seed-data/kinoteka.sqlite3');
const live = fs.readFileSync(path.join(target,'data','kinoteka.sqlite3'));
const seed = fs.readFileSync(path.join(target,'seed-data','kinoteka.sqlite3'));
if (!live.equals(seed)) throw new Error('Release live and seed SQLite must be byte-identical canonical copies.');
const exeSize = fs.statSync(path.join(target,'Kinoteka.exe')).size;
if (exeSize < 1024 * 1024) throw new Error('Kinoteka.exe is unexpectedly small.');
const dbSha = crypto.createHash('sha256').update(live).digest('hex');
console.log('Kinoteka v1.1 Stable release artifact verification OK');
console.log(`- EXE: ${(exeSize/1024/1024).toFixed(2)} MB`);
console.log('- Exact portable allowlist OK (3 runtime files)');
console.log('- SQLite integrity/schema/state/journal_mode OK');
console.log(`- Canonical live/seed SQLite byte identity OK (${dbSha.slice(0,12)}...)`);
