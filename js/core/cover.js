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
