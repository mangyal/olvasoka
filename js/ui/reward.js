// Jutalomnézet (spec 5., 12.5): lufipukkasztás, hang nélkül.
// A lufik felszállnak, a hőlégfúvó szele oldalra sodorja őket (F-R8–F-R11, core/drift.js).
// Csökkentett mozgásnál a régi, helyben lebegő elrendezés marad.

import { shuffledIdx } from '../core/sequence.js';
import { launch, stepBalloon, isOut, nozzle } from '../core/drift.js';
import { confetti, CONFETTI_MS } from './confetti.js';

export const COLORS = ['#F2B5A7', '#F5D58F', '#B5D5BB', '#A7C8E0', '#CBB8DE', '#EFC2D3'];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const BLOWER = 128;                                   // px
const ENTRY_MS = 2500;                                // ennyi idő alatt jön be az összes lufi
const TILT = 12;                                      // a fúvó ennyi fokkal fordul felfelé

const balloonHTML = (bw, bh, color, period) =>
  `<div class="bob" style="--dur:${(period / 2).toFixed(2)}s;--delay:-${(Math.random() * period).toFixed(2)}s">` +
    `<div class="pop-target">` +
      `<svg viewBox="0 0 100 190" width="${bw.toFixed(1)}" height="${(bw * 1.9).toFixed(1)}" aria-hidden="true">` +
        `<path d="M50 129c-6 16 6 30-1 58" fill="none" stroke="var(--ink)" stroke-opacity=".25" stroke-width="1" vector-effect="non-scaling-stroke"/>` +
        `<path d="M44 131L50 120L56 131Z" fill="${color}"/>` +
        `<ellipse cx="50" cy="61" rx="50" ry="61" fill="${color}"/>` +
        `<ellipse cx="30" cy="34" rx="9" ry="15" fill="#ffffff" fill-opacity=".25" transform="rotate(-28 30 34)"/>` +
      `</svg>` +
      `<div class="hit" style="height:${bh.toFixed(1)}px"></div>` +
    `</div>` +
  `</div>`;

// A választó kártyájának lufija (12.5b): ugyanaz a rajz, méret nélkül, a dobozt kitölti.
export const balloonArt = (color) =>
  `<svg viewBox="0 0 100 190" aria-hidden="true">` +
    `<path d="M50 129c-6 16 6 30-1 58" fill="none" stroke="var(--ink)" stroke-opacity=".25" stroke-width="1.5"/>` +
    `<path d="M44 131L50 120L56 131Z" fill="${color}"/>` +
    `<ellipse cx="50" cy="61" rx="50" ry="61" fill="${color}"/>` +
    `<ellipse cx="30" cy="34" rx="9" ry="15" fill="#ffffff" fill-opacity=".25" transform="rotate(-28 30 34)"/>` +
  `</svg>`;

