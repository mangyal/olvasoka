// Gyakorló-, Keresd meg!- és jutalomnézet vezérlése. A logika a core/round.js és a core/find.js
// reducerekben van; ez a modul csak rajzol, időzítőt állít és eseményeket fordít le.

import { buildReadSequence } from '../core/sequence.js';
import { startRound, step, canPrev, remainingMs } from '../core/round.js';
import { coverUnits, rulerGeometry } from '../core/cover.js';
import { gesture } from '../core/swipe.js';
import { roundLayouts, layoutFor } from '../core/fit.js';
import { isSentence } from '../core/items.js';
import { progressModel, dotState } from '../core/progress.js';
import { FONT_STACK } from '../font.js';
import { createReward } from './reward.js';
import { createPandaReward } from './panda.js';
import { forcedReward } from '../core/rewards.js';
import { createChooser } from './chooser.js';
import { startFind as newFind, step as findStep, canPrev as findCanPrev } from '../core/find.js';
import { createFindView } from './find.js';

const KID_KEYS = { Space: 'SPACE', ArrowRight: 'NEXT', ArrowLeft: 'PREV', KeyP: 'PAUSE', ArrowDown: 'COVER_DOWN' };
// Keresd meg! (4a.4): P és ↓ itt nem csinál semmit; a Tab és az Enter a kártyák között natív
const FIND_KEYS = { Space: 'NEXT', ArrowRight: 'NEXT', ArrowLeft: 'PREV' };
const SVG = 'http://www.w3.org/2000/svg';

/**
 * @param {object} el  a DOM elemei
 * @param {{ onExit: () => void, progress?: object, onRoundEnd?: Function, onReward?: Function }} o
 *   progress: a Haladás naplója (data/progress-log.js); a Felolvasás kör átmeneteit kapja
 *   onRoundEnd({ game: 'read'|'find', completed }): a kör vége (completed: false, ha kilépett közben)
 *   onReward(name): a gyerek választott jutalomjátéka (a ?jutalom= paraméterrel rögzített nem számít)
 */
