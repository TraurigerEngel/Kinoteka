"use strict";
// Hotfix 12: create a wholly fictional, isolated CARD_DEMO portable installation.
// NEVER writes the canonical sources or an existing user's portable directory.
const fs=require('node:fs');
const path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const root=path.resolve(__dirname,'..');

const demoItems=Object.freeze([
  ['TEST ONLY - Aurora Ledger',2023,'Фильмы','Нормально'],
  ['TEST ONLY - Blue Lantern',2016,'Фильмы','Не понравилось'],
  ['TEST ONLY - Copper Horizon',2008,'Фильмы','Понравилось'],
  ['TEST ONLY - Echo District',2020,'Фильмы','Запланировано'],
  ['TEST ONLY - Glass Comet',2017,'Фильмы','Понравилось'],
  ['TEST ONLY - Lunar Archive',2024,'Сериалы','Понравилось'],
  ['TEST ONLY - Opal Harbor',2018,'Сериалы','Нормально'],
  ['TEST ONLY - Paper Galaxy',2021,'Сериалы','Смотрю'],
  ['TEST ONLY - Phantom Station',2025,'Сериалы','Запланировано'],
  ['TEST ONLY - River Antenna',2012,'Сериалы','Не понравилось'],
  ['TEST ONLY - Distant Postcard',2027,'Анимация','Запланировано'],
  ['TEST ONLY - Future Moth',2026,'Анимация','Запланировано'],
  ['TEST ONLY - Marshmallow Signal',2022,'Анимация','Нормально'],
  ['TEST ONLY - Silent Orchard',2015,'Анимация','Понравилось'],
  ['TEST ONLY - Violet Transit',2019,'Анимация','Понравилось']
].map(([name,year,category,rating])=>Object.freeze({name,year,category,rating})));

function verifyEmpty(db){
  const state=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);
  if(state.app!=='Кинотека'||state.formatVersion!==1||
     !Array.isArray(state.items)||state.items.length||state.trash?.length||state.favorites?.length||
     state.letterboxd || state.tmdb || state.metadata){
    throw new Error('Only a canonical EMPTY development database can be used for the demo.');
  }
  return state;
}
function populateCardDemo(dbFile){
  const db=new DatabaseSync(dbFile);
  try{
    const state=verifyEmpty(db);
    state.items=demoItems.map(x=>({...x}));
    state.favorites=['Сериалы::TEST ONLY - Lunar Archive::2024','Анимация::TEST ONLY - Silent Orchard::2015'];
    const ui=JSON.parse(db.prepare('SELECT payload FROM ui_state WHERE id=1').get().payload);
    ui.viewMode='cards';
    db.exec('BEGIN IMMEDIATE');
    try{
      db.prepare('UPDATE ui_state SET payload=?,updated_at=? WHERE id=1').run(JSON.stringify(ui),'2026-10-18T00:00:00.000Z');
      db.prepare('UPDATE state SET payload=?,revision=1,updated_at=? WHERE id=1').run(JSON.stringify(state),'2026-10-18T00:00:00.000Z');
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error;}
    if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('Demo SQLite integrity check failed.');
    return state;
  }finally{db.close();}
}
function createPortableCardDemo(){
  const template=path.join(root,'seed-data','kinoteka.sqlite3');
  const source=path.join(root,'Portable','Kinoteka_Standalone_v1.2_Preview_1_CLEAN_DEV','Kinoteka.exe');
  const parent=path.join(root,'Portable');
  const target=path.join(parent,'Kinoteka_Standalone_v1.2_Preview_1_CARD_DEMO');
  if(!fs.existsSync(source))throw new Error('First run BUILD-DEV.cmd to create CLEAN_DEV\\Kinoteka.exe');
  if(!fs.existsSync(template))throw new Error('Empty source SQLite is missing.');
  if(fs.existsSync(target))throw new Error('CARD_DEMO already exists. It will NOT be overwritten. Keep or rename it before creating a new demo.');
  // All clean validation happens before creating the output directory.
  const check=new DatabaseSync(template,{readOnly:true});
  try{verifyEmpty(check);}finally{check.close();}
  fs.mkdirSync(parent,{recursive:true});
  const scratch=fs.mkdtempSync(path.join(parent,'.kinoteka-card-demo-building-'));
  try{
    fs.mkdirSync(path.join(scratch,'data'));
    fs.mkdirSync(path.join(scratch,'seed-data'));
    fs.copyFileSync(source,path.join(scratch,'Kinoteka.exe'));
    fs.copyFileSync(template,path.join(scratch,'seed-data','kinoteka.sqlite3'));
    const targetDb=path.join(scratch,'data','kinoteka.sqlite3');
    fs.copyFileSync(template,targetDb);
    const state=populateCardDemo(targetDb);
    if(state.items.length!==15)throw new Error('Demo count mismatch.');
    fs.renameSync(scratch,target);
  }catch(error){fs.rmSync(scratch,{recursive:true,force:true});throw error;}
  console.log('CARD DEMO READY: 15 fictional records (5 films, 5 series, 5 animation).');
  console.log('Only separate CARD_DEMO/data/kinoteka.sqlite3 contains test data.');
  console.log('Demo EXE: '+path.join(target,'Kinoteka.exe'));
}
module.exports={demoItems,populateCardDemo,createPortableCardDemo,verifyEmpty};
if(require.main===module){try{createPortableCardDemo();}catch(error){console.error('CARD DEMO FAILED: '+error.message);process.exitCode=1;}}
