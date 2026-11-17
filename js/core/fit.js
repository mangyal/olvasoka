// A Felolvasás betűmérete és függőleges elrendezése (spec F-P13, mondatoknál M-7). Tiszta modul:
// a méréseket (100 px-es betűvel) és a nézet méretét kívülről kapja.
//
// A kör két méretet használ: egyet a nem-mondat tételekre, egyet a mondatokra, mindkettőt ugyanazzal
// a szabállyal (a legszélesebb tétel a szélesség 72%-án, a közös tinta-doboz a magasság 53%-án), de
// csak a saját tételeiből számolva. Így egy mondat nem nyomja össze a kör betűit és szótagjait.

import { isSentence } from './items.js';

/**
 * @typedef {{ width: number, left?: number, right?: number, ascent?: number, descent?: number }} Metric
 *   egy tétel mérése 100 px-es betűvel (canvas measureText: width, actualBoundingBox*)
 */

/**
 * Egy tételcsoport közös elrendezése (F-P13).
 * @param {Metric[]} metrics
 * @param {number} vw, vh  a nézet mérete képpontban
 * @returns {{ size: number, baseline: number, top: number, bottom: number, barX: number, barW: number, barY: number }}
 */
export function fitLayout(metrics, vw, vh) {
  let maxW = 1, A = 0, D = 0;
  for (const m of metrics) {
    maxW = Math.max(maxW, m.width, (m.left || 0) + (m.right || 0));
    A = Math.max(A, m.ascent || 72);
    D = Math.max(D, m.descent || 0);
  }
  const k = Math.min(vw * 0.72 / maxW, vh * 0.53 / Math.max(1, A + D), vh * 0.53 / 100);
  const size = Math.max(8, Math.floor(k * 100)), s = size / 100;
  const baseline = vh * 0.46 + ((A - D) / 2) * s;
  // időjelző a közös tinta-doboz alatt, a csoport legszélesebb tételének szélességében
  const barW = Math.min(vw * 0.7, Math.max(160, maxW * s));
  return {
    size, baseline, top: baseline - A * s, bottom: baseline + D * s,
    barX: (vw - barW) / 2, barW, barY: Math.min(baseline + D * s + Math.max(16, vh * 0.035), vh - 110),
  };
}

/**
 * A kör két elrendezése (M-7): `item` a nem-mondat tételekre, `mondat` a mondatokra; ha a körben nincs
 * ilyen tétel, az adott elrendezés null.
 * @param {string[]} texts  a kör tételei
 * @param {(text: string) => Metric} measure
 * @returns {{ item: object|null, mondat: object|null }}
 */
export function roundLayouts(texts, measure, vw, vh) {
  const uniq = [...new Set(texts)];
  const part = (pred) => {
    const xs = uniq.filter(pred);
    return xs.length ? fitLayout(xs.map(measure), vw, vh) : null;
  };
  return { item: part((t) => !isSentence(t)), mondat: part(isSentence) };
}

/** A tételhez tartozó elrendezés a kettő közül (M-7). */
export const layoutFor = (layouts, text) => (isSentence(text) ? layouts.mondat : layouts.item) || layouts.item || layouts.mondat;
