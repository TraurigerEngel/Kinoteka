'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const css=fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const index=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const h36=css.slice(css.lastIndexOf('/* Hotfix 36 —'));
assert.ok(h36.startsWith('/* Hotfix 36 —'));
const block=js.slice(js.indexOf('function renderCardView('),js.indexOf('if(kinotekaCardGrid){'));
const fixtures=[
 {game:'Film title',category:'Фильмы',year:2004,rating:'Не понравилось'},
 {game:'Series title',category:'Сериалы',year:2025,rating:'Смотрю'},
 {game:'Animation title',category:'Анимация',year:2020,rating:'Понравилось',score10:8},
 {game:'Without a year',category:'Фильмы',year:'',rating:'Запланировано'}
];
const grid={hidden:false,cards:[],replaceChildren(f){this.cards=f.children;},querySelectorAll(){return this.cards;}};
const doc={querySelectorAll:()=>[],createElement:()=>({dataset:{},setAttribute(){},tabIndex:0}),createDocumentFragment:()=>({children:[],appendChild(el){this.children.push(el);}})};
const ctx={document:doc,kinotekaCardGrid:grid,kinotekaViewMode:'cards',cardRenderCacheKey:'',clsForRating:x=>({'Понравилось':'rating-liked','Нормально':'rating-normal','Не понравилось':'rating-disliked','Смотрю':'rating-in-progress','Запланировано':'rating-planned'}[x]||''),validScore10:n=>Number.isInteger(n)&&n>=1&&n<=10,esc:s=>String(s),db:{getPosterKeyFor:()=> 'synthetic'},games:fixtures,closePosterMenu(){},posterLoadFor(){},console};
vm.runInNewContext(block+';this.renderCardView=renderCardView',ctx);
ctx.renderCardView(fixtures.map((g,i)=>({g,i})),'hf36');
assert.equal(grid.cards.length,4);
for(const card of grid.cards){
  assert.match(card.innerHTML, /<div class="kinoteka-card-poster"[^>]+><div class="kinoteka-card-topline">/);
  assert.match(card.innerHTML, /<span class="kinoteka-card-type/);
  assert.match(card.innerHTML, /kinoteka-card-score/);
  assert.match(card.innerHTML, /kinoteka-poster-choose/);
}
assert.match(grid.cards[0].innerHTML,/kinoteka-card-topline"><span class="kinoteka-card-year"[^>]*>2004<\/span><span class="kinoteka-card-type kind-film"/);
assert.match(grid.cards[1].innerHTML,/kind-series/);
assert.match(grid.cards[2].innerHTML,/kind-animation/);
assert.match(grid.cards[3].innerHTML,/kinoteka-card-topline"><span class="kinoteka-card-type/,'no-year icon starts at left edge');
assert.match(h36,/\.kinoteka-card-grid\{\s*padding-top:0/);
assert.match(h36,/\.kinoteka-card-topline\{[\s\S]*?display:inline-flex;[\s\S]*?align-items:center;[\s\S]*?gap:6px;/);
assert.match(h36,/\.kinoteka-card-topline \.kinoteka-card-year\{[\s\S]*?position:static!important;/);
assert.match(h36,/\.kinoteka-card-topline \.kinoteka-card-type\{[\s\S]*?position:static!important;/);
assert.match(h36,/@media\(max-width:690px\)/);
assert.match(css,/Hotfix 35 — one \*neutral cyan\* outline/);
assert.match(index,/id="tableWrap"/);
assert.match(index,/id="kinotekaCardGrid"/);
assert.doesNotMatch(h36,/\.table-wrap\s*\{|\.kinoteka-film-card:.*::after|\.kinoteka-poster-choose/,'no edits to table, selection or poster controls');
console.log('HOTFIX 36: PASS (4 category/year fixtures, flexible badge row, equal badge heights, cards-only top alignment, old features untouched)');
