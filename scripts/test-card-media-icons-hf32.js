'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const css=fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const block=js.slice(js.indexOf('function renderCardView('),js.indexOf('if(kinotekaCardGrid){'));
assert.ok(block.startsWith('function renderCardView('));
const items=[
 {game:'Synthetic Film',category:'Фильмы',year:2010,rating:'Понравилось',score10:8},
 {game:'Synthetic Series',category:'Сериалы',year:2025,rating:'Смотрю',score10:7},
 {game:'Synthetic Animation',category:'Анимация',year:2024,rating:'Запланировано'},
 {game:'Synthetic Without Year',category:'Анимация',year:'',rating:'Нормально',score10:5},
 {game:'Synthetic Odd Category',category:'',year:2012,rating:'Не понравилось',score10:3}
];
const grid={hidden:false,cards:[],replaceChildren(f){this.cards=f.children;},querySelectorAll(){return this.cards;}};
const doc={querySelectorAll:()=>[],createElement:()=>({dataset:{},setAttribute(){},tabIndex:0}),createDocumentFragment:()=>({children:[],appendChild(el){this.children.push(el);}})};
const ctx={document:doc,kinotekaCardGrid:grid,kinotekaViewMode:'cards',cardRenderCacheKey:'',clsForRating:x=>({'Понравилось':'rating-liked','Нормально':'rating-normal','Не понравилось':'rating-disliked','Смотрю':'rating-in-progress','Запланировано':'rating-planned'}[x]||''),validScore10:n=>Number.isInteger(n)&&n>=1&&n<=10,esc:s=>String(s),db:{getPosterKeyFor:()=> 'local:synthetic'},games:items,closePosterMenu(){},posterLoadFor(){},console};
vm.runInNewContext(block+';this.renderCardView=renderCardView',ctx);
ctx.renderCardView(items.map((g,i)=>({g,i})),'hf32');
assert.equal(grid.cards.length,items.length);
for(const [i,kind,aria] of [[0,'kind-film','Фильм'],[1,'kind-series','Сериал'],[2,'kind-animation','Анимация'],[3,'kind-animation','Анимация'],[4,'kind-film','Фильм']]){
 const h=grid.cards[i].innerHTML;
 assert.match(h,new RegExp(`class="kinoteka-card-type ${kind}" role="img" aria-label="${aria}"`));
 assert.match(h,/<svg viewBox="0 0 24 24"/);
 assert.equal((h.match(/kinoteka-card-type/g)||[]).length,1);
 assert.doesNotMatch(h,/kinoteka-card-subline|kinoteka-card-kind/,'category is no longer rendered beneath poster');
 assert.match(h,/kinoteka-card-title/);
 assert.match(h,/kinoteka-card-score/);
 assert.match(h,/data-poster-choose/);
}
assert.match(grid.cards[0].innerHTML,/kinoteka-card-year[^>]*>2010<\/span><span class="kinoteka-card-type/,'year precedes icon in poster');
assert.doesNotMatch(grid.cards[3].innerHTML,/class="kinoteka-card-year"/,'missing year has no badge');
assert.match(css,/Hotfix 32 — media type/);
const latest=css.slice(css.indexOf('/* Hotfix 32 — media type'),css.indexOf('/* Hotfix 33 — clearer'));
assert.match(latest,/\.kinoteka-film-card \.kinoteka-card-poster \.kinoteka-card-type/);
assert.match(latest,/\.kinoteka-film-card \.kinoteka-card-meta\{\s*display:block/);
assert.match(latest,/:not\(:has\(\.kinoteka-card-year\)\)/);
assert.doesNotMatch(latest,/\.kinoteka-card-grid\{/,'six-column grid remains untouched');
assert.doesNotMatch(latest,/kinoteka-card-score|kinoteka-card-favorite|kinoteka-poster-choose/,'controls untouched');
assert.match(js,/const pageSize=kinotekaViewMode==='cards'\?CARD_PAGE_SIZE:PAGE_SIZE/);
console.log('HOTFIX 32 CATEGORY ICONS: PASS (5 synthetic categories, year/no year, category removed, 3 SVG icons, card geometry and actions retained)');
