if(search){
  search.addEventListener("input",()=>{
    currentPage=1;
    render();
    scheduleSaveUI();
  });
}
function readTrash(){
  if(trashCache!==null)return trashCache;
  try{
    const raw=db.getTrashSync();
    const arr=JSON.parse(raw);
    trashCache=Array.isArray(arr)?arr:[];
    return trashCache;
  }catch(e){
    trashCache=[];
    return trashCache;
  }
}
function applyDatabaseState(state){
  if(!state || typeof state!=='object')throw new Error('База данных вернула некорректное состояние.');
  const nextGames=JSON.parse(String(state.games??'[]'));
  const nextTrash=JSON.parse(String(state.trash??'[]'));
  if(!Array.isArray(nextGames)||!Array.isArray(nextTrash))throw new Error('База данных вернула некорректные данные.');
  games=migrateEntryStatuses(nextGames.map(item=>({...item})));
  entriesDirty=false;
  persistedEntriesJSON=String(state.games??'[]');
  trashCache=nextTrash;
  filteredCache=null;sortedRowsCache=null;
}

let trashDeactivationTimer=null;
let trashActivationTimer=null;
let trashVisualState={count:null};
let trashIndicatorHydrating=true;
const TRASH_PHASE_MS=1040;
const TRASH_BUTTON_FADE_MS=980;

function clearTrashAnimationTimers(){
  if(trashDeactivationTimer){clearTimeout(trashDeactivationTimer);trashDeactivationTimer=null;}
  if(trashActivationTimer){clearTimeout(trashActivationTimer);trashActivationTimer=null;}
}
function resetTrashMotionClasses(btn){
  btn.classList.remove('trash-activate','trash-deactivate','trash-transition-in','trash-transition-out','trash-dot-enter','trash-dot-exit','trash-fade-out');
}
function finalizeTrashInactive(){
  const btn=$("trashData");if(!btn)return;
  clearTrashAnimationTimers();
  resetTrashMotionClasses(btn);
  btn.classList.remove('has-items');
  btn.disabled=true;
  btn.setAttribute('aria-label','Корзина пуста');
  trashVisualState.count=0;
}
function animateTrashDeactivation(){
  const btn=$("trashData");if(!btn)return;
  clearTrashAnimationTimers();
  btn.disabled=false;
  resetTrashMotionClasses(btn);
  btn.classList.add('has-items','trash-transition-out','trash-dot-exit');

  const startButtonFade=()=>{
    btn.classList.remove('trash-dot-exit');
    btn.classList.add('trash-fade-out');
    const onEnd=(e)=>{
      if(e.propertyName!=='opacity' && e.propertyName!=='background-color' && e.propertyName!=='border-color')return;
      btn.removeEventListener('transitionend',onEnd);
      finalizeTrashInactive();
    };
    btn.addEventListener('transitionend',onEnd);
    trashDeactivationTimer=setTimeout(()=>{
      btn.removeEventListener('transitionend',onEnd);
      finalizeTrashInactive();
    },TRASH_BUTTON_FADE_MS+180);
  };

  btn.addEventListener('animationend',function onDotEnd(e){
    if(e.animationName!=='trashDotAppearV849')return;
    btn.removeEventListener('animationend',onDotEnd);
    startButtonFade();
  },{once:false});
}
function animateTrashActivation(){
  const btn=$("trashData");if(!btn)return;
  clearTrashAnimationTimers();
  btn.disabled=false;
  resetTrashMotionClasses(btn);
  // Phase 1: smoothly enter the active button state with no dot yet.
  btn.classList.add('has-items','trash-transition-in');
  trashActivationTimer=setTimeout(()=>{
    btn.classList.remove('trash-transition-in');
    btn.classList.add('trash-dot-enter');
    trashActivationTimer=setTimeout(()=>{
      btn.classList.remove('trash-dot-enter');
      trashVisualState.count=readTrash().length;
    },TRASH_PHASE_MS);
  },TRASH_PHASE_MS);
}
function updateTrashIndicator(previousCount=trashVisualState.count){
  const btn=$("trashData");if(!btn)return;
  const count=readTrash().length;
  if(trashIndicatorHydrating){
    clearTrashAnimationTimers();
    resetTrashMotionClasses(btn);
    if(count===0){
      btn.classList.remove('has-items');
      btn.disabled=true;
      btn.setAttribute('aria-label','Корзина пуста');
        }else{
      btn.classList.add('has-items');
      btn.disabled=false;
      btn.setAttribute('aria-label',`Корзина, записей: ${count}`);
      btn.removeAttribute('title');
    }
    trashVisualState.count=count;
    return;
  }
  if(count===0){
    if(previousCount>0 && btn.classList.contains('has-items')){
      animateTrashDeactivation();
    }else if(!btn.classList.contains('trash-transition-out')){
      finalizeTrashInactive();
    }
  }else{
    const hadItems=btn.classList.contains('has-items');
    btn.disabled=false;
    btn.setAttribute('aria-label',`Корзина, записей: ${count}`);
    btn.removeAttribute('title');
    if(previousCount===0 || previousCount===null || !hadItems)animateTrashActivation();
    else btn.classList.add('has-items');
    trashVisualState.count=count;
  }
}
function renderTrash(){
  const box=$("trashList");if(!box)return;
  const arr=readTrash();
  updateTrashIndicator();
  if(!arr.length){box.innerHTML='<div class="trash-empty">Корзина пуста.</div>';return}
  box.innerHTML=arr.map(item=>{
    const meta=item.favorite?"Избранное":(item.rating||"Запланировано");
    const id=Number(item.id);
    const metaClass=clsForRating(meta);
    return `<div class="trash-item ${metaClass}"><div class="trash-info"><div class="trash-name">${esc(item.game||"Без названия")}</div><div class="trash-meta ${metaClass}">${esc(meta)}</div></div><div class="trash-actions"><button type="button" data-restore-trash="${Number.isInteger(id)?id:""}">Восстановить</button><button type="button" class="danger" data-delete-trash="${Number.isInteger(id)?id:""}">Удалить навсегда</button></div></div>`;
  }).join("");
}
$("trashData").onclick=openTrash;

