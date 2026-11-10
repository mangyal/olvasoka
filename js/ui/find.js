// Keresd meg! nézet rajzolása (spec 4a.3, 12.4a): a kártyák rácsa, a jelölés, a betűméret.
// A lépés-logika a core/find.js-ben van; ez a modul csak rajzol és a kártya-koppintást továbbadja.

import { gridShape } from '../core/find.js';
import { FONT_STACK } from '../font.js';

const PHONE = 500;                  // a rövidebb oldal ez alatt: telefon (F-K10, U-K2)

/** A rács területe a nézet méretéből (U-K2, U-K4, U-K5). */
function area(vw, vh) {
  const phone = Math.min(vw, vh) < PHONE;
  const sideNav = vh <= 500 && vw > vh;          // mobil fekvő: a nyilak a rács két oldalán
  const gap = phone ? 12 : 28;
  const top = sideNav ? 68 : phone ? 84 : 96;
  const bottom = sideNav ? 20 : phone ? 104 : 108;
  const side = sideNav ? 100 : phone ? 16 : 32;
  const maxW = phone ? Infinity : 1040;
  const w = Math.min(maxW, vw - 2 * side);
  return { left: (vw - w) / 2, top, w, h: Math.max(80, vh - top - bottom), gap };
}

/**
 * @param {{ grid: HTMLElement }} el
 * @param {{ onMark: (i:number) => void }} cb
 */
export function createFindView(el, { onMark }) {
  const measure = document.createElement('canvas').getContext('2d');
  let cards = [], shown = null, shapeN = 4;

  /** A rács felépítése egy feladathoz; a beállított kártyaszám (n) adja az elrendezést (F-K12). */
  function show(items, n) {
    shown = items; shapeN = n;
    cards = items.map((t, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'card';
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', t);
      const s = document.createElement('span'); s.className = 'card-text'; s.textContent = t;
      s.setAttribute('aria-hidden', 'true');
      b.append(s);
      // egérrel ne vigye el a fókuszt (a Space a feladat léptetése, nem a fókuszált kártya)
      b.addEventListener('mousedown', (e) => e.preventDefault());
      b.addEventListener('click', (e) => { e.stopPropagation(); onMark(i); });
      return b;
    });
    el.grid.replaceChildren(...cards);
    layout();
  }

  function mark(i) {
    cards.forEach((c, k) => c.setAttribute('aria-pressed', String(k === i)));
  }

  /** Elrendezés és betűméret (F-K12, F-K13): újraszámolódik feladatváltáskor és átméretezéskor. */
  function layout() {
    if (!shown) return;
    const vw = innerWidth, vh = innerHeight;
    const { cols, rows } = gridShape(shapeN, vw >= vh);
    const a = area(vw, vh);
    const cw = Math.floor((a.w - (cols - 1) * a.gap) / cols);
    const ch = Math.floor((a.h - (rows - 1) * a.gap) / rows);
    const g = el.grid.style;
    g.left = `${a.left}px`; g.top = `${a.top}px`; g.width = `${a.w}px`; g.height = `${a.h}px`;
    g.setProperty('--gap', `${a.gap}px`);
    g.setProperty('--cw', `${cw}px`);
    g.setProperty('--ch', `${ch}px`);
    // a rács a beállított kártyaszám szerint: kevesebb kártyánál az utolsó sor középen (F-K3)
    g.setProperty('--rows', String(Math.ceil(shown.length / cols)));

    // F-K13: egy méret a feladat minden kártyájára, a leghosszabb tétel szerint; a kártya belső
    // szélességének ≤ 80%-a, magasságának ≤ 55%-a. A közös sor-doboz miatt az alapvonal is azonos.
    measure.font = `400 100px ${FONT_STACK}`;
    let maxW = 1, A = 0, D = 0;
    for (const t of shown) {
      const m = measure.measureText(t);
      maxW = Math.max(maxW, m.width, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || 0));
      A = Math.max(A, m.fontBoundingBoxAscent || m.actualBoundingBoxAscent || 72);
      D = Math.max(D, m.fontBoundingBoxDescent || m.actualBoundingBoxDescent || 0);
    }
    const border = 2 * (Math.min(vw, vh) < PHONE ? 4 : 5);   // a jelölt keret se szűkítse a tételt
    const iw = cw - border, ih = ch - border;
    const k = Math.min(iw * 0.8 / maxW, ih * 0.55 / Math.max(1, A + D));
    g.setProperty('--fs', `${Math.max(10, Math.floor(k * 100))}px`);
  }

  function clear() {
    shown = null; cards = [];
    el.grid.replaceChildren();
  }

  /** A kártyák mérete és betűmérete (teszteknek, F-K13). */
  const sizes = () => cards.map((c) => ({ w: c.clientWidth, h: c.clientHeight, fs: getComputedStyle(c).fontSize }));

  return { show, mark, layout, clear, sizes };
}
