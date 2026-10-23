const ratings=["Понравилось","Нормально","Не понравилось","Смотрю","Запланировано","Избранное"];
const selectableRatings=ratings.filter(v=>v!=="Избранное");
function migrateEntryStatuses(arr){
  return arr.map(item=>{
    const copy={...item};
    if(!copy.rating) copy.rating="Запланировано";
    // «Избранное» — это переход из «Понравилось» по звезде.
    if(Boolean(copy.favorite) && copy.rating==="Понравилось") copy.rating="Избранное";
    else if(copy.rating!=="Избранное") copy.favorite=false;
    copy.favorite=copy.rating==="Избранное";
    delete copy.status;
    return copy;
  });
}
// Numerical rating is independent of the legacy categorical status.
function validScore10(value){return Number.isInteger(value) && value >= 1 && value <= 10;}
function validAddedAt(value){return typeof value==='string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString()===value;}
function score10Status(value){return value >= 7 ? 'Понравилось' : value >= 5 ? 'Нормально' : 'Не понравилось';}
const ratingOrder={"Понравилось":1,"Нормально":2,"Не понравилось":3,"Смотрю":4,"Запланировано":5,"Избранное":6,"":99};
let games=[];
let statActiveCache=null;
let currentPage=1;
let kinotekaViewMode="table";
let quickFilter="";
const PAGE_SIZE=25;
const CARD_PAGE_SIZE=24; // Hotfix 22: four complete rows of six on desktop; table remains 25.
let mediaCategory="Все";
let mediaYear="";

const db=window.kinotekaDatabase;
if(!db)throw new Error("Локальная база Кинотеки недоступна.");

const $=id=>document.getElementById(id);
const search=$("search");
const sort=$("sort"),tbody=$("tbody"),toast=$("toast");
const mediaCategoryFilter=$("mediaCategoryFilter"),mediaYearFilter=$("mediaYearFilter");
const pagination=$("pagination"),tableWrap=$("tableWrap"),emptyResults=$("emptyResults");
const kinotekaCardGrid=$("kinotekaCardGrid");
const statValues={
  total:$("totalCount"),
  liked:$("liked"),
  normal:$("normalCount"),
  disliked:$("disliked"),
  inProgress:$("inProgress"),
  planned:$("planned"),
  favorite:$("favoriteCount")
};
const statCards=document.querySelectorAll(".stat-card");
let statValuesRenderCache={total:null,liked:null,normal:null,disliked:null,inProgress:null,planned:null,favorite:null};

function norm(s){
  return String(s??"").replace(/[\u00A0\u2007\u202F]/g," ")
    .replace(/[‘’`]/g,"'").replace(/\s+/g," ").trim().toLocaleLowerCase("ru");
}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
// Кэш нормализованных названий: поиск/фильтрация/дубликаты больше не
// нормализуют одно и то же название заново при каждом render().
const entryNameNormCache=new WeakMap();
function entryNameNorm(entry){
  if(!entry || typeof entry!=="object")return norm(entry?.game);
  const cached=entryNameNormCache.get(entry);
  if(cached!==undefined)return cached;
  const value=norm(entry.game);
  entryNameNormCache.set(entry,value);
  return value;
}

// Одна каноническая идентичность записи для добавления, подсветки дубликатов
// и восстановления из Корзины: тип + нормализованное название + год.
function entryIdentityKey(entry){
  const name=norm(entry?.game??entry?.name);
  if(!name)return "";
  const category=norm(entry?.category||"Фильмы");
  const rawYear=entry?.year;
  let year="";
  if(rawYear!=null&&String(rawYear).trim()!==""){
    const numericYear=Number(rawYear);
    year=Number.isFinite(numericYear)?String(numericYear):norm(rawYear);
  }
  return `${category}\u0000${name}\u0000${year}`;
}

let filteredCache=null;
let sortedRowsCache=null;
// HF58: existing films without addedAt keep an unknown date. No fabricated timestamps.
let posterExistsByKey=new Map();
let posterSortRequestId=0;
let posterSortPending=false;
let persistedEntriesJSON=null;
let persistedUIJSON=null;
let trashCache=null;
let searchQueryCache={raw:null,q:"",words:[]};
let entriesDirty=true;

// Новые записи получают следующий положительный SQLite ID до сохранения.
// Это сохраняет естественный порядок строк (старые записи → новые) и делает
// проверку round-trip строго детерминированной даже для только что добавленных записей.
function nextProvisionalEntryId(offset=0){
  let maxId=0;
  for(const item of games){
    const id=Number(item?.id);
    if(Number.isInteger(id) && id>maxId)maxId=id;
  }
  return maxId+(1+offset);
}

async function save(){
  try{
    if(!entriesDirty){
      return true;
    }
    const rowsForDb=games.map(item=>({
      id:Number.isInteger(Number(item?.id))?Number(item.id):null,
      game:String(item?.game??"").trim(),
      category:String(item?.category??"Фильмы"),
      year:item?.year==null||item.year===""?null:Number(item.year),
      rating:item?.rating||"Запланировано",
      score10:validScore10(item?.score10)?item.score10:null,
      favorite:Boolean(item?.favorite),
      ...(validAddedAt(item?.addedAt)?{addedAt:item.addedAt}:{})
    }));
    const raw=JSON.stringify(rowsForDb);
    if(raw!==persistedEntriesJSON){
      const result=await db.replaceGamesConfirmed(raw);
      if(!result?.ok)throw new Error(result?.error||"Проверка сохранения не пройдена.");
      const check=db.getGamesSync();
      if(check!==raw){
        console.error("Round-trip сохранения записей не совпал с записью",{raw,check});
        throw new Error("Проверка сохранения не пройдена.");
      }
      persistedEntriesJSON=raw;
      filteredCache=null;
      sortedRowsCache=null;
      entriesDirty=false;
    } else {
      entriesDirty=false;
    }
    return true;
  }catch(e){
    console.error("Не удалось сохранить базу:",e);
    toastMsg("Не удалось сохранить изменения. Проверьте свободное место на диске","error");
    return false;
  }
}
function uiState(){return {search:search.value,sort:sort.value,quickFilter,mediaCategory,mediaYear,viewMode:kinotekaViewMode}}

let saveUITimer=null;
function saveUI(){
  try{
    const raw=JSON.stringify(uiState());
    if(raw===persistedUIJSON)return true;
    const result=db.replaceUISync(raw);
    if(!result?.ok || db.getUISync()!==raw)throw new Error("Проверка настроек интерфейса не пройдена.");
    persistedUIJSON=raw;
    return true;
  }catch(e){
    console.warn("Не удалось сохранить настройки интерфейса:",e);
    return false;
  }
}
function scheduleSaveUI(){
  clearTimeout(saveUITimer);
  saveUITimer=setTimeout(()=>{saveUI();saveUITimer=null},250);
}
function loadUI(){try{const raw=db.getUISync();if(!raw){quickFilter="";return}const u=JSON.parse(raw)||{};search.value=u.search||"";sort.value=[...sort.options].some(o=>o.value===u.sort)?u.sort:"game-asc";if(u.sort==="random")scheduleSaveUI();quickFilter="";mediaCategory=u.mediaCategory||"Все";mediaYear=u.mediaYear||"";kinotekaViewMode=u.viewMode==="cards"?"cards":"table";if(mediaCategoryFilter)mediaCategoryFilter.value=mediaCategory;if(mediaYearFilter)mediaYearFilter.value=mediaYear}catch(e){quickFilter="";console.warn("Не удалось восстановить настройки интерфейса:",e)}}

function positionToastStack(stack){
  if(!stack) return;
  const main=document.querySelector("main.wrap");
  const table=document.getElementById("tableWrap");
  if(!main) return;

  const gap=18;
  const edge=28;
  const maxWidth=320;
  const minRailWidth=180;
  const mainRect=main.getBoundingClientRect();
  const tableRect=table?.getBoundingClientRect?.() ?? null;
  const railAnchorRight=tableRect?.right ?? mainRect.right;
  const available=Math.floor(window.innerWidth-edge-(railAnchorRight+gap));
  const hasSideRail=available>=minRailWidth;

  stack.classList.toggle("toast-flow",!hasSideRail);
  stack.classList.toggle("toast-side-rail",hasSideRail);

  if(hasSideRail){
    const width=Math.min(maxWidth,available);
    const top=Math.max(48,Math.min(tableRect?.top ?? mainRect.top,window.innerHeight-120));
    stack.style.position="fixed";
    stack.style.left=`${Math.round(railAnchorRight+gap)}px`;
    stack.style.right="auto";
    stack.style.top=`${Math.round(top)}px`;
    stack.style.bottom="auto";
    stack.style.width=`${Math.round(width)}px`;
    stack.style.maxWidth=`${Math.round(width)}px`;
    if(stack.parentElement!==document.body) document.body.appendChild(stack);
  }else{
    stack.style.position="relative";
    stack.style.left="";
    stack.style.right="";
    stack.style.top="";
    stack.style.bottom="";
    stack.style.width="";
    stack.style.maxWidth="";
    if(table && stack.parentElement!==table.parentElement) table.parentElement.insertBefore(stack,table);
  }
}
function toastMsg(msg,type="success"){
  msg=String(msg??"").replace(/[.。]+$/g,"");
  if(type===true) type="warning";
  if(type===false||!type) type="success";
  if(!["success","info","warning","error"].includes(type)) type="success";
  let stack=document.getElementById("toastStack");
  if(!stack){
    stack=document.createElement("div");
    stack.id="toastStack";
    document.body.appendChild(stack);
  }
  positionToastStack(stack);

  const item=document.createElement("div");
  item.className=`toast-stack-item ${type}`;
  const icon=document.createElement("span");
  icon.className="toast-icon";
  icon.setAttribute("aria-hidden","true");
  icon.textContent={success:"✓",info:"i",warning:"!",error:"×"}[type];
  const text=document.createElement("span");
  text.className="toast-text";
  text.textContent=msg;
  item.append(icon,text);
  stack.appendChild(item);

  requestAnimationFrame(()=>item.classList.add("show"));

  setTimeout(()=>{
    item.classList.remove("show");
    setTimeout(()=>{item.remove();if(!stack.children.length)stack.remove();},220);
  },type==="error"?3600:2800);
}

window.addEventListener("resize",()=>{
  const stack=document.getElementById("toastStack");
  if(stack) positionToastStack(stack);
});
window.addEventListener("scroll",()=>{
  const stack=document.getElementById("toastStack");
  if(stack && stack.classList.contains("toast-side-rail")) positionToastStack(stack);
},{passive:true});

function openConfirmDialog({title,subtitle="",message="",confirmLabel="Подтвердить",cancelLabel="Отмена",danger=false}){
  const backdrop=$("confirmModal");
  const dialog=$("confirmDialog");
  if(!backdrop||!dialog)return Promise.resolve(false);
  $("confirmTitle").textContent=title;
  $("confirmSubtitle").textContent=subtitle;
  $("confirmMessage").textContent=message;
  const confirmButton=$("confirmAction");
  confirmButton.textContent=confirmLabel;
  confirmButton.classList.toggle("danger",Boolean(danger));
  const cancelButton=$("cancelConfirm");
  let settled=false;
  return new Promise(resolve=>{
    const finish=value=>{
      if(settled)return;
      settled=true;
      cleanup();
      const controller=window.KinotekaModal?.get("kinoteka-confirm");
      controller?.close();
      const complete=()=>resolve(value);
      if(!backdrop.classList.contains("open")&&!backdrop.classList.contains("closing")){complete();return;}
      let completed=false;
      const finishClose=()=>{
        if(completed)return;
        if(backdrop.classList.contains("open")||backdrop.classList.contains("closing"))return;
        completed=true;
        closeObserver.disconnect();
        clearTimeout(closeFallback);
        complete();
      };
      const closeObserver=new MutationObserver(finishClose);
      closeObserver.observe(backdrop,{attributes:true,attributeFilter:["class"]});
      const closeFallback=setTimeout(()=>{
        if(completed)return;
        completed=true;
        closeObserver.disconnect();
        complete();
      },320);
    };
    const onConfirm=()=>finish(true);
    const onCancel=()=>finish(false);
    const closeButton=$("closeConfirm");
    const observer=new MutationObserver(()=>{
      if(!backdrop.classList.contains("open")&&!backdrop.classList.contains("closing")&&!settled)finish(false);
    });
    const cleanup=()=>{
      confirmButton.removeEventListener("click",onConfirm);
      cancelButton.removeEventListener("click",onCancel);
      closeButton?.removeEventListener("click",onCancel);
      observer.disconnect();
      backdrop._confirmFinish=null;
    };
    confirmButton.addEventListener("click",onConfirm);
    cancelButton.addEventListener("click",onCancel);
    closeButton?.addEventListener("click",onCancel);
    observer.observe(backdrop,{attributes:true,attributeFilter:["class"]});
    backdrop._confirmFinish=onCancel;
    window.KinotekaModal?.get("kinoteka-confirm")?.open();
  });
}
function fillFilters(){
  // Rating options are created dynamically for each add-entry row.
}
const kinotekaAddEntryModal = window.KinotekaModal?.bind("add-entry", document.getElementById("modal"), document.querySelector("#modal .modal"));
const kinotekaTrashModal = window.KinotekaModal?.bind("entries-trash", document.getElementById("trashModal"), document.querySelector("#trashModal .modal"));
window.KinotekaModal?.bind("kinoteka-confirm", document.getElementById("confirmModal"), document.querySelector("#confirmModal .modal"));
const ratingOptionLabel={"Понравилось":"Понравилось","Нормально":"Нормально","Не понравилось":"Не понравилось","Смотрю":"Смотрю","Запланировано":"Запланировано","Избранное":"Избранное"};
const ratingOptionClass={"Понравилось":"rating-liked","Нормально":"rating-normal","Не понравилось":"rating-disliked","Смотрю":"rating-in-progress","Запланировано":"rating-planned","Избранное":"rating-favorite"};
const ratingOptionMap=new Map(selectableRatings.map(v=>[v,`<option class="${ratingOptionClass[v]||""}" value="${esc(v)}">${esc(ratingOptionLabel[v]||v)}</option>`]));
const ratingOptions=selectableRatings.map(v=>ratingOptionMap.get(v)).join("");
function ratingOptionList(){return ratingOptions;}
const ratingOptionCache=new Map();
for(const rating of ratings){
  const selected=rating;
  const options=selectableRatings.map(v=>{const label=ratingOptionLabel[v]||v;return `<option class="${ratingOptionClass[v]||""}" value="${esc(v)}"${v===selected?" selected":""}>${esc(label)}</option>`}).join("");
  ratingOptionCache.set(rating,selected==="Избранное"
    ? `<option class="rating-favorite" value="Избранное" selected hidden>Избранное</option>${options}`
    : options);
}
function selectOptions(values,current){
  if(values===ratings)return ratingOptionCache.get(current)||ratingOptionCache.get("Запланировано");
  return values.map(v=>`<option class="${ratingOptionClass[v]||""}" value="${esc(v)}"${v===current?" selected":""}>${esc(v)}</option>`).join("");
}
function clsForRating(v){
  return {"Понравилось":"rating-liked","Нормально":"rating-normal","Не понравилось":"rating-disliked","Смотрю":"rating-in-progress","Запланировано":"rating-planned","Избранное":"rating-favorite"}[v]||"";
}

let duplicateIdentitySet=new Set();

function duplicateGroups(){
  const groups=new Map();
  games.forEach((g,i)=>{
    const key=entryIdentityKey(g);
    if(!key)return;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(i);
  });
  return [...groups.entries()]
    .filter(([,indices])=>indices.length>1)
    .map(([key,indices])=>({key,indices}));
}

function refreshDuplicateSet(){
  duplicateIdentitySet=new Set(duplicateGroups().map(g=>g.key));
  filteredCache=null;
}

async function update(i,key,value){
  if(!games[i]||key!=="rating")return;
  const before={...games[i]};
  games[i].rating=value||"Запланировано";
  games[i].favorite=games[i].rating==="Избранное";
  entriesDirty=true;
  if(!(await save())){
    games[i]=before;
    return;
  }
  // Оценка не меняет названия записей, поэтому пересчёт набора дубликатов здесь не нужен.
  // Сбрасываем только кэш фильтрации: результат фильтра может зависеть от оценки.
  filteredCache=null;
  render();
}
