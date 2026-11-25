// Megjelenés: hangcsoportok, megjelenítési darabok, Minta, beállítás (docs/megjelenes-specifikacio.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateSounds, compileSounds, DEFAULT_SOUNDS, DEFAULT_CLASSES, letterRuns, segments } from '../js/core/hangok.js';
import { sampleItems, miniSample, lookSummary } from '../js/core/look.js';
import { clampLook, normalizeState, DEFAULT_LOOK } from '../js/core/settings.js';
import { tokenize } from '../js/core/grid.js';
import { parseListsText } from '../js/core/lists.js';
import { marksOf } from '../js/core/marks.js';
import { distinctItems } from '../js/core/items.js';

const repoSounds = JSON.parse(readFileSync(new URL('../hangok.json', import.meta.url), 'utf8'));
/** Darabok rövid alakban: „m:d a:v -: m:d* …” (* = jelölt). */
const segs = (text, marks) => segments(text, marks).map((s) => `${s.text}:${s.cls || '-'}${s.mark ? '*' : ''}`).join(' ');

test('hangok.json: érvényes, és egyezik a beépített besorolással (D-5)', () => {
  assert.deepEqual(validateSounds(repoSounds), []);
  for (const k of ['maganhangzo', 'zonges', 'zongetlen']) assert.deepEqual(repoSounds[k], DEFAULT_SOUNDS[k], k);
});

test('hangok: besorolás SZ-2 szerint; a párnélküli zöngések is zöngések (D-1)', () => {
  const c = DEFAULT_CLASSES;
  for (const x of 'aáeéiíoóöőuúüű') assert.equal(c.get(x), 'v', x);
  for (const x of ['b', 'd', 'dz', 'dzs', 'g', 'gy', 'j', 'l', 'ly', 'm', 'n', 'ny', 'r', 'v', 'z', 'zs']) assert.equal(c.get(x), 'd', x);
  for (const x of ['c', 'cs', 'f', 'h', 'k', 'p', 's', 'sz', 't', 'ty']) assert.equal(c.get(x), 'u', x);
  assert.equal(c.get('x'), undefined, 'idegen betű nincs besorolva');
});

test('hangok: hibás konfiguráció', () => {
  assert.deepEqual(validateSounds(null), ['a konfiguráció nem objektum']);
  assert.deepEqual(validateSounds([]), ['a konfiguráció nem objektum']);
  const p = validateSounds({ maganhangzo: ['a', 'A', 'ab', 1], zonges: ['m', 'a'], zongetlen: 'k', egyeb: [] });
  assert.ok(p.includes('egyeb: ismeretlen kulcs'));
  assert.ok(p.includes('maganhangzo: hibás betű: "A"'), 'csak kisbetű');
  assert.ok(p.includes('maganhangzo: hibás betű: "ab"'), 'nem többjegyű betű');
  assert.ok(p.includes('maganhangzo: hibás betű: 1'));
  assert.ok(p.includes('zonges: a „a” már szerepel itt: maganhangzo'));
  assert.ok(p.includes('zongetlen: lista kell'));
  assert.deepEqual(validateSounds({ _leiras: 'x', maganhangzo: [], zonges: [], zongetlen: [] }), []);
  assert.equal(compileSounds({ maganhangzo: ['a'], zonges: ['m'], zongetlen: [] }).get('m'), 'd');
});

test('betűk: az eredeti szöveg pozícióival, ugyanaz a felbontás, mint a tokenize', () => {
  assert.deepEqual(letterRuns('Ma-ma'), [
    { start: 0, end: 1, letter: 'm' }, { start: 1, end: 2, letter: 'a' },
    { start: 3, end: 4, letter: 'm' }, { start: 4, end: 5, letter: 'a' },
  ]);
  assert.deepEqual(letterRuns('Dzsó').map((r) => [r.start, r.end, r.letter]), [[0, 3, 'dzs'], [3, 4, 'ó']]);
  assert.deepEqual(letterRuns('asszony').map((r) => r.letter), ['a', 'sz', 'sz', 'o', 'ny'], 'hosszú többjegyű');
  assert.deepEqual(letterRuns('ház sarka.').map((r) => r.letter), ['h', 'á', 'z', 's', 'a', 'r', 'k', 'a'], 'szóhatáron nincs zs');
  const { lists } = parseListsText(readFileSync(new URL('../lists.txt', import.meta.url), 'utf8'));
  for (const x of new Set(lists.flatMap((l) => l.items))) {
    if (/-./.test(x) && /(.)-\1/.test(x)) continue;   // kötőjelen átnyúló hosszú betű: a tokenize kötőjel nélkül bont
    assert.deepEqual(letterRuns(x).map((r) => r.letter), tokenize(x), x);
  }
});

