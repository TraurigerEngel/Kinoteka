'use strict';
// Synthetic-only end-to-end import check; NEVER mutates a shipped/local SQLite.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const vm=require('node:vm');
const { DatabaseSync }=require('node:sqlite');
const root=path.resolve(__dirname,'..');
const core=require('../app/shared/library-integration-core.js');
const filename=path.join(root,'test-data/Letterboxd_SYNTHETIC_15_TEST_ONLY.zip');
const bytes=fs.readFileSync(filename);
(async()=>{
 const parsed=await core.parseFile({name:'Letterboxd_SYNTHETIC_15_TEST_ONLY.zip',size:bytes.length,arrayBuffer:async()=>Uint8Array.from(bytes).buffer});
 assert.equal(parsed.entries.length,15);
 assert.equal(parsed.lists.length,1);
 assert.equal(parsed.lists[0].name,'ТЕСТОВЫЙ список (вымышленные фильмы)');
 assert.equal(parsed.lists[0].films.length,6);
 for (const [name,count] of Object.entries({watched:11,watchlist:4,ratings:11,diary:3,reviews:2,lists:1,files:6}))
  assert.equal(parsed.stats[name],count,`${name} count mismatch`);
 assert.ok(parsed.entries.every(x=>x.name.startsWith('TEST ONLY - ')),'Fixture must use only obviously fake names');
 assert.equal(parsed.entries[0].reviews[0].review,'Synthetic, fake review.\nSecond line with a comma, "quotes".');
 assert.equal(parsed.entries[0].diary.length,2,'Rewatch must have distinct diary entries');
 const db=new DatabaseSync(path.join(root,'data/kinoteka.sqlite3'),{readOnly:true});
 let cleanState,cleanUi;
 try{
  cleanState=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);
  cleanUi=JSON.parse(db.prepare('SELECT payload FROM ui_state WHERE id=1').get().payload);
 }finally{db.close()}
 assert.equal(cleanState.items.length,0,'Canonical development SQLite MUST remain empty');
 const bridgeSource=fs.readFileSync(path.join(root,'app/shared/kinoteka-bridge.js'),'utf8')
  .replace('  async function boot() {','  window.__testMakeDatabase = makeDatabase;\n  async function boot() {');
 // Use an isolated temporary SQLite copied from the empty template.
 const scratchDir=fs.mkdtempSync(path.join(os.tmpdir(),'kinoteka-synthetic-qa-'));
 const scratchPath=path.join(scratchDir,'scratch.sqlite3');
 fs.copyFileSync(path.join(root,'data/kinoteka.sqlite3'),scratchPath);
 const scratch=new DatabaseSync(scratchPath);
 let stored=structuredClone(cleanState),writes=0;
 const window={__TAURI__:{core:{invoke:async(command,args)=>{
  if(command==='persist_movies_state'){
   scratch.prepare('UPDATE state SET payload=?,revision=revision+1,updated_at=? WHERE id=1')
     .run(args.state,'2026-10-18T00:00:00.000Z');
   stored=JSON.parse(scratch.prepare('SELECT payload FROM state WHERE id=1').get().payload);
   writes++;return {ok:true};
  }
  if(command==='persist_movies_ui')return {ok:true};
  throw new Error(`Unexpected invocation: ${command}`);
 }}},kinotekaStartup:{markReady(){}}};
 const document={readyState:'loading',addEventListener(){},documentElement:{style:{setProperty(){}}}};
 vm.runInNewContext(bridgeSource,{window,document,console,Promise,Date,structuredClone,setTimeout,clearTimeout},{filename:'kinoteka-bridge.js'});
 assert.equal(typeof window.__testMakeDatabase,'function','Test adapter was not installed');
 const adapter=window.__testMakeDatabase({state:JSON.stringify(cleanState),ui:JSON.stringify(cleanUi)});
 const firstPlan=adapter.previewLetterboxd(parsed);
 assert.deepEqual([firstPlan.total,firstPlan.added,firstPlan.matched,firstPlan.reviewRequired,firstPlan.lists],[15,15,0,0,1]);
 const first=await adapter.importLetterboxdConfirmed(parsed);
 assert.equal(first.ok,true,first.error);
 assert.equal(first.added,15);
 assert.equal(stored.items.length,15);
 assert.equal(stored.letterboxd.lists[0].films.length,6);
 assert.equal(stored.letterboxd.records[Object.keys(stored.letterboxd.records)[0]].rating,5);
 assert.equal(stored.items.filter(x=>x.rating==='Запланировано').length,4);
 // Simulate app restart: reload the state FROM scratch SQLite, then import again.
 const loaded=JSON.parse(scratch.prepare('SELECT payload FROM state WHERE id=1').get().payload);
 const reopened=window.__testMakeDatabase({state:JSON.stringify(loaded),ui:JSON.stringify(cleanUi)});
 assert.equal(reopened.previewLetterboxd(parsed).matched,15);
 const again=await reopened.importLetterboxdConfirmed(parsed);
 assert.equal(again.ok,true,again.error);
 assert.equal(again.added,0,'Repeated import must not add duplicates');
 assert.equal(again.matched,15,'Repeated import must find all 15 prior records');
 assert.equal(stored.items.length,15);
 assert.equal(writes,2,'One transaction per confirmation');
 // A read-only canonical database remains untouched: no actual user or synthetic records shipped.
 const check=new DatabaseSync(path.join(root,'data/kinoteka.sqlite3'),{readOnly:true});
 try{assert.equal(JSON.parse(check.prepare('SELECT payload FROM state WHERE id=1').get().payload).items.length,0);}
 finally{check.close()}
 scratch.close();
 fs.rmSync(scratchDir,{recursive:true,force:true});
 console.log('SYNTHETIC LETTERBOXD QA: PASS (15 fiction-only records, temporary SQLite, restart/reimport, 1 list, zero distributed data)');
})().catch(error=>{console.error(error);process.exitCode=1});
