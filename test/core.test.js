import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseListsText } from '../js/core/lists.js';
import { clampSettings, normalizeState } from '../js/core/settings.js';

test('9.12 tételek tisztítása', () => {
  const r = parseListsText('# L\nő, a ,\n\nx, #kimarad, a, A, ' + 'x'.repeat(21));
  assert.deepEqual(r.lists[0].items, ['ő', 'a', 'x', 'a', 'A'], 'NFC; kis-/nagybetű megmarad; a #-es kimarad, az ismétlődő marad (2.14)');
  assert.equal([...r.lists[0].items[0]].length, 1, 'NFC: egy karakter');
  assert.ok(r.problems.some((p) => /„#kimarad” #-tel kezdődik/.test(p)), '#-es tétel: figyelmeztetés');
  assert.ok(r.problems.some((p) => /túl hosszú \(21\/20/.test(p)), 'túl hosszú: figyelmeztetés');
  assert.equal(r.problems.length, 2, 'az ismétlődés nem figyelmeztetés');
  assert.equal('duplicates' in r, false);
});

test('2.14 S-1: a kétszer beírt tétel 2 sor, a helyén, figyelmeztetés nélkül', () => {
  const r = parseListsText('# L\nk\nm\nk\nk, s');
  assert.deepEqual(r.lists[0].items, ['k', 'm', 'k', 'k', 's']);
  assert.deepEqual(r.problems, []);
});

test('lists.txt: értelmezés', () => {
  const r = parseListsText([
    'árva sor', '',
    '# Első ', 'a', 'a', ' b ', 'c, d', '', 'y'.repeat(21),
    '# első', 'x',
    '#', 'z',
    '## Üres',
  ].join('\r\n'));
  assert.deepEqual(r.lists, [{ name: 'Első', items: ['a', 'a', 'b', 'c', 'd'] }, { name: 'Üres', items: [] }]);
  assert.equal(r.problems.length, 4);
  assert.match(r.problems[0], /^Az 1\. sor az első lista neve előtt áll/);
  assert.match(r.problems[1], /9\. sor.*túl hosszú/);
  assert.match(r.problems[2], /már szerepel/);
  assert.match(r.problems[3], /hiányzik a lista neve/);
  assert.equal(parseListsText('o\u030B\n').lists.length, 0, 'fejléc nélkül nincs lista');
  assert.equal(parseListsText('# A\no\u030B').lists[0].items[0], 'ő', 'NFC');
  assert.equal(parseListsText('\uFEFF# A\na').lists[0].name, 'A', 'BOM');
});

test('lists.txt: a listák névsorban', () => {
  const names = parseListsText(['# 45. oldal', '# Zebra', '# 10. oldal', '# Á-A-E', '# 2. oldal', '# Alma'].join('\n')).lists.map((l) => l.name);
  assert.deepEqual(names, ['2. oldal', '10. oldal', '45. oldal', 'Á-A-E', 'Alma', 'Zebra']);
});

// A repó valódi lists.txt-je: betölthető-e, és megvannak-e benne a várt listák és tételek.
// Ha a listákat szándékosan átírod, ezeket a mintákat is frissítsd.
const SAMPLES = {
  '45. oldal': ['fa', 'ke-fe', 'lu-fi'],
  '44. oldal': ['pá-va', 'pu-li', 'ma-ma'],
  'Á-A-E': ['á', 'pá', 'ke'],
  '42. oldal': ['só', 'ci-pó', 'te-le'],
  '40. oldal': ['á', 'te-ve', 'mi-si'],
};

test('a repó lists.txt-je betölthető, a várt tételek megvannak', () => {
  const r = parseListsText(readFileSync(new URL('../lists.txt', import.meta.url), 'utf8'));
  assert.deepEqual(r.problems, [], 'Javítsd a lists.txt-t:\n' + r.problems.join('\n'));
  for (const [name, items] of Object.entries(SAMPLES)) {
    const list = r.lists.find((l) => l.name === name);
    assert.ok(list, `Hiányzik a „${name}” lista`);
    for (const item of items) assert.ok(list.items.includes(item), `„${name}”: hiányzik a „${item}”`);
  }
});

test('beállítások és tárolt állapot', () => {
  assert.deepEqual(clampSettings(null), { flashMs: 10000, gapMs: 0, count: 10, source: 'list', mixed: false });
  assert.deepEqual(clampSettings({ flashMs: 99999, gapMs: -3, count: 0, source: 'all' }), { flashMs: 25000, gapMs: 0, count: 1, source: 'all', mixed: false });
  assert.equal(clampSettings({ flashMs: 0 }).flashMs, 0, '0 = kézi léptetés');
  assert.equal(clampSettings({ flashMs: 1234 }).flashMs, 1000);
  assert.deepEqual(normalizeState('szemét').cache, null);
});
