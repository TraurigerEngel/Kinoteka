'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const imp=require('../app/shared/library-integration-core.js');
// Hotfix 4 regression: the labeled toolbar action must not inherit the
// 32px icon-button width, even from the legacy !important toolbar rules.
const integrationCss=fs.readFileSync(path.join(root,'app/shared/library-integration.css'),'utf8');
assert.match(integrationCss,/\.list-nav \.list-actions #integrationOpen\.kinoteka-integration-action\s*\{[^}]*width:max-content!important;/s);
assert.match(integrationCss,/\.list-nav \.list-actions #integrationOpen\.kinoteka-integration-action\s*\{[^}]*padding:0 12px!important;/s);
assert.match(integrationCss,/\.list-nav \.list-actions #integrationOpen\.kinoteka-integration-action\s*\{[^}]*overflow:hidden!important;/s);

const csv='Name,Year,Letterboxd URI\r\n"The Thing",1982,https://letterboxd.com/film/the-thing/\r\n"Paris, Texas",1984,https://letterboxd.com/film/paris-texas/\r\n';
// A minimal standard ZIP with STORE + DEFLATE and a CRC32 that exercises the
// same data paths as Letterboxd archives created by common ZIP exporters.
function crc32(buffer){let c=0xffffffff;for(const b of buffer){c^=b;for(let n=0;n<8;n++)c=c>>>1^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function zip(entries){
 let offset=0,local=[],central=[];
 for(const [name,content,method=8] of entries){
  const bytes=Buffer.from(content),pathBytes=Buffer.from(name),deflated=method===8?zlib.deflateRawSync(bytes):bytes;
  const head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(0x800,6);head.writeUInt16LE(method,8);head.writeUInt32LE(crc32(bytes),14);head.writeUInt32LE(deflated.length,18);head.writeUInt32LE(bytes.length,22);head.writeUInt16LE(pathBytes.length,26);
  local.push(head,pathBytes,deflated);
  const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(0x800,8);ch.writeUInt16LE(method,10);ch.writeUInt32LE(crc32(bytes),16);ch.writeUInt32LE(deflated.length,20);ch.writeUInt32LE(bytes.length,24);ch.writeUInt16LE(pathBytes.length,28);ch.writeUInt32LE(offset,42);central.push(ch,pathBytes);
  offset+=head.length+pathBytes.length+deflated.length;
 }
 const centralBuf=Buffer.concat(central);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralBuf.length,12);end.writeUInt32LE(offset,16);
 return Buffer.concat([...local,centralBuf,end]);
}
const lbZip=zip([
 ['account/watched.csv',csv],
 ['account/watchlist.csv','Name,Year\nNew Film,2001\n'],
 ['account/ratings.csv','Name,Year,Rating\nThe Thing,1982,4.5\n'],
 ['account/diary.csv','Date,Name,Year,Rating,Rewatch,Tags,Watched Date\n2022-03-12,The Thing,1982,4.5,True,"classic, horror",2022-03-11\n'],
 ['account/reviews.csv','Date,Name,Year,Rating,Rewatch,Review,Tags,Watched Date\n2022-03-12,The Thing,1982,4.5,True,"So good, \"\"really\"\"\nnow",horror,2022-03-11\n'],
 ['account/lists/favourites.csv','Name,Year\nThe Thing,1982\n"Paris, Texas",1984\n'],
 ['lists/null-54008077.csv','Letterboxd list export v7\r\nDate,Name,Tags,URL,Description\r\n2024-11-20,Сериалы,,https://boxd.it/Ay7Gc,\r\n\r\nPosition,Name,Year,URL,Description\r\n1,Game of Thrones The IMAX Experience,2015,https://boxd.it/at0I,\r\n2,Sherlock: The Abominable Bride,2016,https://boxd.it/dbTQ,\r\n3,Maigret,2016,https://boxd.it/dAP0,\r\n'],
 ['deleted/diary.csv','Date,Name,Year,Rating\nDeleted Film,2019,4.5\n'],
 ['orphaned/reviews.csv','Date,Name,Year,Review\nOrphaned Film,2020,Not Active\n'],
 ['deleted/lists/deleted-list.csv','Name,Year\nDeleted List Film,2020\n'],
 ['account/deleted/watched.csv','Name,Year\nShould Not Import,2000\n'],
 ['account/profile.csv','Name,Year\nShould Not Import,2000\n']
]);
(async()=>{
 const output=await imp.parseFile({name:'Letterboxd_Export.zip',size:lbZip.length,arrayBuffer:async()=>Uint8Array.from(lbZip).buffer});
 assert.equal(output.entries.length,6);
 assert.equal(output.lists.length,2);
 assert.equal(output.stats.files,7,'Ignored deleted/orphaned exports must never be unpacked as active CSVs');
 assert.equal(output.stats.diary,1);
 assert.equal(output.stats.reviews,1);
 assert.equal(output.stats.lists,2);
 const series=output.lists.find(x=>x.slug==='null-54008077');
 assert.equal(series.name,'Сериалы','Read UTF-8 list title from Letterboxd v7 metadata, not filename');
 assert.equal(series.createdAt,'2024-11-20');
 assert.equal(series.url,'https://boxd.it/Ay7Gc');
 assert.equal(series.films.length,3);
 assert.deepEqual(series.films.map(k=>output.entries.find(e=>imp.key(e.name,e.year)===k).name),
   ['Game of Thrones The IMAX Experience','Sherlock: The Abominable Bride','Maigret']);
 assert.equal(output.entries.some(x=>['Deleted Film','Orphaned Film','Deleted List Film'].includes(x.name)),false);
 assert.equal(output.entries.find(x=>x.name==='The Thing').rating,4.5);
 assert.equal(output.entries.find(x=>x.name==='The Thing').reviews[0].review,'So good, "really"\nnow');
 assert.equal(output.entries.find(x=>x.name==='The Thing').diary[0].rewatch,true);
 assert.equal(output.entries.find(x=>x.name==='The Thing').diary[0].date,'2022-03-11');
 assert.equal(output.entries.find(x=>x.name==='The Thing').tags.includes('horror'),true);
 assert.equal(output.lists[0].films.length,2);
 assert.equal(output.entries.some(x=>x.name==='Should Not Import'),false);
 assert.equal(imp.csvRows('Name,Year,Review\r\n"A, B",2000,"One\nTwo"\r\n')[0].review,'One\nTwo');
 await assert.rejects(()=>imp.parseFile({name:'oops.csv',size:5,arrayBuffer:async()=>Buffer.from('123').buffer}),/должен называться/);
 const corrupted=Buffer.from(lbZip);corrupted[60]^=1;
 await assert.rejects(()=>imp.parseFile({name:'bad.zip',size:corrupted.length,arrayBuffer:async()=>Uint8Array.from(corrupted).buffer}),/контрольная сумма|повреж|decompress|incorrect|invalid/i);
 const emptyLists=zip([['foo/lists/saved.csv','Name,Year\n'],['foo/watched.csv','Name,Year\nOne,2001\n']]);
 const noList=await imp.parseFile({name:'export.zip',size:emptyLists.length,arrayBuffer:async()=>Uint8Array.from(emptyLists).buffer});
 assert.equal(noList.lists.length,0);
 assert.equal(noList.entries.length,1);
 const statePath=path.join(root,'data/kinoteka.sqlite3');
 const {DatabaseSync}=require('node:sqlite');
 const db=new DatabaseSync(statePath,{readOnly:true});
 let orig=JSON.parse(db.prepare('SELECT payload FROM state WHERE id=1').get().payload);
 assert.equal(orig.items.length,0,'Development canonical state must be empty');
 assert.equal(orig.favorites.length,0,'Development canonical favorites must be empty');
 const ui=JSON.parse(db.prepare('SELECT payload FROM ui_state WHERE id=1').get().payload);
 db.close();
 // Tests use fabricated records in memory; shipped SQLite remains empty.
 orig=structuredClone(orig);
 orig.items.push(
   {name:'The Thing',year:1982,category:'Фильмы',rating:'Нормально'},
   {name:'Synthetic Favorite',year:2002,category:'Фильмы',rating:'Понравилось'});
 orig.favorites.push('Фильмы::Synthetic Favorite::2002');
 const source=fs.readFileSync(path.join(root,'app/shared/kinoteka-bridge.js'),'utf8')
   .replace('  async function boot() {','  window.__testMakeDatabase = makeDatabase;\n  async function boot() {');
 let state=structuredClone(orig),commitCount=0;
 const window={__TAURI__:{core:{invoke:async(command,params)=>{
   if(command==='persist_movies_state') {state=JSON.parse(params.state);commitCount++;return {ok:true};}
   if(command==='persist_movies_ui')return {ok:true};
   throw new Error(`Unexpected invoke ${command}`);
 }}},kinotekaStartup:{markReady(){}}};
 const document={readyState:'loading',addEventListener(){},documentElement:{style:{setProperty(){}}}};
 const context={window,document,console,Promise,Date,structuredClone,setTimeout,clearTimeout};
 vm.runInNewContext(source,context,{filename:'kinoteka-bridge.js'});
 const database=window.__testMakeDatabase({state:JSON.stringify(orig),ui:JSON.stringify(ui)});
 const beforeStatus=orig.items[0].rating;
 const beforeFavorites=[...orig.favorites];
 const preview=database.previewLetterboxd(output);
 assert.equal(preview.total,6);
 assert.equal(preview.lists,2);
 const result=await database.importLetterboxdConfirmed(output);
 assert.equal(result.ok,true,result.error);
 assert.equal(state.items.length,orig.items.length+result.added);
 assert.equal(state.items[0].rating,beforeStatus);
 assert.deepEqual(state.favorites,beforeFavorites);
 assert.deepEqual(state.trash,orig.trash);
 assert.equal(Object.keys(state.letterboxd.records).length,6);
 assert.equal(state.letterboxd.lists.length,2);
 assert.equal(state.letterboxd.lists.find(x=>x.slug==='null-54008077').name,'Сериалы');
 const second=await database.importLetterboxdConfirmed(output);
 assert.equal(second.ok,true,second.error);
 assert.equal(second.added,0,'Repeat Letterboxd import must not duplicate films');
 assert.equal(state.items.length,orig.items.length+result.added);
 const localGames=JSON.parse(database.getGamesSync());
 localGames.push({game:'Kinoteka Synthetic Film 2026',year:2026,category:'Фильмы',rating:'Запланировано'});
 const manual=await database.replaceGamesConfirmed(JSON.stringify(localGames));
 assert.equal(manual.ok,true,manual.error);
 assert.equal(state.items.length,orig.items.length+result.added+1);
 assert.equal(commitCount,3,'One confirmed SQLite transaction per import or manual edit');

 // Hotfix 5 — review must be authoritative in persistence, not just a UI warning.
 const originalWithAliases={items:[],favorites:[],trash:[]};
 originalWithAliases.items.push(
   {name:'Грань будущего',year:2014,category:'Фильмы',rating:'Понравилось'},
   {name:'Flight Plan',year:2005,category:'Фильмы',rating:'Нормально'},
   {name:'The Avengers',year:2012,category:'Фильмы',rating:'Не понравилось'},
   {name:'The Thing',year:1982,category:'Фильмы',rating:'Не понравилось'});
 originalWithAliases.trash.push({name:'Trash Test',year:2018,category:'Фильмы',rating:'Нормально'});
 state=structuredClone(originalWithAliases);commitCount=0;
 const db5=window.__testMakeDatabase({state:JSON.stringify(originalWithAliases),ui:JSON.stringify(ui)});
 const entries5=imp.fromFiles([
   {name:'watched.csv',isList:false,rows:imp.csvRows('Name,Year,Rating\nThe Thing,1982,4.5\nEdge of Tomorrow,2014,4.5\nFlight-Plan,2005,4\nAvengers,2012,3\nBrand New Movie,2026,4\nTrash Test,2018,2\n')},
   {name:'lists/other.csv',isList:true,rows:imp.csvRows('Name,Year\nEdge of Tomorrow,2014\nFlight-Plan,2005\nBrand New Movie,2026\n'),listMeta:{name:'My Favorites'}}
 ]);
 let p5=db5.previewLetterboxd(entries5);
 assert.equal(p5.total,6);
 assert.equal(p5.matched,2,'Exact + unambiguous normalized name/year/category should match automatically');
 assert.equal(p5.rows.find(x=>x.name==='Flight-Plan').reason,'normalized-exact');
 assert.equal(p5.trashed,1,'Trash should not be restored');
 assert.equal(p5.reviewRequired,1,'Only genuinely fuzzy names must require review');
 assert.equal(p5.added,2,'Cross-language matches are never silently assumed');
 assert.equal((await db5.importLetterboxdConfirmed(entries5)).ok,false,'Unresolved similarity must BLOCK save');
 assert.equal(commitCount,0,'Blocked import must never persist');
 const flight=p5.rows.find(x=>x.name==='Flight-Plan'),avengers=p5.rows.find(x=>x.name==='Avengers');
 const edge=p5.rows.find(x=>x.name==='Edge of Tomorrow');
 const brand=p5.rows.find(x=>x.name==='Brand New Movie');
 const target=(name)=>p5.local.find(x=>x.name===name)?.identity;
 assert.ok(target('Грань будущего'));
 const choices={
   [avengers.sourceKey]:{action:'add'},
   [edge.sourceKey]:{action:'match',targetIdentity:target('Грань будущего')},
   [brand.sourceKey]:{action:'skip'}
 };
 assert.equal(db5.previewLetterboxd(entries5,choices).reviewRequired,0);
 assert.equal(db5.previewLetterboxd(entries5,choices).manualMatched,1);
 assert.equal(db5.previewLetterboxd(entries5,choices).skipped,1);
 const badChoices={...choices,[avengers.sourceKey]:{action:'match',targetIdentity:'фильмы\u0000missing\u00002005'}};
 assert.equal((await db5.importLetterboxdConfirmed(entries5,badChoices)).ok,false,'Stale target must be rejected');
 assert.equal(commitCount,0,'Stale target must never be committed');
 const trashNear={entries:[{name:'Trash-Test',year:2018,watched:true}],lists:[]};
 assert.equal(db5.previewLetterboxd(trashNear).reviewRequired,1,'Fuzzy matches in Trash must also require review');
 assert.equal(db5.previewLetterboxd(trashNear).rows[0].candidates[0].trash,true);
 assert.equal((await db5.importLetterboxdConfirmed(trashNear)).ok,false,'Fuzzy Trash candidate blocks unsafe reimport');
 const result5=await db5.importLetterboxdConfirmed(entries5,choices);
 assert.equal(result5.ok,true,result5.error);
 assert.equal(result5.added,1,'Only explicitly approved separate entry gets added');
 assert.equal(commitCount,1,'One transaction after human review');
 assert.equal(state.items.length,originalWithAliases.items.length+1);
 assert.equal(state.items.find(x=>x.name==='Грань будущего').rating,'Понравилось','Existing status stays');
 assert.deepEqual(state.trash,originalWithAliases.trash);
 assert.deepEqual(state.favorites,originalWithAliases.favorites);
 assert.equal(state.letterboxd.records[edge.sourceKey].targetIdentity,target('Грань будущего'));
 assert.ok(!state.letterboxd.records[brand.sourceKey],'Skipped record not persisted');
 assert.deepEqual(state.letterboxd.lists[0].films,[target('Грань будущего'),target('Flight Plan')],
   'Manual mapping updates list targets and skipped entries do not leak into lists');
 const repeat5=await db5.importLetterboxdConfirmed(entries5);
 assert.equal(repeat5.ok,true,repeat5.error);
 assert.equal(repeat5.added,0,'Reimport retains previously approved cross-language target');
 assert.equal(state.items.length,originalWithAliases.items.length+1);
 // Trusted TMDB aliases match, but only with a single candidate.
 const withCatalog=structuredClone(originalWithAliases);
 withCatalog.catalog={schema:1,cards:{[target('Грань будущего')]:{tmdbId:137113,mediaType:'movie',aliases:['Edge of Tomorrow']}}};
 const dbTmdb=window.__testMakeDatabase({state:JSON.stringify(withCatalog),ui:JSON.stringify(ui)});
 const tmdbSingle={entries:[{name:'Edge of Tomorrow',year:2014,watched:true,rating:5,tmdbId:137113,mediaType:'movie'}],lists:[]};
 assert.equal(dbTmdb.previewLetterboxd(tmdbSingle).matched,1);
 assert.equal(dbTmdb.previewLetterboxd(tmdbSingle).rows[0].reason,'tmdb');
 assert.equal((await dbTmdb.importLetterboxdConfirmed(tmdbSingle)).ok,true);
 assert.equal(state.items.length,withCatalog.items.length,'No duplicate when trusted TMDB alias matches');
 // Hotfix 6: exact normalized match only with unique same-year, same type.
 const typedState={items:[
   {name:'The - Arrival',year:2016,category:'Фильмы',rating:'Понравилось'},
   {name:'The Arrival',year:2016,category:'Сериалы',rating:'Не понравилось'},
   {name:'Some Movie!',year:2011,category:'Фильмы',rating:'Нормально'},
   {name:'A-Series Show',year:2024,category:'Сериалы',rating:'Нормально'},
   {name:'Another Show',year:2023,category:'Сериалы',rating:'Нормально'},
   {name:'Dup-Case',year:2017,category:'Фильмы',rating:'Нормально'}
 ],favorites:[],trash:[{name:'Dup Case',year:2017,category:'Сериалы',rating:'Нормально'}]};
 state=structuredClone(typedState);commitCount=0;
 const db6=window.__testMakeDatabase({state:JSON.stringify(typedState),ui:JSON.stringify(ui)});
 const sample6={entries:[
   {name:'Some-Movie',year:2011,watched:true},
   {name:'A Series Show',year:2024,watched:true},
   {name:'Another-Show',year:2023,watched:true,mediaType:'tv'},
   {name:'The Arrival',year:2016,watched:true},
   {name:'Dup Case',year:2017,watched:true},
   {name:'Totally Different',year:2010,watched:true}
 ],lists:[]};
 const safe6=db6.previewLetterboxd(sample6);
 assert.equal(safe6.rows.find(x=>x.name==='Some-Movie').reason,'normalized-exact');
 assert.equal(safe6.rows.find(x=>x.name==='Another-Show').reason,'normalized-exact','Explicit TV type can match TV');
 assert.equal(safe6.rows.find(x=>x.name==='A Series Show').action,'review','Category mismatch must not automatically link');
 assert.equal(safe6.rows.find(x=>x.name==='A Series Show').bulkEligible,true,'Only unambiguous exact name/year may be batched after selection');
 assert.equal(safe6.rows.find(x=>x.name==='The Arrival').action,'review','Ambiguous local Film/TV exact title must block');
 assert.equal(safe6.rows.find(x=>x.name==='The Arrival').bulkEligible,false);
 assert.equal(safe6.rows.find(x=>x.name==='Dup Case').action,'review','Local/trash ambiguous exact normalized title must block');
 assert.equal(safe6.rows.find(x=>x.name==='Dup Case').bulkEligible,false);
 assert.equal(safe6.rows.find(x=>x.name==='Totally Different').action,'add');
 assert.equal((await db6.importLetterboxdConfirmed(sample6)).ok,false,'Any undecided conflicts block atomic persistence');
 assert.equal(commitCount,0);
 const local6=n=>safe6.local.find(x=>x.name===n).identity;
 const s6=safe6.rows.find(x=>x.name==='A Series Show');
 const a6=safe6.rows.find(x=>x.name==='The Arrival');
 const d6=safe6.rows.find(x=>x.name==='Dup Case');
 const resolved6={
   [s6.sourceKey]:{action:'match',targetIdentity:local6('A-Series Show')},
   [a6.sourceKey]:{action:'add'},
   [d6.sourceKey]:{action:'skip'}
 };
 assert.equal(db6.previewLetterboxd(sample6,resolved6).reviewRequired,0);
 assert.equal(db6.previewLetterboxd(sample6,resolved6).manualMatched,1);
 const result6=await db6.importLetterboxdConfirmed(sample6,resolved6);
 assert.equal(result6.ok,true,result6.error);
 assert.equal(result6.added,2);
 assert.equal(commitCount,1,'Atomic one-shot save follows explicit decisions');
 assert.equal(state.items.find(x=>x.name==='A-Series Show').rating,'Нормально');
 assert.deepEqual(state.trash,typedState.trash);
 assert.equal((await db6.importLetterboxdConfirmed(sample6)).added,0,'Prior links/skip remembered on repeat import');
 // Never auto-link based on source TMDB ID when the category disagrees.
 const mismatchedCatalog=structuredClone(typedState);
 mismatchedCatalog.catalog={schema:1,cards:{[local6('A-Series Show')]:{
   tmdbId:991,mediaType:'movie',aliases:['Different Label']}}};
 const dbTyped=window.__testMakeDatabase({state:JSON.stringify(mismatchedCatalog),ui:JSON.stringify(ui)});
 assert.notEqual(dbTyped.previewLetterboxd({entries:[{name:'Different Label',year:2024,mediaType:'movie',tmdbId:991}],lists:[]}).rows[0].action,'matched');
 // The import preview interface must expose review and disabled-confirm controls.
 const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
 const uiSource=fs.readFileSync(path.join(root,'app/shared/library-integration-ui.js'),'utf8');
 for(const id of ['reviewSummary','reviewItems','reviewOnly','reviewAll','reviewSearch','reviewPrev','reviewNext','reviewAuto','reviewBatch','reviewBatchLabel','reviewBatchApply','reviewBatchClear'])
   assert.ok(html.includes(`id="${id}"`),`Review UI missing ${id}`);
 assert.ok(uiSource.includes('apply.disabled=importBusy||plan.reviewRequired>0'));
 assert.ok(uiSource.includes('window.confirm('),'Bulk review requires explicit consent');
 assert.ok(uiSource.includes('kino-review-compare'),'Side by side UI must be present');
 assert.ok(uiSource.includes('db.importLetterboxdConfirmed(parsed,decisions)'));
 assert.match(html,/class="kino-integrate-footer"/);
 assert.match(html,/class="kino-import-notes"/);
 assert.match(integrationCss,/\.kino-integrate-import \.kino-review-items\s*\{[^}]*overflow-y:auto;/s);
 assert.match(integrationCss,/\.kinoteka-integration-modal \.kino-integrate-import:not\(\[hidden\]\)\s*\{[^}]*overflow:hidden!important;/s);
 console.log('Letterboxd importer: ZIP STORE/DEFLATE, CRC, CSV multiline, watched, ratings, diary, reviews, v7 two-section lists/UTF-8 titles, ignored deleted/orphaned exports, invalid ZIP, repeated atomic merge, favorites/trash preservation, TMDB addition, original canonical DB, manual/fuzzy review, TMDB aliases, atomic list mapping, unique normalized auto-match, explicit-type safety, group-review safeguards: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});
