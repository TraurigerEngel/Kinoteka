function hasResettableState(){
  return Boolean(search.value.trim()||quickFilter||mediaCategory!=="Все"||mediaYear||sort.value!=="game-asc"||currentPage!==1);
}
function hasResetAnimation(){
  const resetButton=$("reset");
  return Boolean(resetButton&&(resetButton.classList.contains("reset-press")||resetButton.classList.contains("reset-fade-out")));
}
function updateResetButtonState(){
  const resetButton=$("reset");
  if(!resetButton)return;
  const active=hasResettableState();
  const animating=resetAnimationRunning || hasResetAnimation();
  const enabled=active || animating;
  resetButton.disabled=!enabled;
  resetButton.setAttribute("aria-disabled",String(!enabled));
  
}
let resetAnimationRunning=false;
let resetAnimationTimer=null;
const RESET_BUTTON_FADE_MS=780;
function finishResetButtonAnimation(){
  const resetButton=$("reset");
  if(resetAnimationTimer){window.clearTimeout(resetAnimationTimer);resetAnimationTimer=null;}
  if(!resetButton){resetAnimationRunning=false;return;}
  resetButton.classList.remove("reset-press","reset-fade-out");
  resetButton.disabled=true;
  resetButton.setAttribute("aria-disabled","true");
  resetAnimationRunning=false;
  updateResetButtonState();
}
function startResetButtonFade(){
  const resetButton=$("reset");
  if(!resetButton)return;
  if(resetAnimationTimer){window.clearTimeout(resetAnimationTimer);resetAnimationTimer=null;}

  // Mirror the proven Trash deactivation handoff: release the press state,
  // commit the active resting frame, then transition to the exact disabled frame.
  resetButton.classList.remove("reset-press","reset-fade-out");
  void resetButton.offsetWidth;
  resetButton.classList.add("reset-fade-out");

  if(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches){
    window.requestAnimationFrame(()=>finishResetButtonAnimation());
    return;
  }

  const onEnd=(e)=>{
    if(e.target!==resetButton)return;
    if(e.propertyName!=="opacity"&&e.propertyName!=="background-color"&&e.propertyName!=="border-color")return;
    resetButton.removeEventListener("transitionend",onEnd);
    finishResetButtonAnimation();
  };
  resetButton.addEventListener("transitionend",onEnd);
  resetAnimationTimer=window.setTimeout(()=>{
    resetButton.removeEventListener("transitionend",onEnd);
    if(resetAnimationRunning&&resetButton.classList.contains("reset-fade-out"))finishResetButtonAnimation();
  },RESET_BUTTON_FADE_MS+180);
}
function playResetButtonAnimation(){
  const resetButton=$("reset");
  if(!resetButton || resetAnimationRunning || !hasResettableState())return false;
  resetAnimationRunning=true;
  resetButton.disabled=false;
  resetButton.setAttribute("aria-disabled","false");
  resetButton.classList.remove("reset-press");
  void resetButton.offsetWidth;
  resetButton.classList.add("reset-press");
  return true;
}
const resetButton=$("reset");
if(resetButton){
  resetButton.addEventListener("animationend",e=>{
    if(e.target===resetButton&&e.animationName==="resetFilterButtonV832"){
      startResetButtonFade();
    }
  });
}

resetButton.onclick=()=>{
  if(resetAnimationRunning)return;
  if(!playResetButtonAnimation())return;
  search.value="";
  quickFilter="";
  sort.value="game-asc";
  mediaCategory="Все";
  mediaYear="";
  currentPage=1;
  if(mediaCategoryFilter)mediaCategoryFilter.value="Все";
  if(mediaYearFilter)mediaYearFilter.value="";
  document.querySelectorAll('#mediaTabs [data-media-category]').forEach(tab=>tab.classList.toggle('active',tab.dataset.mediaCategory==='Все'));
  if(typeof syncYearFilterUI==='function')syncYearFilterUI();
  filteredCache=null;
  saveUI();
  render();
  resetButton.disabled=false;
  resetButton.setAttribute("aria-disabled","false");
};

