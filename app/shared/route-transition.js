(() => {
  const HANDOFF_MS = 80;
  const READY_TIMEOUT_MS = 260;

  const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const waitForLocalPaint = async () => {
    const imageWait = [...document.images].map((img) => {
      if (img.complete) return img.decode?.().catch(() => {}) || Promise.resolve();
      return new Promise((resolve) => {
        const done = () => {
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
          resolve();
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
        window.setTimeout(done, READY_TIMEOUT_MS);
      });
    });
    const fontWait = document.fonts?.ready?.catch?.(() => {}) || Promise.resolve();
    await Promise.race([
      Promise.all([Promise.all(imageWait), fontWait]),
      new Promise((resolve) => setTimeout(resolve, READY_TIMEOUT_MS))
    ]);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  };

  const reveal = async () => {
    await waitForLocalPaint();
    document.body.classList.add('kinoteka-route-ready');
  };

  const handoff = () => new Promise((resolve) => {
    if (reducedMotion()) return resolve();
    window.setTimeout(resolve, HANDOFF_MS);
  });

  window.kinotekaRouteTransition = Object.freeze({
    HANDOFF_MS,
    READY_TIMEOUT_MS,
    reducedMotion,
    waitForLocalPaint,
    reveal,
    handoff
  });
})();
