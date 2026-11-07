// Beállítások és a helyben tárolt állapot sémája. Tiszta modul.

export const GAPS = [0, 500, 1000, 1500, 2000, 2500, 3000];
export const FLASH_MAX = 25000;
export const DEFAULT_SETTINGS = Object.freeze({ flashMs: 10000, gapMs: 0, count: 10, source: 'list' });

const num = (v, d) => (Number.isFinite(+v) ? +v : d);

/** Bármilyen bemenetből érvényes beállítás. flashMs = 0: kézi léptetés. */
export function clampSettings(s) {
  s = s && typeof s === 'object' ? s : {};
  let f = Math.round(num(s.flashMs, DEFAULT_SETTINGS.flashMs) / 500) * 500;
  f = Math.min(FLASH_MAX, Math.max(0, f));
  let g = Math.round(num(s.gapMs, 0) / 500) * 500;
  g = Math.min(3000, Math.max(0, g));
  let c = Math.round(num(s.count, DEFAULT_SETTINGS.count));
  c = Math.min(50, Math.max(1, c));
  return { flashMs: f, gapMs: g, count: c, source: s.source === 'all' ? 'all' : 'list' };
}

/**
 * Helyi állapot: { v: 3, settings, lastLists: string[], hideHelp: boolean,
 *                  cache: { text, fetchedAt, kind: 'sheet'|'txt' } | null }.
 * hideHelp: a súgó ne jelenjen meg magától induláskor.
 * lastLists: a legutóbb kijelölt listák neve. A cache a legutóbb letöltött lista szövege
 * (táblázat CSV vagy lists.txt, `kind` szerint; a kind nélküli régi cache lists.txt).
 * A v2 egyetlen lastList neve átkerül a lastLists tömbbe.
 * Ismeretlen vagy sérült bemenetnél alapállapot.
 */
export function normalizeState(o) {
  const base = { v: 3, settings: clampSettings(null), lastLists: [], hideHelp: false, cache: null };
  if (!o || typeof o !== 'object') return base;
  const lastLists = Array.isArray(o.lastLists) ? o.lastLists.filter((x) => typeof x === 'string')
    : typeof o.lastList === 'string' ? [o.lastList] : [];
  return {
    v: 3,
    settings: clampSettings(o.settings),
    lastLists,
    hideHelp: o.hideHelp === true,
    cache: o.cache && typeof o.cache === 'object' && typeof o.cache.text === 'string' && Number.isFinite(o.cache.fetchedAt)
      ? { text: o.cache.text, fetchedAt: o.cache.fetchedAt, kind: o.cache.kind === 'sheet' ? 'sheet' : 'txt' } : null,
  };
}
