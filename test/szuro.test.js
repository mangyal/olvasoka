// Tételszűrő (docs/megjelenes-specifikacio.md, SZR-1–SZR-8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { typeKeyOf, clampFilter, filterRows, typeCounts, chipModel, toggleChip, toggleSub, countText, TYPE_KEYS } from '../js/core/type-filter.js';
import { buildReadSequence, mulberry32 } from '../js/core/sequence.js';
import { normalizeState } from '../js/core/settings.js';
import { distinctItems } from '../js/core/items.js';

const ROWS = ['a', 'e', 'm', 'sz', 'am', 'ma', 'mo', 'kap', 'ka-pu', 'a ló húz.', 'a', 'ma'];
const items = distinctItems(ROWS);
const chips = (off) => chipModel(typeCounts(items), off);
const brief = (cs) => cs.map((c) => `${c.label}:${c.state}:${c.n}${c.hasSub ? '▾' : ''}`);

test('típus: a csoportokból (V, C, VC, CV, S, W, M)', () => {
  assert.deepEqual(['a', 'm', 'dzs', 'am', 'ma', 'kap', 'pré', 'ka-pu', 'kapu', 'a ló húz.', 'Ma'].map(typeKeyOf),
    ['V', 'C', 'C', 'VC', 'CV', 'S', 'S', 'W', 'W', 'M', 'CV']);
});

test('szűrő: érvényes alak; tárolódik, régi állapotnál nincs szűrés (SZR-6, N-1)', () => {
  assert.deepEqual(clampFilter(['W', 'x', 'V', 'W', 3]), ['V', 'W']);
  assert.deepEqual(clampFilter('V'), []);
  assert.deepEqual(normalizeState({ v: 4 }).typeFilter, []);
  assert.deepEqual(normalizeState({ v: 4, typeFilter: ['M', 'C'] }).typeFilter, ['C', 'M']);
  assert.equal(TYPE_KEYS.length, 7);
});

test('chipek: mind a négy, a jelen lévő altípusokkal; különböző tételek száma (SZR-1–SZR-4)', () => {
  assert.deepEqual(brief(chips([])), ['Betűk:on:4▾', 'Szótagok:on:4▾', 'Szavak:on:1', 'Mondatok:on:1']);
  const [betu, szotag] = chips([]);
  assert.deepEqual(betu.subs.map((s) => [s.key, s.label, s.n]), [['V', 'Magánhangzók', 2], ['C', 'Mássalhangzók', 2]]);
  assert.deepEqual(szotag.subs.map((s) => s.label), ['CV (pl. ma)', 'VC (pl. am)', 'Egyéb']);
  assert.deepEqual(brief(chips(['C'])), ['Betűk · 1/2:part:2▾', 'Szótagok:on:4▾', 'Szavak:on:1', 'Mondatok:on:1']);
  assert.deepEqual(brief(chips(['V', 'C', 'M'])).slice(0, 1), ['Betűk:off:0▾']);
});

test('chipek: csak a jelen lévő chip és altípus látszik; egy altípusnál nincs ▾ (elfogadás 8, 9)', () => {
  const only = (xs) => brief(chipModel(typeCounts(xs), []));
  assert.deepEqual(only(['a', 'ma', 'ka-pu']), ['Betűk:on:1', 'Szótagok:on:1', 'Szavak:on:1'], 'nincs Mondatok chip; egy altípus: nincs ▾');
  assert.deepEqual(only(['ma', 'mo', 'a ló.']), ['Szótagok:on:2', 'Mondatok:on:1']);
  assert.deepEqual(chipModel(typeCounts(['ma', 'am']), [])[0].label, 'Szótagok');
  assert.deepEqual(chipModel(typeCounts([]), []), []);
});

test('chipek: a tárolt, de most nem jelen lévő altípus állapota marad, nem számít (SZR-6, D-7)', () => {
  const cs = chipModel(typeCounts(['ma', 'mo']), ['VC']);
  assert.deepEqual(brief(cs), ['Szótagok:on:2'], 'a VC nincs jelen: a chip teljes');
  assert.deepEqual(toggleChip(['VC'], cs[0]), ['VC', 'CV'], 'koppintás: a jelen lévő CV ki, a VC kikapcsolva marad');
  const off = chipModel(typeCounts(['ma', 'mo']), ['VC', 'CV'])[0];
  assert.deepEqual(toggleChip(['VC', 'CV'], off), ['VC'], 'bekapcsolás: csak a jelen lévő');
});

test('chipre koppintás: mind egyszerre; a részben bekapcsolt kikapcsol; altípus váltás (SZR-4)', () => {
  const [betu] = chips([]);
  assert.deepEqual(toggleChip([], betu), ['V', 'C']);
  const part = chips(['C'])[0];
  assert.deepEqual(toggleChip(['C'], part), ['V', 'C']);
  const offChip = chips(['V', 'C'])[0];
  assert.deepEqual(toggleChip(['V', 'C', 'W'], offChip), ['W']);
  assert.deepEqual(toggleSub(['C'], 'C'), []);
  assert.deepEqual(toggleSub([], 'S'), ['S']);
});

test('szűrés: a sorok ismétlésekkel maradnak; csak magánhangzó → a kör csak V, hossza a beállított (elfogadás 6, SZR-5)', () => {
  assert.equal(filterRows(ROWS, []), ROWS);
  const v = filterRows(ROWS, ['C', 'VC', 'CV', 'S', 'W', 'M']);
  assert.deepEqual(v, ['a', 'e', 'a']);
  const seq = buildReadSequence(v, 10, {}, mulberry32(7));
  assert.equal(seq.length, 10);
  assert.ok(seq.every((i) => ['a', 'e'].includes(v[i])));
  assert.deepEqual(filterRows(ROWS, TYPE_KEYS), [], 'minden típus ki (elfogadás 7)');
});

test('számláló (SZR-8)', () => {
  assert.equal(countText(62, 62, 3), '62 kártya · 3 csomag');
  assert.equal(countText(34, 62, 3), '34 / 62 kártya · 3 csomag');
  assert.equal(countText(0, 62, 1), '0 / 62 kártya · 1 csomag');
});
