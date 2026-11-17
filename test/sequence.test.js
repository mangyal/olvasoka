// A Felolvasás körének összeállítása (spec 4.1, 2.14: F-4–F-11). Seedelt, determinisztikus tesztek.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReadSequence, arrangeBlock, shuffledIdx, mulberry32 } from '../js/core/sequence.js';
import { groupOf, compareRank } from '../js/core/groups.js';
import { itemKey } from '../js/core/items.js';
import { parseListsText } from '../js/core/lists.js';

const LISTS = parseListsText(readFileSync(new URL('../lists.txt', import.meta.url), 'utf8')).lists;
const list = (name) => LISTS.find((l) => l.name === name).items;
const texts = (rows, seq) => seq.map((i) => rows[i]);
const count = (xs, x) => xs.filter((y) => y === x).length;

/** Egymás utáni azonos csoportú tételek: [csoport, tételek][]. */
function blocks(xs) {
  const out = [];
  for (const x of xs) {
    const k = groupOf(x).key;
    if (out.length && out.at(-1)[0] === k) out.at(-1)[1].push(x); else out.push([k, [x]]);
  }
  return out;
}

/** Véletlen súlyozott lista: néhány tétel, mindegyik 1–4 sorral, vegyes csoportokból. */
function randomRows(rng) {
  const pool = ['a', 'e', 'o', 'm', 'k', 'sz', 'ók', 'el', 'fa', 'mo', 'szó', 'kap', 'ke-fe', 'lu-fi', 'pi-ló-ta', 'Ma', 'ma'];
  const rows = [];
  const n = 1 + Math.floor(rng() * 8);
  for (let i = 0; i < n; i++) {
    const t = pool[Math.floor(rng() * pool.length)];
    for (let k = 1 + Math.floor(rng() * 4); k > 0; k--) rows.push(t);
  }
  return shuffledIdx(rows.length, rng).map((i) => rows[i]);
}

test('F-5: 10 000 seedelt körben soha nincs két azonos tétel egymás után, mindkét kapcsolóállásnál', () => {
  const rng = mulberry32(2026);
  for (let k = 0; k < 10000; k++) {
    const rows = randomRows(rng), N = 1 + Math.floor(rng() * 50), mixed = k % 2 === 1;
    const xs = texts(rows, buildReadSequence(rows, N, { mixed }, rng));
    assert.ok(xs.length >= 1 && xs.length <= N);
    for (let i = 1; i < xs.length; i++) {
      assert.notEqual(itemKey(xs[i]), itemKey(xs[i - 1]), `${k}. kör (${mixed ? 'kevert' : 'csoportosított'}): ${xs.join(' ')}`);
    }
  }
});

test('F-7: a kör N tételes, ha a sorok engedik; ismétlődő tétel mellett is', () => {
  const rng = mulberry32(5);
  for (let k = 0; k < 2000; k++) {
    const rows = randomRows(rng), N = 1 + Math.floor(rng() * 50);
    const distinct = new Set(rows.map(itemKey)).size;
    // csak akkor rövidebb, ha egyetlen sor sem fér be: kevert módban 1 tétel esetén
    const xs = texts(rows, buildReadSequence(rows, N, { mixed: true }, rng));
    assert.equal(xs.length, distinct === 1 ? 1 : N, rows.join(' '));
  }
});

test('F-7: csak `a` sorokból álló kijelölés → 1 tételes kör, hiba nélkül', () => {
  for (const mixed of [false, true]) {
    assert.deepEqual(buildReadSequence(['a', 'a', 'a'], 10, { mixed }, mulberry32(1)).length, 1);
    assert.deepEqual(buildReadSequence(['a'], 10, { mixed }, mulberry32(1)), [0]);
  }
  assert.deepEqual(buildReadSequence([], 10), []);
  assert.deepEqual(buildReadSequence(['a', 'e'], 0), []);
});

test('F-8: kikapcsolt kapcsolónál a 45. oldal 20-as köre csoportblokkokban, a C-2 sorrendben', () => {
  const rows = list('45. oldal');
  for (let s = 1; s <= 200; s++) {
    const xs = texts(rows, buildReadSequence(rows, 20, { mixed: false }, mulberry32(s)));
    assert.equal(xs.length, 20);
    const bs = blocks(xs);
    assert.equal(new Set(bs.map(([k]) => k)).size, bs.length, `seed ${s}: minden csoport egy blokk: ${xs.join(' ')}`);
    for (let i = 1; i < bs.length; i++) {
      assert.ok(compareRank(groupOf(bs[i - 1][1][0]).rank, groupOf(bs[i][1][0]).rank) < 0, `seed ${s}: sorrend ${bs.map(([k]) => k)}`);
    }
  }
});

test('F-8: minden blokkban egy tétel legfeljebb ⌈blokkméret / 2⌉-szer szerepel', () => {
  const rng = mulberry32(17);
  for (let k = 0; k < 3000; k++) {
    const rows = randomRows(rng);
    for (const [, xs] of blocks(texts(rows, buildReadSequence(rows, 30, { mixed: false }, rng)))) {
      for (const x of new Set(xs)) assert.ok(count(xs, x) <= Math.ceil(xs.length / 2), xs.join(' '));
    }
  }
});

test('F-9: bekapcsolt kapcsolónál a kör nem csoportosított (van visszaváltás egy korábbi csoportra)', () => {
  const rows = list('45. oldal');
  let back = 0;
  for (let s = 1; s <= 50; s++) {
    const keys = blocks(texts(rows, buildReadSequence(rows, 20, { mixed: true }, mulberry32(s)))).map(([k]) => k);
    if (new Set(keys).size < keys.length) back++;
  }
  assert.ok(back >= 45, `visszaváltás ${back}/50 körben`);
});

