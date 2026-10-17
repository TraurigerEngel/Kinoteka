'use strict';
const fs = require('fs');
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


const file = process.argv[2];
if (!file || !fs.existsSync(file)) {
  console.error('SQLite file not found.');
  process.exit(2);
}

let db;
try {
  db = new DatabaseSync(file, { readOnly: true });
  const integrity = db.prepare('PRAGMA integrity_check').get();
  if (!integrity || Object.values(integrity)[0] !== 'ok') throw new Error('PRAGMA integrity_check failed.');
  const journal = db.prepare('PRAGMA journal_mode').get();
  if (!journal || String(Object.values(journal)[0]).toLowerCase() !== 'delete') throw new Error('PRAGMA journal_mode must be delete.');
  for (const table of ['state', 'ui_state']) {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
    if (!row) throw new Error(`Missing required table: ${table}`);
  }
  const stateRow = db.prepare('SELECT revision,payload FROM state WHERE id=1').get();
  if (!stateRow) throw new Error('Canonical state row id=1 is missing.');
  const state = JSON.parse(String(stateRow.payload || '{}'));
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error('State payload must be an object.');
  for (const key of ['items','favorites','trash']) {
    if (!Array.isArray(state[key])) throw new Error(`State payload array is missing: ${key}`);
  }
  if (state.app !== 'Кинотека') throw new Error('State app identity mismatch.');
  if (Number(state.formatVersion) !== 1) throw new Error('State formatVersion must be 1.');
  assertStateSemantics(state, file);
  const uiRow = db.prepare('SELECT payload FROM ui_state WHERE id=1').get();
  if (!uiRow || typeof uiRow.payload !== 'string') throw new Error('Canonical ui_state row is missing.');
  const ui = JSON.parse(uiRow.payload);
  assertUiSemantics(ui, file);
  if (!ui || typeof ui !== 'object' || Array.isArray(ui)) throw new Error('UI payload must be an object.');
  for (const key of ['search','sort','quickFilter','mediaCategory','mediaYear']) {
    if (!Object.prototype.hasOwnProperty.call(ui,key)) throw new Error(`UI key is missing: ${key}`);
  }
  console.log(`Kinoteka SQLite verification OK (${state.items.length} items, revision ${stateRow.revision})`);
} catch (error) {
  console.error(String(error && error.message ? error.message : error));
  process.exitCode = 1;
} finally {
  try { db?.close(); } catch {}
}