$("trashList").addEventListener("click",e=>{
  const restore=e.target.closest("[data-restore-trash]");
  if(restore){
    e.preventDefault();
    restoreFromTrash(restore.dataset.restoreTrash);
    return;
  }
  const remove=e.target.closest("[data-delete-trash]");
  if(remove){
    e.preventDefault();
    permanentlyDeleteFromTrash(remove.dataset.deleteTrash);
  }
});
$("emptyTrash").onclick=emptyTrash;
$("closeTrash").onclick=closeTrash;
$("closeTrash2").onclick=closeTrash;

function openTrash(){
  renderTrash();
  kinotekaTrashModal?.open();
}
function closeTrash(){
  kinotekaTrashModal?.close();
}
function closeTrashAnimated(afterClose=null){ kinotekaTrashModal?.close(); if(typeof afterClose==="function") setTimeout(afterClose,window.KinotekaModal?.motion?.closeMs??240); }

async function confirmTrashDestructiveAction(options){
  const backdrop=$("confirmModal");
  backdrop?.classList.add("trash-action-smooth-close");
  try{
    return await openConfirmDialog(options);
  }finally{
    backdrop?.classList.remove("trash-action-smooth-close");
  }
}

function closeTrashAfterDestructiveAction(){
  const backdrop=$("trashModal");
  if(!backdrop||(!backdrop.classList.contains("open")&&!backdrop.classList.contains("closing")))return Promise.resolve();
  backdrop.classList.add("trash-action-smooth-close");
  kinotekaTrashModal?.close();
  return new Promise(resolve=>{
    let completed=false;
    const complete=()=>{
      if(completed)return;
      if(backdrop.classList.contains("open")||backdrop.classList.contains("closing"))return;
      completed=true;
      observer.disconnect();
      clearTimeout(fallback);
      backdrop.classList.remove("trash-action-smooth-close");
      resolve();
    };
    const observer=new MutationObserver(complete);
    observer.observe(backdrop,{attributes:true,attributeFilter:["class"]});
    const fallback=setTimeout(()=>{
      if(completed)return;
      completed=true;
      observer.disconnect();
      backdrop.classList.remove("trash-action-smooth-close");
      resolve();
    },320);
  });
}

function findTrashItemById(id){
  const numericId=Number(id);
  return readTrash().find(item=>Number(item.id)===numericId)||null;
}

