const ADD_ROW_DEFAULT_RATING="Запланировано";
let addRowUid=0;

function addRowTemplate(index){
  const uid=++addRowUid; const row=document.createElement('div'); row.className='kinoteka-entry-row'; row.dataset.rowUid=String(uid);
  row.innerHTML=`<input class="kinoteka-entry-name" type="text" autocomplete="off" placeholder="Название" aria-label="Название ${index}"><select class="kinoteka-entry-category" aria-label="Тип ${index}"><option>Фильмы</option><option>Сериалы</option><option>Анимация</option></select><input class="kinoteka-entry-year" type="text" inputmode="numeric" maxlength="4" pattern="[0-9]{0,4}" autocomplete="off" placeholder="Год" aria-label="Год ${index}"><div class="kinoteka-entry-rating-wrap"><select class="kinoteka-entry-rating" aria-label="Оценка ${index}">${ratingOptionList()}<option class="rating-favorite" value="Избранное" hidden>Избранное</option></select></div><label class="kinoteka-entry-favorite"><input class="kinoteka-entry-favorite-input" type="checkbox" aria-label="Добавить в избранное"><span aria-hidden="true">${lucideSvg('star',{size:16})}</span></label>${index>1?`<button type="button" class="kinoteka-entry-remove" aria-label="Удалить строку">${lucideSvg('x',{size:16})}</button>`:''}<div class="kinoteka-entry-error" aria-live="polite"></div>`;
  const input=row.querySelector('.kinoteka-entry-name'),rating=row.querySelector('.kinoteka-entry-rating');
  const category=row.querySelector('.kinoteka-entry-category'); category.value=mediaCategory!=='Все'?mediaCategory:'Фильмы';
  row.addEventListener('focusin',()=>syncAddModalActionAccent(row));
  rating.value=ADD_ROW_DEFAULT_RATING;
  input.addEventListener('input',()=>validateAddRows(false));
  rating.addEventListener('change',()=>{syncEntryRatingClass(rating);const f=row.querySelector('.kinoteka-entry-favorite-input');if(f){f.checked=rating.value==='Избранное';syncEntryFavoriteState(row);}});
  const cat=row.querySelector('.kinoteka-entry-category'); const year=row.querySelector('.kinoteka-entry-year');
  cat?.addEventListener('change',()=>validateAddRows(false));
  year?.addEventListener('input',()=>{const clean=String(year.value||'').replace(/\D+/g,'').slice(0,4);if(year.value!==clean)year.value=clean;validateAddRows(false);});
  row.querySelector('.kinoteka-entry-remove')?.addEventListener('click',()=>{const fallback=row.previousElementSibling||row.nextElementSibling;row.remove();renumberAddRows();validateAddRows(false);syncAddModalActionAccent(fallback||document.querySelector('#entryEntries .kinoteka-entry-row'));});
  row.querySelector('.kinoteka-entry-favorite-input')?.addEventListener('change',e=>{const f=e.target;if(f.checked){if(rating.value!=='Понравилось'){f.checked=false;return;}rating.value='Избранное';}else if(rating.value==='Избранное')rating.value='Понравилось';syncEntryRatingClass(rating);syncEntryFavoriteState(row);});
  syncEntryRatingClass(rating);syncEntryFavoriteState(row); return row;
}
function syncAddModalActionAccent(row){
  const modal=document.querySelector('#modal .unified-add-modal');
  const rating=row?.querySelector('.kinoteka-entry-rating');
  if(!modal||!rating)return;
  const cls=clsForRating(rating.value)||'rating-planned';
  modal.dataset.actionRating=cls.replace('rating-','');
}

function syncEntryRatingClass(select){
  const row=select?.closest('.kinoteka-entry-row');
  const targets=[select,row?.querySelector('.kinoteka-entry-category'),row?.querySelector('.kinoteka-entry-year')].filter(Boolean);
  targets.forEach(el=>el.classList.remove('rating-liked','rating-normal','rating-disliked','rating-in-progress','rating-planned','rating-favorite'));
  const cls=clsForRating(select?.value);
  if(cls)targets.forEach(el=>el.classList.add(cls));
  syncRatingMarker(select);
  syncAddModalActionAccent(row);
}

function syncRatingMarker(select){
  const wrap=select?.closest('.rating-center,.kinoteka-entry-rating-wrap');
  if(!wrap)return;
  wrap.classList.remove('rating-dot-liked','rating-dot-normal','rating-dot-disliked','rating-dot-in-progress','rating-dot-planned','rating-dot-favorite');
  const cls=clsForRating(select.value);
  if(cls)wrap.classList.add(`rating-dot-${cls.replace('rating-','')}`);
}


function syncEntryFavoriteState(row){
  const favorite=row?.querySelector('.kinoteka-entry-favorite-input');
  const rating=row?.querySelector('.kinoteka-entry-rating');
  if(!favorite||!rating)return;
  favorite.checked=rating.value==="Избранное";
  favorite.disabled=rating.value!=="Понравилось" && rating.value!=="Избранное";
  row.classList.toggle("is-favorite",favorite.checked);
}

function renumberAddRows(){
  const rows=[...document.querySelectorAll('#entryEntries .kinoteka-entry-row')];
  rows.forEach((row,i)=>{
    const n=i+1;
    const input=row.querySelector('.kinoteka-entry-name');
    const rating=row.querySelector('.kinoteka-entry-rating');
    const favorite=row.querySelector('.kinoteka-entry-favorite-input');
    if(input){input.setAttribute('aria-label',`Название записи ${n}`);}
    if(rating){rating.setAttribute('aria-label',`Оценка записи ${n}`);}
    if(favorite){favorite.setAttribute('aria-label',`Добавить в избранное для записи ${n}`);}
    const remove=row.querySelector('.kinoteka-entry-remove');
    if(remove)remove.setAttribute('aria-label',`Удалить строку ${n}`);
  });
}

function getAddRows(){return [...document.querySelectorAll('#entryEntries .kinoteka-entry-row')].map(row=>({row,name:row.querySelector('.kinoteka-entry-name')?.value.trim()||'',category:row.querySelector('.kinoteka-entry-category')?.value||'Фильмы',year:row.querySelector('.kinoteka-entry-year')?.value||'',rating:row.querySelector('.kinoteka-entry-rating')?.value||ADD_ROW_DEFAULT_RATING,favorite:Boolean(row.querySelector('.kinoteka-entry-favorite-input')?.checked),error:row.querySelector('.kinoteka-entry-error')}));}

function validateAddRows(showMessages=true){
  const rows=getAddRows();
  const existing=new Set(games.map(g=>entryIdentityKey(g)).filter(Boolean));
  const seen=new Map();
  let valid=true;
  rows.forEach(item=>{
    const key=entryIdentityKey({category:item.category,name:item.name,year:item.year});
    if(item.error){item.error.textContent="";item.error.className="kinoteka-entry-error";}
    item.row.classList.remove('has-error');
    if(!item.name)return;
    let message="";
    if(existing.has(key))message="Эта запись уже есть в списке.";
    else if(seen.has(key))message="Эта запись уже указана выше.";
    if(message){
      valid=false;
      if(showMessages&&item.error){item.error.textContent=message;item.error.classList.add('show');item.row.classList.add('has-error');}
    }else{
      seen.set(key,true);
    }
  });
  const unnamed=rows.find(item=>!item.name);
  if(showMessages&&unnamed){
    valid=false;
    unnamed.row.classList.add('has-error');
    if(unnamed.error){unnamed.error.textContent="Введите название записи.";unnamed.error.classList.add('show');}
    unnamed.row.querySelector('.kinoteka-entry-name')?.focus();
  }
  const global=$('dupBox');
  if(global){global.textContent="";global.classList.remove('show');}
  return valid && rows.length>0;
}

function openModal(){
  const list=$("entryEntries");
  list.innerHTML="";
  list.appendChild(addRowTemplate(1));
  renumberAddRows();
  $("dupBox").className="dup-box";
  $("dupBox").textContent="";
  kinotekaAddEntryModal?.open(document.querySelector("#entryEntries .kinoteka-entry-name"));
}

function addEntryRow(){
  const list=$("entryEntries");
  const row=addRowTemplate(list.children.length+1);
  list.appendChild(row);
  renumberAddRows();
  row.querySelector('.kinoteka-entry-name')?.focus();
}

function closeModal(){
  kinotekaAddEntryModal?.close();
}

async function addEntry(){const rows=getAddRows();if(!validateAddRows(true))return;const addedItems=rows.map((item,index)=>({id:nextProvisionalEntryId(index),game:item.name,category:item.category,year:item.year?Number(item.year):null,rating:item.favorite?'Избранное':item.rating,favorite:item.favorite}));games.push(...addedItems);entriesDirty=true;if(!(await save())){games.splice(games.length-addedItems.length,addedItems.length);return;}refreshDuplicateSet();currentPage=1;closeModal();populateMediaYearFilter();render();toastMsg(addedItems.length===1?`«${addedItems[0].game}» добавлена.`:`Добавлено записей: ${addedItems.length}.`,"success");}


