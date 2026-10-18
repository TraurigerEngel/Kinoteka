"use strict";
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/index.html'),js=read('app/games.js'),css=read('app/styles.css');
for(const [name,token] of Object.entries({liked:'--like',normal:'--normal',disliked:'--dislike',planned:'--planned','in-progress':'--progress',favorite:'--favorite'})){
  assert.match(css,new RegExp('\\.kinoteka-film-card\\.rating-'+name+'\\{--card-accent:var\\('+token+'\\)\\}'),name+' must share table colour');
}
assert.match(css,/\.kinoteka-film-card \.kinoteka-card-meta\s*\{[^}]*grid-template-rows:/,'fixed card rows');
assert.match(css,/\.kinoteka-film-card \.kinoteka-card-title\s*\{[^}]*-webkit-line-clamp:2/,'two-line titles');
assert.match(js,/const pendingStatus=/);
assert.doesNotMatch(js,/class="kinoteka-card-status-dot"/);
assert.match(js,/data-card-score="\$\{i\}"/);
assert.match(js,/data-card-favorite="\$\{i\}"/);
assert.match(js,/async function updateScore10/);
assert.match(js,/data-poster-choose/);
assert.match(js,/data-poster-remove/);
assert.doesNotMatch(html,/id="kinotekaCommonsOptIn"/);
assert.doesNotMatch(js.slice(js.indexOf('function renderCardView'),js.indexOf('if(kinotekaCardGrid)')),/data-poster-auto/);
assert.match(css,/\.kinoteka-commons-optin,\.kinoteka-poster-auto\{display:none!important\}/);
assert.match(css,/background:color-mix\(in srgb,var\(--card-accent\) 9%,#0b0c0e\)/);
console.log('CARD VISUAL PARITY QA: PASS (6 semantic colours, aligned rows, manual posters, offline-only UI)');
