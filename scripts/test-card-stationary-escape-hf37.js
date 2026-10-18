'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const js=fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const css=fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const patch=css.slice(css.lastIndexOf('/* Hotfix 37 — stationary cards'));
assert.match(patch,/\.kinoteka-film-card\.is-selected:hover,[\s\S]*?transform:none!important/);
assert.match(patch,/transition-property:none!important/);
assert.match(css,/Hotfix 35 — one \*neutral cyan\* outline/);
assert.match(js,/document\.addEventListener\('keydown',handleSelectedCardEscapeShortcut,true\)/);
assert.match(js,/document\.addEventListener\('keydown',handleSelectedCardPasteShortcut,true\)/);
assert.match(js,/document\.addEventListener\('keydown',handleSelectedCardCopyShortcut,true\)/);
const start=js.indexOf('function handleSelectedCardEscapeShortcut(event){');
const end=js.indexOf('if(kinotekaCardGrid){',start);
assert(start>0&&end>start,'Esc handler not found');
const selected={isConnected:true,removed:0,contains:()=>false,classList:{remove(name){assert.equal(name,'is-selected');selected.removed++;}}};
let chosen=selected;
const ctx={
 kinotekaViewMode:'cards',
 kinotekaCardGrid:{hidden:false,querySelector:selector=>{assert.equal(selector,'.kinoteka-film-card.is-selected');return chosen;}},
 isEditablePosterShortcutTarget:()=>false,
 hasOpenPosterShortcutDialog:()=>false,
 cardContextMenu:null,posterOpenMenu:null,
 document:{activeElement:null},
};
vm.runInNewContext(js.slice(start,end)+';this.handle=handleSelectedCardEscapeShortcut',ctx);
function key(opts={}){
 const e={key:'Escape',defaultPrevented:false,ctrlKey:false,metaKey:false,altKey:false,target:{},preventDefault(){this.defaultPrevented=true;},stopPropagation(){this.stopped=true;},...opts};
 ctx.handle(e);return e;
}
assert.equal(key().defaultPrevented,true,'plain Esc consumed');
assert.equal(selected.removed,1,'plain Esc deselects');
selected.removed=0;
for(const prop of ['cardContextMenu','posterOpenMenu']){
 ctx[prop]={};assert.equal(key().defaultPrevented,false,`Esc should close ${prop} first`);assert.equal(selected.removed,0);ctx[prop]=null;
}
ctx.hasOpenPosterShortcutDialog=()=>true;
assert.equal(key().defaultPrevented,false,'dialog Esc reserved');
assert.equal(selected.removed,0);
ctx.hasOpenPosterShortcutDialog=()=>false;
ctx.isEditablePosterShortcutTarget=()=>true;
assert.equal(key().defaultPrevented,false,'Escape preserved for text input');
ctx.isEditablePosterShortcutTarget=()=>false;
ctx.kinotekaViewMode='table';assert.equal(key().defaultPrevented,false);ctx.kinotekaViewMode='cards';
ctx.kinotekaCardGrid.hidden=true;assert.equal(key().defaultPrevented,false);ctx.kinotekaCardGrid.hidden=false;
chosen=null;assert.equal(key().defaultPrevented,false,'no selection leaves Esc alone');chosen=selected;
const target={blur(){target.blurred=true;}};
selected.contains=el=>el===target;ctx.document.activeElement=target;
assert.equal(key().defaultPrevented,true);assert.equal(target.blurred,true,'clear focus-within state');
assert.match(css,/\.kinoteka-film-card\.is-selected::after,[\s\S]*?border-color:rgba\(103,232,249,\.74\)/,'selected cyan outline retained');
console.log('HOTFIX 37: PASS (Esc clears selection; menus/dialogs/input priority; stationary cyan card; copy/paste intact)');
