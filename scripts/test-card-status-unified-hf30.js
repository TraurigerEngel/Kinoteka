'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const gamesJs=fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const css=fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const rust=fs.readFileSync(path.join(root,'src-tauri/src/lib.rs'),'utf8');
const renderCode=gamesJs.slice(gamesJs.indexOf('function renderCardView('),gamesJs.indexOf('if(kinotekaCardGrid){'));
assert.ok(renderCode.startsWith('function renderCardView'));
assert.doesNotMatch(renderCode,/data-card-rating/);
assert.doesNotMatch(renderCode,/kinoteka-card-status"/);
assert.match(renderCode,/canFavorite\?`<button/);
assert.match(renderCode,/score===null\|\|score>=7/);
assert.match(renderCode,/status-watching/);
assert.match(renderCode,/status-planned/);
const entries=[
 {game:'Synthetic Liked 8',category:'Фильмы',rating:'Понравилось',score10:8,year:2020},
 {game:'Synthetic Low Score With Old Liked',category:'Фильмы',rating:'Понравилось',score10:4,year:2004},
 {game:'Synthetic Normal 5',category:'Фильмы',rating:'Нормально',score10:5,year:2005},
 {game:'Synthetic Watching',category:'Сериалы',rating:'Смотрю',score10:8,year:2024},
 {game:'Synthetic Planned',category:'Анимация',rating:'Запланировано',year:2023},
 {game:'Synthetic Favorite',category:'Фильмы',rating:'Избранное',favorite:true,score10:3,year:2003},
 {game:'Synthetic Old Liked No Number',category:'Фильмы',rating:'Понравилось',year:2007}
];
const state={cards:[]};
const grid={hidden:false,cards:[],replaceChildren(f){this.cards=f.children;},querySelectorAll(){return this.cards;}};
const doc={querySelectorAll:()=>[],createElement:()=>({dataset:{},setAttribute(){},tabIndex:0}),createDocumentFragment:()=>({children:[],appendChild(el){this.children.push(el);}})};
const ctx={document:doc,kinotekaCardGrid:grid,kinotekaViewMode:'cards',cardRenderCacheKey:'',clsForRating:x=>({'Понравилось':'rating-liked','Нормально':'rating-normal','Не понравилось':'rating-disliked','Смотрю':'rating-in-progress','Запланировано':'rating-planned','Избранное':'rating-favorite'}[x]||''),validScore10:n=>Number.isInteger(n)&&n>=1&&n<=10,esc:s=>String(s),db:{getPosterKeyFor:()=> 'local:synthetic'},games:entries,closePosterMenu(){},posterLoadFor(){},console};
vm.runInNewContext(renderCode+';this.renderCardView=renderCardView',ctx);
ctx.renderCardView(entries.map((g,i)=>({g,i})),'hf30');
assert.equal(grid.cards.length,entries.length);
const hasStar=i=>grid.cards[i].innerHTML.includes('data-card-favorite=');
assert.equal(hasStar(0),true,'7-10 score has available favorite');
for(const i of [1,2,3,4])assert.equal(hasStar(i),false,'star hidden when rating/status is ineligible');
assert.equal(hasStar(5),true,'already-favorite kept, no silent removal');
assert.equal(hasStar(6),true,'legacy liked without number can be favorite');
assert.match(grid.cards[0].innerHTML,/>8<\/button>/);
assert.match(grid.cards[3].innerHTML,/status-watching[^>]*>Смотрю<\/button>/);
assert.doesNotMatch(grid.cards[3].innerHTML,/>8<\/button>/,'pending status takes display precedence');
assert.match(grid.cards[4].innerHTML,/status-planned[^>]*>План<\/button>/);
assert.ok(grid.cards.every(card=>!card.innerHTML.includes('data-card-rating')));
assert.match(css,/Hotfix 30 — one poster status/);
assert.match(css,/kinoteka-score-modal-statuses button/);
const updateCode=gamesJs.slice(gamesJs.indexOf('async function updateScore10('),gamesJs.indexOf('// Hotfix 11: the same filtered'));
const gameEntries=[{game:'A',rating:'Понравилось',score10:9,favorite:false}, {game:'B',rating:'Избранное',score10:8,favorite:true}];
let persisted=0, rendered=0, accepted=true;
const uctx={games:gameEntries,window:{KinotekaDialog:{confirm:async()=>accepted}},validScore10:ctx.validScore10,score10Status:n=>n>=7?'Понравилось':n>=5?'Нормально':'Не понравилось',save:async()=>{persisted++;return true;},render:()=>{rendered++;},entriesDirty:false,filteredCache:'a',sortedRowsCache:'b',cardRenderCacheKey:'c',tableRenderCacheKey:'d'};
vm.runInNewContext(updateCode+';this.updateScore10=updateScore10',uctx);
(async()=>{
 await uctx.updateScore10(0,{status:'Смотрю'});
 assert.equal(gameEntries[0].rating,'Смотрю');assert.equal(gameEntries[0].score10,9,'existing score is preserved');
 await uctx.updateScore10(0,{status:'Запланировано'});
 assert.equal(gameEntries[0].rating,'Запланировано');assert.equal(gameEntries[0].score10,9);
 await uctx.updateScore10(0,6);
 assert.equal(gameEntries[0].rating,'Нормально');assert.equal(gameEntries[0].score10,6);
 accepted=false;await uctx.updateScore10(1,{status:'Смотрю'});
 assert.equal(gameEntries[1].rating,'Избранное');assert.equal(gameEntries[1].favorite,true,'declined favorite removal must not mutate');
 accepted=true;await uctx.updateScore10(1,{status:'Смотрю'});
 assert.equal(gameEntries[1].favorite,false);assert.equal(gameEntries[1].rating,'Смотрю');assert.equal(gameEntries[1].score10,8);
 assert.equal(persisted,4);assert.equal(rendered,4);
 assert.match(gamesJs,/data-status="Смотрю"|\['Смотрю','Запланировано'\]/);
 assert.match(rust,/fn poster_clipboard_set\(key: String\)/);
 assert.match(rust,/GetImage\(\)/);
 assert.match(rust,/poster_clipboard_set,/);
 assert.match(rust,/CREATE_NO_WINDOW/);
 assert.doesNotMatch(gamesJs,/navigator\.clipboard\.read\(/);
 console.log('HOTFIX 30: PASS (7 synthesized cards, star gating, pending badges, unified control, statuses+score persistence, native clipboard Tauri bridge)');
})().catch(e=>{console.error(e);process.exitCode=1});
