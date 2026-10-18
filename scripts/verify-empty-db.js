'use strict';
// Privacy invariant: source/release SQLite files must never contain user data.
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const root = path.resolve(__dirname, '..');
const defaultPaths = ['data/kinoteka.sqlite3','seed-data/kinoteka.sqlite3'].map(x=>path.join(root,x));
function validate(filename){
  if (!fs.existsSync(filename)) throw new Error(`Empty DB missing: ${filename}`);
  for (const suffix of ['-wal','-shm','-journal']) {
    if (fs.existsSync(filename+suffix)) throw new Error(`SQLite sidecar must not be bundled: ${filename+suffix}`);
  }
  const db = new DatabaseSync(filename,{readOnly:true});
  try {
    if (Object.values(db.prepare('PRAGMA integrity_check').get())[0]!=='ok') throw new Error(`Invalid SQLite: ${filename}`);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(x=>x.name).sort();
    if (JSON.stringify(tables)!==JSON.stringify(['state','ui_state'])) throw new Error(`Unexpected tables: ${filename}`);
    const sr=db.prepare('SELECT revision,payload FROM state WHERE id=1').get();
    const ur=db.prepare('SELECT payload FROM ui_state WHERE id=1').get();
    if(!sr||!ur)throw new Error(`Missing canonical rows: ${filename}`);
    const state=JSON.parse(sr.payload),ui=JSON.parse(ur.payload);
    if(state.app!=='Кинотека'||state.formatVersion!==1)throw new Error(`Unexpected identity: ${filename}`);
    for(const field of ['items','favorites','trash'])if(!Array.isArray(state[field])||state[field].length!==0)throw new Error(`Nonempty ${field} in ${filename}`);
    if(Object.hasOwn(state,'letterboxd')||Object.hasOwn(state,'tmdb')||Object.hasOwn(state,'metadata'))throw new Error(`User metadata in ${filename}`);
    if(Object.keys(state).sort().join('|')!==['app','exportType','favorites','formatVersion','items','pageSize','trash'].sort().join('|'))throw new Error(`Unexpected state fields: ${filename}`);
    if(Number(sr.revision)!==0)throw new Error(`Nonzero revision in distributed DB: ${filename}`);
    for(const key of ['search','quickFilter','mediaYear'])if(ui[key]!=='')throw new Error(`UI contains private ${key}: ${filename}`);
    if(ui.sort!=='game-asc'||ui.mediaCategory!=='Все')throw new Error(`Unexpected UI state: ${filename}`);
    if(Object.keys(ui).sort().join('|')!==['mediaCategory','mediaYear','quickFilter','search','sort'].sort().join('|'))throw new Error(`Unexpected UI fields: ${filename}`);
  }finally{db.close()}
}
function verify(paths=defaultPaths){
paths.forEach(validate);
if(paths.length===2){
  const a=fs.readFileSync(paths[0]),b=fs.readFileSync(paths[1]);
  if(!a.equals(b))throw new Error('Distributed live/seed DB pair must be byte-identical');
}
console.log(`EMPTY DATABASE PRIVACY: PASS (${paths.length} SQLite file(s), 0 records)`);

}
module.exports={verify};
if(require.main===module) verify(process.argv.length>2?process.argv.slice(2):defaultPaths);
