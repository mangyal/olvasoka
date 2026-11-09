// Beállítások és a helyben tárolt állapot sémája. Tiszta modul.

/** A „Szünet a tételek között” választható értékei (ms). */
export const GAPS = [0, 500, 1000, 2000, 3000];
export const FLASH_MAX = 25000;
export const DEFAULT_SETTINGS = Object.freeze({ flashMs: 10000, gapMs: 0, count: 10, source: 'list' });

/** A játékok. A 'find' (Keresd meg!) még nem választható; a normalizálás 'read'-re állítja. */
export const MODES = ['read', 'find'];
export const ACTIVE_MODES = ['read'];

const num = (v, d) => (Number.isFinite(+v) ? +v : d);

/** A legközelebbi választható szünet; döntetlennél (pl. 1500) a kisebb. */
export function snapGap(ms) {
  const v = num(ms, 0);
  let best = GAPS[0];
  for (const g of GAPS) if (Math.abs(g - v) < Math.abs(best - v)) best = g;
  return best;
}

/** Bármilyen bemenetből érvényes beállítás. flashMs = 0: kézi léptetés. */
export function clampSettings(s) {
  s = s && typeof s === 'object' ? s : {};
  let f = Math.round(num(s.flashMs, DEFAULT_SETTINGS.flashMs) / 500) * 500;
  f = Math.min(FLASH_MAX, Math.max(0, f));
  let c = Math.round(num(s.count, DEFAULT_SETTINGS.count));
  c = Math.min(50, Math.max(1, c));
  return { flashMs: f, gapMs: snapGap(s.gapMs), count: c, source: s.source === 'all' ? 'all' : 'list' };
}

/** A kiválasztható játék; inaktív vagy ismeretlen játék helyett a Felolvasás. */
export const normalizeMode = (m) => (ACTIVE_MODES.includes(m) ? m : 'read');

/**
 * Helyi állapot: { v: 4, mode, settings, lastLists: string[], hideHelp: boolean,
 *                  cache: { text, fetchedAt, kind: 'sheet'|'txt' } | null }.
 * mode: a kiválasztott játék ('read' | 'find'; amíg a Keresd meg! inaktív, mindig 'read').
 * hideHelp: a súgó ne jelenjen meg magától induláskor.
 * lastLists: a legutóbb kijelölt listák neve. A cache a legutóbb letöltött lista szövege
 * (táblázat CSV vagy lists.txt, `kind` szerint; a kind nélküli régi cache lists.txt).
 * A v2 egyetlen lastList neve átkerül a lastLists tömbbe; a v3 mode nélkül 'read'.
 * Ismeretlen vagy sérült bemenetnél alapállapot.
 */
export function normalizeState(o) {
  const base = { v: 4, mode: 'read', settings: clampSettings(null), lastLists: [], hideHelp: false, cache: null };
  if (!o || typeof o !== 'object') return base;
  const lastLists = Array.isArray(o.lastLists) ? o.lastLists.filter((x) => typeof x === 'string')
    : typeof o.lastList === 'string' ? [o.lastList] : [];
  return {
    v: 4,
    mode: normalizeMode(o.mode),
    settings: clampSettings(o.settings),
    lastLists,
    hideHelp: o.hideHelp === true,
    cache: o.cache && typeof o.cache === 'object' && typeof o.cache.text === 'string' && Number.isFinite(o.cache.fetchedAt)
      ? { text: o.cache.text, fetchedAt: o.cache.fetchedAt, kind: o.cache.kind === 'sheet' ? 'sheet' : 'txt' } : null,
  };
}

/** Számok tizedesvesszővel. */
export const fmtNum = (x) => String(x).replace('.', ',');

/**
 * A kör becsült hossza a szülői felületre: { count: '10 tétel', time: 'kb. 40 mp' }.
 * Kézi léptetésnél time = 'kézi léptetés'; 60 mp fölött percekkel („kb. 1 perc 20 mp”).
 */
export function estimate(s) {
  const count = `${s.count} tétel`;
  if (s.flashMs === 0) return { count, time: 'kézi léptetés' };
  const total = Math.round(s.count * (s.flashMs + s.gapMs) / 1000);
  const time = total < 60 ? `kb. ${total} mp`
    : `kb. ${Math.floor(total / 60)} perc${total % 60 ? ` ${total % 60} mp` : ''}`;
  return { count, time };
}
