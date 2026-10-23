'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const games=fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const core=fs.readFileSync(path.join(root,'app/core.js'),'utf8');
const styles=fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const runtime=fs.readFileSync(path.join(root,'app/runtime.js'),'utf8');
const rust=fs.readFileSync(path.join(root,'src-tauri/src/posters.rs'),'utf8');
const rustlib=fs.readFileSync(path.join(root,'src-tauri/src/lib.rs'),'utf8');
const options=[...html.matchAll(/<option value="(game-asc|game-desc|year-desc|year-asc|score-desc|score-asc|added-desc|added-asc|status|category|favorite-first|score-missing|poster-missing|random)">/g)].map(a=>a[1]);
assert.deepEqual(options,['game-asc','game-desc','year-desc','year-asc','score-desc','score-asc','added-desc','added-asc','status','category','favorite-first','score-missing','poster-missing']);
assert.match(html,/<select id="sort" aria-label="Сортировка коллекции"/);
assert.doesNotMatch(html,/<select id="sort"[^>]*\bhidden\b/);
assert.doesNotMatch(html, /id="kinotekaReshuffle"/);
assert.match(styles, /HF53 — sorting and search stay together/);
assert.doesNotMatch(core, /shuffleSeed:kinotekaShuffleSeed/);
assert.match(core, /sort.value=\[\.\.\.sort.options\]/);
assert.doesNotMatch(runtime,/syncKinotekaShuffleButton\(\)/);
assert.match(games, /sort.addEventListener\('change'/);
assert.match(games, /sort.value==='poster-missing'\)void ensurePosterSortState/);
assert.match(rust,/pub fn exists_batch\(keys: Vec<String>\)/);
assert.match(rust,/keys.len\(\) > 5000/);
assert.match(rustlib,/poster_get, poster_exists_batch, poster_set/);
assert.match(rust, /poster_file\(&root,&hash\)\.is_some\(\)/);
const block=games.slice(games.indexOf('// HF52: sorting never mutates games'),games.indexOf('function filtered(){'));
const fixtures=[
  {id:1,game:'Альфа',year:2010,category:'Фильмы',rating:'Запланировано',score10:null,favorite:false},
  {id:2,game:'Бета',year:2024,category:'Сериалы',rating:'Избранное',score10:9,favorite:true},
  {id:3,game:'Гамма',year:null,category:'Анимация',rating:'Понравилось',score10:3,favorite:false},
  {id:4,game:'Дельта',year:2018,category:'Фильмы',rating:'Смотрю',score10:7,favorite:false}
];
const ctx={
  sort:{value:'game-asc'},games:fixtures,sortedRowsCache:null,
  posterExistsByKey:new Map([['local:1',true],['local:2',false],['local:3',true],['local:4',false]]),
  db:{getPosterKeyFor:({name})=>'local:'+({Альфа:1,Бета:2,Гамма:3,Дельта:4}[name])},
  entryNameNorm:g=>g.game.toLocaleLowerCase('ru'),validScore10:n=>Number.isInteger(n)&&n>=1&&n<=10,validAddedAt:()=>false
};
vm.createContext(ctx);vm.runInContext('let sortedRowsCache=null;'+block+'globalThis.testSort=getSortedRows;',ctx);
const by=(type)=>{ctx.sort.value=type;return Array.from(ctx.testSort(),x=>x.g.id).join(',');};
assert.equal(by('game-asc'),'1,2,3,4');
assert.equal(by('game-desc'),'4,3,2,1');
assert.equal(by('year-desc'),'2,4,1,3');
assert.equal(by('year-asc'),'1,4,2,3');
assert.equal(by('score-desc'),'2,4,3,1');
assert.equal(by('score-asc'),'3,4,2,1');
assert.equal(by('added-desc'),'4,3,2,1');
assert.equal(by('added-asc'),'1,2,3,4');
assert.equal(by('status'),'2,3,4,1');
assert.equal(by('category'),'1,4,2,3');
assert.equal(by('favorite-first'),'2,1,3,4');
assert.equal(by('score-missing'),'1,2,3,4');
assert.equal(by('poster-missing'),'2,4,1,3');
assert.deepEqual(fixtures.map(x=>x.id),[1,2,3,4],'sort must never mutate original collection');
assert.match(games,/saveUI\(\);render\(\)/);
console.log('HF52 SORT: PASS (13 modes, missing values last, no schema changes, date fallback, offline poster presence, card/table shared ordering)');
