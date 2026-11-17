// Mondatok (docs/mondatok-specifikacio.md, M-1–M-11, elfogadási kritériumok 1–8).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { typeOf, tokenize, syllableCount, createPool, compileConfig } from '../js/core/grid.js';
import { groupOf, compareRank, wordCount } from '../js/core/groups.js';
import { itemKey, isSentence, cleanItem, maxLenOf, distinctItems } from '../js/core/items.js';
import { parseListsText, parseSheetCsv } from '../js/core/lists.js';
import { buildReadSequence, mulberry32 } from '../js/core/sequence.js';
import { coverUnits, words, stepCover, toggleCover } from '../js/core/cover.js';
import { startRound, step } from '../js/core/round.js';
import { fitLayout, roundLayouts, layoutFor } from '../js/core/fit.js';
import { buildTasks, canFind, onlySentences } from '../js/core/find.js';
import { analyze, typeTempo } from '../js/core/mastery.js';
import { resolve } from '../js/core/haladas-config.js';
import { reasonSentence } from '../js/core/haladas-texts.js';

const CC = compileConfig(JSON.parse(readFileSync(new URL('./fixtures/parok.json', import.meta.url), 'utf8')));
const key = (x) => groupOf(x).key;

/* ---------- felismerés és csoport (M-1–M-4, M-6) ---------- */

test('elfogadás 1: a mondat típusa „mondat”, csoportja szószám szerinti', () => {
  assert.equal(typeOf('a ló húz.'), 'mondat');
  assert.equal(key('a ló húz.'), 'M:3');
  assert.equal(key('a ke-fe pu-ha.'), 'M:3');
  assert.equal(key('a fi-ú fát hoz.'), 'M:4');
  assert.equal(key('a há-zi-kó pi-ci.'), 'M:3');
});

test('elfogadás 2: a szavak nem változnak', () => {
  assert.equal(typeOf('pi-ló-ta'), 'szó');
  assert.equal(key('pi-ló-ta'), 'W:3');
  assert.equal(typeOf('ma'), 'szótag');
  assert.equal(typeOf('a'), 'betű');
});

test('M-1, D-1: minden szóközt tartalmazó tétel mondat, írásjel nélkül is', () => {
  assert.equal(typeOf('a ló'), 'mondat');
  assert.equal(key('a ló'), 'M:2');
  assert.equal(isSentence('  ló  '), false, 'a szélső szóköz nem számít');
  assert.notEqual(typeOf('Húzd!'), 'mondat', 'egy szó írásjellel nem mondat');
});

test('M-2: mondatban a szóköz és az írásjel nem betű; a szótagszám a magánhangzók száma', () => {
  assert.deepEqual(tokenize('a ló húz.'), ['a', 'l', 'ó', 'h', 'ú', 'z']);
  assert.deepEqual(tokenize('Jó? Jó!'), ['j', 'ó', 'j', 'ó']);
  assert.equal(syllableCount('a fi-ú fát hoz.'), 5);
  assert.equal(syllableCount('a há-zi-kó pi-ci.'), 6);
});

test('M-2: a szóhatáron nem áll össze többjegyű betű', () => {
  assert.deepEqual(tokenize('a ház sarka.').slice(0, 6), ['a', 'h', 'á', 'z', 's', 'a']);
  assert.deepEqual(tokenize('a cs ny'), ['a', 'cs', 'ny']);
});

test('M-3: a mondatok a szavak után, növekvő szószámmal', () => {
  const order = (xs) => [...xs].sort((a, b) => compareRank(groupOf(a).rank, groupOf(b).rank));
  assert.deepEqual(order(['a ló húz.', 'a ló', 'pi-ló-ta-ka-la-pa', 'ma', 'a', 'a fi-ú fát hoz.']),
    ['a', 'ma', 'pi-ló-ta-ka-la-pa', 'a ló', 'a ló húz.', 'a fi-ú fát hoz.']);
});

