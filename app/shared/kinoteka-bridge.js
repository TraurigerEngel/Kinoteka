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
      favorite:Boolean(x?.favorite)
    })).filter(x => x.game);

    const normalizeGames = () => normalizeGamesFrom(state);
    const normalizeTrash = () => normalizeTrashFrom(state);

    const stateFromGamesOn = (base, games, trash) => {
      const items = games.filter(x => String(x?.game ?? '').trim()).map(x => ({
        name:String(x.game).trim(),
        category:x.category || 'Фильмы',
        year:(x.year == null || x.year === '') ? null : Number(x.year),
        rating:x.rating === 'Избранное' ? 'Понравилось' : (x.rating || 'Запланировано')
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

    return {
      getGamesSync: () => JSON.stringify(normalizeGames()),
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
    for (const file of ['core.js','games.js','trash.js','runtime.js']) await loadScript(file);
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
