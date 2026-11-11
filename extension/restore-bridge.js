// This isolated script is registered only for sites the user opts into.
(() => {
  if (globalThis.__volumeBoosterRestoreBridge_v1) return;
  globalThis.__volumeBoosterRestoreBridge_v1 = true;
  const api = globalThis.browser || globalThis.chrome;
  let pending = false, retry = false;
  async function restore() {
    if (pending) { retry = true; return; }
    pending = true;
    try { await api.runtime.sendMessage({ target: 'worker', type: 'restore' }); }
    catch { /* A later media play event can retry; never interrupt the player. */ }
    finally { pending = false; if (retry) { retry = false; queueMicrotask(restore); } }
  }
  document.addEventListener('play', restore, true);
  document.addEventListener('loadedmetadata', restore, true);
  restore();
})();