test('M-4: a kis- és nagybetű, az írásjel és a kötőjel a tétel része', () => {
  const keys = new Set(['a ló húz.', 'A ló húz.', 'a ló húz', 'a ló-húz.'].map(itemKey));
  assert.equal(keys.size, 4);
});

test('M-6: a belső többszörös szóköz egynek számít, a tételkulcsban is', () => {
  assert.equal(cleanItem('  a   ló\thúz. '), 'a ló húz.');
  assert.equal(itemKey('a  ló húz.'), itemKey('a ló húz.'));
  assert.equal(itemKey('a ló húz.'), 'a ló húz.', 'a nem törő szóköz is szóköz');
  assert.equal(wordCount('a   ló  húz.'), 3);
  assert.deepEqual(distinctItems(['a ló húz.', 'a  ló húz.']), ['a ló húz.']);
});

/* ---------- lista (M-5, M-6) ---------- */

test('elfogadás 6: mondatra 40, másra 20 karakter; a figyelmeztetés a vonatkozó korlátot írja', () => {
  const s21 = 'a ma-ma ma-dár-ra ki.';          // 21
  const s40 = 'a ma-ma ma-dár-ra mu-tat a pa-pa fá-ján.';
  const s41 = 'a ma-ma a ma-dár-ra mu-tat a pa-pa fá-ra.';
  const w21 = 'ab'.repeat(10) + 'a';
  assert.equal([...s21].length, 21);
  assert.equal([...s40].length, 40);
  assert.equal([...s41].length, 41);
  assert.equal(maxLenOf(s21), 40);
  assert.equal(maxLenOf(w21), 20);
  const { lists, problems } = parseListsText(`# L\n${s21}\n${s40}\n${s41}\n${w21}\na ma-ma ma-dár-ra mu-tat.`);
  assert.deepEqual(lists[0].items, [s21, s40, 'a ma-ma ma-dár-ra mu-tat.']);
  assert.equal(problems.length, 2);
  assert.match(problems[0], /\(41\/40 karakter\)/);
  assert.match(problems[1], /\(21\/20 karakter\)/);
});

test('M-6: a lista a belső szóközöket egyre vonja, a táblázatban is', () => {
  assert.deepEqual(parseListsText('# L\n  a   ló  húz.  ').lists[0].items, ['a ló húz.']);
  assert.deepEqual(parseSheetCsv('L\n"a  ló húz."').lists[0].items, ['a ló húz.']);
});

/* ---------- Felolvasás sorrendje (elfogadás 3) ---------- */

// Az `a ló húz.` és az `a há-zi-kó pi-ci.` is 3 szavas (M:3, elfogadás 1), így egy blokkban, a blokkon
// belül véletlen sorrendben jönnek (M-3). A „rövidebb előbb” a szószámra vonatkozik.
test('elfogadás 3: csoportosított körben a mondatok a kör végén, a szavak után', () => {
  const rows = ['ma', 'pi-ló-ta', 'a ló húz.', 'a há-zi-kó pi-ci.'];
  for (let seed = 1; seed <= 20; seed++) {
    const seq = buildReadSequence(rows, 4, {}, mulberry32(seed)).map((i) => rows[i]);
    assert.deepEqual(seq.slice(0, 2), ['ma', 'pi-ló-ta'], `seed ${seed}`);
    assert.deepEqual(new Set(seq.slice(2)), new Set(['a ló húz.', 'a há-zi-kó pi-ci.']), `seed ${seed}`);
  }
});

test('elfogadás 3, M-3: a kevesebb szavas mondat előbb', () => {
  const rows = ['a fi-ú fát hoz.', 'a ló', 'ke-fe', 'a ló húz.'];
  for (let seed = 1; seed <= 20; seed++) {
    assert.deepEqual(buildReadSequence(rows, 4, {}, mulberry32(seed)).map((i) => rows[i]),
      ['ke-fe', 'a ló', 'a ló húz.', 'a fi-ú fát hoz.'], `seed ${seed}`);
  }
});

