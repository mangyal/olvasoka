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