function getSortedRows(){
  const sortKey=sort.value;
  if(sortedRowsCache && sortedRowsCache.games===games && sortedRowsCache.sort===sortKey)return sortedRowsCache.rows;
  const rows=games.map((g,i)=>({g,i,name:entryNameNorm(g)}));
  rows.sort((a,b)=>{
    if(sortKey==="rating")return (ratingOrder[a.g.rating]??90)-(ratingOrder[b.g.rating]??90)||a.name.localeCompare(b.name,"ru");
    return (sortKey==="game-desc"?-1:1)*a.name.localeCompare(b.name,"ru");
  });
  sortedRowsCache={games,sort:sortKey,rows};
  return rows;
}
function filtered(){const rawSearch=search.value;let q,searchWords;if(searchQueryCache.raw===rawSearch){q=searchQueryCache.q;searchWords=searchQueryCache.words;}else{q=norm(rawSearch);searchWords=q?q.split(/\s+/).filter(Boolean):[];searchQueryCache={raw:rawSearch,q,words:searchWords};}const key=`${q}\u0000${sort.value}\u0000${quickFilter}\u0000${mediaCategory}\u0000${mediaYear}`;if(filteredCache&&filteredCache.games===games&&filteredCache.key===key)return filteredCache.rows;const rows=[];for(const row of getSortedRows()){const g=row.g;const quickOk=!quickFilter||(quickFilter==='favorite'?Boolean(g.favorite):g.rating===quickFilter);const searchOk=!searchWords.length||searchWords.every(word=>row.name.includes(word));const catOk=mediaCategory==='Все'||g.category===mediaCategory;const yearValue=g.year==null||g.year===""?null:Number(g.year);const yearOk=!mediaYear||(String(mediaYear).startsWith("decade:")?(yearValue!=null&&yearValue>=Number(mediaYear.slice(7))&&yearValue<=Number(mediaYear.slice(7))+9):String(yearValue??"")===String(mediaYear));if(quickOk&&searchOk&&catOk&&yearOk)rows.push(row);}filteredCache={games,key,rows};return rows;}

// Hotfix 16: posters are user-chosen images stored in a separate local folder.
// The frontend never accepts remote URLs and never embeds poster bytes in SQLite.
const posterInvoke=window.__TAURI__?.core?.invoke;
const posterCache=new Map();
const posterMaxCached=40;
const posterPending=new Map();
const posterCredits=new Map();
const posterAutoBusy=new Set();
const commonsPosterApi=window.KinotekaCommonsPosters;
const commonsOptIn=document.getElementById('kinotekaCommonsOptIn');
try{if(commonsOptIn)commonsOptIn.checked=localStorage.getItem('kinotekaAutoCommonsOptIn')==='1';}catch{}
commonsOptIn?.addEventListener('change',()=>{
  try{localStorage.setItem('kinotekaAutoCommonsOptIn',commonsOptIn.checked?'1':'0');}catch{}
});

const posterChooser=document.createElement('input');
posterChooser.type='file';
posterChooser.accept='image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
posterChooser.hidden=true;
posterChooser.setAttribute('aria-label','Выбрать файл постера');
document.body.appendChild(posterChooser);
let posterSelection=null;
let posterOpenMenu=null;
let posterPasteDialog=null;
function closePosterMenu({focus=false}={}){
  const menu=posterOpenMenu;
  if(!menu)return;
  posterOpenMenu=null;
  menu.hidden=true;
  const toggle=menu.closest('.kinoteka-card-poster')?.querySelector('[data-poster-choose]');
  toggle?.setAttribute('aria-expanded','false');
  if(focus)toggle?.focus();
}
function togglePosterMenu(card){
  const menu=card?.querySelector('[data-poster-menu]');
  if(!menu)return;
  const wasOpen=posterOpenMenu===menu&&!menu.hidden;
  closePosterMenu();
  if(wasOpen)return;
  menu.hidden=false;
  posterOpenMenu=menu;
  card.querySelector('[data-poster-choose]')?.setAttribute('aria-expanded','true');
  menu.querySelector('[data-poster-action]')?.focus();
}
const posterAllowedTypes=new Set(['image/png','image/jpeg','image/webp']);
function checkPosterBlob(blob){
  if(!blob||!posterAllowedTypes.has(blob.type)||blob.size<16||blob.size>5*1024*1024){
    throw new Error('Нужна картинка JPG, PNG или WebP размером не более 5 МБ.');
  }
}
async function saveUserPoster(key,blob){
  checkPosterBlob(blob);
  if(!posterInvoke)throw new Error('Сохранение изображений доступно только в приложении.');
  const dataUrl=await posterBlobToUrl(blob);
  const result=await posterInvoke('poster_set',{key,dataUrl});
  if(!result?.ok||!result.dataUrl)throw new Error('Постер не был сохранён.');
  posterRefreshKey(key,result.dataUrl);
  toastMsg('Постер сохранён локально.','success');
}
function closePosterPasteDialog(){
  const state=posterPasteDialog;
  if(!state)return;
  posterPasteDialog=null;
  document.removeEventListener('paste',state.onPaste,true);
  document.removeEventListener('keydown',state.onKey,true);
  state.layer.remove();
}
function openPosterPasteDialog(key,reason=''){
  closePosterPasteDialog();
  const layer=document.createElement('div');layer.className='kinoteka-paste-backdrop';
  const dialog=document.createElement('section');dialog.className='kinoteka-paste-dialog';
  dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
  dialog.setAttribute('aria-label','Вставить постер из буфера обмена');
  const heading=document.createElement('h3');heading.textContent='Вставить постер';
  const hint=document.createElement('p');hint.textContent='Скопируй изображение и нажми Ctrl+V. Поддерживаются JPG, PNG и WebP до 5 МБ.';
  const status=document.createElement('p');status.className='kinoteka-paste-status';status.setAttribute('aria-live','polite');
  if(reason)status.textContent=reason;
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Отмена';
  cancel.addEventListener('click',closePosterPasteDialog);
  dialog.append(heading,hint,status,cancel);layer.append(dialog);document.body.append(layer);
  async function onPaste(event){
    const item=[...(event.clipboardData?.items||[])].find(item=>item.kind==='file'&&posterAllowedTypes.has(item.type));
    if(!item){status.textContent='В буфере нет изображения JPG, PNG или WebP. Скопируй саму картинку, а не адрес ссылки.';return;}
    event.preventDefault();event.stopPropagation();
    const blob=item.getAsFile();
    try{await saveUserPoster(key,blob);closePosterPasteDialog();}
    catch(error){status.textContent=String(error?.message||error);}
  }
  const onKey=event=>{if(event.key==='Escape'){event.preventDefault();closePosterPasteDialog();}};
  layer.addEventListener('click',event=>{if(event.target===layer)closePosterPasteDialog();});
  document.addEventListener('paste',onPaste,true);
  document.addEventListener('keydown',onKey,true);
  posterPasteDialog={layer,onPaste,onKey};
  cancel.focus();
}
async function pasteUserPoster(key){
  // Hotfix 30: read the Windows image clipboard in native Tauri, never via
  // browser clipboard read APIs, which raise WebView2 permission prompts.
  if(!posterInvoke){openPosterPasteDialog(key,'Буфер обмена недоступен. Нажми Ctrl+V для вставки изображения.');return;}
  try{
    const result=await posterInvoke('poster_clipboard_set',{key});
    if(!result?.ok||!result.dataUrl)throw new Error('Постер не был сохранён.');
    posterRefreshKey(key,result.dataUrl);
    toastMsg('Постер вставлен из буфера и сохранён.','success');
  }catch(error){
    const message=String(error?.message||error);
    if(message.includes('В буфере нет изображения')){
      toastMsg('В буфере нет изображения. Скопируй картинку и попробуй снова.','info');
      return;
    }
    openPosterPasteDialog(key,`Не удалось прочитать изображение напрямую (${message}). Нажми Ctrl+V для вставки.`);
  }
}

function applyPosterToCard(card,dataUrl){
  if(!card?.isConnected)return;
  const shell=card.querySelector('.kinoteka-card-poster');
  if(!shell)return;
  const image=shell.querySelector('.kinoteka-poster-image');
  if(dataUrl){
    if(image){image.src=dataUrl;}else{
      const img=document.createElement('img');
      img.className='kinoteka-poster-image';img.alt='';img.decoding='async';img.loading='lazy';img.src=dataUrl;
      shell.prepend(img);
    }
    shell.classList.add('has-poster');
  }else{
    image?.remove();shell.classList.remove('has-poster');
  }
  const button=card.querySelector('[data-poster-choose]');
  if(button)button.textContent=dataUrl?'Изменить':'Постер';
  const remove=card.querySelector('[data-poster-remove]');
  if(remove)remove.hidden=!dataUrl;
  const auto=card.querySelector('[data-poster-auto]');
  if(auto)auto.hidden=!card.dataset.posterKey?.startsWith('imdb:');
  let creditLink=card.querySelector('.kinoteka-poster-credit');
  const credit=posterCredits.get(card.dataset.posterKey);
  if(dataUrl && credit?.sourceUrl?.startsWith('https://commons.wikimedia.org/wiki/File:')){
    if(!creditLink){
      creditLink=document.createElement('a');creditLink.className='kinoteka-poster-credit';
      creditLink.textContent='ⓘ';creditLink.target='_blank';creditLink.rel='noopener noreferrer';
      shell.append(creditLink);
    }
    creditLink.href=credit.sourceUrl;
    creditLink.setAttribute('aria-label',`Автор и лицензия постера: ${credit.author}, ${credit.license}`);
  }else creditLink?.remove();
}
function posterCachePut(key,dataUrl){
  posterCache.delete(key);
  posterCache.set(key,dataUrl||null);
  if(posterCache.size>posterMaxCached)posterCache.delete(posterCache.keys().next().value);
}
function posterRefreshKey(key,dataUrl,credit=null){
  if(credit)posterCredits.set(key,credit);else posterCredits.delete(key);
  posterCachePut(key,dataUrl);
  kinotekaCardGrid?.querySelectorAll('.kinoteka-film-card').forEach(card=>{
    if(card.dataset.posterKey===key)applyPosterToCard(card,dataUrl);
  });
}
async function posterLoadFor(card){
  const key=card?.dataset.posterKey;
  if(!key||!posterInvoke)return;
  if(posterCache.has(key)){applyPosterToCard(card,posterCache.get(key));return;}
  let pending=posterPending.get(key);
  if(!pending){
    pending=posterInvoke('poster_get',{key}).then(result=>{
      const url=result?.exists&&typeof result.dataUrl==='string'?result.dataUrl:null;
      // A user may select/replace a poster while a previous disk read is pending.
      // Never let that older result overwrite the new selection.
      if(result?.credit)posterCredits.set(key,result.credit);
      if(!posterCache.has(key))posterCachePut(key,url);
      return posterCache.get(key);
    }).catch(err=>{console.warn('[Kinoteka] Не удалось прочитать постер:',err);return null;})
      .finally(()=>posterPending.delete(key));
    posterPending.set(key,pending);
  }
  const url=await pending;
  if(card.dataset.posterKey===key)applyPosterToCard(card,posterCache.get(key)??url);
}