test('M-3: kevert sorrendben a mondatok is keverednek', () => {
  const rows = ['ma', 'mi', 'mo', 'a ló húz.', 'a fa nő.', 'a ló'];
  const firstSentence = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const seq = buildReadSequence(rows, 6, { mixed: true }, mulberry32(seed)).map((i) => rows[i]);
    firstSentence.add(seq.findIndex(isSentence));
  }
  assert.ok(firstSentence.has(0), 'kevert körben mondat is lehet az első');
});

/* ---------- betűméret (M-7, elfogadás 4) ---------- */

// Kitalált mérés 100 px-es betűvel: karakterenként 55 px, egységes tinta-doboz.
const fake = (t) => ({ width: [...t].length * 55, left: 0, right: [...t].length * 55, ascent: 72, descent: 20 });
const VW = 1280, VH = 800;

test('elfogadás 4: a nem-mondat tételek mérete nem függ attól, hogy van-e mondat a körben', () => {
  const without = roundLayouts(['ma', 'pi-ló-ta'], fake, VW, VH);
  const withS = roundLayouts(['ma', 'pi-ló-ta', 'a ló húz.', 'a há-zi-kó pi-ci.'], fake, VW, VH);
  assert.deepEqual(layoutFor(withS, 'ma'), layoutFor(without, 'ma'));
  assert.equal(without.mondat, null);
  assert.ok(withS.mondat.size < withS.item.size, 'a mondat a saját, kisebb méretét kapja');
  // a mondat mérete is csak a mondatokból számol
  assert.deepEqual(withS.mondat, roundLayouts(['a ló húz.', 'a há-zi-kó pi-ci.'], fake, VW, VH).mondat);
});

test('M-7: a mondatok ugyanazzal a 72% / 53% szabállyal', () => {
  const L = fitLayout([fake('a há-zi-kó pi-ci.')], VW, VH);
  assert.equal(L.size, Math.floor(Math.min(VW * 0.72 / (17 * 55), VH * 0.53 / 92, VH * 0.53 / 100) * 100));
  assert.ok(L.top < L.baseline && L.baseline < L.bottom && L.bottom < L.barY);
});

test('M-7: csak mondatos körben is van elrendezés minden tételre', () => {
  const ls = roundLayouts(['a ló húz.'], fake, VW, VH);
  assert.equal(ls.item, null);
  assert.equal(layoutFor(ls, 'a ló húz.'), ls.mondat);
  assert.equal(layoutFor(ls, ''), ls.mondat, 'a szünet üres szövege sem marad elrendezés nélkül');
});

/* ---------- takarás (M-8, elfogadás 5) ---------- */

test('elfogadás 5: a takarás egysége a szó, az írásjellel; a kötőjel nem határ', () => {
  assert.deepEqual(coverUnits('a fi-ú fát hoz.').map((u) => u.text), ['a', 'fi-ú', 'fát', 'hoz.']);
  assert.deepEqual(words('a fi-ú').map((u) => [u.start, u.end]), [[0, 1], [2, 6]]);
  assert.deepEqual(coverUnits('ke-fe').map((u) => u.text), ['ke', 'fe'], 'szónál marad a szótag');
});

test('elfogadás 5: ↓ négy lépésben ér végig a szavakon, ötödikre visszaáll az egészre', () => {
  const n = coverUnits('a fi-ú fát hoz.').length;
  const seen = [];
  let s = startRound([0], 0, 0, 0);
  for (let k = 0; k < 5; k++) {
    s = step(s, 'COVER_DOWN', 10 + k, { n });
    seen.push(s.covered.length ? s.covered.map((c) => (c ? 0 : 1)).join('') : 'egész');
  }
  assert.deepEqual(seen, ['1000', '0100', '0010', '0001', 'egész']);
});