test('darabok: elfogadás 5 – ma-ma, tó, Ma; a kötőjel tintaszínű (SZ-3, SZ-4)', () => {
  assert.equal(segs('ma-ma'), 'm:d a:v -:- m:d a:v');
  assert.equal(segs('tó'), 't:u ó:v');
  assert.equal(segs('Ma'), 'M:d a:v');
  assert.equal(segs('a ló húz.'), 'a:v  :- l:d ó:v  :- h:u ú:v z:d .:-');
  assert.equal(segs('xa'), 'x:- a:v', 'idegen betű tintaszínű');
  assert.equal(segs('szép'), 'sz:u é:v p:u', 'a többjegyű betű egy darab');
  assert.deepEqual(segments(''), []);
});

test('darabok: elfogadás 1 és 3 – a jelölt betű külön darab, a többi nem', () => {
  const [l] = parseListsText('# A\n{m}i-ki\n{sz}é-ke\n{l}a-li {m}a-mi.').lists;
  assert.equal(segs('mi-ki', l.marks.get('mi-ki')), 'm:d* i:v -:- k:u i:v');
  assert.equal(segs('szé-ke', l.marks.get('szé-ke')), 'sz:u* é:v -:- k:u e:v');
  assert.equal(segs('la-li ma-mi.', l.marks.get('la-li ma-mi.')), 'l:d* a:v -:- l:d i:v  :- m:d* a:v -:- m:d i:v .:-');
});

test('darabok: azonos osztályú szomszédok egy darabban', () => {
  assert.deepEqual(segments('ae'), [{ text: 'ae', cls: 'v', mark: false }]);
  assert.deepEqual(segments('kt'), [{ text: 'kt', cls: 'u', mark: false }]);
  assert.equal(segments('a-.').length, 2);
});

test('Minta: a sorrend és a típusonkénti első előfordulás (MI-1, MI-2)', () => {
  const { lists } = parseListsText('# A\nma\nszó\ne\nk\nsz\nam\nkap\nma-ma\n{m}i-ki\na ló húz.\nt\ni\nfa');
  const items = distinctItems(lists[0].items);
  assert.deepEqual(sampleItems(items, marksOf(lists)), ['e', 'k', 'sz', 'ma', 'ma-ma', 'mi-ki', 'a ló húz.']);
  assert.deepEqual(sampleItems(items, marksOf(lists)), sampleItems(items, marksOf(lists)), 'stabil');
});

test('Minta: szótag CV, ha nincs VC, ha nincs egyéb; a hiányzó típus kimarad (MI-1, MI-2)', () => {
  assert.deepEqual(sampleItems(['am', 'kap', 'a']), ['a', 'am']);
  assert.deepEqual(sampleItems(['kap', 'ló-ca']), ['kap', 'ló-ca']);
  assert.deepEqual(sampleItems(['mi-ki', 'la-la'], new Map([['mi-ki', []]])), ['mi-ki'], 'a jelölt szó nem szerepel kétszer');
  assert.deepEqual(sampleItems(['la-la', 'mi-ki'], new Map([['mi-ki', []]])), ['la-la', 'mi-ki']);
  assert.deepEqual(sampleItems([]), [], 'MI-3');
});

test('mini minta és összegzés (L-4)', () => {
  assert.equal(miniSample(['a', 'ma-ma', 'mi-ki'], new Map([['mi-ki', []]])), 'mi-ki');
  assert.equal(miniSample(['a', 'ma-ma']), 'ma-ma');
  assert.equal(miniSample(['a', 'ma']), 'a');
  assert.equal(miniSample([]), '');
  assert.equal(lookSummary({ color: 'sound', mark: 'outline' }), 'Hangok szerint · Nagybetű: körvonal');
  assert.equal(lookSummary({ color: 'none', mark: 'none' }), 'Nincs színezés · Nagybetű: nincs');
});

test('beállítás: alapérték Nincs / Nincs, érvénytelen bemenetre is; tárolódik (MJ-1–MJ-3)', () => {
  assert.deepEqual(DEFAULT_LOOK, { color: 'none', mark: 'none' });
  assert.deepEqual(clampLook(null), DEFAULT_LOOK);
  assert.deepEqual(clampLook({ color: 'hang', mark: 1 }), DEFAULT_LOOK);
  assert.deepEqual(clampLook({ color: 'sound', mark: 'outline', x: 1 }), { color: 'sound', mark: 'outline' });
  assert.deepEqual(normalizeState({ v: 4 }).look, DEFAULT_LOOK, 'régi állapot');
  assert.deepEqual(normalizeState({ v: 4, look: { color: 'sound' } }).look, { color: 'sound', mark: 'none' });
});