async function restoreFromTrash(id){
  const trashId=Number(id);
  const item=findTrashItemById(trashId);
  if(!item)return;
  try{
    const result=await db.restoreTrash(trashId);
    if(!result?.ok)throw new Error(result?.error||"Не удалось восстановить запись.");
    applyDatabaseState({games:result.games,trash:result.trash});
    refreshDuplicateSet();currentPage=1;render();renderTrash();
    if(readTrash().length===0)closeTrashAnimated(()=>animateTrashDeactivation());
    toastMsg(`«${item.game}» восстановлена`,"success");
  }catch(e){
    console.error("Не удалось восстановить запись:",e);
    toastMsg(String(e?.message||"Не удалось восстановить запись"),"error");
  }
}

async function permanentlyDeleteFromTrash(id){
  const trashId=Number(id);
  const item=findTrashItemById(trashId);
  if(!item)return;
  if(!await confirmTrashDestructiveAction({title:"Удалить запись навсегда?",subtitle:"Восстановление будет невозможно",message:`«${item.game}» будет окончательно удалена из корзины. Это действие нельзя отменить.`,confirmLabel:"Удалить навсегда",danger:true}))return;
  try{
    const result=await db.permanentlyDeleteTrash(trashId);
    if(!result?.ok)throw new Error(result?.error||"Не удалось удалить запись из корзины.");
    applyDatabaseState({games:result.games,trash:result.trash});
    await closeTrashAfterDestructiveAction();
    renderTrash();
    toastMsg(`«${item.game}» окончательно удалена`,"success");
  }catch(e){
    console.error("Не удалось окончательно удалить запись:",e);
    toastMsg(String(e?.message||"Не удалось удалить запись из корзины"),"error");
  }
}

async function emptyTrash(){
  const arr=readTrash();if(!arr.length)return;
  if(!await confirmTrashDestructiveAction({title:"Очистить корзину?",subtitle:"Все записи будут удалены навсегда",message:`Будет окончательно удалено записей: ${arr.length}. Это действие нельзя отменить.`,confirmLabel:"Очистить",danger:true}))return;
  try{
    const result=await db.emptyTrash();
    if(!result?.ok)throw new Error(result?.error||"Не удалось очистить корзину.");
    applyDatabaseState({games:result.games,trash:result.trash});
    await closeTrashAfterDestructiveAction();
    renderTrash();
    toastMsg("Корзина очищена","success");
  }catch(e){
    console.error("Не удалось очистить корзину:",e);
    toastMsg(String(e?.message||"Не удалось очистить корзину"),"error");
  }
}

async function deleteEntryAtIndex(i){
  if(!Number.isInteger(i)||!games[i])return false;
  const removed={...games[i]};
  const gameId=Number(removed.id);
  if(!Number.isInteger(gameId)||gameId<=0){
    toastMsg("Не удалось определить запись для удаления","error");
    return false;
  }
  try{
    const result=await db.moveGameToTrash(gameId);
    if(!result?.ok)throw new Error(result?.error||"Не удалось переместить запись в корзину.");
    applyDatabaseState({games:result.games,trash:result.trash});
    refreshDuplicateSet();currentPage=1;render();renderTrash();
    toastMsg(`«${removed.game}» удалена`);
    return true;
  }catch(e){
    console.error("Не удалось удалить запись:",e);
    toastMsg(String(e?.message||"Не удалось удалить запись. Запись не удалена"),"error");
    return false;
  }
}


document.addEventListener("click",async e=>{
  if(e.target.dataset.removeFilter){
    const key=e.target.dataset.removeFilter;
    if(key==="search")search.value="";
    else if(key==="quick")quickFilter="";
    currentPage=1;
    saveUI();
    render();
    return;
  }
  if(e.target.dataset.fav!==undefined){
    const i=+e.target.dataset.fav;
    if(games[i]){
      const next=!games[i].favorite;
      if(next && games[i].rating!=="Понравилось"){
        return;
      }else{
        const beforeFavorite=games[i].favorite;
        const beforeRating=games[i].rating;
        games[i].favorite=next;
        games[i].rating=next?"Избранное":"Понравилось";
        entriesDirty=true;
        if(!(await save())){games[i].favorite=beforeFavorite;games[i].rating=beforeRating;return;}
        render();
      }
    }
    return;
  }
});

$("add").onclick=openModal;
$("addEntryRow").onclick=addEntryRow;
$("cancelAdd").onclick=closeModal;
$("closeAdd").onclick=closeModal;
$("saveAdd").onclick=addEntry;
