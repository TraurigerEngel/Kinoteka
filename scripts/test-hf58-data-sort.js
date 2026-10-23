'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const html=read('app/index.html'),runtime=read('app/runtime.js'),core=read('app/core.js'),games=read('app/games.js'),bridge=read('app/shared/kinoteka-bridge.js'),rust=read('src-tauri/src/storage.rs');
const options=Array.from(html.matchAll(/<option value="([^\"]+)"/g),m=>m[1]).filter(x=>['game-asc','game-desc','year-asc','year-desc','score-asc','score-desc','added-asc','added-desc','status','category','favorite-first','score-missing','poster-missing'].includes(x));
assert.equal(options.length,13);
assert(!html.includes('value="random"') && !html.includes('kinotekaReshuffle'));
assert(!games.includes('kinotekaRandomRank'));
assert.match(runtime,/sort\.dispatchEvent\(new Event\("change",\{bubbles:true\}\)\)/);
assert.match(core,/u\.sort==="random"\)scheduleSaveUI\(\)/);
assert.match(rust,/sort == "random"/,'legacy random UI must not mark a valid SQLite database corrupt');
assert.match(core,/addedAt:item\.addedAt/);
assert.match(bridge,/addedAt:new Date\(\)\.toISOString\(\)/);
assert.match(rust,/valid_added_at\(object\.get\("addedAt"\)\)/);
// Run the actual HF58 sorting function from games.js, including legacy/dated order and all six statuses.
const start=games.indexOf('// HF52: sorting never mutates games');
const end=games.indexOf('function filtered(){',start);
assert(start>=0&&end>start);
const entries=[
 {game:'Бета',rating:'Запланировано'},
 {game:'Гамма',rating:'Не понравилось'},
 {game:'Эпсилон',rating:'Понравилось'},
 {game:'Тета',rating:'Избранное'},
 {game:'Дельта',rating:'Нормально'},
 {game:'Альфа',rating:'Смотрю'},
 {game:'Омега',rating:'Запланировано',addedAt:'2026-10-24T12:00:00.000Z'},
 {game:'Каппа',rating:'Понравилось',addedAt:'2026-10-23T10:00:00.000Z'}
].map((x,i)=>({...x,id:i+1,year:2000+i,category:'Фильмы'}));
const validAddedAt=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
const ctx={sort:{value:'game-asc'},games:entries,posterExistsByKey:new Map(), db:{getPosterKeyFor:()=>''},entryNameNorm:x=>x.game.toLowerCase(),validScore10:()=>false,validAddedAt};
vm.createContext(ctx);
vm.runInContext('let sortedRowsCache=null;'+games.slice(start,end)+'globalThis.getSorted=getSortedRows;',ctx);
const order=mode=>{ctx.sort.value=mode;return [...ctx.getSorted()].map(x=>x.g.game)};
assert.deepEqual(order('status'),['Тета','Каппа','Эпсилон','Дельта','Гамма','Альфа','Бета','Омега']);
assert.deepEqual(order('added-asc'),['Бета','Гамма','Эпсилон','Тета','Дельта','Альфа','Каппа','Омега']);
assert.deepEqual(order('added-desc'),['Омега','Каппа','Альфа','Дельта','Тета','Эпсилон','Гамма','Бета']);
assert.deepEqual(entries.map(x=>x.game),['Бета','Гамма','Эпсилон','Тета','Дельта','Альфа','Омега','Каппа']);
// Exercise actual bridge state serialization for a new date, an old undated record,
// status changes, deletion-to-trash and restoration without losing provenance.
const bstart=bridge.indexOf('function movieKey('),bend=bridge.indexOf('async function boot()',bstart);
assert(bstart>=0&&bend>bstart);
let stored=null;
const fake={
  structuredClone, Date, Promise, Set, Map, JSON, String, Number, Boolean,
  validArray:raw=>JSON.parse(raw),
  invoke:async (name,args)=>{
    if(name==='persist_movies_state'){stored=JSON.parse(args.state);return {ok:true};}
    if(name==='persist_movies_ui')return {ok:true};
    throw Error(name);
  },
  queuePersistence:fn=>fn(),enqueuePersistence:fn=>fn(),
  resultState:(games,trash)=>({ok:true,games,trash}),
};
vm.createContext(fake);
vm.runInContext(bridge.slice(bstart,bend)+'globalThis.databaseFactory=makeDatabase;',fake);
const initial={app:'Кинотека',formatVersion:1,items:[
  {name:'Старый',category:'Фильмы',year:2000,rating:'Нормально'},
  {name:'Новый',category:'Фильмы',year:2025,rating:'Запланировано',addedAt:'2026-10-24T11:22:33.000Z'}
],favorites:[],trash:[]};
(async()=>{
const db=fake.databaseFactory({state:JSON.stringify(initial),ui:null});
const before=JSON.parse(db.getGamesSync());
assert(!Object.hasOwn(before[0],'addedAt'));
assert.equal(before[1].addedAt,'2026-10-24T11:22:33.000Z');
before[1].rating='Понравилось';
let result=await db.replaceGamesConfirmed(JSON.stringify(before));assert(result.ok,result.error);
assert.equal(stored.items[1].addedAt,'2026-10-24T11:22:33.000Z');
assert(!Object.hasOwn(stored.items[0],'addedAt'));
result=await db.moveGameToTrash(2);assert(result.ok,result.error);
assert.equal(stored.trash[0].addedAt,'2026-10-24T11:22:33.000Z');
result=await db.restoreTrash(1);assert(result.ok,result.error);
assert.equal(stored.items.at(-1).addedAt,'2026-10-24T11:22:33.000Z');
console.log('HF58 DATA/SORT: PASS (13 sorts, real timestamps, legacy unknown preserved, status groups, reset label, bridge roundtrip + trash, random migration)');
})().catch(e=>{console.error(e);process.exitCode=1;});
