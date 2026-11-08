// Gyakorló- és jutalomnézet vezérlése. A logika a core/round.js reducerben van;
// ez a modul csak rajzol, időzítőt állít és eseményeket fordít le.

import { buildSequence } from '../core/sequence.js';
import { startRound, step, canPrev, remainingMs } from '../core/round.js';
import { syllables } from '../core/cover.js';
import { FONT_STACK } from '../font.js';
import { createReward } from './reward.js';

const KID_KEYS = { Space: 'SPACE', ArrowRight: 'NEXT', ArrowLeft: 'PREV', KeyP: 'PAUSE', ArrowDown: 'COVER_DOWN' };
const SVG = 'http://www.w3.org/2000/svg';
const DRAG = 12;                    // F-P16, F-P19: ennél nagyobb húzás nem lép és nem takar

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
  const lay = { barW: 0, size: 0, top: 0, bottom: 0 };
  let geo = null;                   // a látható tétel szótag-geometriája (F-P19, F-P22)
  const coverG = document.createElementNS(SVG, 'g');
  coverG.setAttribute('class', 'covers');
  el.itemText.after(coverG);
  const measure = document.createElement('canvas').getContext('2d');
  const reward = createReward({ stage: el.stage, balloonsEl: el.balloons, particlesEl: el.particles, countEl: el.rewardCount, onDone: exit });

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

  function dispatch(ev, arg) {
    if (mode !== 'practice') return;
    if (ev === 'COVER_DOWN') arg = { n: curSyllables().length };
    st = step(st, ev, performance.now(), arg);
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
    el.itemText.textContent = ''; coverG.replaceChildren(); geo = null;
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
    lay.size = size; lay.top = baseline - A * s; lay.bottom = baseline + D * s;
    geo = null;
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
    const text = showing ? items[st.seq[st.index]] : '';
    if (el.itemText.textContent !== text) { el.itemText.textContent = text; geo = null; }
    drawCovers();
    el.counter.textContent = practice ? `${st.index + 1}/${st.seq.length}` : '';
    el.pauseInd.classList.toggle('on', practice && st.paused);
    if (!practice) return;
    el.cPrev.disabled = !canPrev(st);
    el.cPlayPath.setAttribute('d', st.paused ? 'M8 5.5v13l10.5-6.5z' : 'M9 6v12M15 6v12');
    el.cPlay.setAttribute('aria-label', st.paused ? 'Folytatás' : 'Szünet');
  }

  /* ---------- szótag-takarás (spec 4.5) ---------- */
  function curSyllables() {
    return mode === 'practice' && st.phase === 'showing' ? syllables(items[st.seq[st.index]]) : [];
  }

  // Tinta-szélek a tényleges SVG-elrendezésből: a karakter kezdőpontja az SVG-ből, a tinta
  // kiterjedése a canvas mérésből (ugyanaz a betű és méret).
  function ink(text, start, len) {
    const x = el.itemText.getStartPositionOfChar(start).x;
    const m = measure.measureText(text.slice(start, start + len));
    return { l: x - (m.actualBoundingBoxLeft || 0), r: x + (m.actualBoundingBoxRight || m.width) };
  }

  function geometry() {
    if (geo) return geo;
    const text = el.itemText.textContent, syl = syllables(text);
    if (syl.length < 2) return (geo = { syl, slices: [], rects: [] });
    measure.font = `400 ${lay.size}px ${FONT_STACK}`;
    const em = lay.size;
    const whole = ink(text, 0, text.length);
    const hyph = (i) => (text[i] === '-' ? ink(text, i, 1) : null);
    // F-P19: a közös tinta-doboz szeletei a szótagok közti kötőjel(ek) közepén
    const cuts = [];
    for (let k = 0; k < syl.length - 1; k++) {
      const a = ink(text, syl[k].end, 1), b = ink(text, syl[k + 1].start - 1, 1);
      cuts.push(((a.l + a.r) / 2 + (b.l + b.r) / 2) / 2);
    }
    const slices = syl.map((_, k) => ({ l: k ? cuts[k - 1] : whole.l, r: k < cuts.length ? cuts[k] : whole.r }));
    // F-P22: szótag-tinta ± 0,06 em, a szomszédos kötőjel tintáját nem éri el; függőlegesen a kör tinta-doboza ± 0,08 em
    const y = lay.top - 0.08 * em, h = lay.bottom - lay.top + 0.16 * em;
    const rects = syl.map((sy) => {
      const g = ink(text, sy.start, sy.end - sy.start);
      let l = g.l - 0.06 * em, r = g.r + 0.06 * em;
      const before = hyph(sy.start - 1), after = hyph(sy.end);
      if (before) l = Math.max(l, before.r + 1);
      if (after) r = Math.min(r, after.l - 1);
      return { x: l, y, w: Math.max(0, r - l), h };
    });
    return (geo = { syl, slices, rects });
  }

  function drawCovers() {
    const c = mode === 'practice' && st.phase === 'showing' ? st.covered : [];
    if (!c.some(Boolean)) { coverG.replaceChildren(); return; }
    const { rects } = geometry();
    coverG.replaceChildren(...rects.flatMap((r, k) => {
      if (!c[k]) return [];
      const n = document.createElementNS(SVG, 'rect');
      n.setAttribute('class', 'cover');
      n.setAttribute('x', r.x.toFixed(1)); n.setAttribute('y', r.y.toFixed(1));
      n.setAttribute('width', r.w.toFixed(1)); n.setAttribute('height', r.h.toFixed(1));
      n.setAttribute('rx', 6);
      return [n];
    }));
  }

  /** Melyik szótag takarási területén van a pont (F-P19); -1, ha egyiken sem, vagy nincs mit takarni. */
  function syllableAt(x, y) {
    if (mode !== 'practice' || st.phase !== 'showing' || curSyllables().length < 2) return -1;
    if (y < lay.top || y > lay.bottom) return -1;
    return geometry().slices.findIndex((sl) => x >= sl.l && x <= sl.r);
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
    const mouse = e.pointerType === 'mouse';
    tapPt = mode === 'practice' && !e.target.closest('.cbtn') && (!mouse || e.button === 0)
      ? { x: e.clientX, y: e.clientY, mouse } : null;
  });
  // F-P16: érintőképernyőn egy koppintás bárhol = következő (mint a ▶); húzásra nem lép.
  // F-P18/F-P19: többszótagú tételen a szótag területére kattintás/koppintás takar; egérrel máshol semmi.
  el.stage.addEventListener('pointerup', (e) => {
    const p = tapPt; tapPt = null;
    if (!p || mode !== 'practice' || Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG) return;
    const i = syllableAt(p.x, p.y);
    if (i >= 0) dispatch('COVER', { i, n: curSyllables().length });
    else if (!p.mouse) dispatch('NEXT');
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
