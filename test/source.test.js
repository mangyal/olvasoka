// A Google táblázat forrás: CSV, oszlopos listák, tartalékra váltás.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, colName } from '../js/core/csv.js';
import { parseSheetCsv } from '../js/core/lists.js';
import { loadLists, parseByKind, SHEET_CSV_URL, TXT_URL } from '../js/core/source.js';
import { normalizeState } from '../js/core/settings.js';

test('csv: idézőjel, vessző és sortörés a mezőben, CRLF, BOM', () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n"két\nsor",\r\n'),
    [['a', 'b'], ['x, y', 'say "hi"'], ['két\nsor', '']]);
  assert.deepEqual(parseCsv('a,b'), [['a', 'b']], 'záró sortörés nélkül');
  assert.deepEqual(parseCsv(''), []);
  assert.deepEqual([0, 25, 26, 27, 701].map(colName), ['A', 'Z', 'AA', 'AB', 'ZZ']);
});

test('táblázat: oszloponként egy lista, első sor a név, névsorban', () => {
  const csv = [
    '45. oldal,Á-A-E,,# 2. oldal',
    'fa,á,,ma',
    'ke-fe,,,',
    '"lu-fi, fa",pá,,',
  ].join('\r\n');
  const r = parseSheetCsv(csv);
  assert.deepEqual(r.lists, [
    { name: '2. oldal', items: ['ma'] },
    { name: '45. oldal', items: ['fa', 'ke-fe', 'lu-fi'] },
    { name: 'Á-A-E', items: ['á', 'pá'] },
  ], 'üres oszlop csendben kimarad; a cellán belüli vessző elválaszt; a név eleji # elhagyható');
  assert.deepEqual(r.duplicates, [{ list: '45. oldal', item: 'fa', cell: 'A4' }]);
  assert.deepEqual(r.problems, []);
});

test('táblázat: hibás részek kimaradnak, figyelmeztetéssel a cellával', () => {
  const r = parseSheetCsv([
    'Első,,első,Üres',
    'a,x,b,',
    '#a,,,',
    'y'.repeat(21) + ',,,',
  ].join('\n'));
  assert.deepEqual(r.lists, [{ name: 'Első', items: ['a'] }, { name: 'Üres', items: [] }]);
  assert.equal(r.problems.length, 4);
  assert.match(r.problems.find((p) => p.includes('B1')), /^A táblázat B1 cellája: üres, ezért az oszlop kimaradt/);
  assert.match(r.problems.find((p) => p.includes('C1')), /„első” lista már szerepel/);
  assert.match(r.problems.find((p) => p.includes('A3')), /#-tel kezdődik/);
  assert.match(r.problems.find((p) => p.includes('A4')), /túl hosszú/);
  assert.equal(parseSheetCsv('A\nő').lists[0].items[0], 'ő', 'NFC');
  assert.equal(parseSheetCsv(',,\n,,').lists.length, 0);
  assert.match(parseSheetCsv('').problems[0], /nincs lista/);
});

// kitalált hálózat: url → válasz vagy hiba
const net = (map) => async (url) => {
  const v = map[url];
  if (v instanceof Error) throw v;
  if (v === undefined) throw new Error(`nincs: ${url}`);
  return typeof v === 'string' ? { text: v, type: url === TXT_URL ? 'text/plain' : 'text/csv' } : v;
};
const TXT = '# Txt lista\na\nb';
const CSV = 'Táblázat lista\nx\ny';

test('forrás: a táblázatból jön, tartalék nélkül', async () => {
  const r = await loadLists(net({ [SHEET_CSV_URL]: CSV, [TXT_URL]: TXT }));
  assert.equal(r.kind, 'sheet'); assert.equal(r.fallback, '');
  assert.deepEqual(r.lists, [{ name: 'Táblázat lista', items: ['x', 'y'] }]);
  assert.equal(r.text, CSV);
});

test('forrás: a táblázat hibájánál a lists.txt jön, az okkal', async () => {
  const cases = [
    [new Error('A táblázat nem érhető el (HTTP 404).'), /HTTP 404/],
    [{ text: '<!doctype html><title>Bejelentkezés</title>', type: 'text/html; charset=utf-8' }, /nem a várt formában/],
    [{ text: ' <html>', type: '' }, /nem a várt formában/],
    [',,\n,,', /nincs lista/],
  ];
  for (const [sheet, why] of cases) {
    const r = await loadLists(net({ [SHEET_CSV_URL]: sheet, [TXT_URL]: TXT }));
    assert.equal(r.kind, 'txt');
    assert.deepEqual(r.lists.map((l) => l.name), ['Txt lista']);
    assert.match(r.fallback, why);
  }
});

test('forrás: ha egyik sem érhető el, hibát dob mindkét okkal', async () => {
  await assert.rejects(
    loadLists(net({ [SHEET_CSV_URL]: new Error('Táblázat hiba.'), [TXT_URL]: new Error('Txt hiba.') })),
    /Táblázat hiba\. A tartalék lists\.txt sem érhető el: Txt hiba\./,
  );
});

test('forrás: mindig a táblázattal kezd, a lists.txt-t csak tartaléknak kéri', async () => {
  const asked = [];
  await loadLists(async (url) => { asked.push(url); return { text: CSV, type: 'text/csv' }; });
  assert.deepEqual(asked, [SHEET_CSV_URL]);
  asked.length = 0;
  await loadLists(async (url) => { asked.push(url); if (url === SHEET_CSV_URL) throw new Error('x'); return { text: TXT }; });
  assert.deepEqual(asked, [SHEET_CSV_URL, TXT_URL]);
});

test('tárolt állapot: a cache fajtája; a régi forrás-kapcsoló értéke elvész', () => {
  assert.equal('listSource' in normalizeState({ listSource: 'txt' }), false);
  assert.equal(normalizeState({ cache: { text: '# A', fetchedAt: 1 } }).cache.kind, 'txt', 'régi cache: lists.txt');
  assert.equal(normalizeState({ cache: { text: 'A', fetchedAt: 1, kind: 'sheet' } }).cache.kind, 'sheet');
  assert.deepEqual(parseByKind('sheet', 'A\nx').lists, [{ name: 'A', items: ['x'] }]);
  assert.deepEqual(parseByKind('txt', '# A\nx').lists, [{ name: 'A', items: ['x'] }]);
});