// Hotfix 18 — bounded choices, no automatic image installation. Confirm each Commons image.
const commonsMissStorageKey='kinotekaCommonsNoImageV1';
const commonsMissTtl=24*60*60*1000;
function commonsMissRead(imdb){
  try{
    const misses=JSON.parse(localStorage.getItem(commonsMissStorageKey)||'{}');
    const at=Number(misses[imdb]);
    return Number.isFinite(at)&&at<=Date.now()&&Date.now()-at<commonsMissTtl;
  }catch{return false;}
}
function commonsMissWrite(imdb,missing){
  try{
    const now=Date.now();let misses={};
    try{misses=JSON.parse(localStorage.getItem(commonsMissStorageKey)||'{}')||{};}catch{}
    if(typeof misses!=='object'||Array.isArray(misses))misses={};
    const entries=Object.entries(misses).filter(([id,at])=>/^tt\d{4,15}$/.test(id)&&Number.isFinite(Number(at))&&now-Number(at)<commonsMissTtl);
    const next=Object.fromEntries(entries.slice(-100));
    if(missing)next[imdb]=now;else delete next[imdb];
    localStorage.setItem(commonsMissStorageKey,JSON.stringify(next));
  }catch{} // Storage may be disabled: a network lookup must remain optional and usable.
}
function commonsPreviewCandidates(candidates){
  return new Promise(resolve=>{
    const overlay=document.createElement('div');overlay.className='kinoteka-commons-backdrop';
    const dialog=document.createElement('section');dialog.className='kinoteka-commons-dialog';
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-label','Выбор изображения Wikimedia Commons');
    const heading=document.createElement('h3');heading.textContent='Изображения Wikimedia Commons';
    const notice=document.createElement('p');notice.textContent='Это могут быть фотографии, а не афиши. Выбери подходящую обложку и проверь авторство и лицензию.';
    const img=document.createElement('img');img.className='kinoteka-commons-preview';img.alt='Предпросмотр кандидата';
    const status=document.createElement('p');status.className='kinoteka-commons-position';status.setAttribute('aria-live','polite');
    const credit=document.createElement('p');credit.className='kinoteka-commons-attribution';
    const link=document.createElement('a');link.target='_blank';link.rel='noopener noreferrer';link.textContent='Исходный файл и лицензия ↗';
    const actions=document.createElement('div');actions.className='kinoteka-commons-actions';
    const prev=document.createElement('button');prev.type='button';prev.textContent='← Назад';
    const next=document.createElement('button');next.type='button';next.textContent='Далее →';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Отмена';
    const approve=document.createElement('button');approve.type='button';approve.textContent='Сохранить постер';
    actions.append(prev,next,cancel,approve);
    dialog.append(heading,notice,img,status,credit,link,actions);overlay.append(dialog);document.body.append(overlay);
    let index=0,sequence=0,currentBlob=null,objectUrl=null,closed=false;
    const blobs=new Map();
    const close=selection=>{
      if(closed)return;closed=true;sequence++;
      document.removeEventListener('keydown',onKey);
      if(objectUrl)URL.revokeObjectURL(objectUrl);
      overlay.remove();resolve(selection);
    };
    const onKey=e=>{if(e.key==='Escape'){e.preventDefault();close(null);}};
    document.addEventListener('keydown',onKey);
    const show=async(nextIndex)=>{
      index=nextIndex;
      const mySequence=++sequence;
      const item=candidates[index];
      if(objectUrl){URL.revokeObjectURL(objectUrl);objectUrl=null;}
      img.removeAttribute('src');img.hidden=true;
      currentBlob=null;approve.disabled=true;
      prev.disabled=index===0;next.disabled=index===candidates.length-1;
      status.textContent=`Изображение ${index+1} из ${candidates.length} · загрузка…`;
      credit.textContent=`Автор: ${item.source.author} · лицензия: ${item.source.license}`;
      link.href=item.source.sourceUrl;
      try{
        const blob=blobs.get(index)||await commonsPosterApi.download(item);
        if(closed||sequence!==mySequence)return;
        blobs.set(index,blob);currentBlob=blob;
        objectUrl=URL.createObjectURL(blob);img.src=objectUrl;img.hidden=false;
        status.textContent=`Изображение ${index+1} из ${candidates.length}`;
        approve.disabled=false;
      }catch(error){
        if(closed||sequence!==mySequence)return;
        status.textContent='Ошибка загрузки изображения: '+String(error?.message||error)+' Можно выбрать следующий вариант.';
      }
    };
    prev.addEventListener('click',()=>{if(index>0)void show(index-1);});
    next.addEventListener('click',()=>{if(index+1<candidates.length)void show(index+1);});
    cancel.addEventListener('click',()=>close(null));
    approve.addEventListener('click',()=>{if(currentBlob)close({blob:currentBlob,source:candidates[index].source});});
    overlay.addEventListener('click',e=>{if(e.target===overlay)close(null);});
    cancel.focus();void show(0);
  });
}
function posterBlobToUrl(blob){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=()=>reject(new Error('Не удалось прочитать изображение.'));reader.readAsDataURL(blob);
  });
}
async function commonsFindFor(key,{force=false}={}){
  if(!key?.startsWith('imdb:')||!posterInvoke||!commonsPosterApi||posterAutoBusy.has(key))return;
  const imdb=key.slice(5);
  if(!force&&commonsMissRead(imdb)){
    toastMsg('Для этого IMDb ID изображение уже проверяли. Автопоиск повторится завтра; вручную можно искать сейчас.','info');
    return;
  }
  posterAutoBusy.add(key);
  kinotekaCardGrid.querySelectorAll('.kinoteka-film-card').forEach(card=>{
    if(card.dataset.posterKey===key){const b=card.querySelector('[data-poster-auto]');if(b)b.disabled=true;}
  });
  try{
    toastMsg('Проверяю Wikimedia Commons по IMDb ID…','info');
    const result=await commonsPosterApi.lookupCandidates(imdb);
    if(!result.candidates.length){
      commonsMissWrite(imdb,true);
      const message=result.reason==='no_image'
        ?'В Wikidata нет изображения для этого IMDb ID. Можно выбрать файл вручную.'
        :'Изображения есть, но нет подходящих свободных файлов JPG/PNG/WebP. Можно выбрать файл вручную.';
      toastMsg(message,'info');return;
    }
    commonsMissWrite(imdb,false);
    const choice=await commonsPreviewCandidates(result.candidates);
    if(!choice)return;
    // The manual image may have changed while the network request was pending.
    const current=await posterInvoke('poster_get',{key});
    if(current?.exists&&!window.confirm('Для этой записи уже есть постер. Заменить его изображением из Commons?'))return;
    const dataUrl=await posterBlobToUrl(choice.blob);
    const saved=await posterInvoke('poster_set',{key,dataUrl,source:choice.source});
    if(!saved?.ok)throw new Error('Приложение не подтвердило сохранение.');
    posterRefreshKey(key,saved.dataUrl,saved.credit||choice.source);
    toastMsg('Изображение Commons сохранено локально.','success');
  }catch(e){
    console.warn('[Kinoteka] Commons poster:',e);
    // Network errors are deliberately not stored as no-result; the user can retry.
    toastMsg('Ошибка подключения/поиска Commons: '+String(e?.message||e),'error');
  }finally{
    posterAutoBusy.delete(key);
    kinotekaCardGrid.querySelectorAll('.kinoteka-film-card').forEach(card=>{
      if(card.dataset.posterKey===key){const b=card.querySelector('[data-poster-auto]');if(b)b.disabled=false;}
    });
  }
}

posterChooser.addEventListener('change',async()=>{
  const selected=posterSelection;
  const file=posterChooser.files?.[0];
  posterChooser.value='';posterSelection=null;
  if(!selected||!file)return;
  try{await saveUserPoster(selected,file);}
  catch(error){console.error('[Kinoteka] Ошибка постера:',error);toastMsg('Не удалось сохранить постер: '+String(error?.message||error),'error');}
});

