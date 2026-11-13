// Panda-ugrálás jutalomjáték (spec 5a., 12.5a), hang nélkül.
// Egy szemből látott panda bambuszpadokon ugrál felfelé a célig (←/↑/→ vagy koppintás a panda
// mellé/fölé). Ha két pad közé ugrik, leesik: a játék csendben véget ér, büntetés és újrakezdés nincs.
// A pálya és a mozgás tiszta modellje: js/core/hop.js.

import { geometry, makeCourse, placeCourse, needDir, jump, stepJump, landing, cameraFor, fellOut } from '../core/hop.js';
import { confetti, CONFETTI_MS } from './confetti.js';

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const KEYS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: 0, Space: 0 };
const DARK = '#2F3A40';

// Szemből látott panda; a talp a (50, 108) pontban. A kar, a szem és a mosoly CSS-ből vált (U-J2).
export const PANDA_SVG =
  `<svg viewBox="0 0 100 110" aria-hidden="true">` +
    `<circle cx="22" cy="19" r="12.5" fill="${DARK}"/><circle cx="78" cy="19" r="12.5" fill="${DARK}"/>` +
    `<circle cx="22" cy="19" r="6" fill="#4C5A62"/><circle cx="78" cy="19" r="6" fill="#4C5A62"/>` +
    `<ellipse class="leg l" cx="36" cy="100" rx="11.5" ry="8.5" fill="${DARK}"/>` +
    `<ellipse class="leg r" cx="64" cy="100" rx="11.5" ry="8.5" fill="${DARK}"/>` +
    `<ellipse cx="50" cy="80" rx="27" ry="23" fill="#FFFFFF" stroke="#E1D9CB" stroke-width="1.5"/>` +
    `<ellipse cx="50" cy="85" rx="15" ry="12" fill="#F6F1E8"/>` +
    `<g class="arm l"><ellipse cx="27" cy="80" rx="8.5" ry="14" fill="${DARK}" transform="rotate(22 27 80)"/></g>` +
    `<g class="arm r"><ellipse cx="73" cy="80" rx="8.5" ry="14" fill="${DARK}" transform="rotate(-22 73 80)"/></g>` +
    `<ellipse cx="50" cy="43" rx="36" ry="31" fill="#FFFFFF" stroke="#E1D9CB" stroke-width="1.5"/>` +
    `<ellipse cx="35.5" cy="45" rx="9.5" ry="12.5" fill="${DARK}" transform="rotate(28 35.5 45)"/>` +
    `<ellipse cx="64.5" cy="45" rx="9.5" ry="12.5" fill="${DARK}" transform="rotate(-28 64.5 45)"/>` +
    `<g class="eyes"><circle cx="37" cy="43" r="4.4" fill="#FFFFFF"/><circle cx="63" cy="43" r="4.4" fill="#FFFFFF"/>` +
      `<circle cx="37.6" cy="43.6" r="2.7" fill="${DARK}"/><circle cx="62.4" cy="43.6" r="2.7" fill="${DARK}"/>` +
      `<circle cx="38.6" cy="42.3" r="1" fill="#FFFFFF"/><circle cx="63.4" cy="42.3" r="1" fill="#FFFFFF"/></g>` +
    `<g class="happy-eyes" fill="none" stroke="#FFFFFF" stroke-width="2.6" stroke-linecap="round">` +
      `<path d="M32.5 45.5q4.5-6 9 0"/><path d="M58.5 45.5q4.5-6 9 0"/></g>` +
    `<ellipse cx="23" cy="56" rx="6.5" ry="4" fill="#F2B5A7" fill-opacity=".8"/>` +
    `<ellipse cx="77" cy="56" rx="6.5" ry="4" fill="#F2B5A7" fill-opacity=".8"/>` +
    `<path d="M45.5 54h9q0 4.6-4.5 5.6q-4.5-1-4.5-5.6z" fill="${DARK}"/>` +
    `<path class="mouth" d="M44 62.5q3 3 6 0q3 3 6 0" fill="none" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>` +
    `<path class="mouth-open" d="M45 61.5q5 7.5 10 0z" fill="#C8605A" stroke="${DARK}" stroke-width="1.6" stroke-linejoin="round"/>` +
  `</svg>`;

