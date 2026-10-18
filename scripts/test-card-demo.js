"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {spawnSync}=require('node:child_process');
const {demoItems,populateCardDemo,verifyEmpty}=require('./create-card-demo.js');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'seed-data/kinoteka.sqlite3');
const before=fs.readFileSync(source);
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kinoteka-card-demo-'));
const copy=path.join(temp,'fiction.sqlite3');
try{
  const counts={};for(const row of demoItems)counts[row.category]=(counts[row.category]||0)+1;
  assert.deepEqual(counts,{'Фильмы':5,'Сериалы':5,'Анимация':5});
  assert.equal(new Set(demoItems.map(x=>x.category+'|'+x.name+'|'+x.year)).size,15);
  assert.ok(demoItems.every(x=>x.name.startsWith('TEST ONLY - ')));
  fs.copyFileSync(source,copy);
  const state=populateCardDemo(copy);
  assert.equal(state.items.length,15);
  assert.equal(state.favorites.length,2);
  const db=new DatabaseSync(copy,{readOnly:true});
  try{
    const restored=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);
    assert.deepEqual(restored.items,state.items);
    assert.equal(JSON.parse(db.prepare('SELECT payload FROM ui_state WHERE id=1').get().payload).viewMode,'cards');
    for(const category of ['Фильмы','Сериалы','Анимация'])assert.equal(restored.items.filter(x=>x.category===category).length,5);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  }finally{db.close();}
  assert.throws(()=>populateCardDemo(copy),/EMPTY/,'Never replace populated database');
  const sourceDb=new DatabaseSync(source,{readOnly:true});
  try{verifyEmpty(sourceDb);}finally{sourceDb.close();}
  assert.ok(fs.readFileSync(source).equals(before),'Seed SQLite changed during demo test');
  assert.ok(fs.readFileSync(path.join(root,'data/kinoteka.sqlite3')).equals(before),'Canonical DB changed');
  // End-to-end on-demand generation with a fake test-only EXE in a temporary project.
  const mockRoot=path.join(temp,'mock-project');
  for(const part of ['scripts','seed-data','Portable/Kinoteka_Standalone_v1.2_Preview_1_CLEAN_DEV'])fs.mkdirSync(path.join(mockRoot,part),{recursive:true});
  fs.copyFileSync(path.join(root,'scripts/create-card-demo.js'),path.join(mockRoot,'scripts/create-card-demo.js'));
  fs.copyFileSync(source,path.join(mockRoot,'seed-data/kinoteka.sqlite3'));
  fs.writeFileSync(path.join(mockRoot,'Portable/Kinoteka_Standalone_v1.2_Preview_1_CLEAN_DEV/Kinoteka.exe'),'FAKE TEST ONLY EXECUTABLE');
  const run=()=>spawnSync(process.execPath,['scripts/create-card-demo.js'],{cwd:mockRoot,encoding:'utf8'});
  const created=run();
  assert.equal(created.status,0,created.stderr);
  const resultDir=path.join(mockRoot,'Portable/Kinoteka_Standalone_v1.2_Preview_1_CARD_DEMO');
  const mockDb=new DatabaseSync(path.join(resultDir,'data/kinoteka.sqlite3'),{readOnly:true});
  try{const generated=JSON.parse(mockDb.prepare('SELECT payload FROM state WHERE id=1').get().payload);assert.equal(generated.items.length,15);assert.equal(JSON.parse(mockDb.prepare('SELECT payload FROM ui_state WHERE id=1').get().payload).viewMode,'cards')}finally{mockDb.close();}
  const again=run();
  assert.notEqual(again.status,0,'Must refuse to overwrite existing demo installation');
  assert.match(again.stderr,/already exists/);
  assert.ok(fs.readFileSync(path.join(mockRoot,'seed-data/kinoteka.sqlite3')).equals(before),'Source seed must never change');
  console.log('CARD DEMO QA: PASS (5 films + 5 series + 5 animation, isolated SQLite, non-overwrite, zero shipped records)');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
