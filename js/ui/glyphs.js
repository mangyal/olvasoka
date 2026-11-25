// A tétel kirajzolása a Megjelenés szerint (docs/megjelenes-specifikacio.md, SZ, NB-6–NB-8, J-1, J-2).
//
// HTML-ben (előnézet, Minta, Keresd meg! kártyák) a tétel mindig hangcsoport és jelölés szerinti
// <span>-darabokból áll (g-v, g-d, g-u, g-mark); hogy ebből mi látszik, azt a gyökérelem look-color és
// look-mark osztálya dönti el (css/tokens.css). Így a beállítás váltása nem rajzolja újra a tételeket.
// A Felolvasás SVG-jében a darabok <tspan>-ek, és csak akkor, ha a kör Megjelenése ezt kéri; különben
// sima szöveg marad, ahogy eddig (a betűköz sem változik).

import { segments } from '../core/hangok.js';

const SVG = 'http://www.w3.org/2000/svg';
/** A beépített vagy a hangok.json-ból jött besorolás (main.js állítja be). */
let classes;
export function setClasses(c) { classes = c; }

const className = (s) => ['g', s.cls && `g-${s.cls}`, s.mark && 'g-mark'].filter(Boolean).join(' ');

/**
 * A tétel HTML-darabjai egy elembe (a régi tartalom helyére). A textContent a tétel marad.
 * @param {HTMLElement} el
 * @param {string} text
 * @param {{ start: number, end: number }[]} [marks]
 */
export function fillHtml(el, text, marks = []) {
  el.replaceChildren(...segments(text, marks, classes).map((s) => {
    if (!s.cls && !s.mark) return document.createTextNode(s.text);
    const sp = document.createElement('span');
    sp.className = className(s);
    sp.textContent = s.text;
    return sp;
  }));
  return el;
}

/**
 * Új <span> a tétellel (előnézet chip, minta kártya). A darabok egy belső <span class="g-w">-ben vannak,
 * hogy a külső elem (pl. a gap-pel rendezett inline-flex chip) ne tegyen rést a betűk közé.
 */
export function itemSpan(text, marks, cls) {
  const el = document.createElement('span');
  if (cls) el.className = cls;
  el.append(fillHtml(Object.assign(document.createElement('span'), { className: 'g-w' }), text, marks));
  return el;
}

/**
 * A Felolvasás <text> eleme (J-1). Darabolás csak színezésnél, vagy körvonalas jelölésnél jelölt tételen.
 * @param {SVGTextElement} el
 * @param {string} text
 * @param {{ start: number, end: number }[]} marks
 * @param {{ color: string, mark: string }} look
 */
export function fillSvg(el, text, marks, look) {
  const split = look.color === 'sound' || (look.mark === 'outline' && marks.length > 0);
  if (!split) { el.textContent = text; return; }
  el.replaceChildren(...segments(text, marks, classes).map((s) => {
    const t = document.createElementNS(SVG, 'tspan');
    t.setAttribute('class', className(s));
    t.textContent = s.text;
    return t;
  }));
}

/** A gyökérelem osztályai a Megjelenés szerint (MJ-3: mindenhol érvényes). */
export function applyLook(look, root = document.documentElement) {
  root.classList.toggle('look-color', look.color === 'sound');
  root.classList.toggle('look-mark', look.mark === 'outline');
}
