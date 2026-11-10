// Beállítások v4: játékmód, a szünet új értékei és a kör becslése (design spec 4.5, 4.7, 9.).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GAPS, snapGap, clampSettings, normalizeState, normalizeMode, estimate,
  DEFAULT_FIND, clampFind, LEVELS, LEVEL_LABELS, levelToDegree, findEstimate,
} from '../js/core/settings.js';

test('szünet: öt választható érték', () => {
  assert.deepEqual(GAPS, [0, 500, 1000, 2000, 3000]);
});

test('szünet: a régi 1,5 és 2,5 mp a közelebbi kisebb értékre áll', () => {
  assert.equal(snapGap(1500), 1000);
  assert.equal(snapGap(2500), 2000);
  assert.equal(snapGap(1600), 2000);
  assert.equal(snapGap(-3), 0);
  assert.equal(snapGap(9999), 3000);
  assert.equal(snapGap('x'), 0);
  for (const g of GAPS) assert.equal(snapGap(g), g);
  assert.equal(clampSettings({ gapMs: 1500 }).gapMs, 1000);
});

test('játékmód: alapból Felolvasás, a tárolt Keresd meg! megmarad', () => {
  assert.equal(normalizeState(null).mode, 'read');
  assert.equal(normalizeState({ v: 3, settings: {} }).mode, 'read', 'v3 mode nélkül');
  assert.equal(normalizeState({ v: 4, mode: 'find' }).mode, 'find');
  assert.equal(normalizeState({ v: 4, mode: 'xyz' }).mode, 'read');
  assert.equal(normalizeMode('read'), 'read');
  assert.equal(normalizeMode('find', ['read']), 'read', 'inaktív fül (pl. hibás parok.json) → Felolvasás');
});

test('Keresd meg! beállítások: alapértékek, korlátok, érvénytelen mezők (3.3a, F-S3)', () => {
  assert.deepEqual(DEFAULT_FIND, { cards: 4, tasks: 10, level: 1 });
  assert.deepEqual(normalizeState(null).find, DEFAULT_FIND);
  assert.deepEqual(normalizeState({ v: 4 }).find, DEFAULT_FIND, 'régi állapot find nélkül');
  assert.deepEqual(clampFind({ cards: 8, tasks: 25, level: 4 }), { cards: 8, tasks: 25, level: 4 });
  assert.deepEqual(clampFind({ cards: 5, tasks: 99, level: 9 }), { cards: 4, tasks: 30, level: 1 });
  assert.deepEqual(clampFind({ cards: '6', tasks: 0, level: '3' }), { cards: 6, tasks: 1, level: 3 });
  assert.deepEqual(clampFind({ tasks: 'x', level: null }), DEFAULT_FIND);
  assert.equal(normalizeState({ v: 4, find: { cards: 8 } }).v, 4, 'a v marad 4');
});

test('nehézség: 1–5 → a heurisztika 0 · 0,25 · 0,5 · 0,75 · 1 fokozata (F-S6)', () => {
  assert.deepEqual(LEVELS.map((l) => levelToDegree(l)), [0, 0.25, 0.5, 0.75, 1]);
  assert.equal(LEVEL_LABELS[1], 'jól megkülönböztethető');
  assert.equal(LEVEL_LABELS[5], 'nagyon hasonló');
  assert.equal(findEstimate({ tasks: 10, cards: 4 }), '10 feladat · 4 kártya');
});

test('állapot: v4 séma, a v3 adatai megmaradnak', () => {
  const v3 = { v: 3, settings: { flashMs: 5000, gapMs: 2500, count: 12, source: 'all' }, lastLists: ['A'], hideHelp: true,
    cache: { text: '# A\na', fetchedAt: 5, kind: 'sheet' } };
  const s = normalizeState(v3);
  assert.equal(s.v, 4);
  assert.deepEqual(s.settings, { flashMs: 5000, gapMs: 2000, count: 12, source: 'all' });
  assert.deepEqual(s.lastLists, ['A']);
  assert.equal(s.hideHelp, true);
  assert.deepEqual(s.cache, { text: '# A\na', fetchedAt: 5, kind: 'sheet' });
});

test('becslés: „N tétel · kb. X mp”, percekkel 60 mp fölött, kézi léptetés', () => {
  assert.deepEqual(estimate({ count: 10, flashMs: 4000, gapMs: 0 }), { count: '10 tétel', time: 'kb. 40 mp' });
  assert.deepEqual(estimate({ count: 10, flashMs: 10000, gapMs: 0 }), { count: '10 tétel', time: 'kb. 1 perc 40 mp' });
  assert.deepEqual(estimate({ count: 6, flashMs: 9000, gapMs: 1000 }), { count: '6 tétel', time: 'kb. 1 perc' });
  assert.deepEqual(estimate({ count: 10, flashMs: 0, gapMs: 1000 }), { count: '10 tétel', time: 'kézi léptetés' });
});
