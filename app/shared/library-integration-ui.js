/* Kinoteka v1.2 Preview — Letterboxd import and personal lists. */
(() => {
  'use strict';
  const core=window.KinotekaImportCore,db=window.kinotekaDatabase;
  const $=id=>document.getElementById(id);
  if(!core||!db)return;
  const overlay=$('integrationModal');
  const controller=window.KinotekaModal?.bind('kinoteka-integration',overlay,overlay?.querySelector('.modal'));
  let parsed=null,importBusy=false,decisions=Object.create(null),plan=null,reviewPage=0,reviewFilter="review",batchSelected=new Set();
  const state=$('integrationInfo'),summary=$('importPreview'),apply=$('commitImport');
  const message=(text,error=false)=>{state.textContent=text;state.classList.toggle('error',error);};
  // Imported Letterboxd lists remain in SQLite metadata. Their UI is hidden for now.
  $('integrationOpen').addEventListener('click',()=>{
    const disclosure=overlay.querySelector('.kino-import-notes');
    if(disclosure)disclosure.open=false;
    controller?.open();
  });
  $('integrationClose').addEventListener('click',()=>controller?.close());
  $('chooseLetterboxd').addEventListener('click',()=>$('letterboxdFile').click());
  const reviewBox=$('reviewItems'),reviewSearch=$('reviewSearch');
  const localNormalize=value=>String(value??'').toLocaleLowerCase('ru').normalize('NFKC').replace(/ё/g,'е').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const make=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e;};
  function decide(sourceKey,decision){
    if(decision)decisions[sourceKey]=decision;else delete decisions[sourceKey];
    // Keep review position while handling many ambiguous entries: resolving one
    // must not force a jump back to the beginning of the 92-item queue.
    const previousScroll=reviewBox.scrollTop;
    batchSelected.delete(sourceKey);updatePlan(previousScroll);
  }
  function updatePlan(restoreReviewScroll=null){
    if(!parsed)return;
    plan=db.previewLetterboxd(parsed,decisions);
    $('previewTotal').textContent=String(plan.total);
    $('previewAdded').textContent=String(plan.added);
    $('previewMatched').textContent=String(plan.matched);
    $('previewTrash').textContent=String(plan.trashed);
    $('previewLists').textContent=String(plan.lists);
    $('reviewSummary').textContent=plan.reviewRequired
      ?`Требуют решения: ${plan.reviewRequired}. Пока не разрешены все похожие названия, сохранение заблокировано. Вручную связано: ${plan.manualMatched}; пропущено: ${plan.skipped}.`
      :`Сверка готова. Вручную связано: ${plan.manualMatched}; пропущено: ${plan.skipped}. Проверь раздел «Все новые», особенно фильмы с переводными названиями.`;
    $('reviewSummary').classList.toggle('pending',plan.reviewRequired>0);
    apply.disabled=importBusy||plan.reviewRequired>0;
    apply.textContent=plan.reviewRequired?`Сначала разреши совпадения (${plan.reviewRequired})`:'Подтвердить импорт в SQLite';
    renderReview(restoreReviewScroll);
  }
  const formatLocal=l=>`${l.name} (${l.year??'год неизвестен'}) · ${l.category}`;
  const categoryName=category=>{
    const name=String(category||'').toLocaleLowerCase('ru');
    return name.includes('сериал')?'Сериал':name.includes('анимац')?'Анимация':name.includes('фильм')?'Фильм':String(category||'Не указан');
  };
  const incompatibleTypes=(sourceType,category)=>{
    const local=categoryName(category);
    // Letterboxd's movie category includes animated films; do not mark animation as a mismatch.
    return (sourceType==='tv'&&local!=='Сериал')||(sourceType==='movie'&&local==='Сериал');
  };
  function renderReview(restoreReviewScroll=null){
    if(!plan)return;
    const term=localNormalize(reviewSearch.value);
    const rows=plan.rows.filter(r=>{
      const show=reviewFilter==='review'?r.action==='review':
        reviewFilter==='auto'?r.action==='matched'&&r.reason!=='manual':
        r.action==='add'||r.action==='review'||r.reason==='manual';
      return show&&(!term||localNormalize(r.name).includes(term)||String(r.year??'').includes(term));
    });
    const pages=Math.max(1,Math.ceil(rows.length/12));reviewPage=Math.min(reviewPage,pages-1);
    const slice=rows.slice(reviewPage*12,(reviewPage+1)*12);
    reviewBox.replaceChildren();
    if(!slice.length)reviewBox.append(make('p','kino-review-empty',reviewFilter==='review'?'Неоднозначных совпадений нет. Проверь другие новые фильмы во второй вкладке.':'Нет записей по заданному поиску.'));
    // Recheck every batch selection after each preview: no stale decisions.
    const allowed=new Map(plan.rows.filter(r=>r.action==='review'&&r.bulkEligible&&r.bulkTargetIdentity)
      .map(r=>[r.sourceKey,r.bulkTargetIdentity]));
    for(const key of [...batchSelected])if(!allowed.has(key))batchSelected.delete(key);
    $('reviewBatch').hidden=!plan.rows.some(r=>r.action==='review'&&r.bulkEligible);
    $('reviewBatchLabel').textContent=`Выбрано для ручного группового связывания: ${batchSelected.size}`;
    $('reviewBatchApply').disabled=!batchSelected.size;
    $('reviewBatchClear').disabled=!batchSelected.size;
    for(const row of slice){
      const card=make('details','kino-review-item');
      const initial=(row.action==='matched'&&plan.local.find(l=>l.identity===row.targetIdentity))||row.candidates[0]||null;
      const sourceType=row.sourceMediaType==='tv'?'Сериал':row.sourceMediaType==='movie'?'Фильм':'Не указан';
      const mismatch=initial&&incompatibleTypes(row.sourceMediaType,initial.category);
      const title=make('summary','kino-review-title');
      title.append(make('strong','kino-review-item-name',`${row.name} (${row.year??'без года'})`));
      const stateNames={add:'Новая запись',review:'Нужно решение',matched:'Связано',skip:'Пропущено'};
      title.append(make('span','kino-review-state',stateNames[row.action]||row.action));
      const rowMeta=!initial?'В Kinoteka нет предложенного совпадения':
        mismatch?`Разный тип: Letterboxd — ${sourceType} · Kinoteka — ${categoryName(initial.category)}`:
        // A missing Letterboxd media type does NOT constitute a mismatch.
        row.sourceMediaType==='tv'||row.sourceMediaType==='movie'
          ?`Кандидат: ${categoryName(initial.category)}`
          :`Кандидат Kinoteka: ${categoryName(initial.category)}`;
      title.append(make('span',`kino-review-compact-meta${mismatch?' is-mismatch':''}`,rowMeta));
      card.append(title);
      const comparison=make('div','kino-review-compare');
      const source=make('div','kino-review-side');source.append(make('label','','LETTERBOXD'),make('strong','',row.name));
      const sourceMeta=make('div','kino-review-side-meta');
      sourceMeta.append(make('span','kino-review-year',`Год: ${row.year??'не указан'}`));
      // Only show a source type badge if the export actually contains a type.
      // 'Not specified' is lack of metadata, not a different genre/type.
      if(row.sourceMediaType==='tv'||row.sourceMediaType==='movie')sourceMeta.append(make('span','kino-review-type',sourceType));
      source.append(sourceMeta,make('span','kino-review-side-extra',`Просмотр: ${row.sourceWatched?'да':'не отмечен'} · Оценка: ${row.sourceRating??'нет'}`));
      const target=make('div','kino-review-side local');
      const renderTarget=local=>{
        target.replaceChildren();target.append(make('label','','КИНОТЕКА'));
        if(!local){target.append(make('span','','Выбери существующую запись для сравнения.'));return;}
        const mismatch=incompatibleTypes(row.sourceMediaType,local.category);
        target.append(make('strong','',local.name));
        const localMeta=make('div','kino-review-side-meta');
        localMeta.append(make('span','kino-review-year',`Год: ${local.year??'не указан'}`),make('span',`kino-review-type${mismatch?' is-mismatch':''}`,categoryName(local.category)));
        target.append(localMeta);
        if(mismatch)target.append(make('span','kino-review-type-warning','Разный тип — проверь перед связыванием'));
        if(local.rating)target.append(make('span','kino-review-side-extra',`Статус: ${local.rating}${local.favorite?' · В избранном':''}`));
        if(local.trash){target.append(make('span','kino-review-type-warning','В Корзине — связывание запрещено'));return;}
        const link=make('button','kino-review-choice','Связать с этой записью');link.type='button';
        link.addEventListener('click',()=>decide(row.sourceKey,{action:'match',targetIdentity:local.identity}));target.append(link);
      };
      const candidates=make('div','kino-review-candidates');
      if(row.candidates.length){
        candidates.append(make('small','','Похожие записи — выбирай для сравнения, не для автоматического объединения:'));
        for(const local of row.candidates){
          const button=make('button','kino-review-choice',`Сравнить: ${formatLocal(local)} · ${local.score}%${local.trash?' · Корзина':''}`);
          button.type='button';button.addEventListener('click',()=>renderTarget(local));candidates.append(button);
        }
      }
      renderTarget(initial);comparison.append(source,target);card.append(comparison);
      if(row.bulkEligible&&row.action==='review'){
        const select=make('label','kino-review-select');
        const checkbox=make('input');checkbox.type='checkbox';checkbox.checked=batchSelected.has(row.sourceKey);
        checkbox.addEventListener('change',()=>{
          if(checkbox.checked)batchSelected.add(row.sourceKey);else batchSelected.delete(row.sourceKey);
          $('reviewBatchLabel').textContent=`Выбрано для ручного группового связывания: ${batchSelected.size}`;
          $('reviewBatchApply').disabled=!batchSelected.size;$('reviewBatchClear').disabled=!batchSelected.size;
        });
        select.append(checkbox,make('span','', 'Отметить эту пару для группового подтверждения (название и год совпали, тип отличается)'));
        card.append(select);
      }
      const more=make('details','kino-review-more');
      const moreLabel=make('summary','','Другие кандидаты и поиск');
      more.append(moreLabel);
      if(row.candidates.length)more.append(candidates);
      const lookup=make('input','kino-integrate-input kino-review-lookup');lookup.type='search';
      lookup.placeholder='Поиск существующего названия (в том числе по-русски)…';lookup.autocomplete='off';
      lookup.setAttribute('aria-label',`Найти существующую запись для ${row.name}`);
      const results=make('div','kino-review-lookup-results');
      lookup.addEventListener('input',()=>{
        const q=localNormalize(lookup.value);results.replaceChildren();
        if(q.length<2)return;
        const found=plan.local.filter(l=>localNormalize(l.name).includes(q))
          .sort((a,b)=>Number(b.year===row.year)-Number(a.year===row.year)).slice(0,7);
        if(!found.length){results.append(make('small','','Совпадений нет. Попробуй другое название.'));return;}
        for(const local of found){
          const btn=make('button','kino-review-choice',`Сравнить: ${formatLocal(local)}`);btn.type='button';
          btn.addEventListener('click',()=>renderTarget(local));results.append(btn);
        }
      });
      more.append(lookup,results);
      const actions=make('div','kino-review-actions');
      const add=make('button','','Добавить отдельно');add.type='button';
      add.addEventListener('click',()=>decide(row.sourceKey,{action:'add'}));
      const skip=make('button','','Пропустить');skip.type='button';
      skip.addEventListener('click',()=>decide(row.sourceKey,{action:'skip'}));
      const reset=make('button','','Сбросить решение');reset.type='button';
      reset.disabled=!Object.hasOwn(decisions,row.sourceKey);
      reset.addEventListener('click',()=>decide(row.sourceKey,null));
      actions.append(add,skip,reset);
      // Show immediate decisions before optional alternative candidates/search.
      card.append(actions,more);reviewBox.append(card);
      // Keep one review expanded at a time; scroll its header to the top of
      // the INTERNAL review list, never the whole application window.
      card.addEventListener('toggle',()=>{
        if(!card.open)return;
        for(const other of reviewBox.querySelectorAll('.kino-review-item[open]')){
          if(other!==card)other.open=false;
        }
        requestAnimationFrame(()=>{
          if(!card.open||!card.isConnected)return;
          reviewBox.scrollTop+=card.getBoundingClientRect().top-reviewBox.getBoundingClientRect().top;
        });
      });
    }
    reviewBox.scrollTop=Number.isFinite(restoreReviewScroll)
      ?Math.min(Math.max(0,restoreReviewScroll),Math.max(0,reviewBox.scrollHeight-reviewBox.clientHeight))
      :0;
    $('reviewPaging').textContent=`${rows.length} записей · страница ${reviewPage+1} / ${pages}`;
    $('reviewPrev').disabled=reviewPage===0;$('reviewNext').disabled=reviewPage+1===pages;
  }
  const setReviewFilter=filter=>{reviewFilter=filter;reviewPage=0;
    $('reviewOnly').classList.toggle('active',filter==='review');$('reviewAll').classList.toggle('active',filter==='all');$('reviewAuto').classList.toggle('active',filter==='auto');renderReview();};
  $('reviewBatchClear').addEventListener('click',()=>{batchSelected.clear();renderReview();});
  $('reviewBatchApply').addEventListener('click',()=>{
    if(!parsed||importBusy||!batchSelected.size)return;
    const pairs=plan.rows.filter(r=>r.action==='review'&&r.bulkEligible&&batchSelected.has(r.sourceKey));
    if(pairs.length!==batchSelected.size){batchSelected.clear();updatePlan();return;}
    const text=pairs.slice(0,8).map(r=>`${r.name} (${r.year}) → ${plan.local.find(l=>l.identity===r.bulkTargetIdentity)?.name||'?'}`);
    const note=pairs.length>8?`\n…и ещё ${pairs.length-8} пар.`:'';
    if(!window.confirm(`Проверить и связать ${pairs.length} выбранных пар?\n\n${text.join('\n')}${note}\n\nКатегории различаются! Это изменит только план импорта; SQLite пока не затрагивается.`))return;
    for(const r of pairs)decisions[r.sourceKey]={action:'match',targetIdentity:r.bulkTargetIdentity};
    batchSelected.clear();updatePlan();
  });
  $('reviewOnly').addEventListener('click' ,()=>setReviewFilter('review'));
  $('reviewAll').addEventListener('click',()=>setReviewFilter('all'));
  $('reviewAuto').addEventListener('click',()=>setReviewFilter('auto'));
  $('reviewPrev').addEventListener('click',()=>{reviewPage--;renderReview();});
  $('reviewNext').addEventListener('click',()=>{reviewPage++;renderReview();});
  reviewSearch.addEventListener('input',()=>{reviewPage=0;renderReview();});
  $('letterboxdFile').addEventListener('change',async e=>{
    const disclosure=overlay.querySelector('.kino-import-notes');
    if(disclosure)disclosure.open=false;
    parsed=null;decisions=Object.create(null);batchSelected.clear();plan=null;apply.disabled=true;summary.hidden=true;reviewSearch.value='';setReviewFilter('review');
    const file=e.target.files?.[0];if(!file)return;
    message(`Чтение «${file.name}»…`);
    try{
      parsed=await core.parseFile(file);
      $('previewMeta').textContent=`Просмотры: ${parsed.stats.watched}; оценки: ${parsed.stats.ratings}; дневник: ${parsed.stats.diary}; рецензии: ${parsed.stats.reviews}; к просмотру: ${parsed.stats.watchlist}.`;
      updatePlan();summary.hidden=false;
      message(`«${file.name}» разобран. База SQLite не изменялась.`);
    }catch(error){parsed=null;message(`Ошибка импорта: ${error.message}`,true);}
    finally{e.target.value='';}
  });
  apply.addEventListener('click',async()=>{
    if(!parsed||importBusy)return;
    importBusy=true;apply.disabled=true;
    message('Создаю резервную копию и сохраняю импорт одной операцией…');
    try{
      const result=await db.importLetterboxdConfirmed(parsed,decisions);
      if(!result.ok)throw new Error(result.error||'SQLite не подтвердил запись.');
      try {sessionStorage.setItem('kinotekaIntegrationResult',`Импорт Letterboxd: добавлено ${result.added}; совпадений ${result.matched}; записей в Корзине ${result.trashed}.`);} catch {}
      location.reload();
    }catch(error){message(`Не удалось сохранить: ${error.message}`,true);apply.disabled=false;importBusy=false;updatePlan();}
  });
  try{
    const flash=sessionStorage.getItem('kinotekaIntegrationResult');
    if(flash){sessionStorage.removeItem('kinotekaIntegrationResult');
      if(typeof toastMsg==='function')setTimeout(()=>toastMsg(flash,'success'),250);
    }
  }catch{}
})();
