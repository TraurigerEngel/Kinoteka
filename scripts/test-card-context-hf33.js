'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const css=fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const from=source.indexOf('// Hotfix 33 — safe card actions');
const to=source.indexOf('if(kinotekaCardGrid){',from);
assert(from>0&&to>from);
const chunk=source.slice(from,to);
const games=[
  {id:11,game:'Example Movie',category:'Фильмы',year:2010,rating:'Понравилось'},
  {id:12,game:'No year',category:'Анимация',year:null,rating:'Нормально'},
  {id:13,game:'Year 2023',category:'Сериалы',year:2023,rating:'Смотрю'}
];
const copied=[],deleted=[],notices=[],menuEvents={};
let confirmAnswer=true, confirmationHook=null, copySuccess=true;
const selected={isConnected:true,dataset:{entryId:'11'},classList:{add(){},remove(){}},getBoundingClientRect(){return {left:20,top:30};}};
const grid={hidden:false,querySelectorAll(){return [selected];},querySelector(sel){return sel==='.kinoteka-film-card.is-selected'?selected:null;}};
const makeMenu=()=>({
  isConnected:true,style:{},setAttribute(){},innerHTML:'',remove(){this.isConnected=false;},
  getBoundingClientRect(){return {width:214,height:89}},
  addEventListener(type,fn){menuEvents[type]=fn;},querySelector(){return {focus(){}}}
});
const ctx={
  games,document:{createElement:makeMenu,body:{appendChild(menu){menu.isConnected=true;}}},
  kinotekaCardGrid:grid,kinotekaViewMode:'cards',closePosterMenu(){},
  window:{innerWidth:400,innerHeight:300,KinotekaDialog:{confirm:async(msg,options)=>{notices.push([msg,options]);if(confirmationHook)await confirmationHook();return confirmAnswer;}},kinotekaRuntime:{copyText:async str=>{copied.push(str);return copySuccess;}}},
  toastMsg:(msg,type)=>notices.push([msg,type]),
  deleteEntryAtIndex:async index=>{deleted.push(games[index].id);games.splice(index,1);return true;},
  isEditablePosterShortcutTarget:()=>false,hasOpenPosterShortcutDialog:()=>false,
  console
};
vm.runInNewContext(chunk+';this.probe={cardCopyLabel,copyCardNameYear,moveCardToTrash,openCardContextMenu,closeCardContextMenu,handleSelectedCardCopyShortcut};',ctx);
(async()=>{
  const {cardCopyLabel,copyCardNameYear,moveCardToTrash,openCardContextMenu,closeCardContextMenu,handleSelectedCardCopyShortcut}=ctx.probe;
  assert.equal(cardCopyLabel(games[0]),'Example Movie (2010)');
  assert.equal(cardCopyLabel(games[1]),'No year');
  assert.equal(cardCopyLabel({game:'Named',year:'invalid'}),'Named');
  assert.equal(await copyCardNameYear(games[0]),true);
  assert.deepEqual(copied,['Example Movie (2010)']);
  copySuccess=false;assert.equal(await copyCardNameYear(games[0]),false);copySuccess=true;
  let prevented=false,stopped=false;
  const key={code:'KeyC',ctrlKey:true,metaKey:false,shiftKey:false,altKey:false,repeat:false,defaultPrevented:false,target:{},preventDefault(){prevented=true;},stopPropagation(){stopped=true;}};
  handleSelectedCardCopyShortcut(key);
  await new Promise(resolve=>setImmediate(resolve));
  assert(prevented&&stopped&&copied.at(-1)==='Example Movie (2010)');
  prevented=false;handleSelectedCardCopyShortcut({...key,code:'KeyV'});assert.equal(prevented,false,'Ctrl+V remains untouched');
  assert.equal(await moveCardToTrash(9999),false,'unknown IDs never delete');
  confirmAnswer=false;
  assert.equal(await moveCardToTrash(11),false,'cancellation must not remove records');
  assert.deepEqual(deleted,[]);
  confirmAnswer=true;
  // A simultaneous list change cannot delete a different item (resolve by DB ID after confirm).
  confirmationHook=()=>{games.unshift({id:99,game:'Inserted while confirming',year:2020});confirmationHook=null;};
  assert.equal(await moveCardToTrash(13),true);
  assert.deepEqual(deleted,[13],'only intended entry id is removed');
  assert(games.some(g=>g.id===11)&&games.some(g=>g.id===12));
  assert.deepEqual(notices.find(row=>row[0]?.includes('Year 2023'))?.[1]?.okText,'В корзину');
  openCardContextMenu(selected,398,298);
  assert(menuEvents.click,'actions menu opens');
  assert.equal(await ctx.probe.moveCardToTrash(12),true);
  closeCardContextMenu();
  assert.match(css,/Hotfix 33 — clearer 17px category glyphs/);
  assert.match(css,/\.kinoteka-card-context-menu/);
  assert.match(source,/kinotekaCardGrid\.addEventListener\('contextmenu'/);
  assert.match(source,/event\.target\.closest\('\.kinoteka-card-title'\)/);
  assert.match(source,/document\.addEventListener\('keydown',handleSelectedCardCopyShortcut,true\)/);
  assert.match(source,/"Скопировать название и год"|>Скопировать название и год</);
  assert.doesNotMatch(chunk,/poster_remove|permanentlyDeleteTrash|emptyTrash/,'card delete must use recoverable trash');
  assert.match(source,/card\.dataset\.entryId=String\(g\.id\?\?''\)/);
  assert.match(source,/width="17" height="17"/);
  assert.match(source,/<path d="m10 8 5 4-5 4V8Z"/);
  assert.match(source,/const pageSize=kinotekaViewMode==='cards'\?CARD_PAGE_SIZE:PAGE_SIZE/);
  console.log('HOTFIX 33: PASS (copy title/year, Ctrl+C, Ctrl+V preserved, context menu, confirmation, ID-safe trash, category SVG polish, no DB or layout changes)');
})().catch(err=>{console.error(err);process.exitCode=1;});