test('F-4: súly — egy 1× és egy 3× beírt tétel aránya sok körön át kb. 1 : 3', () => {
  // sok különböző tétel, hogy az F-5 ne korlátozzon
  const rows = ['ba', 'ce', 'ce', 'ce', 'di', 'fo', 'gu', 'he', 'ji', 'ko', 'lu', 'mé', 'nó', 'pá', 'ré', 'só', 'tú', 'vő'];
  for (const mixed of [false, true]) {
    const rng = mulberry32(mixed ? 11 : 12);
    let one = 0, three = 0;
    for (let k = 0; k < 6000; k++) {
      const xs = texts(rows, buildReadSequence(rows, 6, { mixed }, rng));
      one += count(xs, 'ba'); three += count(xs, 'ce');
    }
    const r = three / one;
    assert.ok(r > 2.8 && r < 3.2, `${mixed ? 'kevert' : 'csoportosított'}: 1 : ${r.toFixed(2)}`);
  }
});

test('F-4: az a, e, a, e, o listában az a és az e kétszer akkora eséllyel jön, mint az o', () => {
  const rows = ['a', 'e', 'a', 'e', 'o'], rng = mulberry32(8), n = { a: 0, e: 0, o: 0 };
  for (let k = 0; k < 20000; k++) for (const x of texts(rows, buildReadSequence(rows, 1, {}, rng))) n[x]++;
  for (const x of ['a', 'e']) assert.ok(Math.abs(n[x] / n.o - 2) < 0.15, `${x} : o = ${(n[x] / n.o).toFixed(2)}`);
});

test('3.3 példa: k m k s k l c k p k m — a k súlya 5; a 11-es körben minden sor bent, k sosem szomszédos', () => {
  const rows = 'k m k s k l c k p k m'.split(' ');
  for (let s = 1; s <= 300; s++) {
    const xs = texts(rows, buildReadSequence(rows, 11, { mixed: false }, mulberry32(s)));
    assert.deepEqual([...xs].sort(), [...rows].sort(), `seed ${s}`);
    for (let i = 1; i < xs.length; i++) assert.ok(!(xs[i] === 'k' && xs[i - 1] === 'k'), xs.join(' '));
  }
});

test('3.3 példa: kétszer beírt ók — a VC-blokkban nem kerül egymás mellé, helyette más sor jön', () => {
  const rows = ['ók', 'ók', 'fa', 'mo', 'szó', 'lu-fi'];
  let seen = 0;
  for (let s = 1; s <= 300; s++) {
    const xs = texts(rows, buildReadSequence(rows, 4, { mixed: false }, mulberry32(s)));
    assert.equal(xs.length, 4, 'a második ók helyett más sor jön');
    assert.ok(count(xs, 'ók') <= 1, `egyetlen VC tétel: a VC-blokk legfeljebb 1 tételes (${xs.join(' ')})`);
    seen += count(xs, 'ók');
  }
  assert.ok(seen > 150, `az ók bekerül: ${seen}/300`);
});

test('F-4: ha a sorok elfogytak, újra húzhatók; a hosszú kör a súlyokat követi', () => {
  const rows = ['a', 'e', 'e', 'o'];
  const xs = texts(rows, buildReadSequence(rows, 40, { mixed: true }, mulberry32(3)));
  assert.equal(xs.length, 40);
  assert.ok(count(xs, 'e') >= 15 && count(xs, 'e') <= 20, `e: ${count(xs, 'e')}`);
  // csoportosított módban is: egy csoport, F-5 szerint a fele lehet e
  const ys = texts(rows, buildReadSequence(rows, 40, { mixed: false }, mulberry32(3)));
  assert.equal(ys.length, 40);
  for (let i = 1; i < ys.length; i++) assert.notEqual(ys[i], ys[i - 1]);
});

test('kis- és nagybetű: Ma és ma két tétel, egymás mellé kerülhetnek', () => {
  const rows = ['Ma', 'ma'];
  const xs = texts(rows, buildReadSequence(rows, 6, { mixed: false }, mulberry32(4)));
  assert.equal(xs.length, 6);
  for (let i = 1; i < xs.length; i++) assert.notEqual(xs[i], xs[i - 1]);
});

test('seedelt rng-vel determinisztikus', () => {
  const rows = list('45. oldal');
  for (const mixed of [false, true]) {
    assert.deepEqual(buildReadSequence(rows, 20, { mixed }, mulberry32(42)), buildReadSequence(rows, 20, { mixed }, mulberry32(42)));
  }
});

test('F-10: blokk elrendezése szomszédos ismétlés nélkül, a ⌈méret / 2⌉ határon is', () => {
  const keys = ['a', 'a', 'a', 'b', 'b'];
  for (let s = 1; s <= 100; s++) assert.deepEqual(arrangeBlock([0, 1, 2, 3, 4], keys, mulberry32(s)).map((i) => keys[i]), ['a', 'b', 'a', 'b', 'a']);
  const k2 = ['a', 'a', 'b', 'b', 'c', 'c', 'c'];
  for (let s = 1; s <= 300; s++) {
    const xs = arrangeBlock(k2.map((_, i) => i), k2, mulberry32(s)).map((i) => k2[i]);
    assert.deepEqual([...xs].sort(), [...k2].sort());
    for (let i = 1; i < xs.length; i++) assert.notEqual(xs[i], xs[i - 1], xs.join(''));
  }
});

test('shuffledIdx: Fisher–Yates, minden index egyszer', () => {
  for (let s = 1; s <= 50; s++) assert.deepEqual([...shuffledIdx(7, mulberry32(s))].sort(), [0, 1, 2, 3, 4, 5, 6]);
});
