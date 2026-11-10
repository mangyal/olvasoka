// A Keresd meg! kör (spec 4a.): feladatok, jelölés, lépés, telefonos kártyaszám, elrendezés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTasks, buildTaskGrids, startFind, step, canPrev, effectiveCards, gridShape, distinctCount } from '../js/core/find.js';
import { compileConfig, seeded, normalize } from '../js/core/grid.js';

const CC = compileConfig(JSON.parse(readFileSync(new URL('./fixtures/parok.json', import.meta.url), 'utf8')));
const ITEMS = ['ma', 'me', 'mi', 'mo', 'na', 'ne', 'la', 'le', 'hal', 'hol', 'sál', 'hát', 'ma-ma', 'ka-pu'];
const run = (s, evs) => evs.reduce((acc, e) => (Array.isArray(e) ? step(acc, ...e) : step(acc, e)), s);

test('feladatok: pontosan K, mindegyikben N különböző tétel a forrásból; seedelve determinisztikus (23.)', () => {
  const t = buildTasks(ITEMS, { cards: 4, tasks: 10, level: 0 }, CC, seeded(1));
  assert.equal(t.length, 10);
  for (const g of t) {
    assert.equal(g.length, 4);
    assert.equal(new Set(g.map(normalize)).size, 4);
    for (const x of g) assert.ok(ITEMS.includes(x));
  }
  assert.deepEqual(buildTasks(ITEMS, { cards: 4, tasks: 10, level: 0 }, CC, seeded(1)), t);
});

test('feladatok: kevesebb tétel, mint a kártyaszám → az összes elérhető (F-K3)', () => {
  const t = buildTasks(['ma', 'me', 'mi'], { cards: 8, tasks: 3, level: 1 }, CC, seeded(2));
  for (const g of t) assert.deepEqual(new Set(g), new Set(['ma', 'me', 'mi']));
});

test('feladatok: két egymást követő feladat horgonya nem azonos (F-K16)', () => {
  for (const [items, seed] of [[ITEMS, 4], [['ma', 'me'], 8], [['ma', 'me', 'mi'], 9]]) {
    const g = buildTaskGrids(items, { cards: 4, tasks: 30, level: 0.5 }, CC, seeded(seed));
    assert.equal(g.length, 30);
    for (let k = 1; k < g.length; k++) assert.notEqual(g[k].anchor, g[k - 1].anchor, `${k}. feladat`);
  }
  // egyetlen tételnél nincs mit váltogatni: a kör akkor is elkészül (az Indítás ilyenkor inaktív, F-S8)
  assert.equal(buildTasks(['ma'], { cards: 4, tasks: 3, level: 0 }, CC, seeded(1)).length, 3);
});

test('különböző tételek száma (F-S8)', () => {
  assert.equal(distinctCount(['ma', 'Ma', 'm-a']), 1);
  assert.equal(distinctCount(['ma', 'me']), 2);
  assert.equal(distinctCount([]), 0);
});

test('jelölés: kattintás jelöl, ugyanarra újra lekerül, másikra átkerül, nem léptet (25.)', () => {
  let s = startFind([['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']]);
  s = step(s, 'MARK', 2); assert.equal(s.marked, 2); assert.equal(s.index, 0);
  s = step(s, 'MARK', 2); assert.equal(s.marked, null);
  s = run(s, [['MARK', 1], ['MARK', 3]]); assert.equal(s.marked, 3, 'egyszerre egy jelölt');
  assert.equal(step(s, 'MARK', 9).marked, 3, 'nem létező kártya');
  assert.equal(step(s, 'MARK', -1).marked, 3);
});

test('← után ugyanaz a feladat, ugyanabban a sorrendben, jelölés nélkül (24.)', () => {
  const tasks = [['a', 'b', 'c', 'd'], ['e', 'f', 'g', 'h']];
  let s = startFind(tasks);
  s = run(s, [['MARK', 1], 'NEXT']);
  assert.equal(s.index, 1); assert.equal(s.marked, null);
  s = run(s, [['MARK', 0], 'PREV']);
  assert.equal(s.index, 0); assert.equal(s.marked, null);
  assert.deepEqual(s.tasks[0], ['a', 'b', 'c', 'd']);
});

test('→ az utolsó feladaton jutalomra vált; ← az elsőn nincs hatással (26.)', () => {
  let s = startFind([['a', 'b'], ['c', 'd']]);
  assert.equal(canPrev(s), false);
  assert.equal(step(s, 'PREV'), s);
  s = run(s, ['NEXT', 'NEXT']);
  assert.equal(s.done, true);
  assert.equal(step(s, 'PREV'), s, 'kész kör nem változik');
});

test('telefonon legfeljebb 6 kártya, a beállítás változatlan (F-K10)', () => {
  assert.equal(effectiveCards(8, 390, 844), 6);
  assert.equal(effectiveCards(8, 844, 390), 6);
  assert.equal(effectiveCards(4, 390, 844), 4);
  assert.equal(effectiveCards(8, 820, 1180), 8);
  assert.equal(effectiveCards(8, 1280, 500), 8, 'rövidebb oldal pont 500: nem telefon');
});

test('elrendezés a nézet alakja szerint (F-K12)', () => {
  assert.deepEqual(gridShape(4, true), { cols: 2, rows: 2 });
  assert.deepEqual(gridShape(4, false), { cols: 2, rows: 2 });
  assert.deepEqual(gridShape(6, true), { cols: 3, rows: 2 });
  assert.deepEqual(gridShape(6, false), { cols: 2, rows: 3 });
  assert.deepEqual(gridShape(8, true), { cols: 4, rows: 2 });
  assert.deepEqual(gridShape(8, false), { cols: 2, rows: 4 });
});
