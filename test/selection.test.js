import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clickSelect, paint, rangeKeys, reconcile, existing, itemsOf, wantedSelection } from '../js/core/selection.js';
import { distinctItems } from '../js/core/items.js';
import { normalizeState } from '../js/core/settings.js';

const keys = ['a', 'b', 'c', 'd', 'e'];

test('kijelölés: kattintás csak a kattintott sor pipáját váltja, a többi marad (3.1)', () => {
  assert.deepEqual(clickSelect(['a', 'c'], 'd', { keys }), { sel: ['a', 'c', 'd'], anchor: 'd', on: true });
  assert.deepEqual(clickSelect(['a', 'c'], 'a', { keys }), { sel: ['c'], anchor: 'a', on: false });
  assert.deepEqual(clickSelect(['c'], 'c', { keys }).sel, [], 'az utolsó is kivehető: üres kijelölés');
  assert.deepEqual(clickSelect(['d'], 'a', { keys }).sel, ['a', 'd'], 'megjelenési sorrend');
  assert.deepEqual(clickSelect(['a'], 'zz', { keys }).sel, ['a'], 'ismeretlen kulcs: nem változik');
});

test('kijelölés: Shift + kattintás tartomány az előző kattintott sortól, a kattintott sor új állapotával', () => {
  assert.deepEqual(clickSelect(['b'], 'd', { range: true, anchor: 'b', keys }), { sel: ['b', 'c', 'd'], anchor: 'd', on: true });
  assert.deepEqual(clickSelect(keys, 'b', { range: true, anchor: 'd', keys }).sel, ['a', 'e'], 'kivétel visszafelé');
  assert.deepEqual(clickSelect(['e'], 'c', { range: true, anchor: 'a', keys }).sel, ['a', 'b', 'c', 'e'], 'a tartományon kívüli marad');
  assert.deepEqual(clickSelect([], 'c', { range: true, anchor: 'zz', keys }).sel, ['c'], 'nincs érvényes előző sor');
  assert.deepEqual(clickSelect([], 'c', { range: true, anchor: null, keys }).sel, ['c']);
});

test('kijelölés: végighúzás és tartomány segédei', () => {
  assert.deepEqual(paint(['a'], ['c', 'b'], true, keys), ['a', 'b', 'c']);
  assert.deepEqual(paint(['a', 'b', 'c'], ['b', 'x'], false, keys), ['a', 'c']);
  assert.deepEqual(rangeKeys(keys, 'd', 'b'), ['b', 'c', 'd']);
  assert.deepEqual(rangeKeys(keys, 'x', 'b'), ['b']);
});

test('kijelölés: Összesből egy csomag kivétele: minden más kijelölve marad (3.1)', () => {
  // Összes csomag: minden sor pipás, a kattintás a teljes készletből vesz ki
  assert.deepEqual(clickSelect(keys, 'c', { keys }), { sel: ['a', 'b', 'd', 'e'], anchor: 'c', on: false });
});

test('kijelölés: a Kijelöltre visszaváltáskor a mentett kijelölés a létező csomagokra szűkül, üresen is', () => {
  assert.deepEqual(existing(['x', 'c', 'a'], keys), ['a', 'c']);
  assert.deepEqual(existing(['x'], keys), [], 'üres marad, nem az első csomag');
  assert.deepEqual(existing([], keys), []);
});

test('kijelölés: egyeztetés a létező listákkal', () => {
  assert.deepEqual(reconcile(['x', 'c', 'a'], keys), ['a', 'c']);
  assert.deepEqual(reconcile(['x'], keys), ['a']);
  assert.deepEqual(reconcile(['x'], []), []);
});

test('kijelölés: a kijelölt listák sorai, ismétlésekkel, a listák sorrendjében (2.14, S-2)', () => {
  const lists = [{ name: 'A', items: ['m', 'a', 'm'] }, { name: 'B', items: ['x'] }, { name: 'C', items: ['a', 'o'] }];
  assert.deepEqual(itemsOf(lists, ['a', 'c'], (n) => n.toLowerCase()), ['m', 'a', 'm', 'a', 'o']);
});

test('különböző tételek: itemKey szerint, első előfordulásuk sorrendjében (S-3)', () => {
  assert.deepEqual(distinctItems(['a', 'e', 'a', 'e', 'o']), ['a', 'e', 'o']);
  assert.deepEqual(distinctItems(['ma', 'Ma', 'm-a', 'ma', 'mama']), ['ma', 'Ma', 'm-a', 'mama'], 'a kis- és nagybetű, a kötőjel számít');
  assert.deepEqual(distinctItems([]), []);
});

test('tárolt állapot: v2 → v3', () => {
  assert.deepEqual(normalizeState({ v: 2, lastList: '45. oldal' }).lastLists, ['45. oldal']);
  assert.deepEqual(normalizeState({ v: 3, lastLists: ['A', 3, 'B'] }).lastLists, ['A', 'B']);
  assert.deepEqual(normalizeState(null), { v: 4, mode: 'read', settings: normalizeState(null).settings, find: { cards: 4, tasks: 10, level: 1 }, lastLists: [], hideHelp: false, tour: null, cache: null });
  assert.equal(normalizeState({ hideHelp: true }).hideHelp, true);
  assert.equal(normalizeState({ hideHelp: 'igen' }).hideHelp, false);
});

test('betöltéskor: mostani → mentett → a táblázat jelölői → az első lista (F-L1d)', () => {
  const pick = (o) => reconcile(wantedSelection({ source: 'list', selected: [], last: [], preset: [], keys, ...o }), keys);
  assert.deepEqual(pick({ preset: ['d', 'b'] }), ['b', 'd'], 'első betöltés: az alapból kijelöltek, megjelenési sorrendben');
  assert.deepEqual(pick({ preset: ['d'], last: ['c'] }), ['c'], 'a mentett kijelölés erősebb');
  assert.deepEqual(pick({ preset: ['d'], last: ['c'], selected: ['e'] }), ['e'], 'a mostani kijelölés a legerősebb');
  assert.deepEqual(pick({ preset: ['d'], last: ['x'] }), ['d'], 'ha a mentett lista már nem létezik, a jelölő jön');
  assert.deepEqual(pick({ preset: ['d'], selected: ['x'], last: ['c'] }), ['c']);
  assert.deepEqual(pick({ preset: ['x'] }), ['a'], 'nem létező jelölt lista: az első');
  assert.deepEqual(pick({}), ['a'], 'jelölő nélkül: az első, mint eddig');
  assert.deepEqual(pick({ preset: keys }), keys);
  assert.deepEqual(pick({ source: 'all', preset: ['b'] }), keys, 'Összes csomag módban mind');
  assert.deepEqual(pick({ preset: ['b'], last: [] }), ['b'], 'üresen mentett kijelölés (Egyik sem): újratöltéskor a jelölők (döntés 2026-11-18)');
});
