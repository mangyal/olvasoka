// Beállítások és a helyben tárolt állapot sémája. Tiszta modul.

/** A „Szünet a tételek között” választható értékei (ms). */
export const GAPS = [0, 500, 1000, 2000, 3000];
export const FLASH_MAX = 25000;
export const DEFAULT_SETTINGS = Object.freeze({ flashMs: 10000, gapMs: 0, count: 10, source: 'list' });

/** A játékok: Felolvasás és Keresd meg!. */
export const MODES = ['read', 'find'];
export const ACTIVE_MODES = ['read', 'find'];

/** Keresd meg! beállítások (spec 3.3a). level: 1 = nagyon eltérő … 5 = nagyon hasonló. */
export const CARDS = [4, 6, 8];
export const TASKS_MIN = 1, TASKS_MAX = 30;
export const LEVELS = [1, 2, 3, 4, 5];
export const DEFAULT_FIND = Object.freeze({ cards: 4, tasks: 10, level: 1 });
/** A nehézség fokozatainak szövege (U-A8). */
export const LEVEL_LABELS = Object.freeze({
  1: 'nagyon eltérő', 2: 'inkább eltérő', 3: 'vegyes', 4: 'inkább hasonló', 5: 'nagyon hasonló',
});

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

/** Bármilyen bemenetből érvényes Keresd meg! beállítás; hiányzó vagy érvénytelen mezőnél az alapérték. */
export function clampFind(f) {
  f = f && typeof f === 'object' ? f : {};
  const int = (v) => (Number.isFinite(+v) && String(v).trim() !== '' ? Math.round(+v) : NaN);
  const cards = CARDS.includes(int(f.cards)) ? int(f.cards) : DEFAULT_FIND.cards;
  const t = int(f.tasks);
  const tasks = Number.isFinite(t) ? Math.min(TASKS_MAX, Math.max(TASKS_MIN, t)) : DEFAULT_FIND.tasks;
  const level = LEVELS.includes(int(f.level)) ? int(f.level) : DEFAULT_FIND.level;
  return { cards, tasks, level };
}

/** A szülő 1–5 fokozata a heurisztika fokozatára (0 · 0,25 · 0,5 · 0,75 · 1; F-S6). */
export const levelToDegree = (level, levels = [0, 0.25, 0.5, 0.75, 1]) =>
  levels[Math.min(levels.length, Math.max(1, Math.round(level))) - 1];

/** A kiválasztható játék; inaktív vagy ismeretlen játék helyett a Felolvasás. */
export const normalizeMode = (m, active = ACTIVE_MODES) => (active.includes(m) ? m : 'read');

/**
 * Helyi állapot: { v: 4, mode, settings, find, lastLists: string[], hideHelp: boolean,
 *                  cache: { text, fetchedAt, kind: 'sheet'|'txt' } | null }.
 * mode: a kiválasztott játék ('read' | 'find').
 * find: a Keresd meg! beállításai (clampFind); a mező csak hozzáadás, ezért a v marad 4.
 * hideHelp: a súgó ne jelenjen meg magától induláskor.
 * lastLists: a legutóbb kijelölt listák neve. A cache a legutóbb letöltött lista szövege
 * (táblázat CSV vagy lists.txt, `kind` szerint; a kind nélküli régi cache lists.txt).
 * A v2 egyetlen lastList neve átkerül a lastLists tömbbe; a v3 mode nélkül 'read'.
 * Ismeretlen vagy sérült bemenetnél alapállapot.
 */
export function normalizeState(o) {
  const base = { v: 4, mode: 'read', settings: clampSettings(null), find: clampFind(null), lastLists: [], hideHelp: false, cache: null };
  if (!o || typeof o !== 'object') return base;
  const lastLists = Array.isArray(o.lastLists) ? o.lastLists.filter((x) => typeof x === 'string')
    : typeof o.lastList === 'string' ? [o.lastList] : [];
  return {
    v: 4,
    mode: normalizeMode(o.mode),
    settings: clampSettings(o.settings),
    find: clampFind(o.find),
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

/** A Keresd meg! becslése a szülői felületre: „10 feladat · 4 kártya”. */
export const findEstimate = (f) => `${f.tasks} feladat · ${f.cards} kártya`;