export function createReward({ stage, balloonsEl, particlesEl, countEl, onDone }) {
  let timers = [], balloons = [], active = false, raf = 0, cf = null, wf = 0, blower = null, wind = null, windCv = null;
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const showCount = () => {
    if (countEl) countEl.textContent = balloons.length ? `${balloons.filter((b) => b.popped).length}/${balloons.length}` : '';
  };

  /** @param {{ skipSky?: boolean }} [o]  skipSky: a választó után a háttér már ég, nincs mire várni */
  function start({ skipSky = false } = {}) {
    active = true;
    void stage.offsetWidth;
    stage.classList.add('sky');                       // U-R1: háttér papír → ég, 1,8 s
    placeBlower(skipSky);
    later(reduced() || skipSky ? 0 : 1800, reduced() ? spawnStatic : spawnFlying);
  }

  function stop() {
    active = false;
    timers.forEach(clearTimeout); timers = [];
    cancelAnimationFrame(raf); raf = 0;
    if (cf) { cf(); cf = null; }
    cancelAnimationFrame(wf); wf = 0;
    if (blower) { blower.remove(); blower = null; }
    if (windCv) { windCv.remove(); windCv = null; }
    balloons = []; balloonsEl.replaceChildren(); particlesEl.replaceChildren();
    showCount();
  }

  // F-R8: hőlégfúvó véletlenül bal vagy jobb oldalt, az alsó harmadban, kicsit felfelé fordítva.
  // Az SVG balra fúj; bal oldalon tükrözve jobbra.
  function placeBlower(skipSky) {
    const left = Math.random() < 0.5;
    blower = document.createElement('img');
    blower.src = 'img/hoslegfuvo.svg'; blower.alt = ''; blower.className = 'blower ' + (left ? 'left' : 'right');
    blower.width = blower.height = BLOWER; blower.draggable = false;
    blower.style.setProperty('--tilt', `${TILT}deg`);
    // az ég már kész: a fúvó késleltetés nélkül, de ugyanúgy beúszik (nem ugrik be)
    if (skipSky) { blower.style.transitionDelay = '0s'; blower.style.opacity = '0'; }
    stage.insertBefore(blower, balloonsEl);
    if (skipSky) { void blower.offsetWidth; blower.style.opacity = ''; }
    wind = { dir: left ? 1 : -1 };
  }
  const env = () => {
    const W = innerWidth, H = innerHeight;
    return { W, H, dir: wind.dir, blowerY: H * (5 / 6) };
  };

  // F-R9: alulról, elcsúsztatva úsznak be, felszállnak, a szél sodorja őket; kimenve alul visszajönnek
  // F-R13: halvány szélcsíkok a fúvócsőből a szél irányába, a távolsággal elhalványulva.
  // Csak díszítés: a lufik mozgását a drift.js szele adja, ugyanebbe az irányba.
  function windStreaks() {
    windCv = document.createElement('canvas');
    windCv.className = 'wind';
    stage.insertBefore(windCv, balloonsEl);
    const g = windCv.getContext('2d');
    const rnd = (a, b) => a + Math.random() * (b - a);
    let streaks = [], last = 0, acc = 0, W = 0, H = 0, dpr = 1;
    const frame = (now) => {
      if (!active || !windCv) return;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0; last = now;
      if (W !== innerWidth || H !== innerHeight) {
        W = innerWidth; H = innerHeight; dpr = Math.min(2, devicePixelRatio || 1);
        windCv.width = W * dpr; windCv.height = H * dpr; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      const n = nozzle({ left: wind.dir > 0, x: blower.offsetLeft, y: blower.offsetTop, size: BLOWER, tilt: TILT });
      const reach = W * 0.55;                        // eddig látszik a szél
      for (acc += dt * 22; acc >= 1; acc--) {         // ~22 csík / mp
        const spread = rnd(-0.22, 0.22);              // ±12° legyező
        const c = Math.cos(spread), s = Math.sin(spread);
        streaks.push({ x: n.x, y: n.y + rnd(-6, 6), dx: n.dx * c - n.dy * s, dy: n.dx * s + n.dy * c,
          v: rnd(260, 380), len: rnd(18, 42), d: 0, ph: rnd(0, 6.3), w: rnd(1.5, 3) });
      }
      g.clearRect(0, 0, W, H);
      g.lineCap = 'round';
      streaks = streaks.filter((k) => {
        k.v = Math.max(90, k.v * (1 - 0.9 * dt));       // lassul, ahogy távolodik
        k.d += k.v * dt;
        const f = k.d / reach;
        if (f >= 1) return false;
        const wob = Math.sin(k.ph + k.d * 0.025) * 6 * f;   // kis hullámzás
        const x = k.x + k.dx * k.d - k.dy * wob, y = k.y + k.dy * k.d + k.dx * wob;
        const a = Math.min(1, k.d / 40) * (1 - f) * 0.55;    // a cső előtt beúszik, távol elhalványul
        g.strokeStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        g.lineWidth = k.w;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - k.dx * k.len, y - k.dy * k.len); g.stroke();
        return true;
      });
      wf = requestAnimationFrame(frame);
    };
    wf = requestAnimationFrame(frame);
  }

  function spawnFlying() {
    if (!active) return;
    windStreaks();
    const { W, H } = env();
    // F-R9: kis képernyőn kevesebb és kisebb lufi, hogy ne takarják egymást
    const fit = Math.min(1, (W * H) / (1366 * 768));
    const n = Math.max(6, Math.round((10 + Math.random() * 5) * fit));
    const minDim = Math.min(W, H);
    const bwMax = Math.min(140, minDim * 0.26), bwMin = Math.min(90, minDim * 0.2);
    const palette = shuffledIdx(COLORS.length).map((i) => COLORS[i]);
    balloons = Array.from({ length: n }, (_, i) => {
      const bw = bwMin + Math.random() * (bwMax - bwMin), bh = bw / 0.82;
      const color = palette[i % palette.length];
      const node = document.createElement('div');
      node.className = 'balloon free';
      node.style.width = `${bw.toFixed(1)}px`;
      node.innerHTML = balloonHTML(bw, bh, color, 4 + Math.random() * 3);
      balloonsEl.append(node);
      const b = { node, target: node.querySelector('.pop-target'), hit: node.querySelector('.hit'), color, popped: false,
        bw, bh, wakeAt: (i / n) * ENTRY_MS / 1000, s: launch({ W, H, bw, bh, dir: wind.dir, spread: 0.35 }) };
      place(b);
      return b;
    });
    showCount();
    let t0 = 0, last = 0;
    const frame = (now) => {
      if (!active) return;
      if (!t0) { t0 = last = now; }
      const dt = Math.min(0.05, (now - last) / 1000), t = (now - t0) / 1000; last = now;
      const e = env();
      for (const b of balloons) {
        if (b.popped || t < b.wakeAt) continue;
        b.s = stepBalloon(b.s, dt, t, e);
        if (isOut(b.s, { W: e.W, bw: b.bw, bh: b.bh })) b.s = launch({ W: e.W, H: e.H, bw: b.bw, bh: b.bh, dir: e.dir });
        place(b);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  function place(b) {
    const { x, y, vx } = b.s;
    const lean = Math.max(-8, Math.min(8, vx / 6));   // a szél kicsit megdönti
    b.node.style.transform = `translate(${(x - b.bw / 2).toFixed(1)}px,${(y - b.bh / 2).toFixed(1)}px) rotate(${lean.toFixed(1)}deg)`;
  }

  function spawnStatic() {
    if (!active) return;
    const W = innerWidth, H = innerHeight, m = 24;
    let n = 10 + Math.floor(Math.random() * 6);       // F-R2: 10–15 lufi
    const uw = W - 2 * m, uh = H - 2 * m, want = n + 5;
    const cols = Math.max(3, Math.ceil(Math.sqrt(want * uw / uh)));
    const rows = Math.max(2, Math.ceil(want / cols));
    const cw = uw / cols, ch = uh / rows;
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x0 = m + c * cw, y0 = m + r * ch;
      if (x0 < 120 && y0 < 120) continue;             // a ✕ környéke szabadon marad
      cells.push({ x0, y0 });
    }
    const picks = shuffledIdx(cells.length).slice(0, n).map((i) => cells[i]);
    const palette = shuffledIdx(COLORS.length).map((i) => COLORS[i]);
    const maxBw = Math.max(90, Math.min(140, cw * 0.92, ch * 0.92 * 0.82));
    balloons = picks.map((cell, i) => {
      const bw = 90 + Math.random() * (maxBw - 90), bh = bw / 0.82;
      const cx = cell.x0 + cw / 2 + (Math.random() - 0.5) * Math.max(0, cw - bw) * 0.8;
      const cy = cell.y0 + ch / 2 + (Math.random() - 0.5) * Math.max(0, ch - bh) * 0.8;
      const color = palette[i % palette.length];
      const period = 4 + Math.random() * 3;
      const node = document.createElement('div');
      node.className = 'balloon';
      node.style.cssText = `left:${(cx - bw / 2).toFixed(1)}px;top:${(cy - bh / 2).toFixed(1)}px;width:${bw.toFixed(1)}px;animation-delay:${i * 80}ms`;
      node.innerHTML = balloonHTML(bw, bh, color, period);
      balloonsEl.append(node);
      return { node, target: node.querySelector('.pop-target'), hit: node.querySelector('.hit'), color, popped: false };
    });
    showCount();
  }

  // F-R3/F-R4: pointerdown, ~20%-kal nagyobb ellipszis, csak a legfelső lufi pukkan
  function pointerDown(e) {
    if (!active || e.target.closest('.cbtn')) return;
    e.preventDefault();
    for (let i = balloons.length - 1; i >= 0; i--) {
      const b = balloons[i]; if (b.popped) continue;
      const r = b.hit.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const rx = (r.width / 2) * 1.2, ry = (r.height / 2) * 1.2;
      if (((e.clientX - cx) / rx) ** 2 + ((e.clientY - cy) / ry) ** 2 <= 1) { pop(b, cx, cy); return; }
    }
  }

  function pop(b, cx, cy) {
    b.popped = true;
    if (reduced()) b.node.remove();
    else {
      b.target.classList.add('popping');
      setTimeout(() => b.node.remove(), 130);
      const k = 6 + Math.floor(Math.random() * 3);
      for (let j = 0; j < k; j++) {
        const p = document.createElement('div');
        const sz = 7 + Math.random() * 5;
        p.className = 'particle';
        p.style.cssText = `width:${sz}px;height:${sz}px;left:${cx - sz / 2}px;top:${cy - sz / 2}px;background:${b.color}`;
        particlesEl.append(p);
        const ang = (j / k) * Math.PI * 2 + Math.random() * 0.6, dist = 30 + Math.random() * 30;
        p.animate(
          [{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(ang) * dist}px,${Math.sin(ang) * dist}px)`, opacity: 0 }],
          { duration: 450, easing: 'ease-out', fill: 'forwards' },
        ).onfinish = () => p.remove();
      }
    }
    showCount();
    if (balloons.every((x) => x.popped)) {
      cancelAnimationFrame(raf); raf = 0;
      cf = confetti(particlesEl);                     // F-R5: 3 mp konfettieső, majd vissza papírszínre
      later(CONFETTI_MS, () => {
        stage.classList.add('back'); stage.classList.remove('sky');
        cancelAnimationFrame(wf); wf = 0; if (windCv) windCv.style.opacity = '0';
        later(reduced() ? 0 : 600, onDone);
      });
    }
  }

  return { start, stop, pointerDown };
}
