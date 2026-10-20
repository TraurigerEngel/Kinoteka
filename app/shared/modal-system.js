/* Kinoteka shared modal system — same interaction model as Backup Center. */
(() => {
  const MOTION = Object.freeze({ openMs: 280, closeMs: 260 });
  const controllers = new Map();
  const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const FOCUSABLE = 'button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
  const openControllers = () => [...controllers.values()].filter(c => c.isOpen());
  const updateLock = () => {
    const locked = openControllers().length > 0;
    document.documentElement.classList.toggle('modal-open', locked);
    document.body.classList.toggle('modal-open', locked);
  };

  function bind(id, overlay, dialog) {
    if (!overlay || !dialog) return null;
    if (controllers.has(id)) return controllers.get(id);
    let closeTimer = null;
    let previousFocus = null;
    let opening = false;
    const controller = {
      id,
      overlay,
      dialog,
      isOpen: () => overlay.classList.contains('open'),
      open(preferredFocus = null) {
        clearTimeout(closeTimer);
        overlay.classList.remove('closing');
        previousFocus = document.activeElement;
        overlay.classList.add('open');
        if (overlay.classList.contains('modal-backdrop')) overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
        updateLock();
        opening = true;
        requestAnimationFrame(() => {
          const target = preferredFocus || dialog.querySelector(FOCUSABLE);
          target?.focus?.({ preventScroll: true });
          opening = false;
        });
      },
      close({ restoreFocus = true, immediate = false, blurRestoredFocus = false } = {}) {
        if (!controller.isOpen() && !overlay.classList.contains('closing')) return;
        clearTimeout(closeTimer);
        overlay.classList.add('closing');
        const finish = () => {
          overlay.classList.remove('open', 'closing', 'show');
          overlay.setAttribute('aria-hidden', 'true');
          updateLock();
          if (restoreFocus && previousFocus?.isConnected) {
            previousFocus.focus?.({ preventScroll: true });
            if (blurRestoredFocus) previousFocus.blur?.();
          }
          previousFocus = null;
        };
        if (immediate || prefersReducedMotion()) finish();
        else closeTimer = setTimeout(finish, MOTION.closeMs);
      },
      toggle() { controller.isOpen() ? controller.close() : controller.open(); }
    };
    overlay.addEventListener('click', e => { if (e.target === overlay) controller.close(); });
    controllers.set(id, controller);
    return controller;
  }

  const hasVisibleDialog = () => [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(el => {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && (el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  });
  const clearEscapeFocus = () => {
    const blurIfDismissed = () => {
      if (!hasVisibleDialog()) document.activeElement?.blur?.();
    };
    requestAnimationFrame(blurIfDismissed);
    setTimeout(blurIfDismissed, 0);
    setTimeout(blurIfDismissed, 250);
  };

  document.addEventListener('keydown', e => {
    const current = openControllers().at(-1);
    if (e.key === 'Escape') {
      const hadDialog = Boolean(current) || hasVisibleDialog();
      if (!hadDialog) return;
      e.preventDefault();
      if (current) {
        e.stopPropagation();
        current.close({ blurRestoredFocus: true });
      }
      // Esc is a dismissal action. After the modal finishes closing, make sure
      // the restored page element does not retain a focus ring. This runs after
      // project-specific Escape handlers as well, not just KinotekaModal controllers.
      clearEscapeFocus();
      return;
    }
  }, true);



  // Kinoteka themed alert/confirm dialogs. These replace native browser dialogs
  // while keeping the same async interaction style everywhere in the app.
  // Dialog presentation lives in modal-system.css, loaded with the document.
  // Runtime <style> injection was fragile and could leave the overlay in normal flow.

  function normalizeDialogText(value){ return String(value ?? ''); }
  function createDialog(options={}){
    const layer=document.createElement('div'); layer.className='kinoteka-native-dialog-layer'; layer.setAttribute('role','presentation');
    const dialog=document.createElement('section'); dialog.className='kinoteka-native-dialog'; dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true');
    const head=document.createElement('div'); head.className='kinoteka-native-dialog-head';
    const title=document.createElement('div'); title.className='kinoteka-native-dialog-title'; title.textContent=options.title || 'Кинотека';
    head.append(title);
    const body=document.createElement('div'); body.className='kinoteka-native-dialog-body'; body.textContent=normalizeDialogText(options.message);
    const actions=document.createElement('div'); actions.className='kinoteka-native-dialog-actions';
    if(options.copyText){
      const copy=document.createElement('button'); copy.type='button'; copy.className='kinoteka-native-dialog-btn copy'; copy.textContent='Копировать путь';
      copy.addEventListener('click',async()=>{
        try{
          const text=String(options.copyText);
          let copied=false;
          if(window.kinotekaRuntime?.copyText){ copied=(await window.kinotekaRuntime.copyText(text))===true; }
          if(!copied && navigator.clipboard?.writeText){ await navigator.clipboard.writeText(text); copied=true; }
          if(!copied) throw new Error('clipboard write failed');
          copy.textContent='Скопировано';
          setTimeout(()=>{copy.textContent='Копировать путь'},1200);
        }catch{
          copy.textContent='Не удалось скопировать';
          setTimeout(()=>{copy.textContent='Копировать путь'},1400);
        }
      });
      actions.appendChild(copy);
    }
    const cancel=options.confirm ? document.createElement('button') : null;
    if(cancel){ cancel.type='button'; cancel.className='kinoteka-native-dialog-btn'; cancel.textContent=options.cancelText||'Отмена'; actions.appendChild(cancel); }
    const ok=document.createElement('button'); ok.type='button'; ok.className=`kinoteka-native-dialog-btn ${options.type==='danger'?'danger':options.type==='success'?'success':'primary'}`; ok.textContent=options.confirm ? (options.okText||'Подтвердить') : (options.okText||'OK'); actions.appendChild(ok);
    dialog.append(head,body,actions); layer.appendChild(dialog); document.body.appendChild(layer);
    document.documentElement.classList.add('kinoteka-dialog-open'); document.body.classList.add('kinoteka-dialog-open');
    let closed=false;
    const finish=(value)=>{
      if(closed)return;
      closed=true;
      const complete=()=>{
        layer.classList.remove('open','closing');
        document.documentElement.classList.remove('kinoteka-dialog-open');
        document.body.classList.remove('kinoteka-dialog-open');
        layer.remove();
        resolvePromise(value);
      };
      if(prefersReducedMotion()){ complete(); return; }
      layer.classList.add('closing');
      setTimeout(complete,MOTION.closeMs);
    };
    let resolvePromise;
    const promise=new Promise(resolve=>{ resolvePromise=resolve; });
    const onKey=e=>{ if(e.key==='Escape'){ e.preventDefault(); finish(options.confirm?false:undefined); } else if(e.key==='Enter'){ e.preventDefault(); finish(true); } };
    const onBackdrop=e=>{ if(e.target===layer) finish(options.confirm?false:undefined); };
    layer.addEventListener('click',onBackdrop);
    layer.addEventListener('keydown',onKey,true);
    ok.addEventListener('click',()=>finish(true));
    cancel?.addEventListener('click',()=>finish(false));
    requestAnimationFrame(()=>{layer.classList.add('open');ok.focus({preventScroll:true});});
    return promise;
  }
  // A modal must never create a second stack of prompts: rapid clicks can arrive
  // before the first confirmation completes. Extra confirmations are cancelled,
  // not shared, so one approval cannot authorise multiple database mutations.
  let activeNativeDialog = false;
  function showNativeDialog(options){
    if(activeNativeDialog) return Promise.resolve(options.confirm ? false : undefined);
    activeNativeDialog = true;
    try{
      return createDialog(options).finally(()=>{ activeNativeDialog = false; });
    }catch(error){
      activeNativeDialog = false;
      throw error;
    }
  }
  window.KinotekaDialog={
    alert(message,options={}){ return showNativeDialog({...options,confirm:false,message}); },
    confirm(message,options={}){ return showNativeDialog({...options,confirm:true,message}); }
  };

  window.KinotekaModal = { bind, get: id => controllers.get(id) || null, updateLock, motion: MOTION };
})();
