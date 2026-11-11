// Haladás: tételállapotok a küszöbök határértékeivel, betűelemzés, áttekintés, szövegek
// (docs/haladas-specifikacio.md 7., 7.2, 8., 10.). Rögzített `now`, kitalált napi összesítők.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, itemState, overview, detail, cardLetter, letterStats, weakestLetter, daysBetween, currentItems } from '../js/core/mastery.js';
import { resolve } from '../js/core/haladas-config.js';
import * as TX from '../js/core/haladas-texts.js';

const CFG = resolve(null);
const SKIP = resolve(null, { skipDayRules: true });
const NOW = new Date(2026, 10, 20, 18, 0).getTime();   // helyi idő: 2026-11-20
const TODAY = '2026-11-20';

/** A mai naphoz képest k nappal korábbi nap. */
const ago = (k) => { const d = new Date(2026, 10, 20 - k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Egy napi összesítő. help: megjelenésenként '0'/'1'; dwell: a kézi megjelenések ideje. */
function rec(item, day, { help = '0', dwell = [], covers, pauses = 0, prevs = 0, fast = 0 } = {}) {
  const sup = [...help].filter((c) => c === '1').length;
  return {
    id: `d|default|${item}|${day}`, child: 'default', item, day,
    exposures: help.length, manualExposures: dwell.length, dwellMs: dwell, medianDwellMs: null,
    covers: covers ?? sup, pauses, prevs, supportedExposures: sup, unsupportedFastFlash: fast, help,
  };
}
/** k napon (a legrégebbi elöl) egy-egy összesítő. */
const days = (item, list) => list.map(([k, o]) => rec(item, ago(k), o));
const state = (recs, cfg = CFG, typeMedian = null) => itemState(recs[0]?.item ?? 'x', recs, { today: TODAY, cfg, typeMedian }).state;

/* ---------- Nem látott, Új ---------- */

test('Nem látott: 0 megjelenés; Új: kevesebb mint 3 napon', () => {
  assert.equal(state([]), 'unseen');
  const two = days('ma', [[2, { dwell: [3000, 3000, 3000] }], [1, { dwell: [1000, 1000, 1000] }]]);
  assert.equal(state(two), 'new', '2 nap: még ismerkedik vele, akármilyen gyors');
});

/* ---------- Már megy ---------- */

const fast3 = (rel) => days('ma', [[3, { help: '000', dwell: [3000, 3000, 3000] }], [2, { help: '0' }], [1, { help: '000', dwell: [3000 * rel, 3000 * rel, 3000 * rel] }]]);

test('Már megy: relatív idő ≤ 0,8 (határ: 0,8 igen, 0,81 nem)', () => {
  assert.equal(state(fast3(0.8)), 'fluent');
  assert.equal(state(fast3(0.81)), 'improving', '0,81 ≤ 0,9: egyre jobban megy');
});

test('Már megy: kell legalább 3 nap és az utolsó 3 megjelenés segítség nélkül', () => {
  const r = fast3(0.5);
  assert.equal(state(r.slice(1)), 'new', 'csak 2 nap');
  r[2] = { ...r[2], help: '010', supportedExposures: 1, covers: 1 };
  assert.notEqual(state(r), 'fluent', 'segítség az utolsó 3 között');
});

test('Már megy: karakterenként legfeljebb 0,8-szorosa a típus mediánjának', () => {
  const r = days('ma', [[3, { help: '0', dwell: [2000] }], [2, { help: '0', dwell: [2000] }], [1, { help: '0', dwell: [2000] }]]);
  // relatív idő 1,0; „ma” 2 betű → 1000 ms/betű
  assert.equal(state(r, CFG, 1250), 'fluent', '1000 ≤ 0,8 × 1250');
  assert.equal(state(r, CFG, 1249), 'new', '1000 > 0,8 × 1249');
});

test('Már megy: legalább 2 segítség nélküli, ≤ 5 mp-es villantás', () => {
  const r = (fast) => days('ma', [[3, { help: '0' }], [2, { help: '0', fast }], [1, { help: '0', fast: 1 }]]);
  assert.equal(state(r(1)), 'fluent');
  assert.equal(state(r(0)), 'new');
});

/* ---------- Gyakoroljuk még ---------- */

/** 5 nap, az első `first` napja; az utolsó 5 megjelenés segítsége `tail`. */
const slow = (first, tail, rel = 1) => days('gyöngy', [
  [first, { help: '1', dwell: [4000] }], [first - 1, { help: '1', dwell: [4000] }], [first - 2, { help: '1', dwell: [4000] }],
  [1, { help: tail.slice(0, 2), dwell: [4000 * rel] }], [0, { help: tail.slice(2), dwell: [4000 * rel, 4000 * rel] }],
]);

test('Gyakoroljuk még: legalább 5 nap, 14 napja kezdte, az utolsó 5 legalább felénél segítség', () => {
  assert.equal(state(slow(14, '11100')), 'practice', '3/5 segítség, pontosan 14 napja');
  assert.equal(state(slow(13, '11111')), 'new', '13 nap még kevés; a segítség nem csökkent, a tempó sem javult');
  assert.equal(state(slow(14, '11111')), 'practice');
  assert.equal(state(slow(14, '11000', 0.85)), 'improving', '2/5 < 0,5 és relatív idő 0,85: nem gyakorolni való');
  assert.equal(state(slow(14, '11000')), 'practice', '2/5 < 0,5, de relatív idő 1,0 > 0,9');
});

test('Gyakoroljuk még: kevés segítség, de relatív idő > 0,9', () => {
  const r = days('gyöngy', [[20, { help: '0', dwell: [3000] }], [15, { help: '0', dwell: [3000] }], [10, { help: '0', dwell: [3000] }], [5, { help: '1', dwell: [3000] }], [1, { help: '0', dwell: [3000] }]]);
  assert.equal(state(r), 'practice', 'relatív idő 1,0 > 0,9');
});

test('Gyakoroljuk még: kevesebb mint 5 napon nem', () => {
  assert.equal(state(slow(14, '11111').slice(1)), 'new');
});

/* ---------- Egyre jobban megy ---------- */

test('Egyre jobban megy: relatív idő ≤ 0,9 (határ), vagy csökkenő segítség', () => {
  const r = (rel, last = '0') => days('ma', [[3, { help: '1', dwell: [3000, 3000, 3000] }], [2, { help: '1' }], [1, { help: last, dwell: [3000 * rel, 3000 * rel, 3000 * rel] }]]);
  assert.equal(state(r(0.9, '1')), 'improving', 'relatív idő pontosan 0,9');
  assert.equal(state(r(0.91, '1')), 'new', '0,91, és a segítség sem csökkent (1 → 1)');
  const less = days('ma', [[3, { help: '111' }], [2, { help: '1' }], [1, { help: '100' }]]);
  assert.equal(state(less), 'improving', 'első 3: 3/3, utolsó 3: 1/3');
});

/* ---------- napszabály-kapcsoló ---------- */

test('napszabály-kapcsoló: egyetlen nap után is lehet „Már megy” és „Gyakoroljuk még”', () => {
  const one = days('ma', [[0, { help: '000', fast: 2 }]]);
  assert.equal(state(one), 'new');
  assert.equal(state(one, SKIP), 'fluent');
  const hard = days('gyöngy', [[0, { help: '11' }]]);
  assert.equal(state(hard, SKIP), 'practice');
  assert.equal(overview(analyze(hard, { now: NOW, cfg: CFG }), [{ name: 'L', items: ['gyöngy'] }]).empty, true);
  assert.equal(overview(analyze(hard, { now: NOW, cfg: SKIP }), [{ name: 'L', items: ['gyöngy'] }]).empty, false, 'nincs üres állapot');
});

test('a haladas.json értéke hat: más küszöb más állapotot ad ugyanarra az adatra', () => {
  const cfg = resolve({ ...structuredClone(CFG), allapot: { ...CFG.allapot, megy_relativ_ido_max: 0.85 } });
  assert.equal(state(fast3(0.81)), 'improving');
  assert.equal(state(fast3(0.81), cfg), 'fluent');
});

/* ---------- betűk (7.2) ---------- */

/** Napi összesítők több tételhez, egy napon: [tétel, segítséggel, összes]. */
const mix = (rows, k = 1) => rows.map(([item, sup, all]) => rec(item, ago(k), { help: '1'.repeat(sup) + '0'.repeat(all - sup) }));

test('betű segítségaránya: legalább 3 különböző tétel kell; a többjegyű egy betű', () => {
  const daily = mix([['gyöngy', 4, 4], ['gyár', 3, 4], ['ágy', 3, 4], ['ma', 0, 4], ['me', 0, 4], ['mi', 1, 4]]);
  const byItem = new Map(daily.map((d) => [d.item, [d]]));
  const { rate, without } = letterStats(byItem, ago(30), 3);
  assert.equal(rate.get('gy'), 10 / 12);
  assert.equal(rate.has('g'), false, 'a gy egy betű');
  assert.equal(rate.has('ö'), false, 'csak 1 tételben');
  assert.equal(without('gy'), 1 / 12);
  assert.equal(weakestLetter('gyöngy', rate), 'gy');
});

test('a 30 napnál régebbi adat nem számít a betűkbe', () => {
  const byItem = new Map(mix([['gyár', 4, 4], ['ágy', 4, 4], ['gyík', 4, 4]], 31).map((d) => [d.item, [d]]));
  assert.equal(letterStats(byItem, ago(30), 3).rate.size, 0);
});

test('Mi segíthet?: szótagnál és szónál, ha a betű legalább kétszer nehezebb; betűnél soha', () => {
  const hard = (item, n) => days(item, [[20, { help: '1' }], [15, { help: '1' }], [10, { help: '1' }], [5, { help: '1' }], [1, { help: '1'.repeat(n) }]]);
  const daily = [...hard('gyöngy', 3), ...hard('gyár', 3), ...hard('ágy', 2), ...hard('gy', 2), ...mix([['ma', 0, 6], ['me', 0, 6], ['mi', 1, 6], ['mo', 0, 6]])];
  const an = analyze(daily, { now: NOW, cfg: CFG });
  const lists = [{ name: '40. oldal', items: ['gyöngy', 'gyár', 'ágy', 'gy', 'ma', 'me', 'mi', 'mo'] }];
  const d = detail(an, 'gyöngy', lists);
  assert.equal(d.state, 'practice');
  assert.equal(d.help.letter, 'gy');
  assert.deepEqual(d.help.related.sort(), ['gy', 'gyár', 'ágy'].sort());
  assert.ok(!d.help.related.includes('gyöngy'));
  assert.equal(detail(an, 'gy', lists).help, null, 'betűnél nincs „Mi segíthet?”');
  assert.deepEqual(d.lists, ['40. oldal']);
  const max2 = analyze(daily, { now: NOW, cfg: resolve({ ...structuredClone(CFG), betu: { ...CFG.betu, kapcsolodo_max: 2 } }) });
  assert.equal(detail(max2, 'gyöngy', lists).help.related.length, 2);
  const flat = analyze(mix([['gyár', 1, 4], ['ágy', 1, 4], ['gyík', 1, 4], ['ma', 1, 4]]), { now: NOW, cfg: CFG });
  assert.equal(detail(flat, 'gyár', lists).help, null, 'nem kétszer nehezebb');
});

test('kártya-megjegyzés: a „Gyakoroljuk még” tételek legalább felében közös betű', () => {
  const rate = new Map([['gy', 0.9], ['á', 0.3], ['a', 0.1]]);
  assert.equal(cardLetter(['gyöngy', 'gyár', 'ágy', 'sün'], rate, 0.5), 'gy');
  assert.equal(cardLetter(['gyöngy', 'tál', 'kő', 'sí'], rate, 0.5), null);
  assert.equal(cardLetter(['gyár'], rate, 0.5), null, 'egy tételnél nincs „legtöbbjük”');
});

/* ---------- áttekintés (8.2) ---------- */

test('áttekintés: az összes = minden jelenlegi lista egyedi tételei; listánkénti számok; sorrend', () => {
  const daily = [
    ...fast3(0.5).map((r) => ({ ...r, item: 'ma', id: r.id })),
    ...days('me', [[3, { help: '0' }], [2, { help: '0' }], [0, { help: '0', fast: 2 }]]),
    ...slow(14, '11111').map((r) => ({ ...r, item: 'gyár' })),
    ...slow(14, '11100').map((r) => ({ ...r, item: 'gyöngy' })),
    rec('mi', ago(0)),
  ];
  const an = analyze(daily, { now: NOW, cfg: CFG });
  const lists = [{ name: 'A', items: ['ma', 'me', 'mi', 'mo'] }, { name: 'B', items: ['ma', 'gyár', 'gyöngy', 'Ma'] }];
  const ov = overview(an, lists);
  assert.equal(ov.total, 7, 'ma, me, mi, mo, gyár, gyöngy, Ma (kis- és nagybetű külön)');
  assert.equal(ov.seen, 5);
  assert.deepEqual(ov.counts, { fluent: 2, improving: 0, practice: 2 });
  assert.deepEqual(ov.cards.fluent.map((x) => x.item), ['me', 'ma'], 'a legutóbb látott elöl');
  assert.deepEqual(ov.cards.practice.map((x) => x.item), ['gyár', 'gyöngy'], 'a több segítséget igénylő elöl');
  assert.deepEqual(ov.perList, [
    { name: 'A', total: 4, fluent: 2, improving: 0, practice: 0 },
    { name: 'B', total: 4, fluent: 1, improving: 0, practice: 2 },
  ]);
  assert.equal(ov.empty, false);
  assert.deepEqual(currentItems([{ items: ['a', 'a ', 'b'] }]), ['a', 'b']);
});

test('üres állapot: 3 gyakorlási nap alatt; a napok és az olvasott tételek száma', () => {
  const an = analyze([rec('ma', ago(1)), rec('me', ago(1)), rec('ma', ago(0))], { now: NOW, cfg: CFG });
  const ov = overview(an, [{ name: 'L', items: ['ma', 'me'] }]);
  assert.equal(ov.empty, true); assert.equal(ov.practiceDays, 2); assert.equal(ov.itemsRead, 2); assert.equal(ov.minDays, 3);
});

/* ---------- tétel részletei és szövegek (8.3, 8.4b) ---------- */

test('részletek mondata: a spec sablonja; „szinte mindig” 80% fölött, „takarás”, „nem lett gyorsabb”', () => {
  const r = days('gyöngy', [[17, { help: '1', dwell: [3000] }], [12, { help: '1', dwell: [3000] }], [8, { help: '1', dwell: [3000] }], [4, { help: '1', dwell: [3000] }], [0, { help: '1', dwell: [3000] }]]);
  const an = analyze(r, { now: NOW, cfg: CFG });
  const d = detail(an, 'gyöngy', []);
  assert.equal(TX.detailSentence(d), 'Két és fél hete olvassa, de még most is szinte mindig kell hozzá takarás, és nem lett gyorsabb.');
  const p = days('gyöngy', [[14, { help: '0', dwell: [3000] }], [10, { help: '1', pauses: 1, covers: 0, dwell: [3000] }], [8, { help: '1', pauses: 1, covers: 0, dwell: [1000] }], [4, { help: '1', prevs: 1, covers: 0, dwell: [1000] }], [0, { help: '0', dwell: [1000] }]]);
  const d2 = detail(analyze(p, { now: NOW, cfg: CFG }), 'gyöngy', []);
  assert.equal(TX.detailSentence(d2), 'Két hete olvassa, de még most is gyakran kell hozzá segítség.');
  assert.equal(TX.detailSentence({ state: 'new' }), 'Most ismerkedik vele, még kevés alkalommal olvasta.');
  assert.equal(d.recentDays.length, 5);
});

test('részletek: legfeljebb az utolsó 14 gyakorlási nap', () => {
  const r = Array.from({ length: 20 }, (_, k) => rec('ma', ago(19 - k)));
  const d = detail(analyze(r, { now: NOW, cfg: CFG }), 'ma', []);
  assert.equal(d.recentDays.length, 14);
  assert.equal(d.recentDays.at(-1).day, TODAY);
});

test('szövegek: összefoglaló mondat, kimaradó tagmondatok, -ból/-ből, névelő', () => {
  const s = (o) => TX.summary(o).map((p) => p[0]).join('');
  assert.equal(s({ seen: 63, total: 76, counts: { fluent: 30, improving: 16, practice: 7 } }),
    'Eddig 63 tételt olvasott a 76-ból. 30 már megy, 16 egyre jobban megy, és 7 tételt érdemes még gyakorolni.');
  assert.equal(s({ seen: 4, total: 5, counts: { fluent: 0, improving: 2, practice: 1 } }),
    'Eddig 4 tételt olvasott az 5-ből. 2 egyre jobban megy, és 1 tételt érdemes még gyakorolni.');
  assert.equal(s({ seen: 3, total: 10, counts: { fluent: 3, improving: 0, practice: 0 } }), 'Eddig 3 tételt olvasott a 10-ből. 3 már megy.');
  assert.equal(s({ seen: 0, total: 20, counts: { fluent: 0, improving: 0, practice: 0 } }), 'Eddig 0 tételt olvasott a 20-ból.');
  assert.equal(TX.listText(16, 20), '16 megy a 20-ból');
  assert.equal(TX.listText(1, 5), '1 megy az 5-ből');
});

test('szövegek: időtartam és dátum', () => {
  assert.deepEqual([7, 10, 14, 17, 21, 30, 60].map(TX.durationText),
    ['Egy hete', 'Másfél hete', 'Két hete', 'Két és fél hete', 'Három hete', 'Egy hónapja', 'Két hónapja']);
  assert.equal(TX.dateLabel('2026-10-24'), 'okt. 24.');
  assert.equal(TX.dateLabel('2026-03-05'), 'márc. 5.');
  assert.equal(daysBetween('2026-10-25', '2026-10-26'), 1, 'az óraátállítás napján is');
});

test('szövegek: nincs gondolatjel, és a „tétel” szó egy helyről jön', () => {
  const all = [
    ...Object.values(TX.T), ...Object.values(TX.CARDS).flatMap((c) => [c.title, c.means]), ...Object.values(TX.STATE_NAME),
    ...TX.summary({ seen: 1, total: 2, counts: { fluent: 1, improving: 1, practice: 1 } }).map((p) => p[0]),
    ...TX.emptyText(2, 18).map((p) => p[0]), ...TX.mayHelpText('gy').map((p) => p[0]), TX.cardNote('gy'), TX.moreText(3),
  ];
  for (const s of all) assert.doesNotMatch(s, /[–—]/, s);
  assert.equal(TX.TERM.nom, 'tétel');
});