export function createPractice(el, { onExit, progress = null, onRoundEnd = () => {}, onReward = () => {} }) {
  let mode = 'off';                 // 'off' | 'practice' | 'find' | 'choose' | 'reward'
  let fst = null;                   // a Keresd meg! kör állapota (core/find.js)
  let wake = null;                  // N9: a képernyő ne sötétüljön el gyakorlás közben
  let waking = false;               // a kérés folyamatban: ne induljon párhuzamosan még egy

  // A kérés aszinkron: ha közben véget ért a kör (vagy elrejtették a lapot), a megkapott zár
  // azonnal elengedődik, különben a szülői felületen is ébren tartaná a képernyőt.
  async function keepAwake() {
    if (mode === 'off' || wake || waking || !('wakeLock' in navigator) || document.hidden) return;
    waking = true;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (mode === 'off' || document.hidden) { lock.release().catch(() => {}); return; }
      wake = lock;
      lock.addEventListener('release', () => { if (wake === lock) wake = null; });
    } catch { /* nincs engedély vagy támogatás: nem jelez hibát (N9) */ } finally { waking = false; }
  }
  function letSleep() { if (wake) { wake.release().catch(() => {}); wake = null; } }
  let st = null, items = [], timer = 0, uiTimer = 0, lastPt = null;
  let touch = false;                // F-P10: volt már érintés/toll → a ✕ végig látszik
  const lay = { barW: 0, barY: Infinity, size: 0, top: 0, bottom: 0 };
  let layouts = null, curLayout = null;   // M-7: a kör két elrendezése és az épp használt
  let geo = null;                   // a látható tétel takarási geometriája (F-P19, F-P22, M-8)
  const coverG = document.createElementNS(SVG, 'g');
  coverG.setAttribute('class', 'covers');
  el.itemText.after(coverG);
  const measure = document.createElement('canvas').getContext('2d');
  // 5., 5a.: a jutalomjátékok; a kör végén a gyerek választ (F-R14), a `?jutalom=lufi|panda` cím rögzíti
  const rewards = {
    lufi: createReward({ stage: el.stage, balloonsEl: el.balloons, particlesEl: el.particles, countEl: el.rewardCount, onDone: exit }),
    panda: createPandaReward({ stage: el.stage, layerEl: el.balloons, particlesEl: el.particles, countEl: el.rewardCount, onDone: exit }),
  };
  const forced = forcedReward(new URLSearchParams(location.search).get('jutalom'));
  let reward = null;
  const chooser = createChooser({ root: el.chooser, onPick: (name) => { if (mode === 'choose') { onReward(name); playReward(name, true); } } });
  const findView = createFindView({ grid: el.findGrid }, { onMark: (i) => findDispatch('MARK', i) });

  /** A játékképernyő megjelenítése egy kör indulásakor: a fókusz le a szülői felületről, és ha a kör
   *  érintéssel indult, a ✕ végig látszik (F-P10). @param {'practice'|'find'} m */
  function showStage(m, ev) {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    mode = m;
    if (ev && ev.pointerType && ev.pointerType !== 'mouse') touch = true;
    el.stage.className = 'stage' + (touch ? ' touch' : ''); el.stage.dataset.mode = m; el.stage.hidden = false;
  }

  /* ---------- kör ---------- */
  /** @param {{ listNames?: string[], undoMs?: number }} [opt]  a Haladás naplójához */
  /** roundItems: a kör sorai, ismétlésekkel (2.14); settings.mixed: „Kevert sorrend” (F-8, F-9) */
  function start(roundItems, settings, ev, { listNames = [], undoMs } = {}) {
    items = roundItems;
    const seq = buildReadSequence(items, settings.count, { mixed: settings.mixed });
    showStage('practice', ev);
    lastPt = ev && ev.clientX != null && ev.detail ? { x: ev.clientX, y: ev.clientY } : null;
    st = startRound(seq, settings.flashMs, settings.gapMs, performance.now(), { undoMs });
    progress?.beginRound({ seq: st.seq, items, listNames, flashMs: settings.flashMs, gapMs: settings.gapMs, count: settings.count,
      order: settings.mixed ? 'mixed' : 'grouped' });
    buildProgress(st.seq.length);
    layout();
    render(); arm();                // S1: azonnal az első tétel, teljes idővel
    requestAnimationFrame(barFrame);
    keepAwake();
  }

  /* ---------- Keresd meg! kör (4a.) ---------- */
  /** @param {string[][]} tasks  a kör feladatai; @param {number} cards  a beállított (F-K10 utáni) kártyaszám */
  function startFind(tasks, cards, ev) {
    showStage('find', ev);
    fst = newFind(tasks);
    findCards = cards;
    el.findGrid.hidden = false;
    el.cPrev.setAttribute('aria-label', 'Előző feladat');
    el.cNext.setAttribute('aria-label', 'Következő feladat');
    buildProgress(fst.tasks.length);
    renderFind(true);
    keepAwake();
  }
  let findCards = 4;

  function findDispatch(ev, i) {
    if (mode !== 'find') return;
    const prev = fst;
    fst = findStep(fst, ev, i);
    if (fst.done) { toReward(); return; }
    renderFind(fst.index !== prev.index);
  }

  function renderFind(newTask) {
    if (newTask) findView.show(fst.tasks[fst.index], findCards);
    findView.mark(fst.marked);
    const m = progressModel(fst.index, fst.tasks.length, 'feladat');
    el.findGrid.setAttribute('aria-label', m.label);
    renderProgress(m);
    el.cPrev.disabled = !findCanPrev(fst);
  }

  function dispatch(ev, arg) {
    if (mode !== 'practice') return;
    if (ev === 'COVER_DOWN') arg = { n: curUnits().length };
    const before = st;
    st = step(st, ev, performance.now(), arg);
    progress?.step(before, ev, st);
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
    onRoundEnd({ game: mode === 'find' ? 'find' : 'read', completed: true });
    if (mode === 'find') { findView.clear(); el.findGrid.hidden = true; fst = null; }
    if (mode === 'practice') progress?.endRound();
    if (forced) { mode = 'reward'; el.stage.dataset.mode = 'reward'; render(); playReward(forced, false); return; }
    // F-R14, 12.5b: a háttér papír → ég, közben megjelenik a két kártya; a gyerek választ
    mode = 'choose';
    el.stage.dataset.mode = 'choose';
    render();
    void el.stage.offsetWidth;
    el.stage.classList.add('sky');
    chooser.show();
  }

  /** @param {boolean} skipSky  a választóból jön: az ég már kész, a játék a saját belépőjével indul */
  function playReward(name, skipSky) {
    chooser.hide();
    mode = 'reward';
    el.stage.dataset.mode = 'reward';
    reward = rewards[name];
    el.stage.dataset.reward = name;
    reward.start({ skipSky });
  }

  function exit() {
    clearTimeout(timer); clearTimeout(uiTimer);
    if (reward) { reward.stop(); reward = null; }
    chooser.hide();
    if (mode === 'practice') progress?.endRound(st.index);   // kilépés a kör közben
    if (mode === 'practice' || mode === 'find') onRoundEnd({ game: mode === 'find' ? 'find' : 'read', completed: false });
    delete el.stage.dataset.reward;
    mode = 'off'; st = null; fst = null;
    findView.clear(); el.findGrid.hidden = true;
    el.cPrev.setAttribute('aria-label', 'Előző'); el.cNext.setAttribute('aria-label', 'Következő');
    letSleep();
    el.itemText.textContent = ''; coverG.replaceChildren(); geo = null;
    el.progress.replaceChildren(); prog = null;
    el.stage.hidden = true; el.stage.className = 'stage'; el.stage.dataset.mode = 'practice';
    onExit();
  }

  /* ---------- rajzolás ---------- */
  // F-P13, M-7: két betűméret a körre (nem-mondat tételek, mondatok), mindkettő a saját tételei közös
  // tinta-dobozához igazítva, állandó alapvonallal. A tétel a típusa szerinti elrendezéssel jelenik meg.
  function layout() {
    measure.font = `400 100px ${FONT_STACK}`;
    const metric = (t) => {
      const m = measure.measureText(t);
      return { width: m.width, left: m.actualBoundingBoxLeft, right: m.actualBoundingBoxRight,
        ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent };
    };
    layouts = roundLayouts(st.seq.map((i) => items[i]), metric, innerWidth, innerHeight);
    curLayout = null;
    applyLayout(items[st.seq[st.index]] ?? '');
  }

  /** A tétel elrendezésére vált, ha az más, mint az épp használt (M-7). */
  function applyLayout(text) {
    const L = layoutFor(layouts, text);
    if (!L || L === curLayout) return;
    curLayout = L;
    el.itemText.setAttribute('font-size', L.size);
    lay.size = L.size; lay.top = L.top; lay.bottom = L.bottom;
    lay.barW = L.barW; lay.barY = L.barY;
    geo = null;
    el.itemText.setAttribute('y', L.baseline.toFixed(1));
    for (const r of [el.barTrack, el.barFill]) { r.setAttribute('x', L.barX.toFixed(1)); r.setAttribute('y', L.barY.toFixed(1)); }
    el.barTrack.setAttribute('width', L.barW.toFixed(1));
  }

  function render() {
    const practice = mode === 'practice';
    const showing = practice && st.phase === 'showing';
    const text = showing ? items[st.seq[st.index]] : '';
    if (text) applyLayout(text);    // M-7: a szünetben (üres szöveg) a méret marad
    if (el.itemText.textContent !== text) { el.itemText.textContent = text; geo = null; }
    drawCovers();
    if (practice) renderProgress(progressModel(st.index, st.seq.length));
    el.pauseInd.classList.toggle('on', practice && st.paused);
    if (!practice) return;
    el.cPrev.disabled = !canPrev(st);
    el.cPlayPath.setAttribute('d', st.paused ? 'M8 5.5v13l10.5-6.5z' : 'M9 6v12M15 6v12');
    el.cPlay.setAttribute('aria-label', st.paused ? 'Folytatás' : 'Szünet');
  }

  /* ---------- haladásjelző (design spec 7.) ---------- */
  // A DOM a kör indulásakor épül fel egyszer; lépésenként csak az osztályok és a felirat változnak.
  let prog = null;                  // { kind, dots: [], fill, text }
  function buildProgress(total) {
    const m = progressModel(0, total);
    el.progress.className = 'progress ' + m.kind;
    if (m.kind === 'dots') {
      const dots = Array.from({ length: m.total }, () => document.createElement('span'));
      for (const d of dots) d.className = 'dot';
      el.progress.replaceChildren(...dots);
      prog = { kind: 'dots', dots };
    } else {
      const track = document.createElement('span'); track.className = 'track';
      const fill = document.createElement('span'); fill.className = 'fill'; track.append(fill);
      const text = document.createElement('span'); text.className = 'ptext num';
      el.progress.replaceChildren(track, text);
      prog = { kind: 'bar', fill, text };
    }
  }
  function renderProgress(m) {
    el.progress.setAttribute('aria-label', m.label);
    if (prog.kind === 'dots') {
      prog.dots.forEach((d, k) => {
        const s = dotState(k, m.current);
        d.classList.toggle('is-done', s === 'done');
        d.classList.toggle('is-current', s === 'current');
      });
    } else {
      prog.fill.style.width = `${(m.fraction * 100).toFixed(2)}%`;
      prog.text.textContent = m.text;
    }
  }

  /* ---------- szótag-takarás (spec 4.5); mondatnál szavanként (M-8) ---------- */
  function curUnits() {
    return mode === 'practice' && st.phase === 'showing' ? coverUnits(items[st.seq[st.index]]) : [];
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
    const text = el.itemText.textContent, units = coverUnits(text);
    if (units.length < 2) return (geo = { units, slices: [], rulers: [] });
    measure.font = `400 ${lay.size}px ${FONT_STACK}`;
    const em = lay.size;
    const whole = ink(text, 0, text.length);
    const startX = (u) => el.itemText.getStartPositionOfChar(u.start).x;
    const endX = (u) => el.itemText.getEndPositionOfChar(u.end - 1).x;
    const sentence = isSentence(text);
    // F-P19: a közös tinta-doboz szeletei a szótagok közti kötőjel(ek) közepén;
    // M-8: mondatban a két szó közti szóköz közepén
    const cuts = [];
    for (let k = 0; k < units.length - 1; k++) {
      if (sentence) { cuts.push((endX(units[k]) + startX(units[k + 1])) / 2); continue; }
      const a = ink(text, units[k].end, 1), b = ink(text, units[k + 1].start - 1, 1);
      cuts.push(((a.l + a.r) / 2 + (b.l + b.r) / 2) / 2);
    }
    const slices = units.map((_, k) => ({ l: k ? cuts[k - 1] : whole.l, r: k < cuts.length ? cuts[k] : whole.r }));
    // F-P22: vonalzó az egység advance-dobozán; a kötőjel felől ráhagyás nélkül, a tintáját nem éri el.
    // M-8: a mondat szava mindkét oldalon ráhagyást kap, a szón belüli kötőjelet és az írásjelet is fedi.
    const hyph = (i) => (!sentence && text[i] === '-' ? ink(text, i, 1) : null);
    const rulers = units.map((u) => {
      const before = hyph(u.start - 1), after = hyph(u.end);
      return rulerGeometry({
        left: startX(u), right: endX(u),
        top: lay.top, bottom: lay.bottom, barTop: lay.barY,
        hyphenLeft: before ? before.r : undefined,
        hyphenRight: after ? after.l : undefined,
      }, em);
    });
    return (geo = { units, slices, rulers });
  }

  function drawCovers() {
    const c = mode === 'practice' && st.phase === 'showing' ? st.covered : [];
    if (!c.some(Boolean)) { coverG.replaceChildren(); return; }
    const { rulers } = geometry();
    coverG.replaceChildren(...rulers.flatMap((r, k) => (c[k] ? [rulerNode(r)] : [])));
  }

  // F-P22: test, élvonal, beosztás. Az 1 px-es vonalak a képpontrácsra igazítva.
  const px = (v) => (Math.round(v - 0.5) + 0.5).toFixed(1);
  function rulerNode(r) {
    const g = document.createElementNS(SVG, 'g');
    g.setAttribute('class', 'ruler');
    const body = document.createElementNS(SVG, 'rect');
    body.setAttribute('class', 'ruler-body');
    for (const [k, v] of [['x', r.x], ['y', r.y], ['width', r.w], ['height', r.h], ['rx', r.rx]]) body.setAttribute(k, v.toFixed(1));
    const bevel = document.createElementNS(SVG, 'path');
    bevel.setAttribute('class', 'ruler-bevel');
    bevel.setAttribute('d', `M${(r.x + 1).toFixed(1)} ${px(r.bevelY)}H${(r.x + r.w - 1).toFixed(1)}`);
    const ticks = document.createElementNS(SVG, 'path');
    ticks.setAttribute('class', 'ruler-ticks');
    ticks.setAttribute('d', r.ticks.map((t) => `M${px(t.x)} ${(r.y + 0.5).toFixed(1)}v${t.len.toFixed(1)}`).join(''));
    g.append(body, bevel, ticks);
    return g;
  }

  /** Melyik egység (szótag, mondatban szó) takarási területén van a pont (F-P19, M-8); -1, ha egyiken sem. */
  function unitAt(x, y) {
    if (mode !== 'practice' || st.phase !== 'showing' || curUnits().length < 2) return -1;
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
      ? { x: e.clientX, y: e.clientY, t: performance.now(), mouse } : null;
  });
  // F-P16: érintőképernyőn egy koppintás bárhol = következő (mint a ▶).
  // F-P18/F-P19: többszótagú tételen a szótag területére kattintás/koppintás takar; egérrel máshol semmi.
  // F-P16a: érintéssel (és tollal) balra húzás = következő (▶), jobbra húzás = előző (◀); egérrel nincs.
  //   A húzás sosem takar, akkor sem, ha a tételen indul; a tétel nem követi az ujjat (F-P2).
  el.stage.addEventListener('pointerup', (e) => {
    const p = tapPt; tapPt = null;
    if (!p || mode !== 'practice') return;
    const g = gesture({ dx: e.clientX - p.x, dy: e.clientY - p.y, dt: performance.now() - p.t });
    if (g === 'TAP') {
      const i = unitAt(p.x, p.y);
      if (i >= 0) dispatch('COVER', { i, n: curUnits().length });
      else if (!p.mouse) dispatch('NEXT');
    } else if (g && !p.mouse) dispatch(g);
  });
  el.stage.addEventListener('pointercancel', () => { tapPt = null; });
  const ctl = (btn, fn) => {
    btn.addEventListener('mousedown', (e) => e.preventDefault());
    btn.addEventListener('click', (e) => { e.stopPropagation(); btn.blur(); fn(); showUI(); });
  };
  ctl(el.cClose, exit);
  ctl(el.cPrev, () => (mode === 'find' ? findDispatch('PREV') : dispatch('PREV')));
  ctl(el.cPlay, () => dispatch('PAUSE'));
  ctl(el.cNext, () => (mode === 'find' ? findDispatch('NEXT') : dispatch('NEXT')));

  /* ---------- billentyűk és ablak ---------- */
  function key(e) {
    if (mode === 'find') {
      if (e.code === 'Escape') { e.preventDefault(); exit(); return; }
      if (e.code === 'KeyP' || e.code === 'ArrowDown') { e.preventDefault(); return; }
      if (!FIND_KEYS[e.code]) return;   // Tab, Enter: natív fókusz és jelölés a kártyákon
      e.preventDefault();
      if (!e.repeat) findDispatch(FIND_KEYS[e.code]);
      return;
    }
    if (mode === 'choose' && e.code !== 'Escape') {
      // 12.5b: ← → kiemel, Space / Enter / ↑ indít; a többi gyerek-billentyű elnyelődik, a Tab natív
      if (chooser.key(e) || KID_KEYS[e.code]) e.preventDefault();
      return;
    }
    if (mode === 'reward' && e.code !== 'Escape') {
      // 5a.: a panda a nyilakkal ugrik; a lufiknál a gyerek-billentyűk csak elnyelődnek
      if ((reward.key && reward.key(e)) || KID_KEYS[e.code]) e.preventDefault();
      return;
    }
    if (e.code !== 'Escape' && !KID_KEYS[e.code]) return;
    e.preventDefault();
    if (e.repeat) return;           // egy lenyomás = egy lépés
    if (e.code === 'Escape') exit();
    else dispatch(KID_KEYS[e.code]);
  }
  document.addEventListener('visibilitychange', () => {
    // a Haladás naplójában az elrejtett idő nem olvasási idő (docs/haladas-specifikacio.md, 5.2)
    if (mode === 'practice') progress?.visibility(document.hidden, st.index);
    if (document.hidden) dispatch('BLUR'); else keepAwake();
  });
  addEventListener('blur', () => dispatch('BLUR'));
  addEventListener('resize', () => {
    if (mode === 'practice') { layout(); render(); }
    if (mode === 'find') findView.layout();   // forgatás: az elrendezés vált, a kártyaszám marad (F-K12)
  });

  return { start, startFind, key, get active() { return mode !== 'off'; }, findSizes: () => findView.sizes() };
}
