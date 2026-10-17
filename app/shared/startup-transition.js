(() => {
  'use strict';
  let ready = false;
  window.kinotekaStartup = Object.freeze({
    markReady() {
      if (ready) return false;
      ready = true;
      document.documentElement.dataset.kinotekaStartup = 'ready';
      return true;
    }
  });
})();
