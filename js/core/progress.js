// A gyakorlókör haladásjelzője (design spec 7.): pöttysor, 20 tétel fölött sáv + „N/M”. Tiszta modul.

/** Legfeljebb ennyi tételig pöttysor; fölötte sáv. */
export const DOT_MAX = 20;

/**
 * index: az aktuális tétel (0-tól), total: a kör hossza, noun: amit számol („tétel”, Keresd meg!-ben „feladat”).
 * → { kind: 'dots'|'bar', total, current, label, text, fraction }
 *   label: akadálymentes felirat („4. tétel a 10-ből”), text: a sáv melletti „4/10”,
 *   fraction: a sáv kitöltése (a kész és az aktuális tétel együtt).
 */
export function progressModel(index, total, noun = 'tétel') {
  const n = Math.max(1, Math.floor(total) || 1);
  const i = Math.min(n - 1, Math.max(0, Math.floor(index) || 0));
  return {
    kind: n > DOT_MAX ? 'bar' : 'dots',
    total: n,
    current: i,
    label: `${i + 1}. ${noun} a ${n}-${fromSuffix(n)}`,
    text: `${i + 1}/${n}`,
    fraction: (i + 1) / n,
  };
}

/** Pötty állapota: 'done' | 'current' | 'todo'. */
export const dotState = (k, current) => (k < current ? 'done' : k === current ? 'current' : 'todo');

/**
 * A „-ból/-ből” rag a szám kiejtése szerint (magánhangzó-harmónia): 10-ből, 20-ból, 3-ból, 5-ből.
 * Az utolsó nem nulla helyiérték dönt (a kerek tízesek és a 100 saját alakkal).
 */
export function fromSuffix(n) {
  const back = new Set([3, 6, 8]);          // három, hat, nyolc → -ból
  const tensBack = new Set([20, 30, 60, 80, 100]); // húsz, harminc, hatvan, nyolcvan, száz → -ból
  const ones = n % 10;
  if (ones) return back.has(ones) ? 'ból' : 'ből';
  const t = n % 100 || 100;
  return tensBack.has(t) ? 'ból' : 'ből';
}

/* ---------- ragok számok után (Haladás) ---------- */

/** A szám kiejtésének utolsó szava (ez dönt a ragról): 3 → három, 20 → húsz, 100 → száz, 1000 → ezer. */
function lastWord(n) {
  if (n === 0) return 0;
  if (n % 10) return n % 10;
  if (n % 100) return n % 100;
  return n % 1000 ? 100 : 1000;
}

const ACC = { 0: 't', 1: 'et', 2: 't', 3: 'at', 4: 'et', 5: 'öt', 6: 'ot', 7: 'et', 8: 'at', 9: 'et', 10: 'et', 20: 'at', 30: 'at', 40: 'et', 50: 'et', 60: 'at', 70: 'et', 80: 'at', 90: 'et', 100: 'at', 1000: 'et' };
const TIMES = { 0: 'szor', 1: 'szer', 2: 'szer', 3: 'szor', 4: 'szer', 5: 'ször', 6: 'szor', 7: 'szer', 8: 'szor', 9: 'szer', 10: 'szer', 20: 'szor', 30: 'szor', 40: 'szer', 50: 'szer', 60: 'szor', 70: 'szer', 80: 'szor', 90: 'szer', 100: 'szor', 1000: 'szer' };

/** Tárgyrag számjegyes szám után: 1-et, 2-t, 3-at, 5-öt, 6-ot, 10-et, 120-at. */
export const accSuffix = (n) => ACC[lastWord(n)];
/** „-szor/-szer/-ször” számjegyes szám után: 1-szer, 3-szor, 5-ször, 20-szor. */
export const timesSuffix = (n) => TIMES[lastWord(n)];
