// Jutalomnézet (spec 5., 12.6): lufipukkasztás, hang nélkül.

import { shuffledIdx } from '../core/sequence.js';

const COLORS = ['#F2B5A7', '#F5D58F', '#B5D5BB', '#A7C8E0', '#CBB8DE', '#EFC2D3'];
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createReward({ stage, balloonsEl, particlesEl, onDone }) {
  let timers = [], balloons = [], active = false;
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  function start() {
    active = true;
    void stage.offsetWidth;
    stage.classList.add('sky');                       // U-R1: háttér papír → ég, 1,8 s
    later(reduced() ? 0 : 1800, spawn);
  }

  function stop() {
    active = false;
    timers.forEach(clearTimeout); timers = [];
    balloons = []; balloonsEl.replaceChildren(); particlesEl.replaceChildren();
  }

  function spawn() {
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
      node.innerHTML =
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
      balloonsEl.append(node);
      return { node, target: node.querySelector('.pop-target'), hit: node.querySelector('.hit'), color, popped: false };
    });
  }

  // F-R3/F-R4: pointerdown, ~20%-kal nagyobb ellipszis, csak a legfelső lufi pukkan
  function pointerDown(e) {
    if (!active) return;
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
    if (balloons.every((x) => x.popped)) {
      later(1200, () => {                             // U-R5: csend, majd vissza papírszínre
        stage.classList.add('back'); stage.classList.remove('sky');
        later(reduced() ? 0 : 600, onDone);
      });
    }
  }

  return { start, stop, pointerDown };
}
