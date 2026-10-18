'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'app/games.js'),'utf8');
const css=fs.readFileSync(path.join(root,'app/styles.css'),'utf8');
const from=source.indexOf('// Hotfix 31: paste into the explicitly selected card with Ctrl+V.');
const to=source.indexOf('if(kinotekaCardGrid){',from);
assert.ok(from>0&&to>from,'Hotfix 31 shortcut functions must be present');
const chunk=source.slice(from,to);
assert.doesNotMatch(chunk,/navigator\.clipboard\.read/);
assert.match(source,/document\.addEventListener\('keydown',handleSelectedCardPasteShortcut,true\)/);
assert.match(source,/dataUrl\?'Изменить':'Постер'/,'added poster stays editable, empty slot says Постер');
assert.match(source,/>Постер<\/button><div class=\"kinoteka-poster-menu\"/,'empty-slot markup says Постер');
assert.doesNotMatch(source,/>\+ Постер<\/button>/,'no old empty-slot caption');
assert.match(css,/Hotfix 31 — compact non-wrapping poster action/);
assert.match(css,/\.kinoteka-film-card \.kinoteka-poster-choose\{\s*white-space:nowrap/);
assert.match(css,/status-watching\) \.kinoteka-poster-choose\{\s*right:76px/);
const log=[], ui={modal:false};
const card={isConnected:true,dataset:{posterKey:'local:fiction-123'},classList:{contains:cls=>cls==='is-selected'}};
let selected=card;
let available=true, exists=false, confirm=true, releaseLookup=null;
const grid={hidden:false,querySelector(selector){assert.equal(selector,'.kinoteka-film-card.is-selected');return selected;}};
const document={querySelector:()=>ui.modal?{}:null};
const ctx={
 document,kinotekaViewMode:'cards',kinotekaCardGrid:grid,
 posterInvoke:async(name,args)=>{log.push(['native',name,args.key]);if(name==='poster_get'){if(releaseLookup)return await releaseLookup;return {exists};}throw Error('unexpected native command');},
 pasteUserPoster:async key=>{log.push(['paste',key]);},
 closePosterMenu:()=>log.push(['close-menu']),
 toastMsg:(msg,type)=>log.push(['toast',msg,type]),
 window:{KinotekaDialog:{confirm:async(...args)=>{log.push(['confirm',args[0]]);return confirm;}}},
 String,Error,Boolean
};
vm.runInNewContext(chunk+';this.pastePosterIntoSelectedCard=pastePosterIntoSelectedCard;this.handleSelectedCardPasteShortcut=handleSelectedCardPasteShortcut;',ctx);
const event=(opts={})=>{
  let prevented=false,stopped=false;
  return {
   get prevented(){return prevented;},get stopped(){return stopped;},
   code:'KeyV',ctrlKey:true,metaKey:false,shiftKey:false,altKey:false,repeat:false,defaultPrevented:false,
   target:{isContentEditable:false,closest:()=>null},
   preventDefault:()=>{prevented=true;},stopPropagation:()=>{stopped=true;},...opts
  };
};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  let e=event();ctx.handleSelectedCardPasteShortcut(e);await tick();
  assert.equal(e.prevented,true);assert.equal(e.stopped,true);
  assert.deepEqual(log.map(x=>x[0]),['native','close-menu','paste']);
  assert.deepEqual(log[2],['paste','local:fiction-123']);
  log.length=0;exists=true;confirm=false;
  await ctx.pastePosterIntoSelectedCard(card);
  assert.deepEqual(log.map(x=>x[0]),['native','confirm'],'rejecting replacement must not paste');
  log.length=0;confirm=true;
  await ctx.pastePosterIntoSelectedCard(card);
  assert.deepEqual(log.map(x=>x[0]),['native','confirm','close-menu','paste'],'accepted replacement pastes once');
  for (const altered of [
    {target:{isContentEditable:true,closest:()=>null}},
    {target:{isContentEditable:false,closest:()=>({tagName:'INPUT'})}},
    {metaKey:true},{shiftKey:true},{altKey:true},{repeat:true},{code:'KeyC'},
    {ctrlKey:false},{defaultPrevented:true}
  ]){
    const before=log.length;const ev=event(altered);ctx.handleSelectedCardPasteShortcut(ev);await tick();
    assert.equal(ev.prevented,false,'invalid/typing shortcut should not be captured');assert.equal(log.length,before);
  }
  ui.modal=true;{const ev=event();ctx.handleSelectedCardPasteShortcut(ev);assert.equal(ev.prevented,false);}ui.modal=false;
  ctx.kinotekaViewMode='table';{const ev=event();ctx.handleSelectedCardPasteShortcut(ev);assert.equal(ev.prevented,false);}
  ctx.kinotekaViewMode='cards';grid.hidden=true;{const ev=event();ctx.handleSelectedCardPasteShortcut(ev);assert.equal(ev.prevented,false);}grid.hidden=false;
  selected=null;{const ev=event();ctx.handleSelectedCardPasteShortcut(ev);assert.equal(ev.prevented,false);}selected=card;
  log.length=0;exists=false;
  let fulfill;releaseLookup=new Promise(r=>{fulfill=r;});
  const pending=ctx.pastePosterIntoSelectedCard(card);
  await tick();
  const duplicate=ctx.pastePosterIntoSelectedCard(card);
  await duplicate;
  assert.equal(log.filter(x=>x[0]==='native').length,1,'busy guard blocks duplicate Ctrl+V');
  card.isConnected=false;fulfill({exists:false});await pending;
  assert.equal(log.some(x=>x[0]==='paste'),false,'stale card must not be modified');
  card.isConnected=true;releaseLookup=null;
  console.log('HOTFIX 31: PASS (selected-card shortcut, normal text paste, no-dialog, Ctrl+V blocking, replacement confirmation, stale selection, reentrancy, compact controls)');
})().catch(err=>{console.error(err);process.exitCode=1;});
