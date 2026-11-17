// A Keresd meg! kör (spec 4a.): a feladatok előállítása és a lépés-logika. Tiszta modul, DOM nélkül.
//
// Állapot: { tasks, index, marked, done }. A tasks a kör feladatai, mindegyik a kártyák tételei
// megjelenítési sorrendben; a marked az aktuális feladatban megjelölt kártya sorszáma vagy null.
// A program nem tudja, melyik a jó válasz, és nem értékel: csak megjelöli, amire a gyerek rábökött.

import { createPool, buildGrid, anchorChoices } from './grid.js';
import { itemKey, isSentence } from './items.js';
import { groupOf } from './groups.js';

/** Telefonon (a rövidebb oldal 500 CSS px alatt) legfeljebb ennyi kártya (F-K10). */
export const PHONE_MAX_CARDS = 6;
export const PHONE_SHORT_SIDE = 500;

/** A kör kártyaszáma a nézet méretéből; a tárolt beállítást nem írja át (F-K10). */
export function effectiveCards(cards, width, height) {
  return Math.min(width, height) < PHONE_SHORT_SIDE ? Math.min(cards, PHONE_MAX_CARDS) : cards;
}

/**
 * A kör összes feladata (F-K1). Egy feladat csak egy csoport tételeiből áll (2.14, K-2). Két egymást
 * követő feladatnak nem lehet azonos a horgonya (F-K16), ha van legalább két választható horgony.
 * @param {string[]} items  a kör sorai, ismétlésekkel (3.3a; a horgony súlyozásához)
 * @param {{ cards:number, tasks:number, level:number }} o  level: a heurisztika fokozata (0–1)
 * @param {object} cc  compileConfig eredménye
 * @param {() => number} [rng]
 * @returns {{ anchor:string, items:string[] }[]}
 */
export function buildTaskGrids(items, { cards, tasks, level }, cc, rng = Math.random) {
  const pool = createPool(items, cc);
  if (!anchorChoices(pool).length) return [];
  const out = [];
  let prev = '';
  for (let k = 0; k < tasks; k++) {
    const g = buildGrid(pool, cards, level, rng, { avoid: prev });
    out.push(g);
    prev = g.anchor;
  }
  return out;
}

/** Mint a buildTaskGrids, de csak a kártyák tételei: a kör állapota ezt tárolja. */
export const buildTasks = (...a) => buildTaskGrids(...a).map((g) => g.items);

/** Hány különböző tétel van a forrásban (itemKey: a kis- és nagybetű számít). */
export const distinctCount = (items) => new Set(items.map(itemKey).filter(Boolean)).size;

/**
 * Indítható-e a Keresd meg! (2.14, K-5): van-e legalább egy csoport legalább 2 különböző tétellel.
 * A mondat nem számít (M-9).
 * A készlet nem kell hozzá (nincs távolságtábla), csak a csoportok.
 */
export function canFind(items) {
  const seen = new Set(), size = new Map();
  for (const raw of items) {
    const k = itemKey(raw);
    if (!k || seen.has(k) || isSentence(raw)) continue;   // M-9: a mondat nem játszható
    seen.add(k);
    const g = groupOf(raw).key;
    size.set(g, (size.get(g) || 0) + 1);
    if (size.get(g) >= 2) return true;
  }
  return false;
}

/** Csak mondat van-e a forrásban (M-9): ilyenkor a Keresd meg! saját üzenetet kap. */
export const onlySentences = (items) => items.length > 0 && items.every(isSentence);

export function startFind(tasks) {
  return { tasks, index: 0, marked: null, done: false };
}

export const canPrev = (s) => s.index > 0;
export const isLast = (s) => s.index >= s.tasks.length - 1;

/**
 * @param {object} s
 * @param {'MARK'|'NEXT'|'PREV'} ev
 * @param {number} [i]  MARK: a kártya sorszáma
 */
export function step(s, ev, i) {
  if (s.done) return s;
  switch (ev) {
    case 'MARK': {                    // F-K6: jelöl; ugyanarra újra: lekerül; másikra: átkerül
      const n = s.tasks[s.index]?.length ?? 0;
      if (!Number.isInteger(i) || i < 0 || i >= n) return s;
      return { ...s, marked: s.marked === i ? null : i };
    }
    case 'NEXT':                      // F-K7: a következő feladat jelölés nélkül; az utolsón jutalom
      return isLast(s) ? { ...s, marked: null, done: true } : { ...s, index: s.index + 1, marked: null };
    case 'PREV':                      // F-K2, F-K7: ugyanaz a rács jön vissza, jelölés nélkül
      return canPrev(s) ? { ...s, index: s.index - 1, marked: null } : s;
    default:
      return s;
  }
}

/**
 * Rács-elrendezés (F-K12): oszlop × sor a beállított kártyaszám és a nézet alakja szerint.
 * Kevesebb kártyánál (F-K3) a beállított kártyaszám rácsa marad.
 */
export function gridShape(cards, landscape) {
  if (cards <= 4) return { cols: 2, rows: 2 };
  if (cards <= 6) return landscape ? { cols: 3, rows: 2 } : { cols: 2, rows: 3 };
  return landscape ? { cols: 4, rows: 2 } : { cols: 2, rows: 4 };
}
