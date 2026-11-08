// Szótag-takarás (spec 4.5, F-P17–F-P21). Tiszta modul, DOM nélkül.
//
// A takarási állapot (`covered`) egy logikai tömb, szótagonként egy elem (true = letakarva).
// Az üres tömb jelenti az „egész látszik” állapotot; tételváltáskor mindig ez lesz (F-P21).

/**
 * F-P17: a tétel szótagjai a kötőjel (U+002D) mentén, a karakterpozíciókkal együtt.
 * Az üres szakasz nem szótag (`ka--ta` → 2, `-ka` → 1, `ka-` → 1).
 * @returns {{ text: string, start: number, end: number }[]}  end kizáró, UTF-16 index
 */
export function syllables(item) {
  const s = String(item), out = [];
  let start = 0;
  for (let i = 0; i <= s.length; i++) {
    if (i === s.length || s[i] === '-') {
      if (i > start) out.push({ text: s.slice(start, i), start, end: i });
      start = i + 1;
    }
  }
  return out;
}

export const syllableCount = (item) => syllables(item).length;

/** Van-e letakart szótag. */
export const anyCovered = (covered) => covered.some(Boolean);

const normalize = (covered) => (anyCovered(covered) ? covered : []);

/** Kattintás/koppintás az i. szótagra: annak takarása vált (F-P18). n < 2: nincs hatása. */
export function toggleCover(covered, i, n) {
  if (n < 2 || !(i >= 0 && i < n)) return covered;
  const next = Array.from({ length: n }, (_, k) => Boolean(covered[k]));
  next[i] = !next[i];
  return normalize(next);
}

/** „Csak a k. szótag látszik.” */
const onlyVisible = (k, n) => Array.from({ length: n }, (_, j) => j !== k);

/**
 * `↓` (F-P18): egész → csak az 1. → csak a 2. → … → csak az utolsó → egész.
 * Kézzel kevert takarásból a „csak az 1.” állapotra ugrik. n < 2: nincs hatása.
 */
export function stepCover(covered, n) {
  if (n < 2) return covered;
  if (!anyCovered(covered)) return onlyVisible(0, n);
  const shown = [];
  for (let j = 0; j < n; j++) if (!covered[j]) shown.push(j);
  if (shown.length !== 1 || covered.length !== n) return onlyVisible(0, n);
  return shown[0] < n - 1 ? onlyVisible(shown[0] + 1, n) : [];
}

/** Az átmenet letakart-e olyan szótagot, amely előtte látszott (F-P20 auto-pause). */
export const coversMore = (before, after) => after.some((c, j) => c && !before[j]);

/* ---------- vonalzó (F-P22) ---------- */

export const RULER = Object.freeze({
  padOuter: 0.06,       // em, vízszintes ráhagyás a kötőjeltől távoli oldalon
  padY: 0.03,           // em, függőleges ráhagyás a kör tinta-doboza körül
  barGap: 4,            // px, az alsó él és az időjelző teteje között legalább
  hyphenGap: 1,         // px, a kötőjel tintájától (az 1 px-es keret fele is kívül esik)
  radius: 0.03,         // em
  bevel: 0.62,          // a test magasságának aránya
  tickStart: 0.05,      // em, az első vonás a bal végtől
  tickEnd: 0.03,        // em, az utolsó vonás legalább ennyire a jobb végtől
  tickStep: 0.045,      // em („mm”)
  tickLen: [0.16, 0.11, 0.06],   // em: 10-es, 5-ös, többi
});

/** Az n. vonás (0-tól) hossza em-ben: minden 10. hosszú, minden 5. közepes. */
export const tickLength = (k) => RULER.tickLen[k % 10 === 0 ? 0 : k % 5 === 0 ? 1 : 2];

/**
 * Egy szótag vonalzójának geometriája, képpontban.
 * @param {object} box
 * @param {number} box.left, box.right    a szótag advance-dobozának szélei
 * @param {number} box.top, box.bottom    a kör közös tinta-dobozának teteje és alja (F-P13)
 * @param {number} [box.hyphenLeft]       a bal szomszéd kötőjel tintájának jobb széle (ha van)
 * @param {number} [box.hyphenRight]      a jobb szomszéd kötőjel tintájának bal széle (ha van)
 * @param {number} [box.barTop]           az időjelző teteje (U-P3)
 * @param {number} em                     a betűméret képpontban
 * @returns {{ x, y, w, h, rx, bevelY, ticks: { x: number, len: number }[] }}
 *   a vonások a felső élről (y) indulnak lefelé
 */
export function rulerGeometry(box, em) {
  const hasL = Number.isFinite(box.hyphenLeft), hasR = Number.isFinite(box.hyphenRight);
  let l = box.left - (hasL ? 0 : RULER.padOuter * em);
  let r = box.right + (hasR ? 0 : RULER.padOuter * em);
  if (hasL) l = Math.max(l, box.hyphenLeft + RULER.hyphenGap);
  if (hasR) r = Math.min(r, box.hyphenRight - RULER.hyphenGap);
  r = Math.max(r, l);
  const y = box.top - RULER.padY * em;
  let bottom = box.bottom + RULER.padY * em;
  if (Number.isFinite(box.barTop)) bottom = Math.min(bottom, box.barTop - RULER.barGap);
  const h = Math.max(0, bottom - y), w = r - l;
  const ticks = [];
  const last = l + w - RULER.tickEnd * em;
  for (let k = 0; ; k++) {
    const x = l + (RULER.tickStart + k * RULER.tickStep) * em;
    if (k > 0 && x > last + 1e-9) break;   // keskeny szótagon is marad az első 10-es vonás
    ticks.push({ x, len: tickLength(k) * em });
  }
  return { x: l, y, w, h, rx: RULER.radius * em, bevelY: y + RULER.bevel * h, ticks };
}