// Bambuszpad (U-J3): a viewBox aránya egyezik a pad arányával (1,6 P × 0,3 P).
export const padSVG = (goal) => {
  const [body, joint, hi] = goal ? ['#F5D58F', '#D9B65E', '#FFFFFF'] : ['#B5D5BB', '#8DBE97', '#FFFFFF'];
  return `<svg viewBox="0 0 160 30" aria-hidden="true">` +
    `<rect x="0" y="2" width="160" height="26" rx="13" fill="${body}"/>` +
    `<rect x="4" y="20" width="152" height="8" rx="4" fill="${joint}" fill-opacity=".45"/>` +
    `<rect x="12" y="7" width="136" height="5" rx="2.5" fill="${hi}" fill-opacity=".4"/>` +
    `<rect x="52" y="2" width="3.5" height="26" fill="${joint}"/><rect x="105" y="2" width="3.5" height="26" fill="${joint}"/>` +
    (goal ? '' : `<path d="M132 4q8-15 24-15q-6 13-24 15z" fill="${joint}"/>`) +
  `</svg>`;
};

// A cél díszei (U-J4): bambuszszárak levelekkel a cél pad mögött.
const GOAL_SVG =
  `<svg viewBox="0 0 160 120" aria-hidden="true">` +
    `<g fill="#8DBE97"><rect x="14" y="20" width="10" height="100" rx="5"/><rect x="136" y="34" width="10" height="86" rx="5"/>` +
    `<rect x="122" y="60" width="8" height="60" rx="4"/></g>` +
    `<g fill="#6FA97C"><rect x="14" y="52" width="10" height="3"/><rect x="14" y="86" width="10" height="3"/>` +
    `<rect x="136" y="66" width="10" height="3"/><rect x="136" y="96" width="10" height="3"/><rect x="122" y="88" width="8" height="3"/></g>` +
    `<g class="leaves" fill="#B5D5BB"><path d="M24 30q18-14 34-6q-18 12-34 6z"/><path d="M14 44q-14-16-12-30q14 12 12 30z"/>` +
    `<path d="M136 42q-18-16-34-8q16 14 34 8z"/><path d="M146 50q16-10 14-26q-14 8-14 26z"/></g>` +
  `</svg>`;

const CLOUD = `<svg viewBox="0 0 120 50" aria-hidden="true"><path d="M20 46q-18 0-18-14q0-13 16-14q4-14 20-14q12 0 18 9q6-7 16-5q14 2 16 15q16 0 20 11q3 12-14 12z" fill="#FFFFFF"/></svg>`;

