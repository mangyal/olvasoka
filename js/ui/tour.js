// Első lépések (bemutató): rétegek, buborék, billentyűk és a kihagyás utáni üzenet.
// Spec: docs/bemutato-specifikacio.md. A tiszta logika (szövegek, célelem, elhelyezés) a js/core/tour.js-ben.
//
// A kiemelés két külön, position: fixed réteg a body alatt (3.1): a sötétítés (lyukkal a célelem helyén,
// clip-path) és a gyűrű. Egyetlen box-shadow nem elég, mert a #modeTabs és a #startBtn görgethető
// konténerben van, ami levágná. A lyukon át a célelem kattintható, a sötétítés elnyeli a kattintást.

import { TOUR_STEPS, targetFor, stepContent, SIDES, place, grow, holePath, MARGIN } from '../core/tour.js';

// ugyanaz a feltétel, mint a .only-keys / .only-touch osztályoké (css/admin.css)
const TOUCH = matchMedia('(max-width:600px),(hover:none) and (pointer:coarse)');
const TOAST_MS = 8000;
const TABBABLE = 'button, input, select, textarea, a[href], [tabindex]';

const make = (tag, cls, attrs = {}) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};
const shown = (n) => {
  if (!n) return false;
  const r = n.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};
const tabbable = (n) => n.matches(TABBABLE) && !n.disabled && n.tabIndex >= 0 && !n.closest('[hidden], [inert]') && shown(n);

/**
 * el: a main.js elem-proxyja (#admin, #haladas, #helpBtn és a célelemek).
 * opts.mod: '⌘' vagy 'Ctrl'; opts.minDays(): a haladas.json min_nap értéke;
 * opts.onEnd(how): 'done' | 'skipped' – a tárolás a hívóé.
 */
