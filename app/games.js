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
  const totalPages=Math.max(1,Math.ceil(filteredTotal/PAGE_SIZE));
  if(currentPage>totalPages)currentPage=totalPages;
  const pageRows=allRows.slice((currentPage-1)*PAGE_SIZE,currentPage*PAGE_SIZE);
  if(tableWrap) tableWrap.hidden=pageRows.length===0;
  if(emptyResults) emptyResults.hidden=pageRows.length!==0;

  const dupKeys=duplicateIdentitySet;
  let identityKey="",tableKey="";
  for(const {g,i,name} of pageRows){
    identityKey+=(identityKey?"\u0001":"")+`${i}|${name}`;
    tableKey+=(tableKey?"\u0001":"")+`${i}|${name}|${g.category??""}|${g.year??""}|${g.rating??""}|${g.favorite?1:0}`;
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