// Hotfix 27 — explicit local numerical rating editor, 1–10; blank = no score.
// Hotfix 45: prevent opening two score editors on fast/double clicks.
let scoreDialogActive = false;
function askScore10(entry){
  if(scoreDialogActive) return Promise.resolve(undefined);
  scoreDialogActive = true;
  return new Promise(resolve=>{
    const layer=document.createElement('div');
    layer.className='kinoteka-score-modal-layer';
    layer.setAttribute('role','presentation');
    const dialog=document.createElement('section');dialog.className='kinoteka-score-modal';
    dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-label','Числовая оценка');
    const heading=document.createElement('h3');heading.textContent='Оценка или статус';
    const detail=document.createElement('p');detail.textContent=String(entry.game||'');
    const help=document.createElement('p');help.textContent='1–4 — Не понравилось · 5–6 — Нормально · 7–10 — Понравилось';
    const grid=document.createElement('div');grid.className='kinoteka-score-modal-grid';
    let finished=false;
    const close=(value)=>{if(finished)return;finished=true;scoreDialogActive=false;document.removeEventListener('keydown',keyHandler,true);layer.remove();resolve(value);};
    const keyHandler=e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close(undefined);}};
    for(let n=1;n<=10;n++){
      const b=document.createElement('button');b.type='button';b.textContent=String(n);
      b.className='kinoteka-score-option'+(entry.score10===n?' current':'');
      b.setAttribute('aria-label',`Оценка ${n} из 10`);
      b.addEventListener('click',()=>close(n));grid.append(b);
    }
    const actions=document.createElement('div');actions.className='kinoteka-score-modal-actions';
    const clear=document.createElement('button');clear.type='button';clear.textContent='Без оценки';
    clear.addEventListener('click',()=>close(null));
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Отмена';
    cancel.addEventListener('click',()=>close(undefined));
    const statuses=document.createElement('div');statuses.className='kinoteka-score-modal-statuses';
    for(const status of ['Смотрю','Запланировано']){
      const b=document.createElement('button');b.type='button';b.textContent=status;
      b.className='kinoteka-score-status-option'+(entry.rating===status?' current':'');
      b.dataset.status=status;
      b.setAttribute('aria-label',`Установить статус: ${status}`);
      b.addEventListener('click',()=>close({status}));
      statuses.append(b);
    }
    actions.append(clear,cancel);dialog.append(heading,detail,help,grid,statuses,actions);
    layer.append(dialog);document.body.append(layer);
    layer.addEventListener('click',e=>{if(e.target===layer)close(undefined);});
    document.addEventListener('keydown',keyHandler,true);
    (dialog.querySelector('.kinoteka-score-option.current')||grid.firstElementChild)?.focus?.();
  });
}
async function updateScore10(index,score){
  const entry=games[index];if(!entry)return;
  const pendingStatus=score&&typeof score==='object'&&['Смотрю','Запланировано'].includes(score.status)?score.status:null;
  if(!pendingStatus&&score!==null&&!validScore10(score))return;
  const before={...entry};
  if(pendingStatus){
    if(entry.favorite){
      const yes=await window.KinotekaDialog?.confirm?.('Смена статуса удалит запись из избранного. Продолжить?',
        {title:'Изменить статус',okText:'Изменить'});
      if(yes!==true)return;
    }
    // Keep a previous numeric score in local data until explicitly replaced or cleared.
    // The pending status is the only badge shown while watching / planning.
    entry.rating=pendingStatus;entry.favorite=false;
    entriesDirty=true;
    if(!(await save())){games[index]=before;return;}
    filteredCache=null;sortedRowsCache=null;cardRenderCacheKey='';tableRenderCacheKey='';render();
    return;
  }
  if(entry.favorite&&score!==null&&score<7){
    const yes=await window.KinotekaDialog?.confirm?.('Новая оценка ниже 7. Статус станет соответствовать оценке, а фильм будет удалён из избранного. Продолжить?',
      {title:'Изменить оценку',okText:'Применить'});
    if(yes!==true)return;
  }
  entry.score10=score;
  if(score!==null){
    const status=score10Status(score);
    entry.rating=entry.favorite&&status==='Понравилось'?'Избранное':status;
    entry.favorite=entry.rating==='Избранное';
  }
  entriesDirty=true;
  if(!(await save())){games[index]=before;return;}
  filteredCache=null;sortedRowsCache=null;cardRenderCacheKey='';tableRenderCacheKey='';render();
}

