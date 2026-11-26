// Véletlen segédek a kör és a Keresd meg! rácsainak összeállításához. Tiszta, DOM-mentes modul; az rng
// mindig a hívótól jön (tesztben magolt generátor), így a sorrend visszakereshető.

/** Fisher–Yates keverés helyben; visszaadja ugyanazt a tömböt. */
export function shuffleInPlace(a, rng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Egy súlyozott húzás: a weights arányában választott index.
 * Ha a súlyok összege nem pozitív: `uniformIfZero` mellett egyenletes húzás, különben az utolsó index.
 * Mindkét ágon pontosan egy rng-hívás, így egy rögzített rng ugyanazt a sorozatot adja, mint korábban.
 * @param {number[]} weights
 * @param {() => number} rng
 * @param {{ uniformIfZero?: boolean }} [o]
 */
export function pickWeighted(weights, rng, { uniformIfZero = false } = {}) {
  let sum = 0;
  for (const w of weights) sum += w;
  if (uniformIfZero && !(sum > 0)) return Math.floor(rng() * weights.length);
  let r = rng() * sum;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}
