// Nagybetűk jelölése a listában (docs/megjelenes-specifikacio.md, NB-1–NB-5a).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarks, marksOf, withMarks } from '../js/core/marks.js';
import { parseListsText, parseSheetCsv } from '../js/core/lists.js';
import { distinctItems } from '../js/core/items.js';
import { listHash } from '../js/core/exposures.js';
import { groupOf } from '../js/core/groups.js';
import { syllableCount } from '../js/core/cover.js';

const ok = (raw) => {
  const r = parseMarks(raw);
  assert.notEqual(r.marks, null, `érvényes: ${raw}`);
  return r;
};
const bad = (raw) => assert.deepEqual(parseMarks(raw), { text: null, marks: null }, `hibás: ${raw}`);

test('jelölés: a zárójel leválik, a jelölés a zárójel nélküli alak pozíciója (NB-1, NB-5)', () => {
  assert.deepEqual(parseMarks('{m}i-ki'), { text: 'mi-ki', marks: [{ start: 0, end: 1 }] });
  assert.deepEqual(parseMarks('{e}-mi'), { text: 'e-mi', marks: [{ start: 0, end: 1 }] });
  assert.deepEqual(parseMarks('{sz}é-ke'), { text: 'szé-ke', marks: [{ start: 0, end: 2 }] }, 'többjegyű betű egészben');
  assert.deepEqual(ok('{gy}ö-mölcs').marks, [{ start: 0, end: 2 }]);
  assert.deepEqual(ok('{dzs}ip').marks, [{ start: 0, end: 3 }]);
  assert.deepEqual(ok('{ő}-sök').marks, [{ start: 0, end: 1 }], 'ékezetes magánhangzó');
});

test('jelölés: mondatban több jelölt betű, mindegyik szó elején (NB-2)', () => {
  const r = ok('{l}a-li {m}a-mi.');
  assert.equal(r.text, 'la-li ma-mi.');
  assert.deepEqual(r.marks, [{ start: 0, end: 1 }, { start: 6, end: 7 }]);
  assert.equal(withMarks(r.text, r.marks), '{l}a-li {m}a-mi.');
});

test('jelölés: zárójel nélküli tétel változatlan', () => {
  assert.deepEqual(parseMarks('mi-ki'), { text: 'mi-ki', marks: [] });
  assert.deepEqual(parseMarks('Mi-ki'), { text: 'Mi-ki', marks: [] });
  assert.deepEqual(parseMarks('a ló húz.'), { text: 'a ló húz.', marks: [] });
});

test('jelölés: érvénytelen jelölés (NB-3)', () => {
  bad('{m'); bad('{mi-ki'); bad('m}i-ki'); bad('}m{');
  bad('{}'); bad('{}mi');
  bad('{mi}-ki');                 // nem egy betű
  bad('{{m}}i'); bad('{m{i}}');   // egymásba ágyazás
  bad('{-}mi'); bad('{.}'); bad('{ }mi'); bad('{1}');
  bad('{s}zó');                   // a többjegyű betű fele
  bad('{d}zsip'); bad('{dz}sip'); bad('{c}sap');
});

test('jelölés: nagybetű a zárójelben hibás (döntés 2026-11-25)', () => {
  bad('{M}i-ki'); bad('{Sz}é-ke'); bad('{SZ}é-ke');
});

test('jelölés: szó közepén hibás, kötőjel után is (döntés 2026-11-25)', () => {
  bad('mi-{k}i'); bad('m{i}-ki'); bad('{m}{i}'); bad('la-li {m}a-{m}i.');
  ok('a {l}ó húz.');
});

test('lista: a tétel a zárójel nélküli alak, a jelölés a lista marks térképében', () => {
  const r = parseListsText('# Mi\n{m}i-ki\n{sz}é-ke, mi-ki\n{l}a-li {m}a-mi.');
  assert.deepEqual(r.problems, []);
  const [l] = r.lists;
  assert.deepEqual(l.items, ['mi-ki', 'szé-ke', 'mi-ki', 'la-li ma-mi.']);
  assert.deepEqual([...l.marks], [
    ['mi-ki', [{ start: 0, end: 1 }]],
    ['szé-ke', [{ start: 0, end: 2 }]],
    ['la-li ma-mi.', [{ start: 0, end: 1 }, { start: 6, end: 7 }]],
  ]);
  assert.equal(parseListsText('# A\nma').lists[0].marks, undefined, 'jelölés nélkül nincs marks mező');
});

test('lista: {m}i-ki és mi-ki egy tétel, a Mi-ki külön (NB-4)', () => {
  const [l] = parseListsText('# A\n{m}i-ki\nmi-ki\nMi-ki').lists;
  assert.deepEqual(distinctItems(l.items), ['mi-ki', 'Mi-ki']);
  assert.equal(l.items.length, 3, 'a súlyozás minden sort számol (NB-5a)');
});

test('lista: a jelölés nem változtat a csoporton, szótagszámon és a lista azonosítóján (NB-5)', () => {
  const [marked] = parseListsText('# A\n{m}i-ki\n{sz}é-ke').lists;
  const [plain] = parseListsText('# A\nmi-ki\nszé-ke').lists;
  assert.deepEqual(marked.items, plain.items);
  assert.equal(listHash(marked.items), listHash(plain.items), 'zárójelek hozzáadása nem „másik csomag”');
  assert.equal(groupOf(marked.items[0]).key, 'W:2');
  assert.equal(syllableCount(marked.items[0]), 2);
});

test('lista: érvénytelen jelölésnél a tétel figyelmeztetéssel kimarad (NB-3)', () => {
  const r = parseListsText('# A\nma\n{m\n{}\n{mi}-ki\nmi-{k}i\n{M}i-ki');
  assert.deepEqual(r.lists[0].items, ['ma']);
  assert.equal(r.problems.length, 5);
  assert.equal(r.problems[0], 'A 3. sor: a „{m” jelölése hibás (a kapcsos zárójelbe egy szó első betűje kerülhet, kisbetűvel), kimaradt.');
  assert.match(r.problems[2], /^Az 5\. sor: a „\{mi\}-ki” jelölése hibás/);
});

test('táblázat: ugyanaz a jelölés, cellahellyel', () => {
  const r = parseSheetCsv('A\n{m}i-ki\n{mi}-ki');
  assert.deepEqual(r.lists[0].items, ['mi-ki']);
  assert.deepEqual([...r.lists[0].marks.keys()], ['mi-ki']);
  assert.match(r.problems[0], /^A táblázat A3 cellája: a „\{mi\}-ki” jelölése hibás/);
});

test('lista: a hosszkorlát a zárójel nélküli alakra vonatkozik', () => {
  const twenty = 'a'.repeat(19);
  assert.deepEqual(parseListsText(`# A\n{m}${twenty}`).lists[0].items, ['m' + twenty]);
  assert.match(parseListsText(`# A\n{m}${twenty}a`).problems[0], /túl hosszú \(21\/20/);
});

test('csomagok: a jelölt alak látszik, több jelölésnél a csomagsorrendben az első (NB-5a)', () => {
  const { lists } = parseListsText('# A\nmi-ki\n# B\n{m}i-ki\n# C\n{l}a-li {m}a-mi.\n# D\nla-li {m}a-mi.');
  const m = marksOf(lists);
  assert.deepEqual(m.get('mi-ki'), [{ start: 0, end: 1 }]);
  assert.deepEqual(m.get('la-li ma-mi.'), [{ start: 0, end: 1 }, { start: 6, end: 7 }]);
  assert.equal(marksOf(lists.slice(0, 1)).size, 0);
});