document.addEventListener("keydown",e=>{
  const target=e.target;
  const editing=target&&(target.tagName==="INPUT"||target.tagName==="TEXTAREA"||target.tagName==="SELECT"||target.isContentEditable);
  if(e.ctrlKey&&!e.altKey&&!e.metaKey&&e.code==="KeyZ"){
    if(editing)return;
    const resetButton=$("reset");
    if(resetButton&&!resetButton.disabled){e.preventDefault();e.stopPropagation();resetButton.click();}
    return;
  }
  if(e.key==="Escape"){
    if(e.defaultPrevented)return;
    if(search.value){
      e.preventDefault();
      search.value="";
      currentPage=1;
      saveUI();
      render();
      search.focus();
    }
    const active=document.activeElement;
    if(active&&active!==document.body&&typeof active.blur==="function")active.blur();
    requestAnimationFrame(()=>document.activeElement?.blur?.());
    return;
  }
  if((e.code==="Slash"||e.key==="/")&&!editing&&!e.ctrlKey&&!e.altKey&&!e.metaKey){
    e.preventDefault();
    e.stopPropagation();
    search.focus();
    search.select();
  }
});

async function load(){
  fillFilters();
  loadUI();
  updateResetButtonState();
  let restoredFromDb=null;
  try{
    const raw=db.getGamesSync();
    persistedEntriesJSON=raw||"[]";
    const parsedGames=JSON.parse(raw||"[]");
    if(Array.isArray(parsedGames))restoredFromDb=migrateEntryStatuses(parsedGames.map(x=>({...x})));
    const trashRaw=db.getTrashSync();
    try{const parsedTrash=JSON.parse(trashRaw||"[]");trashCache=Array.isArray(parsedTrash)?parsedTrash:[]}catch(e){trashCache=[]}
    const uiRaw=db.getUISync();
    if(uiRaw!==null)persistedUIJSON=uiRaw;
  }catch(e){
    console.error("Не удалось прочитать локальную базу Кинотеки:",e);
    toastMsg("Не удалось загрузить локальную базу Кинотеки.","error");
  }
  games=restoredFromDb||[];
  if(typeof populateMediaYearFilter==="function")populateMediaYearFilter();
  if(mediaCategoryFilter)mediaCategoryFilter.value=mediaCategory||"Все";
  if(mediaYearFilter)mediaYearFilter.value=(!String(mediaYear).startsWith("decade:")?mediaYear:"");
  if(typeof syncYearFilterUI==="function")syncYearFilterUI();
  document.querySelectorAll("#mediaTabs [data-media-category]").forEach(t=>t.classList.toggle("active",(t.dataset.mediaCategory||"Все")===(mediaCategory||"Все")));
  window.dispatchEvent(new CustomEvent('kinoteka-media-category-state',{detail:mediaCategory||"Все"}));
  entriesDirty=false;
  refreshDuplicateSet();
  currentPage=1;
  render();
}
load().then(()=>{
  trashIndicatorHydrating=false;
  updateTrashIndicator();
}).finally(async()=>{
  try{
    if(document.fonts?.load){
      await Promise.race([
        Promise.all([
          document.fonts.load('400 16px "Inter"'),
          document.fonts.load('500 16px "Inter"'),
          document.fonts.load('600 16px "Inter"'),
          document.fonts.load('700 16px "Inter"')
        ]),
        new Promise(resolve=>setTimeout(resolve,1200))
      ]);
    }
    if(document.fonts?.ready){
      await Promise.race([
        document.fonts.ready,
        new Promise(resolve=>setTimeout(resolve,1200))
      ]);
    }
  }catch(e){console.warn("Font readiness check:",e);}
  document.documentElement.classList.remove("app-loading");
});

/* Kinoteka v66 — interaction focus recovery */
(()=>{
  const editable='input:not([disabled]):not([readonly]),textarea:not([disabled]):not([readonly]),select:not([disabled]),[contenteditable="true"]';
  document.addEventListener('pointerdown',e=>{
    const el=e.target.closest?.(editable);
    if(!el)return;
    requestAnimationFrame(()=>{
      if(document.activeElement!==el && !el.disabled && !el.readOnly) el.focus({preventScroll:true});
    });
  },true);
})();