// Hotfix 11: the same filtered collection drives table and poster-style cards.
let cardRenderCacheKey="";
function renderCardView(pageRows,tableKey){
  if(!kinotekaCardGrid)return;
  kinotekaCardGrid.hidden=kinotekaViewMode!=="cards"||!pageRows.length;
  document.querySelectorAll('[data-kinoteka-view]').forEach(button=>{
    const active=button.dataset.kinotekaView===kinotekaViewMode;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  if(kinotekaViewMode!=="cards"||cardRenderCacheKey===tableKey)return;
  const fragment=document.createDocumentFragment();
  // Small inline, network-free icons for the three existing library categories.
  // Keep them in the poster's year row; no category chip under the title.
  const mediaIcons={
    'Фильмы':'<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M7 4v16M17 4v16M2.5 9h4.5M2.5 15h4.5M17 9h4.5M17 15h4.5"/><path d="m10 9 4 3-4 3V9Z" fill="currentColor" stroke="none"/>',
    'Сериалы':'<rect x="2.5" y="4.5" width="19" height="15" rx="2.8"/><path d="m10 8 5 4-5 4V8Z" fill="currentColor" stroke="none"/><path d="M9 22h6"/>',
    'Анимация':'<path d="M12 2.3 14.2 9.8 21.7 12l-7.5 2.2L12 21.7l-2.2-7.5L2.3 12l7.5-2.2L12 2.3Z"/><path d="m20 3 .7 2.3L23 6l-2.3.7L20 9l-.7-2.3L17 6l2.3-.7L20 3Z"/>'
  };
  for(const {g,i} of pageRows){
    const card=document.createElement('article');
    const color=clsForRating(g.rating)||'rating-planned';
    card.className=`kinoteka-film-card ${color}${g.favorite?" is-favorite":""}`;
    card.tabIndex=0;
    card.setAttribute('aria-label',`Карточка: ${String(g.game||'').trim()}`);
    card.dataset.posterKey=db.getPosterKeyFor?.({name:g.game,category:g.category,year:g.year})||'';
    card.dataset.entryId=String(g.id??'');
    const label=String(g.game||'').trim();
    const year=String(g.year??'').trim();
    const score=validScore10(g.score10)?g.score10:null;
    const pendingStatus=['Смотрю','Запланировано'].includes(g.rating)?g.rating:null;
    const scoreClass=pendingStatus?(pendingStatus==='Смотрю'?'status-watching':'status-planned'):(score==null?'is-empty':score>=7?'score-liked':score>=5?'score-normal':'score-disliked');
    const scoreText=pendingStatus?(pendingStatus==='Смотрю'?'Смотрю':'План'):(score==null?'＋':String(score));
    const scoreLabel=pendingStatus?`Статус: ${pendingStatus}. Нажми для изменения`:score==null?'Выбрать оценку или статус':`Оценка: ${score} из 10. Нажми для изменения`;
    const yearBadge=/^\d{4}$/.test(year)?`<span class="kinoteka-card-year">${esc(year)}</span>`:'';
    const category=['Фильмы','Сериалы','Анимация'].includes(g.category)?g.category:'Фильмы';
    const categoryClass=category==='Сериалы'?'kind-series':category==='Анимация'?'kind-animation':'kind-film';
    const categoryName=category==='Фильмы'?'Фильм':category==='Сериалы'?'Сериал':'Анимация';
    const categoryBadge=`<span class="kinoteka-card-type ${categoryClass}" role="img" aria-label="${categoryName}"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.95" stroke-linecap="round" stroke-linejoin="round" focusable="false" aria-hidden="true">${mediaIcons[category]}</svg></span>`;
    const favorite=Boolean(g.favorite);
    const canFavorite=favorite||(g.rating==='Понравилось'&&(score===null||score>=7));
    card.innerHTML=`<div class="kinoteka-card-poster" role="group" aria-label="Постер: ${esc(label)}"><div class="kinoteka-card-topline">${yearBadge}${categoryBadge}</div><span class="kinoteka-poster-caption" aria-hidden="true">KINOTEKA</span><button type="button" class="kinoteka-card-score ${scoreClass}" data-card-score="${i}" aria-label="${esc(scoreLabel)} для ${esc(label)}">${scoreText}</button><button class="kinoteka-poster-choose" type="button" data-poster-choose aria-haspopup="true" aria-expanded="false" aria-label="Действия с постером для ${esc(label)}">Постер</button><div class="kinoteka-poster-menu" data-poster-menu hidden role="group" aria-label="Действия с постером"><button type="button" data-poster-action="file">Выбрать с ПК</button><button type="button" data-poster-action="paste">Вставить из буфера</button><button type="button" data-poster-action="remove" data-poster-remove hidden>Удалить постер</button></div></div>
      ${canFavorite?`<button type="button" class="kinoteka-card-favorite ${favorite?'is-on':''}" data-card-favorite="${i}" aria-label="${favorite?'Убрать из избранного':'Добавить в избранное'}">${favorite?'★':'☆'}</button>`:''}
      <div class="kinoteka-card-meta"><div class="kinoteka-card-title" title="${esc(label)}">${esc(label)}</div><div class="kinoteka-card-title-full" role="tooltip" aria-hidden="true">${esc(label)}</div></div>`;
    fragment.appendChild(card);
  }
  closePosterMenu();
  if(typeof closeCardContextMenu==='function')closeCardContextMenu();
  kinotekaCardGrid.replaceChildren(fragment);
  kinotekaCardGrid.querySelectorAll('.kinoteka-film-card').forEach(posterLoadFor);
  if(typeof scheduleKinotekaCardTitleCheck==='function')scheduleKinotekaCardTitleCheck();
  cardRenderCacheKey=tableKey;
}

// Hotfix 31: paste into the explicitly selected card with Ctrl+V.
// Keep normal paste in text fields and never act while another dialog is open.
let posterShortcutBusy=false;
function isEditablePosterShortcutTarget(target){
  return Boolean(target?.isContentEditable||target?.closest?.('input,textarea,select,[contenteditable],[role="textbox"]'));
}
function hasOpenPosterShortcutDialog(){
  return Boolean(document.querySelector('.kinoteka-score-modal-layer,.kinoteka-paste-backdrop,.kinoteka-native-dialog-layer,.modal-backdrop.show,.kinoteka-poster-menu:not([hidden])'));
}
async function pastePosterIntoSelectedCard(card){
  if(posterShortcutBusy||!card?.isConnected)return;
  const key=card.dataset.posterKey;
  if(!key){toastMsg('Не удалось определить карточку для постера.','error');return;}
  posterShortcutBusy=true;
  try{
    if(!posterInvoke)throw new Error('Нативная вставка постера недоступна.');
    const existing=await posterInvoke('poster_get',{key});
    // The user might have changed selection/page while the read was pending.
    if(!card.isConnected||!card.classList.contains('is-selected')||kinotekaViewMode!=='cards')return;
    if(existing?.exists){
      const agreed=await window.KinotekaDialog?.confirm?.('У этой карточки уже есть постер. Заменить его изображением из буфера?',{title:'Заменить постер',okText:'Заменить'});
      if(agreed!==true)return;
      if(!card.isConnected||!card.classList.contains('is-selected')||kinotekaViewMode!=='cards')return;
    }
    closePosterMenu();
    await pasteUserPoster(key);
  }catch(error){
    toastMsg('Не удалось вставить постер: '+String(error?.message||error),'error');
  }finally{posterShortcutBusy=false;}
}
function handleSelectedCardPasteShortcut(event){
  if(event.defaultPrevented||event.repeat||!event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.code!=='KeyV')return;
  if(kinotekaViewMode!=='cards'||!kinotekaCardGrid||kinotekaCardGrid.hidden||isEditablePosterShortcutTarget(event.target)||hasOpenPosterShortcutDialog())return;
  const selected=kinotekaCardGrid.querySelector('.kinoteka-film-card.is-selected');
  if(!selected?.isConnected)return;
  event.preventDefault();
  event.stopPropagation();
  void pastePosterIntoSelectedCard(selected);
}
// Hotfix 33 — safe card actions without additional buttons over the poster.
// Name copy and removal operate on the same stable SQLite record ID as the table.
let cardContextMenu=null;
let cardContextEntryId=null;
let cardContextBusy=false;
function cardEntryById(id){
  if(!Number.isInteger(id)||id<=0)return null;
  return games.find(g=>Number(g.id)===id)||null;
}
function cardCopyLabel(entry){
  const name=String(entry?.game||'').trim();
  const year=String(entry?.year??'').trim();
  return /^\d{4}$/.test(year)?`${name} (${year})`:name;
}
async function copyCardNameYear(entry){
  const label=cardCopyLabel(entry);
  if(!label)return false;
  try{
    if(typeof window.kinotekaRuntime?.copyText!=='function')throw new Error('Буфер обмена недоступен');
    const copied=await window.kinotekaRuntime.copyText(label);
    if(copied!==true)throw new Error('Не удалось скопировать');
    toastMsg(`«${label}» скопировано.`, 'success');
    return true;
  }catch(error){toastMsg('Не удалось скопировать название и год.', 'error');return false;}
}
async function moveCardToTrash(entryId){
  if(cardContextBusy)return false;
  const item=cardEntryById(entryId);
  if(!item)return false;
  const label=cardCopyLabel(item);
  cardContextBusy=true;
  try{
    const accepted=await window.KinotekaDialog?.confirm?.(
      `Переместить «${label}» в корзину?\nЗапись можно будет восстановить из корзины.`,
      {title:'Удалить карточку',type:'danger',okText:'В корзину'}
    );
    if(accepted!==true)return false;
    // Index may change while the confirmation is open: resolve by immutable DB id.
    const currentIndex=games.findIndex(g=>Number(g.id)===entryId);
    if(currentIndex<0)return false;
    closeCardContextMenu();
    return await deleteEntryAtIndex(currentIndex); // Uses SQLite trash; does not delete the poster file.
  }finally{cardContextBusy=false;}
}
function closeCardContextMenu(){
  cardContextMenu?.remove();
  cardContextMenu=null;
  cardContextEntryId=null;
}
function openCardContextMenu(card,x,y){
  if(!card?.isConnected)return;
  const entryId=Number(card.dataset.entryId);
  if(!cardEntryById(entryId))return;
  closeCardContextMenu();closePosterMenu();
  kinotekaCardGrid?.querySelectorAll('.kinoteka-film-card.is-selected').forEach(item=>{
    if(item!==card)item.classList.remove('is-selected');
  });
  card.classList.add('is-selected');
  const menu=document.createElement('div');
  menu.className='kinoteka-card-context-menu';
  menu.setAttribute('role','menu');
  menu.setAttribute('aria-label','Действия с карточкой');
  menu.innerHTML=`<button type="button" role="menuitem" data-card-context-action="copy">Скопировать название и год</button><div class="kinoteka-card-context-separator" aria-hidden="true"></div><button type="button" role="menuitem" class="danger" data-card-context-action="trash">Удалить карточку</button>`;
  document.body.appendChild(menu);
  cardContextMenu=menu;cardContextEntryId=entryId;
  const box=menu.getBoundingClientRect();
  menu.style.left=`${Math.max(8,Math.min(x,window.innerWidth-box.width-8))}px`;
  menu.style.top=`${Math.max(8,Math.min(y,window.innerHeight-box.height-8))}px`;
  menu.addEventListener('click',async event=>{
    const action=event.target.closest('[data-card-context-action]')?.dataset.cardContextAction;
    if(!action||cardContextBusy)return;
    const id=cardContextEntryId;
    closeCardContextMenu();
    const entry=cardEntryById(id);
    if(!entry)return;
    if(action==='copy')await copyCardNameYear(entry);
    else if(action==='trash')await moveCardToTrash(id);
  });
  menu.querySelector('button')?.focus({preventScroll:true});
}
function handleSelectedCardCopyShortcut(event){
  if(event.defaultPrevented||event.repeat||!event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.code!=='KeyC')return;
  if(kinotekaViewMode!=='cards'||kinotekaCardGrid?.hidden||isEditablePosterShortcutTarget(event.target)||hasOpenPosterShortcutDialog()||cardContextMenu)return;
  const selected=kinotekaCardGrid?.querySelector('.kinoteka-film-card.is-selected');
  const entry=selected&&cardEntryById(Number(selected.dataset.entryId));
  if(!entry)return;
  event.preventDefault();event.stopPropagation();
  void copyCardNameYear(entry);
}
// Hotfix 37 — Esc deselects the card, unless a dialog or a card menu
// should consume Escape first. This never changes the underlying collection.
function handleSelectedCardEscapeShortcut(event){
  if(event.key!=='Escape'||event.defaultPrevented||event.ctrlKey||event.metaKey||event.altKey)return;
  if(kinotekaViewMode!=='cards'||!kinotekaCardGrid||kinotekaCardGrid.hidden)return;
  // Preserve normal Escape behavior in search, text entry and open dialogs.
  if(isEditablePosterShortcutTarget(event.target)||hasOpenPosterShortcutDialog()||cardContextMenu||posterOpenMenu)return;
  const selected=kinotekaCardGrid.querySelector('.kinoteka-film-card.is-selected');
  if(!selected)return;
  selected.classList.remove('is-selected');
  // A focus-within highlight should not remain after Esc deselects the card.
  if(selected.contains(document.activeElement))document.activeElement?.blur?.();
  event.preventDefault();
  event.stopPropagation();
}
if(kinotekaCardGrid){
  // Select/highlight a card without modifying records or the current pagination.
  kinotekaCardGrid.addEventListener('click',event=>{
    const card=event.target.closest('.kinoteka-film-card');
    if(!card)return;
    kinotekaCardGrid.querySelectorAll('.kinoteka-film-card.is-selected').forEach(item=>{if(item!==card)item.classList.remove('is-selected');});
    card.classList.add('is-selected');
  });
  document.addEventListener('keydown',handleSelectedCardPasteShortcut,true);
  document.addEventListener('keydown',handleSelectedCardCopyShortcut,true);
  document.addEventListener('keydown',handleSelectedCardEscapeShortcut,true);
  kinotekaCardGrid.addEventListener('contextmenu',event=>{
    const card=event.target.closest('.kinoteka-film-card');
    if(!card)return;
    event.preventDefault();event.stopPropagation();
    openCardContextMenu(card,event.clientX,event.clientY);
  });
  kinotekaCardGrid.addEventListener('click',event=>{
    if(event.target.closest('.kinoteka-card-title')){
      const card=event.target.closest('.kinoteka-film-card');
      const entry=card&&cardEntryById(Number(card.dataset.entryId));
      if(entry)void copyCardNameYear(entry);
    }
  });
  kinotekaCardGrid.addEventListener('keydown',event=>{
    if(!['Escape','Enter',' ','F10','ContextMenu'].includes(event.key))return;
    if(event.key==='Escape'){closePosterMenu({focus:true});closeCardContextMenu();return;}
    if((event.key==='F10'&&event.shiftKey)||event.key==='ContextMenu'){
      const card=event.target.closest('.kinoteka-film-card');
      if(card){event.preventDefault();const r=card.getBoundingClientRect();openCardContextMenu(card,r.left+20,r.top+42);}
      return;
    }
    const card=event.target.closest('.kinoteka-film-card');
    if(card&&event.target===card){event.preventDefault();card.click();}
  });
  kinotekaCardGrid.addEventListener('click',async event=>{
    const scoreButton=event.target.closest('[data-card-score]');
    if(scoreButton){
      const index=Number(scoreButton.dataset.cardScore);
      if(Number.isInteger(index)&&index>=0&&index<games.length){
        const selected=await askScore10(games[index]);
        if(selected!==undefined)await updateScore10(index,selected);
      }
      return;
    }
    const choose=event.target.closest('[data-poster-choose]');
    const actionButton=event.target.closest('[data-poster-action]');
    const card=(choose||actionButton)?.closest('.kinoteka-film-card');
    const key=card?.dataset.posterKey;
    if(!key)return;
    if(choose){togglePosterMenu(card);return;}
    if(!actionButton)return;
    const action=actionButton.dataset.posterAction;
    closePosterMenu();
    if(action==='file'){posterSelection=key;posterChooser.click();return;}
    if(action==='paste'){await pasteUserPoster(key);return;}
    if(action==='remove'){
      const confirmed=await window.KinotekaDialog?.confirm?.('Удалить этот локальный постер?',{title:'Удаление постера',type:'danger',okText:'Удалить'});
      if(confirmed!==true)return;
      try{
        if(!posterInvoke)throw new Error('Хранилище постеров недоступно.');
        await posterInvoke('poster_remove',{key});
        posterRefreshKey(key,null);
        toastMsg('Постер удалён.','success');
      }catch(error){toastMsg('Не удалось удалить постер: '+String(error?.message||error),'error');}
    }
  });
  kinotekaCardGrid.addEventListener('click',event=>{
    const button=event.target.closest('[data-card-favorite]');
    if(!button||button.disabled)return;
    const index=Number(button.dataset.cardFavorite);
    const entry=games[index];
    if(!entry)return;
    if(entry.rating==='Понравилось'&&(!validScore10(entry.score10)||entry.score10>=7))update(index,'rating','Избранное');
    else if(entry.rating==='Избранное')update(index,'rating','Понравилось');
  });
}
// Hotfix 34 — measure clamped titles after layout, font loading and window resizing.
// Full title stays out of the normal grid flow and appears only if the name is clipped.
let kinotekaTitleOverflowFrame=0;
function refreshKinotekaCardTitles(){
  if(!kinotekaCardGrid || kinotekaViewMode!=='cards')return;
  kinotekaCardGrid.querySelectorAll('.kinoteka-card-title').forEach(title=>{
    const truncated=title.scrollHeight>title.clientHeight+1;
    title.classList.toggle('is-truncated',truncated);
    // Avoid two simultaneous tooltips (native title + the styled full-name popup).
    if(truncated)title.removeAttribute('title');
    else title.setAttribute('title',title.textContent||'');
  });
}
function scheduleKinotekaCardTitleCheck(){
  if(kinotekaTitleOverflowFrame)cancelAnimationFrame(kinotekaTitleOverflowFrame);
  kinotekaTitleOverflowFrame=requestAnimationFrame(()=>{
    kinotekaTitleOverflowFrame=0;
    refreshKinotekaCardTitles();
  });
}
window.addEventListener('resize',scheduleKinotekaCardTitleCheck,{passive:true});
if(document.fonts?.ready)document.fonts.ready.then(scheduleKinotekaCardTitleCheck).catch(()=>{});

document.querySelector('.kinoteka-view-toggle')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-kinoteka-view]');
  if(!button)return;
  const mode=button.dataset.kinotekaView;
  if(mode!=='cards'&&mode!=='table')return;
  if(kinotekaViewMode!==mode){
    const oldPageSize=kinotekaViewMode==='cards'?CARD_PAGE_SIZE:PAGE_SIZE;
    const newPageSize=mode==='cards'?CARD_PAGE_SIZE:PAGE_SIZE;
    const firstVisible=(currentPage-1)*oldPageSize;
    currentPage=Math.floor(firstVisible/newPageSize)+1;
    kinotekaViewMode=mode;saveUI();render();
  }
});

