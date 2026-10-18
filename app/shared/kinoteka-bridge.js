(() => {
  'use strict';

  const tauri = window.__TAURI__;
  if (!tauri?.core?.invoke) {
    console.error('[Kinoteka] Tauri API is unavailable.');
    return;
  }
  const invoke = tauri.core.invoke;

  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); }
    if (event.key === 'Escape') setTimeout(() => { try { document.activeElement?.blur?.(); } catch {} }, 0);
  }, true);
  for (const type of ['pointerdown','pointerup','mousedown','mouseup','auxclick','click']) {
    document.addEventListener(type, event => {
      if (event.button === 1) { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); }
    }, true);
  }

  document.documentElement.style.setProperty('background', '#020203', 'important');
  document.documentElement.style.setProperty('color-scheme', 'dark', 'important');

  let persistenceQueue = Promise.resolve();
  let persistenceError = null;

  function reportPersistenceError(error) {
    persistenceError = error instanceof Error ? error : new Error(String(error));
    console.error('[Kinoteka] SQLite persistence failed:', persistenceError);
    try {
      window.KinotekaDialog?.alert?.(`Не удалось сохранить изменения в SQLite:\n${persistenceError.message}`, {
        title:'Ошибка сохранения', type:'danger'
      });
    } catch {}
  }

  function queuePersistence(task) {
    const run = persistenceQueue.then(task);
    persistenceQueue = run.then(
      result => {
        persistenceError = null;
        return result;
      },
      error => {
        reportPersistenceError(error);
        return undefined;
      }
    );
    return run;
  }

  function enqueuePersistence(task) {
    const run = queuePersistence(task);
    void run.catch(() => {});
    return persistenceQueue;
  }

  async function flushPersistence() {
    await persistenceQueue;
    if (persistenceError) throw persistenceError;
  }

  async function flushBeforeLeave() {
    try { await flushPersistence(); return true; }
    catch { return false; }
  }

  async function copyText(text) {
    const value = String(text ?? '');
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {}
    }
    try {
      const helper = document.createElement('textarea');
      helper.value = value;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      helper.style.pointerEvents = 'none';
      document.body.appendChild(helper);
      helper.focus();
      helper.select();
      const copied = document.execCommand('copy');
      helper.remove();
      return copied === true;
    } catch {
      return false;
    }
  }

  window.kinotekaRuntime = { copyText };

  function installTitlebar() {
    // The titlebar is inserted synchronously in index.html at the start of body.
    // Only wire Tauri actions here; never recreate/reposition/repaint its DOM.
    const host = document.getElementById('kinotekaCustomTitlebar');
    const shadow = host?.shadowRoot;
    if (!shadow?.querySelector('.bar')) {
      return Promise.reject(new Error('Early titlebar was not initialized.'));
    }
    const q = selector => shadow.querySelector(selector);
    q('.min').onclick = () => invoke('window_minimize');
    q('.close').onclick = async () => { if (await flushBeforeLeave()) invoke('window_close'); };
    const stylesheet = q('link[rel="stylesheet"]');
    return new Promise(resolve => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      stylesheet?.addEventListener('load', done, {once:true});
      stylesheet?.addEventListener('error', done, {once:true});
      queueMicrotask(() => {
        try { if (stylesheet?.sheet) done(); } catch {}
      });
      window.setTimeout(done, 750);
    });
  }

  function waitForFrontendReady(timeoutMs = 2500) {
    if (!document.documentElement.classList.contains('app-loading')) return Promise.resolve();
    return new Promise(resolve => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        resolve();
      };
      const observer = new MutationObserver(() => {
        if (!document.documentElement.classList.contains('app-loading')) done();
      });
      observer.observe(document.documentElement, {attributes:true, attributeFilter:['class']});
      window.setTimeout(done, timeoutMs);
    });
  }

  // Tauri creates the maximized window visible. No native show/maximize IPC.
  // The static splash remains opaque until the frontend readiness barrier.
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  function resultState(gamesRaw, trashRaw) {
    return {ok:true, games:gamesRaw, trash:trashRaw};
  }

  function validArray(raw) {
    const value = JSON.parse(String(raw || '[]'));
    if (!Array.isArray(value)) throw new Error('Некорректные данные.');
    return value;
  }

  function movieKey(x) {
    return `${String(x?.category ?? 'Фильмы')}::${String(x?.name ?? x?.game ?? '')}::${x?.year == null || x.year === '' ? '' : String(x.year)}`;
  }

  function entryIdentityKey(x) {
    const normalize = value => String(value ?? '').replace(/[\u00A0\u2007\u202F]/g, ' ').replace(/[‘’`]/g, "'").replace(/\s+/g, ' ').trim().toLocaleLowerCase('ru');
    const name = normalize(x?.name ?? x?.game);
    if (!name) return '';
    const category = normalize(x?.category || 'Фильмы');
    const rawYear = x?.year;
    let year = '';
    if (rawYear != null && String(rawYear).trim() !== '') {
      const numericYear = Number(rawYear);
      year = Number.isFinite(numericYear) ? String(numericYear) : normalize(rawYear);
    }
    return `${category}\u0000${name}\u0000${year}`;
  }

  function makeDatabase(seed) {
    let state = (() => {
      try { return JSON.parse(String(seed.state || '{}')); }
      catch { return {items:[], favorites:[], trash:[]}; }
    })();
    let uiRaw = seed.ui == null ? null : String(seed.ui);

    const validScore10 = n => Number.isInteger(n) && n >= 1 && n <= 10;
    const letterboxdScore10 = stars => {
      if (stars == null || stars === '') return null;
      const value = Number(stars);
      return Number.isFinite(value) && value >= 0.5 && value <= 5 &&
        Number.isInteger(value * 2) ? value * 2 : null;
    };
    const scoreStatus = n => n >= 7 ? 'Понравилось' : n >= 5 ? 'Нормально' : 'Не понравилось';
    const normalizeGamesFrom = source => {
      const favorites = new Set(Array.isArray(source?.favorites) ? source.favorites : []);
      return (Array.isArray(source?.items) ? source.items : []).map((x, index) => {
        const category = x?.category === 'Аниме и Анимация' ? 'Анимация' : String(x?.category || 'Фильмы');
        const year = (x?.year == null || x.year === '') ? null : Number(x.year);
        const item = {
          id:index + 1,
          game:String(x?.name ?? '').trim(),
          category,
          year,
          rating:x?.rating || 'Запланировано',
          score10:validScore10(x?.score10) ? x.score10 : null,
          favorite:favorites.has(movieKey({category, name:x?.name, year}))
        };
        if (item.favorite) item.rating = 'Избранное';
        return item;
      }).filter(x => x.game);
    };

    const normalizeTrashFrom = source => (Array.isArray(source?.trash) ? source.trash : []).map((x, index) => ({
      id:Number.isInteger(Number(x?.id)) ? Number(x.id) : index + 1,
      game:String(x?.game ?? x?.name ?? '').trim(),
      category:x?.category === 'Аниме и Анимация' ? 'Анимация' : String(x?.category || 'Фильмы'),
      year:(x?.year == null || x.year === '') ? null : Number(x.year),
      rating:x?.rating || 'Запланировано',
      score10:validScore10(x?.score10) ? x.score10 : null,
      favorite:Boolean(x?.favorite)
    })).filter(x => x.game);

    const normalizeGames = () => normalizeGamesFrom(state);
    const normalizeTrash = () => normalizeTrashFrom(state);

    const stateFromGamesOn = (base, games, trash) => {
      const items = games.filter(x => String(x?.game ?? '').trim()).map(x => ({
        name:String(x.game).trim(),
        category:x.category || 'Фильмы',
        year:(x.year == null || x.year === '') ? null : Number(x.year),
        rating:x.rating === 'Избранное' ? 'Понравилось' : (x.rating || 'Запланировано'),
        ...(validScore10(x.score10) ? {score10:x.score10} : {})
      }));
      const favorites = games
        .filter(x => Boolean(x?.favorite) || x.rating === 'Избранное')
        .map(x => movieKey({category:x.category, name:x.game, year:x.year}));
      return {...base, items, favorites, trash};
    };

    const persistUI = () => {
      const ui = uiRaw || '{}';
      return enqueuePersistence(() => invoke('persist_movies_ui', {ui}));
    };
    const out = () => resultState(JSON.stringify(normalizeGames()), JSON.stringify(normalizeTrash()));

    const commitDestructive = async (nextState, reason) => {
      const result = await queuePersistence(() => invoke('persist_movies_state', {
        state:JSON.stringify(nextState), ui:uiRaw, reason
      }));
      if (!result?.ok) throw new Error(result?.error || 'SQLite persistence was not confirmed.');
      state = nextState;
      return out();
    };

    // Import metadata is stored alongside the existing v1 state payload. Existing
    // favorites, statuses, trash and uiState remain untouched. One SQLite commit
    // creates the normal pre-change backup before updating the collection.
    const importKey = x => entryIdentityKey({category:'Фильмы',name:x.name,year:x.year});
    const simpleTitle = s => String(s||'').toLocaleLowerCase('ru').normalize('NFKC')
      .replace(/ё/g,'е').replace(/&/g,' and ').replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim();
    // Similarity is only a prompt to review, NEVER permission to merge.
    const titleScoreNormalized = (x,y) => {
      if(!x||!y)return 0;
      if(x===y)return 1;
      if(x.length<5||y.length<5)return 0;
      const count=s=>{const o=new Map();for(let i=0;i<s.length-1;i++){const v=s.slice(i,i+2);o.set(v,(o.get(v)||0)+1);}return o;};
      const a2=count(x),b2=count(y);let shared=0;
      for(const [v,n] of a2)shared+=Math.min(n,b2.get(v)||0);
      return 2*shared/(x.length+y.length-2);
    };
    const getLocalIndex = () => {
      const existing=normalizeGames().map(x=>({identity:entryIdentityKey(x),name:x.game,year:x.year,category:x.category,rating:x.rating,favorite:Boolean(x.favorite)}));
      const trash=normalizeTrash().map(x=>({identity:entryIdentityKey(x),name:x.game,year:x.year,category:x.category}));
      return {existing,trash};
    };
    const reviewPlan = (data, decisions={}) => {
      if(!Array.isArray(data?.entries)||!data.entries.length||data.entries.length>50000)throw new Error('Некорректное количество фильмов.');
      if(decisions===null||typeof decisions!=='object'||Array.isArray(decisions))throw new Error('Некорректные решения сверки.');
      const {existing,trash}=getLocalIndex();
      const byIdentity=new Map(existing.map(x=>[x.identity,x]));
      const byTrash=new Map(trash.map(x=>[x.identity,x]));
      const prior=state.letterboxd?.records||{};
      const priorSkipped=state.letterboxd?.skipped||{};
      const cards=state.catalog?.cards||{};
      const byYear=new Map(),byAlias=new Map(),byTmdb=new Map(),byNormalized=new Map();
      for(const local of existing){
        const card=cards[local.identity];if(!card)continue;
        const id=Number(card.tmdbId);
        if(Number.isSafeInteger(id)&&id>0&&['movie','tv'].includes(card.mediaType)){
          const key=`${card.mediaType}\u0000${id}`;
          if(!byTmdb.has(key))byTmdb.set(key,[]);byTmdb.get(key).push(local);
        }
        for(const alias of Array.isArray(card.aliases)?card.aliases:[]){
          const key=`${local.year??''}\u0000${simpleTitle(alias)}`;
          if(!byAlias.has(key))byAlias.set(key,[]);byAlias.get(key).push(local);
        }
      }
      for(const local of [...existing,...trash.map(x=>({...x,trash:true}))]){
        const k=String(local.year??'');
        if(!byYear.has(k))byYear.set(k,[]);
        const normalizedTitle=simpleTitle(local.name);
        byYear.get(k).push({...local,normalizedTitle});
        if(local.year!=null&&normalizedTitle){
          const exactKey=`${local.year}\u0000${normalizedTitle}`;
          if(!byNormalized.has(exactKey))byNormalized.set(exactKey,[]);
          byNormalized.get(exactKey).push(local);
        }
      }
      const used=new Set(), rows=[];
      let added=0,matched=0,trashed=0,skipped=0,reviewRequired=0,manualMatched=0;
      for(const item of data.entries){
        const name=String(item?.name||'').trim(),year=item?.year==null?null:Number(item.year);
        if(!name||name.length>400||year!==null&&(!Number.isInteger(year)||year<1870||year>2100))throw new Error('Некорректные данные фильма.');
        const sourceKey=importKey(item),identity=importKey(item),normalizedTitle=simpleTitle(name);
        if(used.has(sourceKey))throw new Error('В импорте обнаружен повтор идентификатора фильма.');
        used.add(sourceKey);
        const candidates=[];
        for(const local of byYear.get(String(year??''))||[]){
          const score=titleScoreNormalized(normalizedTitle,local.normalizedTitle);
          if(score>=0.73)candidates.push({identity:local.identity,name:local.name,year:local.year,category:local.category,rating:local.rating,favorite:local.favorite,trash:Boolean(local.trash),score:Math.round(score*100)});
        }
        candidates.sort((x,y)=>y.score-x.score||x.name.localeCompare(y.name,'ru'));
        const normalizedCandidates=year==null?[]:(byNormalized.get(`${year}\u0000${normalizedTitle}`)||[]);
        const onlyNormalized=normalizedCandidates.length===1?normalizedCandidates[0]:null;
        // Letterboxd exports do not normally declare movie vs TV. Never silently
        // bridge a category mismatch (e.g. movie and series with the same name).
        const expectedCategory=item.mediaType==='tv'?'Сериалы':item.mediaType==='movie'?'Фильмы':null;
        const categoryCompatible=local=>expectedCategory?local.category===expectedCategory:local.category==='Фильмы';
        const safeNormalized=onlyNormalized&&!onlyNormalized.trash&&categoryCompatible(onlyNormalized);
        const bulkEligible=Boolean(onlyNormalized&&!onlyNormalized.trash&&!categoryCompatible(onlyNormalized)&&
          normalizedTitle.length>=5&&year!=null);
        const row={sourceKey,name,year,action:'add',targetIdentity:identity,candidates:candidates.slice(0,5),
          reason:'new',bulkEligible,bulkTargetIdentity:bulkEligible?onlyNormalized.identity:null,
          sourceRating:item.rating??null,sourceWatched:Boolean(item.watched),
          sourceMediaType:item.mediaType||null};
        const manual=Object.hasOwn(decisions,sourceKey)?decisions[sourceKey]:null;
        if(manual!=null){
          if(!manual||!['match','add','skip'].includes(manual.action))throw new Error('Некорректное решение о совпадении.');
          if(manual.action==='match'){
            if(byTrash.has(identity))throw new Error('Запись уже находится в Корзине. Ручное сопоставление заблокировано.');
            if(typeof manual.targetIdentity!=='string'||!byIdentity.has(manual.targetIdentity))throw new Error('Выбранная запись Кинотеки больше не существует. Повтори сверку.');
            row.action='matched';row.targetIdentity=manual.targetIdentity;row.reason='manual';manualMatched++;
          } else if(manual.action==='skip'){row.action='skip';row.targetIdentity=null;row.reason='manual';}
          else {
            if(byIdentity.has(identity)||byTrash.has(identity))throw new Error('Запись уже присутствует в Кинотеке или Корзине.');
            row.action='add';row.reason='manual';
          }
        } else if(byIdentity.has(identity)&&categoryCompatible(byIdentity.get(identity))){row.action='matched';row.reason='exact';}
        else if(byTrash.has(identity)){row.action='trash';row.reason='trash';}
        else if(priorSkipped[sourceKey]===true){row.action='skip';row.targetIdentity=null;row.reason='previous';}
        else if(typeof prior[sourceKey]?.targetIdentity==='string'&&byIdentity.has(prior[sourceKey].targetIdentity)){
          row.action='matched';row.targetIdentity=prior[sourceKey].targetIdentity;row.reason='previous';
        } else if(typeof prior[sourceKey]?.targetIdentity==='string'&&byTrash.has(prior[sourceKey].targetIdentity)){
          row.action='trash';row.targetIdentity=prior[sourceKey].targetIdentity;row.reason='trash';
        } else if(safeNormalized){
          row.action='matched';row.targetIdentity=onlyNormalized.identity;row.reason='normalized-exact';
        } else {
          const linkedMap=new Map();
          const linkedId=Number(item.tmdbId);
          if(Number.isSafeInteger(linkedId)&&linkedId>0&&['movie','tv'].includes(item.mediaType))
            for(const local of byTmdb.get(`${item.mediaType}\u0000${linkedId}`)||[])
              if(categoryCompatible(local))linkedMap.set(local.identity,local);
          if(year!=null)
            for(const local of byAlias.get(`${year}\u0000${simpleTitle(name)}`)||[]){
              const card=cards[local.identity];
              if(categoryCompatible(local)&&(!expectedCategory||!card?.mediaType||card.mediaType===item.mediaType))
                linkedMap.set(local.identity,local);
            }
          const linked=[...linkedMap.values()];
          // Exact external ID or an unambiguous catalogue alias may link; a
          // conflicting local title/year or trash entry demands review instead.
          if(linked.length===1&&normalizedCandidates.every(x=>x.identity===linked[0].identity)){
            row.action='matched';row.targetIdentity=linked[0].identity;row.reason='tmdb';
          }
          else if(linked.length>1||candidates.length||normalizedCandidates.length){row.action='review';row.targetIdentity=null;row.reason='similar';}
        }
        if(row.action==='add')added++;
        else if(row.action==='matched')matched++;
        else if(row.action==='trash')trashed++;
        else if(row.action==='skip')skipped++;
        else reviewRequired++;
        rows.push(row);
      }
      // The same new identity must never be inserted twice through a crafted plan.
      return {total:rows.length,added,matched,trashed,skipped,reviewRequired,manualMatched,
        lists:data.lists?.length||0,rows,local:existing};
    };
    const importPreview = (data,decisions={}) => reviewPlan(data,decisions);
    const applyImport = async (data,decisions={}) => {
      try {
        const preview=reviewPlan(data,decisions);
        if(preview.reviewRequired)throw new Error(`Осталось ${preview.reviewRequired} неоднозначных совпадений. Сначала заверши сверку.`);
        const copy=structuredClone(state);
        const records={...(copy.letterboxd?.records||{})};
        const skipped={...(copy.letterboxd?.skipped||{})};
        const mapKeys=new Map(),existing=new Set(copy.items.map(entryIdentityKey));
        for(let i=0;i<preview.rows.length;i++){
          const row=preview.rows[i],item=data.entries[i];
          if(row.action==='skip'){skipped[row.sourceKey]=true;delete records[row.sourceKey];continue;}
          delete skipped[row.sourceKey];
          mapKeys.set(row.sourceKey,row.targetIdentity);
          records[row.sourceKey]={...item,category:'Фильмы',targetIdentity:row.targetIdentity,matchMethod:row.reason};
          const score10=letterboxdScore10(item.rating);
          if(row.action!=='add'){
            // Reimport/backfill: preserve the user's original status, favorites and
            // any manually edited numerical rating. Never silently reclassify.
            if(row.action==='matched' && score10!=null){
              const local=copy.items.find(x=>entryIdentityKey(x)===row.targetIdentity);
              if(local && !validScore10(local.score10))local.score10=score10;
            }
            continue;
          }
          if(existing.has(row.targetIdentity))continue;
          const rating=score10!=null ? scoreStatus(score10) :
            item.watchlist&&!item.watched ? 'Запланировано' :
            item.watched?'Нормально':'Запланировано';
          copy.items.push({name:row.name,category:'Фильмы',year:row.year,rating,
            ...(score10!=null?{score10}: {})});
          existing.add(row.targetIdentity);
        }
        const oldMeta=copy.letterboxd&&typeof copy.letterboxd==='object'?copy.letterboxd:{};
        const listBySlug=new Map((Array.isArray(oldMeta.lists)?oldMeta.lists:[]).map(x=>[x.slug,x]));
        for(const list of data.lists||[]){
          const slug=String(list.slug||'');
          if(!slug)continue;
          listBySlug.set(slug,{name:String(list.name||slug),slug,
            films:(list.films||[]).map(x=>mapKeys.get(`фильмы\u0000${x}`)).filter(Boolean)});
        }
        copy.letterboxd={schema:2,importedAt:new Date().toISOString(),records,skipped,lists:[...listBySlug.values()]};
        await commitDestructive(copy,'Импорт Letterboxd — резервная копия перед изменениями');
        return {ok:true,...preview,rows:undefined,local:undefined};
      } catch(error){return {ok:false,error:String(error?.message||error)};}
    };
    return {
      // Poster associations prefer stable IMDb IDs. Private/manual entries use a
      // canonical identity; no poster bytes or paths enter kinoteka.sqlite3.
      getPosterKeyFor: entry => {
        const identity=entryIdentityKey(entry);
        if(!identity)return '';
        const metadata=state.catalog?.cards?.[identity];
        const imdb=String(metadata?.imdbId||'');
        return /^tt\d{4,15}$/.test(imdb) ? `imdb:${imdb}` : `local:${encodeURIComponent(identity)}`;
      },
      getGamesSync: () => JSON.stringify(normalizeGames()),
      getImportedListsSync: () => JSON.stringify(state.letterboxd?.lists||[]),
      getImportMetadataSync: () => JSON.stringify(state.letterboxd||{}),
      previewLetterboxd: importPreview,
      importLetterboxdConfirmed: applyImport,
      replaceGamesConfirmed: async raw => {
        try {
          const games = validArray(raw);
          const nextState = stateFromGamesOn(state, games, normalizeTrash());
          await commitDestructive(nextState, 'Изменён список Кинотеки');
          return {ok:true};
        } catch (error) {
          return {ok:false,error:String(error?.message || error)};
        }
      },
      getTrashSync: () => JSON.stringify(normalizeTrash()),
      getUISync: () => uiRaw,
      replaceUISync: raw => {
        try {
          const value = JSON.parse(String(raw ?? '{}'));
          if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Некорректные настройки интерфейса.');
          uiRaw = JSON.stringify(value);
          persistUI();
          return {ok:true};
        } catch (error) { return {ok:false, error:error.message}; }
      },
      moveGameToTrash: async id => {
        const games = normalizeGames();
        const numeric = Number(id);
        const index = games.findIndex(x => Number(x.id) === numeric);
        if (index < 0) return {ok:false,error:'Запись не найдена.'};
        const [item] = games.splice(index,1);
        const trash = normalizeTrash();
        trash.push({...item,id:Math.max(0,...trash.map(x=>Number(x.id)||0))+1});
        try { return await commitDestructive(stateFromGamesOn(state,games,trash),'Запись Кинотеки перемещена в корзину'); }
        catch (error) { return {ok:false,error:String(error?.message||error)}; }
      },
      restoreTrash: async id => {
        const trash = normalizeTrash();
        const numeric = Number(id);
        const index = trash.findIndex(x => Number(x.id) === numeric);
        if (index < 0) return {ok:false,error:'Запись не найдена.'};
        const [item] = trash.splice(index,1);
        const games = normalizeGames();
        if (games.some(g => entryIdentityKey(g) === entryIdentityKey(item))) return {ok:false,error:`«${item.game}» уже есть в списке.`};
        games.push({...item,id:games.length+1});
        try { return await commitDestructive(stateFromGamesOn(state,games,trash),'Запись Кинотеки восстановлена из корзины'); }
        catch (error) { return {ok:false,error:String(error?.message||error)}; }
      },
      permanentlyDeleteTrash: async id => {
        const trash = normalizeTrash();
        const numeric = Number(id);
        const nextTrash = trash.filter(x => Number(x.id) !== numeric);
        if (nextTrash.length === trash.length) return {ok:false,error:'Запись не найдена.'};
        try { return await commitDestructive({...state,trash:nextTrash},'Запись Кинотеки окончательно удалена'); }
        catch (error) { return {ok:false,error:String(error?.message||error)}; }
      },
      emptyTrash: async () => {
        try { return await commitDestructive({...state,trash:[]},'Очищена корзина Кинотеки'); }
        catch (error) { return {ok:false,error:String(error?.message||error)}; }
      }
    };
  }

  async function boot() {
    const seed = await invoke('library_state');
    window.kinotekaDatabase = makeDatabase(seed);
    for (const file of ['core.js','games.js','trash.js','runtime.js','shared/library-integration-ui.js']) await loadScript(file);
  }

  // Tauri's initial visible+maximized window already displays the static splash.
  // Wait for the titlebar stylesheet, then finish SQLite + fonts behind the cover.
  // Do NOT call show(), maximize(), focus() or any deferred native reveal here.
  const start = async () => {
    const titlebarReady = installTitlebar();
    try {
      await titlebarReady;
      await boot();
      await waitForFrontendReady();
      if (document.documentElement.classList.contains('app-loading')) {
        throw new Error('Library render did not complete before splash handoff.');
      }
    } catch (error) {
      console.error('[Kinoteka] bootstrap failed', error);
      const box = document.createElement('div');
      box.textContent = `Не удалось загрузить Кинотеку: ${error}`;
      Object.assign(box.style,{padding:'80px 32px',color:'#fff',font:'16px Inter,system-ui'});
      document.body.appendChild(box);
      document.documentElement.classList.remove('app-loading');
    } finally {
      await titlebarReady;
      window.kinotekaStartup.markReady();
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
