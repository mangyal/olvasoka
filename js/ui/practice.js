// Gyakorló- és jutalomnézet vezérlése. A logika a core/round.js reducerben van;
// ez a modul csak rajzol, időzítőt állít és eseményeket fordít le.

import { buildSequence } from '../core/sequence.js';
import { startRound, step, canPrev, remainingMs } from '../core/round.js';
import { FONT_STACK } from '../font.js';
import { createReward } from './reward.js';

const KID_KEYS = { Space: 'SPACE', ArrowRight: 'NEXT', ArrowLeft: 'PREV', KeyP: 'PAUSE' };

export function createPractice(el, { onExit }) {
  let mode = 'off';                 // 'off' | 'practice' | 'reward'
  let wake = null;                  // F-P17: a képernyő ne sötétüljön el gyakorlás közben

  async function keepAwake() {
    if (mode === 'off' || wake || !('wakeLock' in navigator) || document.hidden) return;
    try { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); }
    catch { wake = null; }
  }
  function letSleep() { if (wake) { wake.release().catch(() => {}); wake = null; } }
  let st = null, items = [], timer = 0, uiTimer = 0, lastPt = null;
  let touch = false;                // F-P10: volt már érintés/toll → a ✕ végig látszik
  const lay = { barW: 0 };
  const measure = document.createElement('canvas').getContext('2d');
  const reward = createReward({ stage: el.stage, balloonsEl: el.balloons, particlesEl: el.particles, onDone: exit });

  /* ---------- kör ---------- */
  function start(roundItems, settings, ev) {
    items = roundItems;
    const seq = buildSequence(items.length, settings.count);
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    mode = 'practice';
    if (ev && ev.pointerType && ev.pointerType !== 'mouse') touch = true;
    el.stage.className = 'stage' + (touch ? ' touch' : ''); el.stage.dataset.mode = 'practice'; el.stage.hidden = false;
    lastPt = ev && ev.clientX != null && ev.detail ? { x: ev.clientX, y: ev.clientY } : null;
    st = startRound(seq, settings.flashMs, settings.gapMs, performance.now());
    layout();
    render(); arm();                // S1: azonnal az első tétel, teljes idővel
    requestAnimationFrame(barFrame);
    keepAwake();
  }

  function dispatch(ev) {
    if (mode !== 'practice') return;
    st = step(st, ev, performance.now());
    if (st.done) { toReward(); return; }
    render(); arm();
  }

  // N3: abszolút határidő; egyetlen időzítő, ami a határidőig alszik
  function arm() {
    clearTimeout(timer);
    if (st.paused || !Number.isFinite(st.deadline)) return;
    timer = setTimeout(() => dispatch('TICK'), Math.max(0, st.deadline - performance.now()));
  }

  function toReward() {
    clearTimeout(timer);
    mode = 'reward';
    el.stage.dataset.mode = 'reward';
    render();
    reward.start();
  }

  function exit() {
    clearTimeout(timer); clearTimeout(uiTimer);
    reward.stop();
    mode = 'off'; st = null;
    letSleep();
    el.itemText.textContent = '';
    el.stage.hidden = true; el.stage.className = 'stage'; el.stage.dataset.mode = 'practice';
    onExit();
  }

  /* ---------- rajzolás ---------- */
  // F-P13: egy betűméret az egész körre, a tételek közös tinta-dobozához igazítva, állandó alapvonallal
  function layout() {
    const texts = [...new Set(st.seq.map((i) => items[i]))];
    measure.font = `400 100px ${FONT_STACK}`;
    let maxW = 1, A = 0, D = 0;
    for (const t of texts) {
      const m = measure.measureText(t);
      maxW = Math.max(maxW, m.width, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0));
      A = Math.max(A, m.actualBoundingBoxAscent || 72);
      D = Math.max(D, m.actualBoundingBoxDescent || 0);
    }
    const vw = innerWidth, vh = innerHeight;
    const k = Math.min(vw * 0.85 / maxW, vh * 0.62 / Math.max(1, A + D), vh * 0.62 / 100);
    const size = Math.max(8, Math.floor(k * 100)), s = size / 100;
    const baseline = vh * 0.46 + ((A - D) / 2) * s;
    el.itemText.setAttribute('font-size', size);
    el.itemText.setAttribute('y', baseline.toFixed(1));
    // időjelző a közös tinta-doboz alatt, a kör legszélesebb tételének szélességében
    lay.barW = Math.min(vw * 0.7, Math.max(160, maxW * s));
    const x = (vw - lay.barW) / 2;
    const y = Math.min(baseline + D * s + Math.max(16, vh * 0.035), vh - 110);
    for (const r of [el.barTrack, el.barFill]) { r.setAttribute('x', x.toFixed(1)); r.setAttribute('y', y.toFixed(1)); }
    el.barTrack.setAttribute('width', lay.barW.toFixed(1));
  }

  function render() {
    const practice = mode === 'practice';
    const showing = practice && st.phase === 'showing';
    el.itemText.textContent = showing ? items[st.seq[st.index]] : '';
    el.counter.textContent = practice ? `${st.index + 1}/${st.seq.length}` : '';
    el.pauseInd.classList.toggle('on', practice && st.paused);
    if (!practice) return;
    el.cPrev.disabled = !canPrev(st);
    el.cPlayPath.setAttribute('d', st.paused ? 'M8 5.5v13l10.5-6.5z' : 'M9 6v12M15 6v12');
    el.cPlay.setAttribute('aria-label', st.paused ? 'Folytatás' : 'Szünet');
  }

  function barFrame() {
    if (mode !== 'practice') { el.bar.setAttribute('visibility', 'hidden'); return; }
    const on = st.phase === 'showing' && st.flash > 0;
    el.bar.setAttribute('visibility', on ? 'visible' : 'hidden');
    if (on) el.barFill.setAttribute('width', (lay.barW * Math.min(1, remainingMs(st, performance.now()) / st.flash)).toFixed(1));
    requestAnimationFrame(barFrame);
  }

  /* ---------- egér és ikonok (F-P10, F-P11) ---------- */
  function showUI() {
    el.stage.classList.add('ui'); clearTimeout(uiTimer);
    uiTimer = setTimeout(() => el.stage.classList.remove('ui'), 2500);
  }
  el.stage.addEventListener('pointermove', (e) => {
    if (mode === 'off') return;
    if (!lastPt) { lastPt = { x: e.clientX, y: e.clientY }; return; }
    if (Math.hypot(e.clientX - lastPt.x, e.clientY - lastPt.y) < 8) return;
    lastPt = { x: e.clientX, y: e.clientY }; showUI();
  });
  let tapPt = null;
  el.stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' && !touch) { touch = true; el.stage.classList.add('touch'); }
    if (mode === 'reward') reward.pointerDown(e);
    tapPt = mode === 'practice' && e.pointerType !== 'mouse' && !e.target.closest('.cbtn') ? { x: e.clientX, y: e.clientY } : null;
  });
  // F-P16: érintőképernyőn egy koppintás bárhol = következő (mint a ▶); húzásra nem lép
  el.stage.addEventListener('pointerup', (e) => {
    const p = tapPt; tapPt = null;
    if (!p || mode !== 'practice' || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 12) return;
    dispatch('NEXT');
  });
  el.stage.addEventListener('pointercancel', () => { tapPt = null; });
  const ctl = (btn, fn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => { e.stopPropagation(); btn.blur(); fn(); showUI(); });
  };
  ctl(el.cClose, exit);
  ctl(el.cPrev, () => dispatch('PREV'));
  ctl(el.cPlay, () => dispatch('PAUSE'));
  ctl(el.cNext, () => dispatch('NEXT'));

  /* ---------- billentyűk és ablak ---------- */
  function key(e) {
    if (e.code !== 'Escape' && !KID_KEYS[e.code]) return;
    e.preventDefault();
    if (e.repeat) return;           // egy lenyomás = egy lépés
    if (e.code === 'Escape') exit();
    else dispatch(KID_KEYS[e.code]);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) dispatch('BLUR'); else keepAwake(); });
  addEventListener('blur', () => dispatch('BLUR'));
  addEventListener('resize', () => { if (mode === 'practice') { layout(); render(); } });

  return { start, key, get active() { return mode !== 'off'; } };
}
