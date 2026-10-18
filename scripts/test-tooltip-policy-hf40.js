"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/index.html'),'utf8');
const games=fs.readFileSync(path.join(root,'app/games.js'),'utf8');
// The only native tooltip attributes in the static UI belong to 7 counters.
const expected=['Всего','Смотрю','Понравилось','Нормально','Не понравилось','Запланировано','Избранное'];
const titles=[...html.matchAll(/title="([^"]*)"/g)].map(m=>m[1]);
assert.deepEqual(titles,expected,'only 7 statistic counters carry native title hints');
assert.doesNotMatch(html,/kinoteka-view-btn[^>]*title=/,'no redundant view switch tooltip');
assert.doesNotMatch(html,/class="min"[^>]*title=|class="close"[^>]*title=/,'window controls have aria labels but no tooltip');
assert.match(html,/class="min" aria-label="Свернуть"/);
assert.match(html,/class="close" aria-label="Закрыть"/);
// Render the actual card template, checking the entire markup for unwanted title attrs.
const start=games.indexOf('function renderCardView(');
const end=games.indexOf('if(kinotekaCardGrid){',start);
assert(start>=0 && end>start);
const grid={hidden:false,cards:[],replaceChildren(f){this.cards=f.children;},querySelectorAll(){return this.cards;}};
const doc={querySelectorAll:()=>[],createElement:()=>({dataset:{},setAttribute(){},tabIndex:0}),createDocumentFragment:()=>({children:[],appendChild(el){this.children.push(el);}})};
const rows=[
 {game:'Example long title',year:2024,category:'Фильмы',rating:'Понравилось',score10:8,favorite:true},
 {game:'Series',year:2022,category:'Сериалы',rating:'Смотрю'},
 {game:'Animation',year:2019,category:'Анимация',rating:'Запланировано'}
];
const ctx={document:doc,kinotekaCardGrid:grid,kinotekaViewMode:'cards',cardRenderCacheKey:'',clsForRating:()=>'',validScore10:n=>Number.isInteger(n)&&n>=1&&n<=10,esc:s=>String(s),db:{getPosterKeyFor:()=> 'local:test'},games:rows,closePosterMenu(){},posterLoadFor(){},console};
vm.runInNewContext(games.slice(start,end)+';this.renderCardView=renderCardView',ctx);
ctx.renderCardView(rows.map((g,i)=>({g,i})),'hf40');
assert.equal(grid.cards.length,3);
for(const card of grid.cards){
  const found=[...card.innerHTML.matchAll(/title="([^"]*)"/g)].map(m=>m[1]);
  assert.deepEqual(found,[rows[grid.cards.indexOf(card)].game],'full card title is the only tooltip');
  assert.match(card.innerHTML,/kinoteka-card-score[^>]*aria-label=/,'rating remains accessible');
  assert.match(card.innerHTML,/kinoteka-card-type[^>]*aria-label=/,'category remains accessible');
}
assert.doesNotMatch(games,/creditLink\.title\s*=/);
assert.match(games,/title\.classList\.toggle\('is-truncated',truncated\)/,'existing custom tooltip for clipped names retained');
console.log('PASS Hotfix 40: only 7 summary status hints and full card-name hints; controls retain aria labels');