export function createPandaReward({ stage, layerEl, particlesEl, countEl, onDone }) {
  let active = false, timers = [], raf = 0, stopConfetti = null;
  let root = null, world = null, clouds = [], pandaEl = null, hintEl = null;
  let g = null, course = null, pads = [], padEls = [];
  let state = 'off';            // 'intro' | 'stand' | 'air' | 'won' | 'out'
  let cur = 0, best = 0, j = null, cam = 0, camGoal = 0, spin = 0, lean = 0, relayout = false, falling = false;
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const showCount = () => { if (countEl) countEl.textContent = state === 'off' ? '' : `${best}/${pads.length - 1}`; };

  /** @param {{ skipSky?: boolean }} [o]  skipSky: a választó után a háttér már ég, nincs mire várni */
  function start({ skipSky = false } = {}) {
    active = true;
    void stage.offsetWidth;
    stage.classList.add('sky');                       // mint a lufiknál: papír → ég, 1,8 s
    later(reduced() || skipSky ? 0 : 1800, build);
  }

  function stop() {
    active = false; state = 'off';
    timers.forEach(clearTimeout); timers = [];
    cancelAnimationFrame(raf); raf = 0;
    if (stopConfetti) { stopConfetti(); stopConfetti = null; }
    if (root) { root.remove(); root = null; }
    particlesEl.replaceChildren();
    clouds = []; pads = []; padEls = [];
    showCount();
  }

  /* ---------- felépítés ---------- */
  function build() {
    if (!active) return;
    g = geometry({ W: innerWidth, H: innerHeight });
    course = makeCourse(g);
    root = document.createElement('div');
    root.className = 'hop';
    root.style.setProperty('--P', `${g.P}px`);
    world = document.createElement('div');
    world.className = 'hop-world';
    clouds = Array.from({ length: 5 }, (_, i) => {
      const c = document.createElement('div');
      c.className = 'hop-cloud'; c.innerHTML = CLOUD;
      const w = 90 + Math.random() * 90;
      c.style.width = `${w.toFixed(0)}px`;
      root.append(c);
      return { el: c, fx: (i + 0.2 + Math.random() * 0.6) / 5, fy: Math.random(), w };
    });
    root.append(world);
    layerEl.after(root);
    padEls = course.map((_, k) => {
      const goal = k === course.length - 1;
      const p = document.createElement('div');
      p.className = 'hop-pad' + (goal ? ' goal' : '');
      p.innerHTML = (goal ? `<div class="hop-goal">${GOAL_SVG}</div>` : '') + padSVG(goal);
      p.style.animationDelay = `${k * 70}ms`;
      world.append(p);
      return p;
    });
    hintEl = document.createElement('div');
    hintEl.className = 'hop-hint';
    hintEl.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="icon" d="M9 5l7 7-7 7"/></svg>';
    world.append(hintEl);
    pandaEl = document.createElement('div');
    pandaEl.className = 'hop-panda';
    pandaEl.innerHTML = `<div class="squash">${PANDA_SVG}</div>`;
    world.append(pandaEl);
    cur = best = 0; falling = false; spin = 0;
    layout();
    cam = camGoal;
    // a panda felülről a kiinduló padra pottyan
    if (reduced()) land(0);
    else {
      state = 'intro';
      j = { x: pads[0].x, y: pads[0].y - g.H * 0.75, vx: 0, vy: 0, g: jump(pads[0], null, 0, g).g, to: pads[0] };
      pandaEl.classList.add('air');
    }
    showCount();
    place();
    let last = 0;
    const frame = (now) => {
      if (!active) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      tick(dt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  /** Méretek és helyek a képernyőhöz; a pálya (fx) marad, elforgatáskor csak átméreteződik. */
  function layout() {
    g = geometry({ W: innerWidth, H: innerHeight });
    root.style.setProperty('--P', `${g.P}px`);
    pads = placeCourse(course, g);
    pads.forEach((p, k) => {
      Object.assign(padEls[k].style, { left: `${(p.x - g.w / 2).toFixed(1)}px`, top: `${(p.y - g.h * 0.1).toFixed(1)}px`, width: `${g.w}px`, height: `${g.h}px` });
    });
    camGoal = cameraFor(pads[cur].y, pads[pads.length - 1].y, g);
  }

  /* ---------- játékmenet ---------- */
  function tick(dt) {
    if (state === 'intro' || state === 'air') {
      const n = stepJump(j, dt);
      const k = landing(j, n, state === 'intro' ? [pads[0]] : pads, g);
      if (k >= 0) land(k);
      else {
        j = n;
        // két pad közé ugrott: pörögve esik; egy lejjebb lévő padon még megállhat (F-J6)
        if (state === 'air' && !falling && j.vy > 0 && j.y > pads[cur].y + g.P * 0.5) { falling = true; pandaEl.classList.add('falling'); }
        if (falling) spin += dt * 140 * (Math.sign(j.vx) || 1);
        if (fellOut(j, cam, g)) { state = 'out'; pandaEl.hidden = true; finish(false); }
      }
    }
    const k = 1 - Math.exp(-4 * dt);
    if (!falling && state !== 'out') cam += (camGoal - cam) * k;
    lean += ((state === 'air' && j ? Math.max(-10, Math.min(10, j.vx / 40)) : 0) - lean) * (1 - Math.exp(-12 * dt));
    place();
  }

  function input(dir) {
    if (!active || state !== 'stand') return;
    hintEl.classList.remove('on');
    const next = pads[cur + 1] || null;
    const jmp = jump(pads[cur], next, dir, g);
    if (reduced()) {                                   // csökkentett mozgás: azonnal az eredmény
      let a = jmp;
      for (let i = 0; i < 600; i++) {
        const n = stepJump(a, 1 / 60), k = landing(a, n, pads, g);
        if (k >= 0) { land(k); return; }
        if (fellOut(n, cam, g)) break;
        a = n;
      }
      state = 'out'; pandaEl.hidden = true; finish(false); return;
    }
    j = jmp; state = 'air';
    pandaEl.classList.add('air'); pandaEl.classList.remove('landed');
  }

  function land(k) {
    cur = k; best = Math.max(best, k); state = 'stand';
    j = null; falling = false; spin = 0;
    pandaEl.classList.remove('air', 'falling');
    if (!reduced()) { pandaEl.classList.remove('landed'); void pandaEl.offsetWidth; pandaEl.classList.add('landed'); dust(pads[k]); }
    if (relayout) { relayout = false; layout(); }
    camGoal = cameraFor(pads[k].y, pads[pads.length - 1].y, g);
    if (reduced()) cam = camGoal;
    showCount();
    if (k === pads.length - 1) { win(); return; }
    // U-J5: az első ugrás előtt halvány nyíl mutatja az irányt
    if (best === 0) hint();
  }

  function hint() {
    const d = needDir(pads[cur].x, pads[cur + 1], g.P);
    const sz = Math.max(24, Math.min(40, g.P * 0.4));
    // oldalra: a panda mellett, derékmagasságban; fel: a feje és a fölötte lévő pad között
    const cx = pads[cur].x + d * g.P * 0.95, cy = pads[cur].y - (d ? g.P * 0.55 : (g.P * 1.1 + g.S) / 2);
    Object.assign(hintEl.style, { width: `${sz}px`, height: `${sz}px`, left: `${(cx - sz / 2).toFixed(1)}px`, top: `${(cy - sz / 2).toFixed(1)}px` });
    hintEl.style.setProperty('--rot', `${d * 90 - 90}deg`);
    later(reduced() ? 0 : 500, () => { if (state === 'stand' && best === 0) hintEl.classList.add('on'); });
  }

  function win() {
    state = 'won';
    pandaEl.classList.add('happy');
    stopConfetti = confetti(particlesEl);
    later(CONFETTI_MS, () => finish(true));
  }

  // F-J7/F-J8: a cél után a konfetti végén, leesés után kis szünettel; mindkettő csendben vissza
  function finish(won) {
    later(won ? 0 : 500, () => {
      if (!active) return;
      stage.classList.add('back'); stage.classList.remove('sky');
      if (root) root.classList.add('fade');
      later(reduced() ? 0 : 600, onDone);
    });
  }

  function dust(p) {
    for (let i = 0; i < 6; i++) {
      const d = document.createElement('div');
      const sz = 5 + Math.random() * 4, side = i % 2 ? 1 : -1;
      d.className = 'hop-dust';
      d.style.cssText = `width:${sz}px;height:${sz}px;left:${(p.x + side * g.P * 0.25 - sz / 2).toFixed(1)}px;top:${(p.y - sz).toFixed(1)}px`;
      world.append(d);
      d.animate(
        [{ transform: 'translate(0,0)', opacity: 0.9 }, { transform: `translate(${side * (18 + Math.random() * 22)}px,${-6 - Math.random() * 10}px)`, opacity: 0 }],
        { duration: 380, easing: 'ease-out', fill: 'forwards' },
      ).onfinish = () => d.remove();
    }
  }

  /* ---------- rajzolás ---------- */
  function place() {
    if (!world) return;
    world.style.transform = `translateY(${(-cam).toFixed(1)}px)`;
    for (const c of clouds) {                         // lassabban mozog: mélység
      const y = (c.fy * g.H * 0.8 - cam * 0.35) % (g.H + 120);
      c.el.style.transform = `translate(${(c.fx * g.W - c.w / 2).toFixed(1)}px,${(y - 60).toFixed(1)}px)`;
    }
    const p = j || pads[cur];
    const rot = falling ? spin : lean;
    pandaEl.style.transform = `translate(${(p.x - g.P / 2).toFixed(1)}px,${(p.y - g.P * 1.1).toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
  }

  /* ---------- bemenet ---------- */
  // F-J3: koppintás/kattintás a panda bal vagy jobb oldalára oldalra, fölé vagy rá: fel
  function pointerDown(e) {
    if (!active || !pandaEl || e.target.closest('.cbtn')) return;
    e.preventDefault();
    const r = pandaEl.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    input(Math.abs(dx) < g.P * 0.6 ? 0 : Math.sign(dx));
  }

  /** @returns {boolean} a játék kezelte-e a billentyűt */
  function key(e) {
    if (!(e.code in KEYS)) return false;
    if (!e.repeat) input(KEYS[e.code]);
    return true;
  }

  addEventListener('resize', () => {
    if (!active || !root || state === 'won' || state === 'out') return;
    if (state === 'stand') { layout(); cam = camGoal; place(); }
    else relayout = true;
  });

  return { start, stop, pointerDown, key };
}