let tableRenderCacheKey="";
function renderPagination(totalPages){
  if(!pagination)return;
  if(totalPages<=1){
    pagination.innerHTML="";
    return;
  }
  pagination.innerHTML=`<button type="button" class="pageBtn pageFirst" data-page="1" ${currentPage===1?'disabled':''} aria-label="Первая страница" ><span class="pageIcon" aria-hidden="true">${lucideSvg('chevrons-left',{size:18})}</span></button><button type="button" class="pageBtn pagePrev" data-page="${currentPage-1}" ${currentPage===1?'disabled':''} aria-label="Предыдущая страница" ><span class="pageIcon" aria-hidden="true">${lucideSvg('chevron-left',{size:18})}</span></button><span class="pageIndicator"><span class="pageCurrent">${currentPage}</span><span class="pageSeparator">/</span><span class="pageTotal">${totalPages}</span></span><button type="button" class="pageBtn pageNext" data-page="${currentPage+1}" ${currentPage===totalPages?'disabled':''} aria-label="Следующая страница" ><span class="pageIcon" aria-hidden="true">${lucideSvg('chevron-right',{size:18})}</span></button><button type="button" class="pageBtn pageLast" data-page="${totalPages}" ${currentPage===totalPages?'disabled':''} aria-label="Последняя страница" ><span class="pageIcon" aria-hidden="true">${lucideSvg('chevrons-right',{size:18})}</span></button>`;
}

pagination.addEventListener("click",e=>{
  const btn=e.target.closest(".pageBtn:not([disabled])");
  if(!btn || !pagination.contains(btn))return;
  currentPage=Number(btn.dataset.page);
  render();
  const searchEl=document.getElementById('search');
  if(searchEl){
    // After pagination, keep the fixed title bar visible and place the search field at the top of the content area.
    const topInset=Math.max(0,parseFloat(getComputedStyle(document.body).paddingTop)||0);
    const target=Math.max(0,window.scrollY+searchEl.getBoundingClientRect().top-topInset-6);
    window.scrollTo({top:target,behavior:'smooth'});
  }
});

function render(){
  const allRows=filtered();
  const filteredTotal=allRows.length;
  const pageSize=kinotekaViewMode==='cards'?CARD_PAGE_SIZE:PAGE_SIZE;
  const totalPages=Math.max(1,Math.ceil(filteredTotal/pageSize));
  if(currentPage>totalPages)currentPage=totalPages;
  const pageRows=allRows.slice((currentPage-1)*pageSize,currentPage*pageSize);
  if(tableWrap) tableWrap.hidden=kinotekaViewMode!=="table"||pageRows.length===0;
  if(emptyResults){
    emptyResults.hidden=pageRows.length!==0;
    if(pageRows.length===0){
      const hasOtherFilters=Boolean(search.value.trim()||mediaYear||mediaCategory!=="Все");
      if(games.length===0) emptyResults.textContent="Коллекция пока пуста. Нажми «+», чтобы добавить запись.";
      else if(quickFilter){
        const label=quickFilter==='favorite'?'Избранное':quickFilter;
        emptyResults.textContent=hasOtherFilters
          ? `Нет записей в разделе «${label}» с выбранными условиями поиска. Сбрось фильтры, чтобы увидеть коллекцию.`
          : `В разделе «${label}» пока нет записей. Выбери «Все» в верхних счётчиках, чтобы увидеть коллекцию.`;
      }else{
        emptyResults.textContent="По выбранным условиям ничего не найдено. Сбрось фильтры, чтобы увидеть коллекцию.";
      }
    }
  }

  const dupKeys=duplicateIdentitySet;
  let identityKey="",tableKey="";
  for(const {g,i,name} of pageRows){
    identityKey+=(identityKey?"\u0001":"")+`${i}|${name}`;
    tableKey+=(tableKey?"\u0001":"")+`${i}|${name}|${g.category??""}|${g.year??""}|${g.rating??""}|${g.score10??""}|${g.favorite?1:0}`;
  }

  const rowClassName=(g)=>{
    const rowClasses=[];
    if(dupKeys.has(entryIdentityKey(g)))rowClasses.push("dup-row");
    if(g.rating==="Понравилось")rowClasses.push("rating-liked");
    else if(g.rating==="Нормально")rowClasses.push("rating-normal");
    else if(g.rating==="Не понравилось")rowClasses.push("rating-disliked");
    else if(g.rating==="Запланировано")rowClasses.push("rating-planned");
    else if(g.rating==="Смотрю")rowClasses.push("rating-in-progress");
    else if(g.rating==="Избранное")rowClasses.push("rating-favorite");
    if(g.favorite)rowClasses.push("favorite-row");
    return rowClasses.join(" ");
  };

  renderCardView(pageRows,tableKey);

  if(tableKey!==tableRenderCacheKey){
    const previousRows=[...tbody.querySelectorAll("tr")];
    const previousIdentity=previousRows.map(tr=>{
      const input=tr.querySelector(".entry-name");
      return input?`${input.dataset.i}|${input.value}`:"";
    }).join("\u0001");

    if(pageRows.length && previousIdentity===identityKey && previousRows.length===pageRows.length){
      pageRows.forEach(({g,i,name},index)=>{
        const tr=previousRows[index];
        tr.className=rowClassName(g);
        const input=tr.querySelector(".entry-name");
        if(input){
          input.value=g.game;
          input.removeAttribute("title");
        }
        const select=tr.querySelector(".rating-select");
        if(select){
          select.className=`rating-select ${clsForRating(g.rating)}`;
          select.value=g.rating||"";
          syncRatingMarker(select);
        }
        const fav=tr.querySelector(".favorite-btn");
        if(fav){
          fav.classList.toggle("on",Boolean(g.favorite));
          fav.disabled=!g.favorite && g.rating!=="Понравилось";
          fav.dataset.fav=String(i);
          fav.removeAttribute("title");
          fav.textContent=g.favorite?"★":"☆";
        }
      });
    }else{
      tbody.innerHTML="";
      if(!pageRows.length){
        tbody.innerHTML='<tr><td colspan="5" class="empty">Ничего не найдено</td></tr>';
      }else{
        const fragment=document.createDocumentFragment();
        for(const {g,i,name} of pageRows){
          const tr=document.createElement("tr");
          tr.className=rowClassName(g);
          tr.innerHTML=`<td class="title"><input class="entry-name" data-i="${i}" data-k="game" value="${esc(g.game)}" readonly></td><td class="media-type-cell"><span class="media-meta-inline ${clsForRating(g.rating)}">${esc(g.category||'Фильмы')}</span></td><td class="media-year-cell"><span class="media-meta-inline ${clsForRating(g.rating)}">${g.year??'—'}</span></td><td class="rating-cell"><div class="rating-center"><span class="rating-dot rating-dot-left" aria-hidden="true"></span><select class="rating-select ${clsForRating(g.rating)}" data-i="${i}" data-k="rating" aria-label="Оценка ${esc(g.game)}">${selectOptions(ratings,g.rating)}</select><span class="rating-dot rating-dot-right" aria-hidden="true"></span></div></td><td><button type="button" class="favorite-btn ${g.favorite?"on":""}" data-fav="${i}" ${!g.favorite&&g.rating!=="Понравилось"?"disabled":""} aria-label="${g.favorite?"Убрать из избранного":"Добавить в избранное"}">${g.favorite?"★":"☆"}</button></td>`;
          fragment.appendChild(tr);
        }
        tbody.appendChild(fragment);
        tbody.querySelectorAll(".rating-select").forEach(syncRatingMarker);
      }
    }
    tableRenderCacheKey=tableKey;
  }

  // Верхняя статистика показывает распределение внутри текущих фильтров,
  // но намеренно НЕ учитывает сам quickFilter (иначе после клика по одной
  // карточке все остальные значения превращались бы в нули).
  const currentSearch=norm(search.value);
  let statCounts=null;
  let statTotal=0;
  {
    const words=currentSearch?currentSearch.split(/\s+/).filter(Boolean):[];
    const counts={"Понравилось":0,"Нормально":0,"Не понравилось":0,"Смотрю":0,"Запланировано":0,"Избранное":0,favorite:0};
    for(const {g,name} of getSortedRows()){
      if(words.length && !words.every(word=>name.includes(word)))continue;
      const catOk=mediaCategory==="Все"||g.category===mediaCategory;
      if(!catOk)continue;
      const yearValue=g.year==null||g.year===""?null:Number(g.year);
      const yearOk=!mediaYear||(String(mediaYear).startsWith("decade:")
        ? (yearValue!=null&&yearValue>=Number(mediaYear.slice(7))&&yearValue<=Number(mediaYear.slice(7))+9)
        : String(yearValue??"")===String(mediaYear));
      if(!yearOk)continue;
      const rating=String(g.rating??"").trim();
      if(Object.prototype.hasOwnProperty.call(counts,rating))counts[rating]++;
      if(Boolean(g.favorite))counts.favorite++;
      statTotal++;
    }
    statCounts=counts;
  }
  const nextStatValues={
    total:statTotal,
    liked:statCounts["Понравилось"],
    normal:statCounts["Нормально"],
    disliked:statCounts["Не понравилось"],
    inProgress:statCounts["Смотрю"],
    planned:statCounts["Запланировано"],
    favorite:statCounts.favorite
  };
  for(const key of Object.keys(nextStatValues)){
    const value=nextStatValues[key];
    if(statValuesRenderCache[key]!==value){
      statValues[key].textContent=value;
      statValuesRenderCache[key]=value;
    }
  }

  renderPagination(totalPages);
  if(typeof updateResetButtonState==="function")updateResetButtonState();
  const activeStatKey=quickFilter;
  const activeFilterColor={
    "":"var(--total)",
    "Смотрю":"var(--progress)",
    "Понравилось":"var(--like)",
    "Нормально":"var(--normal)",
    "Не понравилось":"var(--dislike)",
    "Запланировано":"var(--planned)",
    favorite:"var(--favorite)"
  }[activeStatKey]||"var(--total)";
  document.documentElement.style.setProperty('--active-filter-color',activeFilterColor);
  if(activeStatKey!==statActiveCache){
statCards.forEach(card=>{
      const target=card.dataset.filterAll ? "" : (card.dataset.filterFavorite ? "favorite" : (card.dataset.filterRating || ""));
      card.classList.toggle("active", activeStatKey===target);
    });
    statActiveCache=activeStatKey;
  }
  if(quickStats.classList.contains("stat-init")){
    requestAnimationFrame(()=>quickStats.classList.remove("stat-init"));
  }
}

