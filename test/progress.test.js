// Pöttyös haladásjelző (design spec 7.).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progressModel, dotState, fromSuffix, DOT_MAX } from '../js/core/progress.js';

test('haladás: 20 tételig pöttyök, fölötte sáv', () => {
  assert.equal(DOT_MAX, 20);
  assert.equal(progressModel(0, 10).kind, 'dots');
  assert.equal(progressModel(0, 20).kind, 'dots');
  assert.equal(progressModel(0, 21).kind, 'bar');
  assert.equal(progressModel(0, 50).kind, 'bar');
});

test('haladás: felirat, szöveg, kitöltés', () => {
  const m = progressModel(3, 10);
  assert.equal(m.label, '4. tétel a 10-ből');
  assert.equal(m.text, '4/10');
  assert.equal(m.current, 3);
  assert.equal(m.fraction, 0.4);
  assert.equal(progressModel(11, 50).text, '12/50');
  assert.equal(progressModel(0, 1).fraction, 1);
});

test('haladás: a határon kívüli index a körbe szorul', () => {
  assert.equal(progressModel(-2, 10).current, 0);
  assert.equal(progressModel(99, 10).current, 9);
  assert.equal(progressModel(0, 0).total, 1);
});

test('haladás: pötty-állapotok (visszalépés csak a current-et mozgatja)', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((k) => dotState(k, 2)), ['done', 'done', 'current', 'todo', 'todo']);
  assert.deepEqual([0, 1, 2].map((k) => dotState(k, 0)), ['current', 'todo', 'todo']);
});

test('haladás: -ból/-ből rag a szám kiejtése szerint', () => {
  const want = { 1: 'ből', 3: 'ból', 5: 'ből', 6: 'ból', 8: 'ból', 10: 'ből', 13: 'ból', 15: 'ből',
    20: 'ból', 26: 'ból', 30: 'ból', 40: 'ből', 50: 'ből', 60: 'ból', 70: 'ből', 80: 'ból', 90: 'ből', 100: 'ból' };
  for (const [n, s] of Object.entries(want)) assert.equal(fromSuffix(+n), s, `${n}`);
});

test('haladásjelző: Keresd meg!-ben a feladatokat számolja', () => {
  assert.equal(progressModel(2, 10, 'feladat').label, '3. feladat a 10-ből');
});