export function createTour(el, { mod = 'Ctrl', minDays = () => 3, onEnd = () => {} } = {}) {
  let step = 0;                 // 0: nem fut
  let visible = false;          // a rétegek látszanak-e (alsó lap, Haladás nézet alatt nem)
  let targetId = null, target = null;
  let toHaladas = false;        // a 3. lépésből megnyitott Haladás nézet: visszatéréskor a 4. lépés jön
  let frame = 0, toastTimer = 0;

  /* ---------- DOM ---------- */
  const scrim = make('div', 'tour-scrim', { 'aria-hidden': 'true' });
  const ring = make('div', 'tour-ring', { 'aria-hidden': 'true' });
  const bubble = make('div', 'tour-bubble', { role: 'dialog', 'aria-labelledby': 'tourTitle', 'aria-describedby': 'tourText' });
  const arrow = make('span', 'tour-arrow', { 'aria-hidden': 'true' });
  const eyebrow = make('p', 'tour-eyebrow');
  const title = make('h2', 'tour-title', { id: 'tourTitle', tabindex: '-1' });
  const text = make('p', 'tour-text', { id: 'tourText' });
  const dots = make('span', 'tour-dots', { role: 'img' });
  const skipBtn = make('button', 'btn-text tour-skip', { type: 'button', id: 'tourSkip' });
  const nextBtn = make('button', 'btn btn-primary tour-next', { type: 'button', id: 'tourNext' });
  skipBtn.textContent = 'Kihagyom';
  const actions = make('span', 'tour-actions');
  actions.append(skipBtn, nextBtn);
  const foot = make('div', 'tour-foot');
  foot.append(dots, actions);
  bubble.append(arrow, eyebrow, title, text, foot);

  const toast = make('div', 'tour-toast', { role: 'status', id: 'tourToast' });
  const toastArrow = make('span', 'tour-arrow', { 'aria-hidden': 'true' });
  const toastText = make('span', 'tour-toast-text');
  const toastOk = make('button', 'tour-ok', { type: 'button' });
  toastOk.textContent = 'Rendben';
  toast.append(toastArrow, toastText, toastOk);

  for (const n of [scrim, ring, bubble]) n.hidden = true;
  toast.hidden = true;
  document.body.append(scrim, ring, bubble, toast);

  // a sötétítés elnyeli a kattintást, és a fókuszt sem viszi el
  scrim.addEventListener('pointerdown', (e) => e.preventDefault());
  skipBtn.addEventListener('click', () => end('skipped'));
  nextBtn.addEventListener('click', () => (step < TOUR_STEPS ? go(step + 1) : end('done')));
  toastOk.addEventListener('click', hideToast);

  /* ---------- állapot és megjelenítés ---------- */
  /** Alsó lap vagy más dialog nyitva, a Haladás nézet látszik, vagy játék fut: a bemutató elrejtőzik. */
  const blocked = () => el.admin.hidden || !el.haladas.hidden || Boolean(document.querySelector('dialog[open]'));

  function render() {
    const c = stepContent(step, { target: targetId, touch: TOUCH.matches, mod, minDays: minDays() });
    eyebrow.textContent = c.eyebrow;
    title.textContent = c.title;
    text.replaceChildren(...c.lines.flatMap((line, i) => [
      ...(i ? [make('br')] : []),
      ...line.map((p) => {
        if (p.b != null) { const b = make('b'); b.textContent = p.b; return b; }
        if (p.kbd != null) { const k = make('kbd'); k.textContent = p.kbd; return k; }
        return document.createTextNode(p.t);
      }),
    ]));
    dots.setAttribute('aria-label', c.progressLabel);
    dots.replaceChildren(...Array.from({ length: TOUR_STEPS }, (_, i) => make('i', i + 1 === step ? 'cur' : i + 1 < step ? 'past' : '')));
    nextBtn.textContent = c.primary;
  }

  function setVisible(v) {
    visible = v;
    scrim.hidden = !v; bubble.hidden = !v;
    if (!v) ring.hidden = true;
  }

  /** A célelem újrakeresése (az elrendezés válthat), a rétegek és a buborék helye. */
  function layout() {
    const id = targetFor(step, (x) => shown(document.getElementById(x)));
    if (id !== targetId) {
      if (target) ro?.unobserve(target);
      targetId = id; target = id ? document.getElementById(id) : null;
      if (target) ro?.observe(target);
      render();
    }
    const view = { w: document.documentElement.clientWidth || innerWidth, h: innerHeight };
    const margin = view.w < 600 ? 16 : MARGIN;   // telefonon teljes szélesség, 16 px margóval (3.2)
    const size = { w: bubble.offsetWidth, h: bubble.offsetHeight };
    let p;
    if (target) {
      const hole = grow(target.getBoundingClientRect(), 6);
      const radius = Math.max(8, (parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0) + 6);
      scrim.style.clipPath = holePath(view, hole, radius);
      Object.assign(ring.style, {
        left: `${hole.left}px`, top: `${hole.top}px`,
        width: `${hole.right - hole.left}px`, height: `${hole.bottom - hole.top}px`, borderRadius: `${radius}px`,
      });
      ring.hidden = false;
      const phone = shown(el.listsBtn);
      p = place(hole, size, view, SIDES[phone ? 'phone' : 'wide'][step], { margin });
    } else {
      // nincs látható célelem (pl. a listák nem töltődtek be): középen, nyíl nélkül
      scrim.style.clipPath = 'none';
      ring.hidden = true;
      p = { left: Math.max(margin, (view.w - size.w) / 2), top: Math.max(margin, (view.h - size.h) / 2), side: 'none', arrow: 0 };
    }
    bubble.style.left = `${p.left}px`;
    bubble.style.top = `${p.top}px`;
    bubble.dataset.side = p.side;
    bubble.style.setProperty('--arrow', `${p.arrow}px`);
  }

  /** Igazítás az aktuális helyzethez: elrejtés, a Haladás nézetből visszatérés, újraszámolás. */
  function sync() {
    frame = 0;
    if (!step) return;
    if (blocked()) {
      if (step === 3 && !el.haladas.hidden) toHaladas = true;
      if (visible) setVisible(false);
      return;
    }
    if (toHaladas) { toHaladas = false; go(4); return; }
    const appear = !visible;
    if (appear) setVisible(true);
    layout();
    if (appear && !bubble.contains(document.activeElement) && !target?.contains(document.activeElement)) focusTitle();
  }
  const schedule = () => { if (step && !frame) frame = requestAnimationFrame(sync); };

  const focusTitle = () => title.focus({ preventScroll: true });

  function go(n) {
    step = n;
    toHaladas = false;
    targetId = null;            // a célelem és a szöveg újra
    layout();
    target?.scrollIntoView({ block: 'nearest' });
    bubble.classList.remove('tour-in');
    void bubble.offsetWidth;    // az áttűnés újraindítása
    bubble.classList.add('tour-in');
    sync();
    if (visible) focusTitle();
  }

  /* ---------- figyelők ---------- */
  const ro = 'ResizeObserver' in window ? new ResizeObserver(schedule) : null;
  // dialogok nyitása/zárása, a Haladás nézet és a szülői felület rejtése
  const mo = new MutationObserver(schedule);
  const onTouch = () => { if (step) { render(); schedule(); } };

  function listen(on) {
    const f = on ? 'addEventListener' : 'removeEventListener';
    window[f]('resize', schedule);
    window[f]('orientationchange', schedule);
    document[f]('scroll', schedule, true);
    TOUCH[f]('change', onTouch);
    if (on) {
      ro?.observe(bubble);
      ro?.observe(document.documentElement);
      mo.observe(document.body, { attributes: true, attributeFilter: ['open', 'hidden'], subtree: true });
    } else {
      ro?.disconnect();
      mo.disconnect();
    }
  }

  /* ---------- indítás és befejezés ---------- */
  function start() {
    hideToast();
    if (step) { go(1); return; }
    listen(true);
    go(1);
  }

  function end(how) {
    if (!step) return;
    step = 0; targetId = null; target = null; toHaladas = false;
    listen(false);
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    setVisible(false);
    onEnd(how);
    if (how === 'skipped') {
      showToast();
      el.helpBtn.focus({ preventScroll: true });
    }
  }

  /* ---------- kihagyás utáni üzenet (4.4) ---------- */
  function placeToast() {
    if (toast.hidden) return;
    const r = el.helpBtn.getBoundingClientRect();
    const vw = document.documentElement.clientWidth || innerWidth;
    const w = toast.offsetWidth, margin = vw < 600 ? 16 : MARGIN;
    const cx = r.left + r.width / 2;
    const left = Math.max(margin, Math.min(vw - margin - w, cx - w / 2));
    toast.style.left = `${Math.round(left)}px`;
    toast.style.top = `${Math.round(r.bottom + 10)}px`;
    toast.style.setProperty('--arrow', `${Math.round(Math.max(20, Math.min(w - 20, cx - left)))}px`);
  }
  function showToast() {
    toastText.textContent = 'A bemutatót a Súgóban bármikor újra elindíthatod.';
    toast.hidden = false;
    placeToast();
    addEventListener('resize', placeToast);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, TOAST_MS);
  }
  function hideToast() {
    clearTimeout(toastTimer);
    if (toast.hidden) return;
    toast.hidden = true;
    toastText.textContent = '';
    removeEventListener('resize', placeToast);
  }

  /* ---------- billentyűk ---------- */
  /** A main.js billentyűkezelője hívja elsőként a szülői felületen; true: a bemutató kezelte. */
  function key(e) {
    if (!step || !visible) return false;      // rejtve (alsó lap, Haladás) a billentyű az övék
    if (e.key === 'Escape') {
      if (document.querySelector('dialog[open]')) return false;
      e.preventDefault();
      end('skipped');
      return true;
    }
    if (e.key === 'Tab') {
      // körbejár a buborék gombjai és a célelem vezérlői között (6.)
      const inTarget = target ? [target, ...target.querySelectorAll(TABBABLE)].filter(tabbable) : [];
      const order = [skipBtn, nextBtn, ...inTarget];
      const i = order.indexOf(document.activeElement);
      const n = i < 0 ? (e.shiftKey ? order.length - 1 : 0) : (i + (e.shiftKey ? -1 : 1) + order.length) % order.length;
      e.preventDefault();
      order[n].focus();
      return true;
    }
    // nyilak: csak ha a fókusz a buborékban van; a célelemen (pl. a játékfüleken) a saját jelentésük marad
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey
        && bubble.contains(document.activeElement)) {
      e.preventDefault();
      if (e.key === 'ArrowRight' && step < TOUR_STEPS) go(step + 1);
      if (e.key === 'ArrowLeft' && step > 1) go(step - 1);
      return true;
    }
    return false;
  }

  return {
    get active() { return step > 0; },
    get step() { return step; },
    start,
    key,
    /** A játék elindult a bemutató közben: egyenértékű a Kész gombbal (4.2). */
    gameStarted() { if (step) end('done'); },
    /** A szöveg függ külső adattól (haladas.json): újrarajzolás. */
    refresh() { if (step) { render(); schedule(); } },
  };
}