function triggerRowShine(row){
  if(!row || !tbody.contains(row) || !tableWrap || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)return;
  tableWrap.querySelectorAll(".row-shine-js-layer").forEach(node=>node.remove());
  const rowRect=row.getBoundingClientRect();
  const wrapRect=tableWrap.getBoundingClientRect();
  const layer=document.createElement("div");
  layer.className="row-shine-js-layer";
  let shineColor="#d7ccdf";
  const ratingSelect=row.querySelector(".rating-select");
  if(ratingSelect){
    const computedColor=getComputedStyle(ratingSelect).color;
    if(computedColor)shineColor=computedColor;
  }else if(row.classList.contains("favorite-row")){
    shineColor=getComputedStyle(row).getPropertyValue("--favorite").trim() || "#FFC94D";
  }
  const left=rowRect.left-wrapRect.left+tableWrap.scrollLeft;
  const top=rowRect.top-wrapRect.top+tableWrap.scrollTop;
  const width=rowRect.width;
  const height=rowRect.height;
  const match=shineColor.match(/rgba?\(([^)]+)\)/);
  const rgb=match ? match[1].split(',').slice(0,3).map(x=>x.trim()).join(',') : null;
  const shineGradient=rgb
    ? `linear-gradient(105deg,transparent 0%,transparent 31%,rgba(${rgb},0) 43%,rgba(${rgb},0.82) 50%,rgba(${rgb},0) 57%,transparent 69%,transparent 100%)`
    : `linear-gradient(105deg,transparent 0%,transparent 31%,${shineColor}00 43%,${shineColor}D1 50%,${shineColor}00 57%,transparent 69%,transparent 100%)`;
  const beam=document.createElement("div");
  beam.className="row-shine-js-beam";
  Object.assign(layer.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`,position:"absolute",pointerEvents:"none",zIndex:"10000",overflow:"hidden",clipPath:"inset(0)",background:"transparent",opacity:"0"});
  Object.assign(beam.style,{position:"absolute",left:"0",top:"0",width:"42%",height:"100%",pointerEvents:"none",background:shineGradient,transform:"translateX(-125%) skewX(-10deg)"});
  layer.appendChild(beam);
  tableWrap.appendChild(layer);
  const opacityAnimation=layer.animate([{opacity:0},{opacity:.18,offset:.12},{opacity:1,offset:.5},{opacity:.45,offset:.78},{opacity:0}],{duration:1450,easing:"cubic-bezier(.22,.61,.36,1)",fill:"forwards"});
  const beamAnimation=beam.animate([{transform:"translateX(-125%) skewX(-10deg)"},{transform:"translateX(315%) skewX(-10deg)"}],{duration:1450,easing:"cubic-bezier(.22,.61,.36,1)",fill:"forwards"});
  Promise.allSettled([opacityAnimation.finished,beamAnimation.finished]).finally(()=>{if(layer.isConnected)layer.remove()});
}

tbody.addEventListener("change",e=>{
  const select=e.target.closest(".rating-select");
  if(!select || !tbody.contains(select))return;
  const index=Number(select.dataset.i);
  if(!Number.isInteger(index))return;
  syncEntryRatingClass(select);
  syncRatingMarker(select);
  update(index,"rating",select.value);
});


tbody.addEventListener("mousedown",e=>{
  if(e.button!==0)return;
  const row=e.target.closest("tr");
  const nameInput=e.target.closest(".entry-name");
  if(row && tbody.contains(row) && nameInput && tbody.contains(nameInput)){
    triggerRowShine(row);
    e.preventDefault();
    nameInput.blur();
    const selection=window.getSelection();
    if(selection)selection.removeAllRanges();
  }
});

function selectEntryRow(row){
  tbody.querySelectorAll('tr[data-selected="1"]').forEach(r=>{if(r!==row)r.removeAttribute("data-selected")});
  if(row)row.dataset.selected="1";
}

async function copyEntryNameFromRow(row){
  if(!row || !tbody.contains(row))return false;
  const nameInput=row.querySelector(".entry-name");
  if(!nameInput)return false;
  const yearCell=row.querySelector(".media-year-cell"); const y=yearCell?.textContent?.trim(); const text=`${String(nameInput.value||"")}${y&&y!=="—"?` ${y}`:""}`;
  try{
    if(typeof window.kinotekaRuntime?.copyText === "function") {
      const copied=await window.kinotekaRuntime.copyText(text);
      if(copied!==true)throw new Error("clipboard write failed");
    } else if(navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const helper=document.createElement("textarea");
      helper.value=text;helper.setAttribute("readonly","");
      helper.style.position="fixed";helper.style.opacity="0";helper.style.pointerEvents="none";
      document.body.appendChild(helper);helper.focus();helper.select();
      if(!document.execCommand("copy"))throw new Error("copy command failed");
      helper.remove();
    }
    nameInput.blur();
    const selection=window.getSelection();
    if(selection)selection.removeAllRanges();
    selectEntryRow(row);
    toastMsg(`«${text}» скопировано.`,"info");
    return true;
  }catch(err){
    nameInput.blur();
    const selection=window.getSelection();
    if(selection)selection.removeAllRanges();
    console.warn("Не удалось скопировать название записи:",err);
    return false;
  }
}

tbody.addEventListener("click",async e=>{
  const row=e.target.closest("tr");
  if(!row || !tbody.contains(row))return;
  const nameInput=e.target.closest(".entry-name");
  if(nameInput){
    e.preventDefault();
    e.stopPropagation();
    await copyEntryNameFromRow(row);
    return;
  }
  if(e.target.closest("button,select,textarea,a"))return;
  e.preventDefault();
  e.stopPropagation();
  selectEntryRow(row);
  await copyEntryNameFromRow(row);
});

function animateContextDelete(row,index){
  if(!row || row.dataset.deleting === "1" || !tbody.contains(row) || !row.querySelector(".entry-name"))return;
  row.dataset.deleting="1";
  const rows=[...tbody.querySelectorAll("tr")];
  const positions=new Map();
  for(const r of rows){
    if(r===row)continue;
    const key=r.querySelector(".entry-name")?.value;
    if(key)positions.set(key,r.getBoundingClientRect().top);
  }

  row.classList.add("row-context-delete");
  const cells=[...row.children];
  const reduceMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const duration=reduceMotion?120:680;
  const animations=cells.map((cell)=>cell.animate(
    [
      {opacity:1,transform:"scaleY(1)",filter:"none"},
      {opacity:.82,transform:"scaleY(.985)",filter:"brightness(1.02)",offset:0.16},
      {opacity:0,transform:"scaleY(.12)",filter:"blur(.4px)"}
    ],
    {duration,easing:"cubic-bezier(.22,.61,.36,1)",fill:"both"}
  ));

  Promise.all(animations.map(a=>a.finished.catch(()=>null))).then(async()=>{
    if(!row.isConnected)return;
    const ok=typeof deleteEntryAtIndex==="function" ? await deleteEntryAtIndex(index) : false;
    if(!ok){
      animations.forEach(a=>a.cancel());
      row.classList.remove("row-context-delete");
      delete row.dataset.deleting;
      return;
    }
    requestAnimationFrame(()=>{
      const newRows=[...tbody.querySelectorAll("tr")];
      const flipAnimations=[];
      for(const r of newRows){
        const key=r.querySelector(".entry-name")?.value;
        const before=key?positions.get(key):null;
        if(before==null)continue;
        const after=r.getBoundingClientRect().top;
        const delta=before-after;
        if(Math.abs(delta)<.5)continue;
        const anim=r.animate(
          [{transform:`translateY(${delta}px)`},{transform:"translateY(0)"}],
          {duration:560,easing:"cubic-bezier(.22,.61,.36,1)",fill:"both"}
        );
        flipAnimations.push(anim);
      }
      Promise.all(flipAnimations.map(a=>a.finished.catch(()=>null))).finally(()=>{
        newRows.forEach(r=>r.style.removeProperty("transform"));
      });
    });
  });
}

document.addEventListener("contextmenu",e=>{
  const row=e.target.closest("#tbody tr");
  if(!row || !tbody.contains(row) || !row.querySelector(".entry-name"))return;
  e.preventDefault();
  e.stopPropagation();
  const active=document.activeElement;
  if(active && active instanceof HTMLElement && active.closest("#tbody tr"))active.blur();
  const selection=window.getSelection();
  if(selection)selection.removeAllRanges();
  const input=row.querySelector(".entry-name");
  const index=Number(input?.dataset.i);
  if(Number.isInteger(index))animateContextDelete(row,index);
});


function populateMediaYearFilter(){
  if(!mediaYearFilter)return;
  const years=[...new Set(games.map(g=>g.year).filter(v=>v!=null&&v!==''))].sort((a,b)=>Number(b)-Number(a));
  const current=mediaYearFilter.value||mediaYear||'';
  mediaYearFilter.innerHTML='<option value="">Все годы</option>'+years.map(y=>`<option value="${esc(y)}">${esc(y)}</option>`).join('');
  if(!String(current).startsWith('decade:') && years.some(y=>String(y)===String(current)))mediaYearFilter.value=String(current);
}

const mediaYearPicker=$('mediaYearPicker');
const mediaYearLabel=$('mediaYearLabel');
const yearPickerModal=$('yearPickerModal');
const decadeGrid=$('decadeGrid');
const yearGrid=$('yearGrid');
const closeYearPickerButton=$('closeYearPicker');
const yearPickerController=window.KinotekaModal?.bind('kinoteka-year-picker',yearPickerModal,yearPickerModal?.querySelector('.year-picker-modal-dialog'));
function formatYearFilterLabel(value){
  if(!value)return 'Все годы';
  if(String(value).startsWith('decade:'))return `${String(value).slice(7)}-е`;
  return String(value);
}
function syncYearFilterUI(){
  if(mediaYearLabel)mediaYearLabel.textContent=formatYearFilterLabel(mediaYear);
  mediaYearPicker?.classList.toggle('active',Boolean(mediaYear));
  mediaYearPicker?.setAttribute('aria-expanded',String(Boolean(yearPickerController?.isOpen?.())));
}
function applyMediaYear(value){
  mediaYear=value||'';
  if(mediaYearFilter)mediaYearFilter.value=(!String(mediaYear).startsWith('decade:')?mediaYear:'');
  currentPage=1;filteredCache=null;saveUI();render();syncYearFilterUI();
  yearPickerController?.close({blurRestoredFocus:false});
}
function buildYearPicker(){
  if(!decadeGrid||!yearGrid)return;
  const years=[...new Set(games.map(g=>Number(g.year)).filter(Number.isFinite))].sort((a,b)=>b-a);
  const decadeSet=[...new Set(years.map(y=>Math.floor(y/10)*10))].sort((a,b)=>b-a);
  decadeGrid.innerHTML='';
  const all=document.createElement('button');all.type='button';all.className='year-picker-option all'+(!mediaYear?' active':'');all.textContent='Все годы';all.addEventListener('click',()=>applyMediaYear(''));decadeGrid.appendChild(all);
  for(const decade of decadeSet){
    const b=document.createElement('button');b.type='button';b.className='year-picker-option'+(mediaYear===`decade:${decade}`?' active':'');b.textContent=`${decade}-е`;b.addEventListener('click',()=>applyMediaYear(`decade:${decade}`));decadeGrid.appendChild(b);
  }
  yearGrid.innerHTML='';
  if(!years.length){yearGrid.innerHTML='<div class="year-picker-empty">В базе пока нет годов</div>';return;}
  for(const year of years){
    const b=document.createElement('button');b.type='button';b.className='year-picker-option'+(String(mediaYear)===String(year)?' active':'');b.textContent=String(year);b.addEventListener('click',()=>applyMediaYear(String(year)));yearGrid.appendChild(b);
  }
}
mediaYearPicker?.addEventListener('click',()=>{buildYearPicker();yearPickerController?.open(mediaYearPicker);syncYearFilterUI();});
closeYearPickerButton?.addEventListener('click',()=>yearPickerController?.close());
document.querySelectorAll('#mediaTabs [data-media-category]').forEach(tab=>{
  tab.addEventListener('click',()=>{
    mediaCategory=tab.dataset.mediaCategory||'Все';
    document.querySelectorAll('#mediaTabs [data-media-category]').forEach(t=>t.classList.toggle('active',t===tab));
    if(mediaCategoryFilter)mediaCategoryFilter.value=mediaCategory;
    currentPage=1;filteredCache=null;saveUI();render();
    window.dispatchEvent(new CustomEvent('kinoteka-media-category-state',{detail:mediaCategory}));
  });
});

mediaCategoryFilter?.addEventListener('change',()=>{
  mediaCategory=mediaCategoryFilter.value||'Все'; currentPage=1; filteredCache=null; saveUI(); render();
  window.dispatchEvent(new CustomEvent('kinoteka-media-category-state',{detail:mediaCategory}));
});
window.addEventListener('kinoteka-media-category-change',e=>{mediaCategory=String(e.detail||'Все');if(mediaCategoryFilter)mediaCategoryFilter.value=mediaCategory;currentPage=1;filteredCache=null;saveUI();render();window.dispatchEvent(new CustomEvent('kinoteka-media-category-state',{detail:mediaCategory}));});
mediaYearFilter?.addEventListener('change',()=>{mediaYear=mediaYearFilter.value||'';currentPage=1;filteredCache=null;saveUI();render();syncYearFilterUI();});
statCards.forEach(card=>{
  card.addEventListener("click",()=>{
    const r=card.dataset.filterRating;
    const f=card.dataset.filterFavorite;
    const all=card.dataset.filterAll;
    const target=all ? "" : (f ? "favorite" : r || "");

    if(f){
      quickFilter="favorite";
    }else if(all){
      quickFilter="";
    }else{
      quickFilter=target;
    }
    currentPage=1;
      saveUI();
    render();
  });
});





// Opt-in only: after adding one IMDb title from the offline catalog, propose a
// licensed Commons image. No background scan of the private collection.
window.setTimeout(async()=>{
  let id=null;try{id=sessionStorage.getItem('kinotekaCommonsPendingImdb');sessionStorage.removeItem('kinotekaCommonsPendingImdb');}catch{}
  if(commonsOptIn?.checked && /^tt\d{4,15}$/.test(String(id||''))){
    const key='imdb:'+id;
    try{
      const existing=await posterInvoke?.('poster_get',{key});
      if(!existing?.exists)await commonsFindFor(key);
    }catch(err){console.warn('[Kinoteka] Optional Commons suggestion:',err);}
  }
},350);

// Hotfix 28: outside-click closes the poster menu; no changes to other controls.
document.addEventListener('pointerdown',event=>{
  if(cardContextMenu&&!event.target.closest('.kinoteka-card-context-menu'))closeCardContextMenu();
  if(posterOpenMenu && !event.target.closest('.kinoteka-card-poster'))closePosterMenu();
  if(kinotekaCardGrid && !event.target.closest('.kinoteka-film-card')&&!event.target.closest('.kinoteka-card-context-menu')){
    kinotekaCardGrid.querySelector('.kinoteka-film-card.is-selected')?.classList.remove('is-selected');
  }
});

// Context actions are ephemeral and must never outlive the view.
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&cardContextMenu){event.preventDefault();closeCardContextMenu();}},true);
window.addEventListener('scroll',closeCardContextMenu,true);
window.addEventListener('resize',closeCardContextMenu);
