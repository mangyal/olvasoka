// Közös véletlen segédek (js/core/random.js): keverés és súlyozott húzás.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffleInPlace, pickWeighted } from '../js/core/random.js';

/** Előre megadott értékeket ad vissza, és számolja a hívásokat. */
const fixed = (...xs) => { const f = () => { f.calls++; return xs.shift(); }; f.calls = 0; return f; };

test('random: a keverés helyben dolgozik, és minden elem megmarad', () => {
  const a = [1, 2, 3, 4, 5];
  const r = shuffleInPlace(a, fixed(0.1, 0.9, 0.5, 0.3));
  assert.equal(r, a, 'ugyanaz a tömb');
  assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5]);
  assert.deepEqual(shuffleInPlace([], fixed()), []);
});

test('random: súlyozott húzás a súlyok arányában', () => {
  assert.equal(pickWeighted([1, 1, 2], fixed(0.0)), 0);
  assert.equal(pickWeighted([1, 1, 2], fixed(0.3)), 1);
  assert.equal(pickWeighted([1, 1, 2], fixed(0.6)), 2);
  assert.equal(pickWeighted([0, 3, 0], fixed(0.99)), 1, 'a 0 súlyú elem nem jöhet');
});

test('random: csupa 0 súly – a két korábbi viselkedés megmaradt, egy rng-hívással', () => {
  // a Felolvasás (sequence.js): az utolsó index
  const a = fixed(0.2);
  assert.equal(pickWeighted([0, 0, 0], a), 2);
  assert.equal(a.calls, 1);
  // a Keresd meg! rácsa (grid.js): egyenletes húzás
  const b = fixed(0.4);
  assert.equal(pickWeighted([0, 0, 0], b, { uniformIfZero: true }), 1);
  assert.equal(b.calls, 1);
});
