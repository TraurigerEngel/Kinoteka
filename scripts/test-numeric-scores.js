'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const bridge=fs.readFileSync(path.join(root,'app/shared/kinoteka-bridge.js'),'utf8');
const core=fs.readFileSync(path.join(root,'app/core.js'),'utf8');
const cards=fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const styles=fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const storage=fs.readFileSync(path.join(root,'src-tauri/src/storage.rs'),'utf8');
assert.match(core,/score10:validScore10\(item\?\.score10\)\?item\.score10:null/);
assert.match(cards,/data-card-score="\$\{i\}"/);
assert.match(cards,/score==null\?'＋':String\(score\)/);
assert.match(cards,/validScore10\(g.score10\)/);
assert.match(styles,/\.kinoteka-film-card \.kinoteka-card-score\{/);
assert.match(storage,/fn valid_score10\(/);
assert.match(storage,/!valid_score10\(object.get\("score10"\)\)/);
let saved;
const window={__TAURI__:{core:{invoke:async(name,params)=>{
  if(name==='persist_movies_state'){ saved=JSON.parse(params.state);return {ok:true}; }
  if(name==='persist_movies_ui')return {ok:true};
  throw new Error(name);
}}},kinotekaStartup:{markReady(){}}};
const document={readyState:'loading',addEventListener(){},documentElement:{style:{setProperty(){}}}};
const context={window,document,console,Promise,Date,structuredClone,setTimeout,clearTimeout};
vm.runInNewContext(bridge.replace('  async function boot() {','  window.__testMakeDatabase = makeDatabase;\n  async function boot() {'),context,{filename:'kinoteka-bridge.js'});
const make=initial=>window.__testMakeDatabase({state:JSON.stringify(initial),ui:'{}'});
const f=(name,year,stars)=>({name,year,watched:true,rating:stars});
(async()=>{
  for(let stars=0.5;stars<=5;stars+=0.5){
    const db=make({items:[],favorites:[],trash:[]});
    const entry=f('Synthetic Score '+stars,2020,stars);
    const result=await db.importLetterboxdConfirmed({entries:[entry],lists:[]});
    assert.equal(result.ok,true,result.error);
    assert.equal(saved.items.length,1);
    assert.equal(saved.items[0].score10,stars*2);
    assert.equal(saved.items[0].rating,stars>=3.5?'Понравилось':stars>=2.5?'Нормально':'Не понравилось');
    const games=JSON.parse(db.getGamesSync());
    assert.equal(games[0].score10,stars*2);
    const repeat=await db.importLetterboxdConfirmed({entries:[entry],lists:[]});
    assert.equal(repeat.added,0);
    assert.equal(saved.items.length,1);
  }
  // Explicit star rating wins even if the export inconsistently also lists it as watchlist.
  const conflicting=make({items:[],favorites:[],trash:[]});
  assert.equal((await conflicting.importLetterboxdConfirmed({entries:[{
    name:'Synthetic Watched Later',year:2026,watchlist:true,watched:false,rating:4
  }],lists:[]})).ok,true);
  assert.equal(saved.items[0].rating,'Понравилось');
  assert.equal(saved.items[0].score10,8);
  const existing={items:[
    {name:'Synthetic A',year:2005,category:'Фильмы',rating:'Нормально'},
    {name:'Synthetic B',year:2006,category:'Фильмы',rating:'Понравилось',score10:9},
    {name:'Synthetic C',year:2007,category:'Фильмы',rating:'Понравилось'},
    {name:'Synthetic D',year:2008,category:'Фильмы',rating:'Смотрю'}
  ],favorites:['Фильмы::Synthetic C::2007'],trash:[]};
  const db=make(existing);
  const result=await db.importLetterboxdConfirmed({entries:[
    f('Synthetic A',2005,5),f('Synthetic B',2006,1),f('Synthetic C',2007,1.5),
    {name:'Synthetic D',year:2008,watched:true,rating:null},
    {name:'Synthetic No Score',year:2022,watched:true,rating:null}
  ],lists:[]});
  assert.equal(result.ok,true,result.error);
  assert.equal(result.added,1);
  assert.equal(saved.items[0].rating,'Нормально','matched status must be preserved');
  assert.equal(saved.items[0].score10,10,'matched score can be filled in');
  assert.equal(saved.items[1].rating,'Понравилось');
  assert.equal(saved.items[1].score10,9,'previous manual numeric score never overridden');
  assert.equal(saved.items[2].score10,3,'favorite can receive a score without losing favorite');
  assert.deepEqual(saved.favorites,existing.favorites);
  assert.equal(saved.items[3].rating,'Смотрю');
  assert.equal(saved.items[3].score10,undefined);
  assert.equal(saved.items[4].score10,undefined);
  const modified=JSON.parse(db.getGamesSync());
  modified[0].score10=6;modified[1].score10=null;
  const res=await db.replaceGamesConfirmed(JSON.stringify(modified));
  assert.equal(res.ok,true,res.error);
  assert.equal(saved.items[0].score10,6);
  assert.equal('score10' in saved.items[1],false);
  assert.deepEqual(saved.favorites,existing.favorites);
  assert.equal(JSON.parse(db.getGamesSync())[0].score10,6,'numeric score roundtrip');
  // Real user's ZIP must never be loaded by QA or included in a patch.
  const {DatabaseSync}=require('node:sqlite');
  for(const filepath of ['data/kinoteka.sqlite3','seed-data/kinoteka.sqlite3']){
    const testDb=new DatabaseSync(path.join(root,filepath),{readOnly:true});
    const state=JSON.parse(testDb.prepare('SELECT payload FROM state WHERE id=1').get().payload);
    assert.equal(state.items.length,0);testDb.close();
  }
  console.log('NUMERIC SCORES QA: PASS (all 10 stars, matched preserve, favorite preserve, empty ratings, SQLite roundtrip, clean distributed data)');
})().catch(error=>{console.error(error);process.exitCode=1});
