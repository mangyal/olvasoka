import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSequence, mulberry32 } from '../js/core/sequence.js';
import { analyzeItems } from '../js/core/items.js';
import { parseListsText } from '../js/core/lists.js';
import { clampSettings, normalizeState } from '../js/core/settings.js';

const sorted = (a) => [...a].sort((x, y) => x - y).join();

test('9.1 húzózsák: 4 tétel, 10-es kör, 500 seed', () => {
  for (let s = 1; s <= 500; s++) {
    const q = buildSequence(4, 10, mulberry32(s));
    assert.equal(q.length, 10);
    assert.equal(sorted(q.slice(0, 4)), '0,1,2,3', `seed ${s}`);
    assert.equal(sorted(q.slice(4, 8)), '0,1,2,3', `seed ${s}`);
    assert.notEqual(q[8], q[9]);
    assert.notEqual(q[3], q[4], `seed ${s}: 4. és 5.`);
    assert.notEqual(q[7], q[8], `seed ${s}: 8. és 9.`);
  }
});

test('soha nincs két azonos index egymás után (L > 1)', () => {
  for (let s = 1; s <= 300; s++) for (const L of [2, 3, 7]) {
    const q = buildSequence(L, 50, mulberry32(s));
    for (let i = 1; i < q.length; i++) assert.notEqual(q[i], q[i - 1], `L=${L} seed=${s} i=${i}`);
  }
});

test('határesetek', () => {
  assert.deepEqual(buildSequence(1, 4, mulberry32(1)), [0, 0, 0, 0]);
  assert.equal(new Set(buildSequence(5, 3, mulberry32(7))).size, 3);
  assert.deepEqual(buildSequence(0, 5), []);
  assert.deepEqual(buildSequence(6, 20, mulberry32(42)), buildSequence(6, 20, mulberry32(42)));
});

test('tételek tisztítása', () => {
  const a = analyzeItems('ő, a ,\n\n#kimarad, a, A, ô, ' + 'x'.repeat(21));
  assert.equal(a.items[0], 'ő');
  assert.equal([...a.items[0]].length, 1, 'NFC: egy karakter');
  assert.deepEqual(a.items.slice(1, 3), ['a', 'A'], 'kis-/nagybetű megmarad, külön tétel');
  assert.ok(a.entries.some((e) => e.status === 'excl'));
  assert.ok(a.entries.some((e) => e.status === 'dup' && e.text === 'a'));
  assert.ok(a.entries.some((e) => e.warn?.includes('ô')));
  assert.ok(a.invalid);
});

test('lists.txt: értelmezés', () => {
  const r = parseListsText([
    'árva sor', '',
    '# Első ', 'a', 'a', ' b ', 'c, d', '', 'y'.repeat(21),
    '# első', 'x',
    '#', 'z',
    '## Üres',
  ].join('\r\n'));
  assert.deepEqual(r.lists, [{ name: 'Első', items: ['a', 'b', 'c', 'd'] }, { name: 'Üres', items: [] }]);
  assert.deepEqual(r.duplicates, [{ list: 'Első', item: 'a', line: 5 }]);
  assert.equal(r.problems.length, 4);
  assert.match(r.problems[0], /^Az 1\. sor az első lista neve előtt áll/);
  assert.match(r.problems[1], /9\. sor.*túl hosszú/);
  assert.match(r.problems[2], /már szerepel/);
  assert.match(r.problems[3], /hiányzik a lista neve/);
  assert.equal(parseListsText('o\u030B\n').lists.length, 0, 'fejléc nélkül nincs lista');
  assert.equal(parseListsText('# A\no\u030B').lists[0].items[0], 'ő', 'NFC');
  assert.equal(parseListsText('\uFEFF# A\na').lists[0].name, 'A', 'BOM');
});

test('a repó lists.txt-je hibátlan, ismétlődés nélkül', () => {
  const r = parseListsText(readFileSync(new URL('../lists.txt', import.meta.url), 'utf8'));
  assert.deepEqual(r.problems, [], 'Javítsd a lists.txt-t:\n' + r.problems.join('\n'));
  assert.deepEqual(r.duplicates, [], 'Ismétlődő tétel a lists.txt-ben:\n' +
    r.duplicates.map((d) => `  ${d.line}. sor: „${d.item}” (${d.list})`).join('\n'));
  assert.ok(r.lists.length > 0);
});

test('beállítások és tárolt állapot', () => {
  assert.deepEqual(clampSettings(null), { flashMs: 10000, gapMs: 0, count: 10, source: 'list' });
  assert.deepEqual(clampSettings({ flashMs: 99999, gapMs: -3, count: 0, source: 'all' }), { flashMs: 25000, gapMs: 0, count: 1, source: 'all' });
  assert.equal(clampSettings({ flashMs: 0 }).flashMs, 0, '0 = kézi léptetés');
  assert.equal(clampSettings({ flashMs: 1234 }).flashMs, 1000);
  assert.deepEqual(normalizeState('szemét').cache, null);
});