test('M-8: kattintás egy szóra csak annak a takarását váltja', () => {
  assert.deepEqual(toggleCover([], 2, 4), [false, false, true, false]);
  assert.deepEqual(toggleCover([false, false, true, false], 2, 4), []);
  assert.deepEqual(stepCover([], 4), [false, true, true, true]);
});

/* ---------- Keresd meg! (M-9, elfogadás 7) ---------- */

test('elfogadás 7: Keresd meg! feladatban mondat nem jelenik meg', () => {
  const items = ['ma', 'mi', 'mo', 'mu', 'a ló húz.', 'a ló fut.', 'a fa nő.', 'a fi-ú fát hoz.'];
  const pool = createPool(items, CC);
  assert.ok(pool.entries.every((e) => !isSentence(e.text)));
  for (let r = 0; r < 10; r++) {
    const tasks = buildTasks(items, { cards: 4, tasks: 6, level: 0.5 }, CC);
    assert.ok(tasks.length > 0);
    assert.ok(tasks.flat().every((t) => !isSentence(t)), tasks.flat().join(' | '));
  }
});

test('M-9: csak mondatból nem indítható, és ezt külön jelezzük', () => {
  const s = ['a ló húz.', 'a ló fut.', 'a fa nő.'];
  assert.equal(canFind(s), false);
  assert.equal(onlySentences(s), true);
  assert.equal(onlySentences([...s, 'ma']), false);
  assert.equal(onlySentences([]), false);
  assert.equal(canFind([...s, 'ma', 'mi']), true);
  assert.equal(canFind([...s, 'ma']), false, 'a mondat nem pótolja a hiányzó második tételt');
  assert.deepEqual(buildTasks(s, { cards: 4, tasks: 3, level: 0 }, CC), []);
});

/* ---------- Haladás (M-10, M-11, elfogadás 8) ---------- */

function rec(item, day, dwell) {
  return {
    id: `d|default|${item}|${day}`, child: 'default', item, day,
    exposures: dwell.length, manualExposures: dwell.length, dwellMs: dwell, medianDwellMs: null,
    covers: 0, pauses: 0, prevs: 0, supportedExposures: 0, unsupportedFastFlash: 0, help: '0'.repeat(dwell.length), flashDwell: [],
  };
}

test('elfogadás 8: a mondat saját tempót kap, a szavak tempója nélküle számolódik', () => {
  const day = '2026-11-16';
  const ten = (ms) => Array(10).fill(ms);
  const daily = [
    rec('ke-fe', day, ten(2000)),                // szó: 1000 ms/szótag
    rec('a ló húz.', day, ten(9000)),            // mondat: 3000 ms/szótag (3 szótag)
  ];
  const byItem = new Map(daily.map((d) => [d.item, [d]]));
  const t = typeTempo(byItem, { window: 30, minCount: 10 });
  assert.equal(t.get('szó'), 1000, 'a szavak tempóját a mondat nem lassítja');
  assert.equal(t.get('mondat'), 3000);

  const an = analyze(daily, { now: new Date(2026, 10, 17).getTime(), cfg: resolve(null, { skipDayRules: true }) });
  const st = an.states.get('a ló húz.');
  assert.equal(st.type, 'mondat');
  assert.equal(an.tempo.get('szó'), 1000);
});

test('M-11: a régi, dupla szóközös kulcs nélkül is a mondat-tempóba kerül (a típus a szövegből jön)', () => {
  const byItem = new Map([['a ló húz.', [rec('a ló húz.', '2026-11-16', Array(10).fill(3000))]]]);
  assert.deepEqual([...typeTempo(byItem, { window: 30, minCount: 10 }).keys()], ['mondat']);
});

test('M-10: a tételrészlet mondata „mondatot” mond', () => {
  const a = resolve(null).allapot;
  assert.equal(reasonSentence({ group: 'practice', reason: 'slow', type: 'mondat', helpN: 0, helpK: 0 }, a),
    'Lassabban olvasta, mint a többi mondatot.');
});
