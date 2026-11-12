// Haladás: kitalált, de a valós formátumú napló a böngészős tesztekhez (e2e/layout.mjs, e2e/app.mjs).
// A napi összesítők a mai naphoz képest készülnek, így a tesztek bármelyik napon ugyanazt mutatják.
// Mért idő nincs bennük, így nincs szokásos tempó: a csoportot csak a napok és a segítség dönti el
// (az időfeltételt a unit tesztek fedik le).

import { readFileSync } from 'node:fs';
import { parseListsText } from '../js/core/lists.js';

/** k nappal ezelőtti helyi nap (YYYY-MM-DD). */
export function ago(k, now = Date.now()) {
  const d = new Date(now);
  d.setDate(d.getDate() - k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rec(item, day, help) {
  const sup = [...help].filter((c) => c === '1').length;
  return {
    id: `r-seed|default|${item}|${day}`, child: 'default', item, day,
    exposures: help.length, manualExposures: 0, dwellMs: [], medianDwellMs: null,
    covers: sup, pauses: 0, prevs: 0, supportedExposures: sup, unsupportedFastFlash: 0, help, flashDwell: [],
  };
}

/** Csoportonként a napok és a segítségsor: [k nappal ezelőtt, segítség]. */
const PLAN = {
  fluent: [[6, '01'], [4, '00'], [2, '0'], [0, '0']],          // 6 alkalom, 4 napon, az utolsó 3 segítség nélkül
  unsure: [[5, '0'], [3, '10'], [1, '0']],                      // az utolsó 3-ban volt segítség, 5-ből 1
  practice: [[18, '1'], [14, '1'], [11, '0'], [8, '1'], [5, '1'], [2, '1'], [0, '1']], // 5-ből 5
  low: [[3, '00'], [1, '0']],                                   // 2 napon olvasta
  seenOnce: [[0, '0']],
};

/**
 * Tárolt Haladás-gyökér.
 * @param {{ fluent?: string[], unsure?: string[], practice?: string[], low?: string[], seenOnce?: string[] }} o
 */
export function seedRoot(o, now = Date.now()) {
  const daily = Object.entries(PLAN).flatMap(([g, plan]) => (o[g] || []).flatMap((x) => plan.map(([k, help]) => rec(x, ago(k, now), help))));
  return { v: 1, deviceId: 'r-seed', child: 'default', events: [], daily, rounds: [], lists: {} };
}

/** A repó lists.txt-jének listái és egyedi tételei (a localhoston ezek töltődnek be). */
export function repoLists() {
  const { lists } = parseListsText(readFileSync(new URL('../lists.txt', import.meta.url), 'utf8'));
  const items = [...new Set(lists.flatMap((l) => l.items.map((x) => x.normalize('NFC').trim())))];
  return { lists, items };
}
