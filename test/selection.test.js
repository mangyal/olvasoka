import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clickSelect, reconcile, itemsOf } from '../js/core/selection.js';
import { normalizeState } from '../js/core/settings.js';

const keys = ['a', 'b', 'c', 'd', 'e'];

test('kijelölés: sima kattintás csak azt jelöli ki', () => {
  assert.deepEqual(clickSelect(['a', 'c'], 'd', { keys }), { sel: ['d'], anchor: 'd' });
});

test('kijelölés: Ctrl hozzáad és kivesz, az utolsó megmarad', () => {
  let r = clickSelect(['a'], 'c', { toggle: true, keys });
  assert.deepEqual(r.sel, ['a', 'c']);
  r = clickSelect(r.sel, 'a', { toggle: true, keys });
  assert.deepEqual(r.sel, ['c']);
  r = clickSelect(r.sel, 'c', { toggle: true, keys });
  assert.deepEqual(r.sel, ['c'], 'legalább egy lista marad');
  assert.deepEqual(clickSelect(['d'], 'a', { toggle: true, keys }).sel, ['a', 'd'], 'megjelenési sorrend');
});

test('kijelölés: Shift tartomány az anchortól', () => {
  assert.deepEqual(clickSelect(['b'], 'd', { range: true, anchor: 'b', keys }), { sel: ['b', 'c', 'd'], anchor: 'b' });
  assert.deepEqual(clickSelect(['b', 'c', 'd'], 'a', { range: true, anchor: 'b', keys }).sel, ['a', 'b'], 'visszafelé, csere');
  assert.deepEqual(clickSelect(['e'], 'c', { range: true, toggle: true, anchor: 'a', keys }).sel, ['a', 'b', 'c', 'e'], 'Ctrl+Shift hozzáad');
  assert.deepEqual(clickSelect([], 'c', { range: true, anchor: 'zz', keys }).sel, ['c'], 'nincs érvényes anchor');
});

test('kijelölés: egyeztetés a létező listákkal', () => {
  assert.deepEqual(reconcile(['x', 'c', 'a'], keys), ['a', 'c']);
  assert.deepEqual(reconcile(['x'], keys), ['a']);
  assert.deepEqual(reconcile(['x'], []), []);
});

test('kijelölés: tételek uniója ismétlődés nélkül', () => {
  const lists = [{ name: 'A', items: ['m', 'a'] }, { name: 'B', items: ['x'] }, { name: 'C', items: ['a', 'o'] }];
  assert.deepEqual(itemsOf(lists, ['a', 'c'], (n) => n.toLowerCase()), ['m', 'a', 'o']);
});

test('tárolt állapot: v2 → v3', () => {
  assert.deepEqual(normalizeState({ v: 2, lastList: '45. oldal' }).lastLists, ['45. oldal']);
  assert.deepEqual(normalizeState({ v: 3, lastLists: ['A', 3, 'B'] }).lastLists, ['A', 'B']);
  assert.deepEqual(normalizeState(null), { v: 3, settings: normalizeState(null).settings, lastLists: [], cache: null });
});
