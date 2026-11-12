// Haladás: szótagszám, szokásos tempó, friss idő, csoportok és okok a küszöbök határértékeivel,
// áttekintés, csoport oldala, részletek, szövegek (docs/haladas-specifikacio.md 7., 8.).
// Rögzített `now`, kitalált napi összesítők.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyze, classify, overview, groupView, detail, syllables, typeTempo, freshTime, history, daysBetween, currentItems, GROUPS,
} from '../js/core/mastery.js';
import { resolve } from '../js/core/haladas-config.js';
import { accSuffix, timesSuffix } from '../js/core/progress.js';
import * as TX from '../js/core/haladas-texts.js';

const CFG = resolve(null);
const A = CFG.allapot;
const SKIP = resolve(null, { skipDayRules: true });
const NOW = new Date(2026, 10, 20, 18, 0).getTime();   // helyi idő: 2026-11-20

/** A 2026-11-20-hoz képest k nappal korábbi nap. */
const ago = (k) => { const d = new Date(2026, 10, 20 - k); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Egy napi összesítő. help: megjelenésenként '0'/'1'; dwell: kézi idők; flash: villantásos idők (ms). */
function rec(item, day, { help = '0', dwell = [], flash = [], device } = {}) {
  const sup = [...help].filter((c) => c === '1').length;
  return {
    id: `d|default|${item}|${day}${device ? `|${device}` : ''}`, child: 'default', item, day,
    exposures: help.length, manualExposures: dwell.length, dwellMs: dwell, medianDwellMs: null,
    covers: sup, pauses: 0, prevs: 0, supportedExposures: sup, unsupportedFastFlash: 0, help,
    flashDwell: flash.map((ms) => ({ ms, flashMs: 10000 })),
  };
}
/** Napok (a legrégebbi elöl): [k nappal ezelőtt, opciók]. */
const days = (item, list) => list.map(([k, o]) => rec(item, ago(k), o));
const cls = (item, recs, tempo = null, cfg = CFG) => classify(item, recs, { cfg, tempo });
const pick = (s) => ({ group: s.group, reason: s.reason });

/* ---------- 7.2 szótagszám ---------- */

test('szótagszám: magánhangzók; nagybetű, kötőjel; csak mássalhangzónál 1', () => {
  const cases = { 'pi-ló-ta': 3, pilóta: 3, ma: 1, b: 1, sz: 1, dzs: 1, 'MA-MA': 2, Ő: 1, 'bo-hó-c': 2, gyöngy: 1, 'ÁÉÍÓÖŐÚÜŰ': 9 };
  for (const [k, n] of Object.entries(cases)) assert.equal(syllables(k), n, k);
});

/* ---------- 7.3 szokásos tempó ---------- */

const tempoOf = (daily, o = {}) => typeTempo(new Map(Object.entries(Object.groupBy(daily, (d) => d.item))), { window: 30, minCount: 10, ...o });

test('szokásos tempó: típusonként külön, szótagonként, kézi és villantásos idő együtt', () => {
  const daily = [
    rec('ma', ago(1), { help: '0'.repeat(5), dwell: [1000, 1000, 1000, 1000, 1000] }),
    rec('mi', ago(1), { help: '0'.repeat(5), flash: [3000, 3000, 3000, 3000, 3000] }),
    rec('ma-ma', ago(1), { help: '0'.repeat(10), dwell: Array(10).fill(4000) }),
    rec('b', ago(1), { help: '0'.repeat(9), dwell: Array(9).fill(500) }),
  ];
  const t = tempoOf(daily);
  assert.equal(t.get('szótag'), 2000, '5×1000 és 5×3000 középértéke');
  assert.equal(t.get('szó'), 2000, '4000 ms / 2 szótag');
  assert.equal(t.has('betű'), false, '9 mérés: nincs szokásos tempó');
});

test('szokásos tempó: 30 napos ablak az utolsó gyakorlási naptól (szünet után sem ürül ki)', () => {
  const old = rec('ma', ago(129), { help: '0'.repeat(10), dwell: Array(10).fill(9000) });
  const recent = rec('mi', ago(100), { help: '0'.repeat(10), dwell: Array(10).fill(1000) });
  assert.equal(tempoOf([old, recent]).get('szótag'), 9000 / 2 + 1000 / 2, '29 nappal az utolsó nap előtt: még benne');
  const older = rec('ma', ago(130), { help: '0'.repeat(10), dwell: Array(10).fill(9000) });
  assert.equal(tempoOf([older, recent]).get('szótag'), 1000, '30 nappal előtte: már kívül');
  assert.equal(tempoOf([recent]).get('szótag'), 1000, '100 napos szünet után is van tempó');
});

/* ---------- 7.4 friss idő ---------- */

test('friss idő: napi sorrend (előbb kézi, utána villantásos), az utolsó 3 középértéke szótagonként', () => {
  const h = history([
    rec('pi-ló', ago(2), { help: '00', dwell: [9000], flash: [1000] }),
    rec('pi-ló', ago(1), { help: '000', dwell: [2000, 4000], flash: [6000] }),
  ]);
  assert.deepEqual(h.times, [9000, 1000, 2000, 4000, 6000]);
  assert.equal(freshTime('pi-ló', h.times, 3), 2000, '4000 / 2 szótag');
  assert.equal(freshTime('pi-ló', [1000, 2000], 3), null, '2 mérés: nincs friss idő');
});

test('friss idő: lejárt villantásnak nincs ideje; ugyanaz a nap két eszközről egy nap', () => {
  const recs = [rec('ma', ago(1), { help: '00', dwell: [1000] }), rec('ma', ago(1), { help: '0', flash: [3000], device: 'b' })];
  const h = history(recs);
  assert.equal(h.days.length, 1);
  assert.equal(h.days[0].count, 3);
  assert.deepEqual(h.times, [1000, 3000], 'csak a mért idők');
});

/* ---------- 7.5–7.7 csoportok és okok ---------- */

test('7.7 példatáblázat: minden sor a csoporttal és az okkal (szokásos tempó 1,5 mp/szótag)', () => {
  const T = 1500;
  const rows = [
    ['pi-ló-ta', [[4, { help: '0' }], [3, { help: '1' }], [2, { help: '00', dwell: [4200, 3900] }], [1, { help: '0', dwell: [4000] }]], 'fluent', null],
    ['ka-bát', [[3, { help: '00', dwell: [5000] }], [2, { help: '00', dwell: [5400] }], [1, { help: '0', dwell: [4800] }]], 'unsure', 'slow'],
    ['me', [[5, { help: '0' }], [4, { help: '0' }], [3, { help: '0', dwell: [13000] }], [2, { help: '0', dwell: [11000] }], [1, { help: '0', dwell: [9000] }]], 'practice', 'slow'],
    ['bo-hó-c', [[4, { help: '1' }], [3, { help: '01' }], [2, { help: '1' }], [1, { help: '0' }]], 'practice', 'help'],
    ['ma', [[3, { help: '0' }], [2, { help: '0', dwell: [2000] }], [1, { help: '0', dwell: [2100] }]], 'fluent', null],
    ['la', [[2, { help: '00', dwell: [1000, 1200] }], [1, { help: '0', dwell: [900] }]], 'lowdata', null],
    ['ba', [[3, { help: '1', dwell: [1800] }], [2, { help: '1', dwell: [2000] }], [1, { help: '0', dwell: [1700] }]], 'unsure', 'help'],
  ];
  const ratios = { 'pi-ló-ta': 4000 / 3 / T, 'ka-bát': 2500 / T, me: 11000 / T, 'bo-hó-c': null, ma: null, la: 1000 / T, ba: 1800 / T };
  for (const [item, list, group, reason] of rows) {
    const s = cls(item, days(item, list), T);
    assert.deepEqual(pick(s), { group, reason }, item);
    if (ratios[item] == null) assert.equal(s.ratio, null, item);
    else assert.ok(Math.abs(s.ratio - ratios[item]) < 1e-9, `${item}: ${s.ratio}`);
  }
  const boho = cls('bo-hó-c', days('bo-hó-c', rows[3][1]), T);
  assert.deepEqual([boho.helpN, boho.helpK], [5, 3]);
});

/** 3 nap, az utolsó 3 mért idő `ms`; a segítségsor `help` (napokra szétosztva). */
const three = (item, help, ms) => days(item, [[3, { help: help.slice(0, -2), dwell: [ms] }], [2, { help: help.at(-2), dwell: [ms] }], [1, { help: help.at(-1), dwell: [ms] }]]);

test('határértékek: arány 1,5 → Megy, efölött Még bizonytalan; 2 → Még gyakorolni kell', () => {
  assert.equal(cls('ma', three('ma', '000', 1500), 1000).group, 'fluent', 'pontosan 1,5');
  assert.deepEqual(pick(cls('ma', three('ma', '000', 1501), 1000)), { group: 'unsure', reason: 'slow' });
  assert.deepEqual(pick(cls('ma', three('ma', '000', 1999), 1000)), { group: 'unsure', reason: 'slow' });
  assert.deepEqual(pick(cls('ma', three('ma', '000', 2000), 1000)), { group: 'practice', reason: 'slow' }, 'pontosan 2');
});

test('segítség: 3/5 → Még gyakorolni kell; 2/5 és a segítség az utolsó 3-ban → Még bizonytalan', () => {
  assert.deepEqual(pick(cls('ma', three('ma', '10110', 1000), 1000)), { group: 'practice', reason: 'help' });
  assert.deepEqual(pick(cls('ma', three('ma', '00110', 1000), 1000)), { group: 'unsure', reason: 'help' });
  assert.deepEqual(pick(cls('ma', three('ma', '11000', 1000), 1000)), { group: 'fluent', reason: null }, 'a régi segítség nem számít');
  assert.deepEqual(pick(cls('ma', three('ma', '111000', 1000), 1000)), { group: 'fluent', reason: null }, '6 alkalomból csak az utolsó 5 számít');
});

test('5-nél kevesebb alkalom: a meglévőkből számol, a mondat számaival', () => {
  const r = days('ma', [[3, { help: '1' }], [2, { help: '11' }], [1, { help: '0' }]]);
  const s = cls('ma', r);
  assert.deepEqual([s.group, s.reason, s.helpN, s.helpK], ['practice', 'help', 4, 3]);
  assert.equal(TX.reasonSentence(s, A), 'Az utóbbi 4 alkalomból 3-szor kellett segítség.');
});

test('ok: ha a segítség- és az arány-feltétel is teljesül, az ok „help”', () => {
  assert.deepEqual(pick(cls('ma', three('ma', '111', 5000), 1000)), { group: 'practice', reason: 'help' });
});

test('nincs szokásos tempó vagy friss idő: nincs időfeltétel', () => {
  assert.equal(cls('ma', three('ma', '000', 99000), null).group, 'fluent');
  const two = days('ma', [[3, { help: '0' }], [2, { help: '0', dwell: [9000] }], [1, { help: '0', dwell: [9000] }]]);
  assert.equal(cls('ma', two, 1000).ratio, null);
  assert.equal(cls('ma', two, 1000).group, 'fluent');
});

test('Kevés adat: kevesebb mint 3 különböző napon, vagy még nem olvasta; két eszköz egy napja egy nap', () => {
  assert.equal(cls('ma', []).group, 'lowdata');
  assert.equal(cls('ma', days('ma', [[2, { help: '000' }], [1, { help: '000' }]])).group, 'lowdata');
  const dup = [rec('ma', ago(2)), rec('ma', ago(2), { device: 'b' }), rec('ma', ago(1)), rec('ma', ago(1), { device: 'b' })];
  assert.equal(cls('ma', dup).dayCount, 2);
  assert.equal(cls('ma', dup).group, 'lowdata');
  assert.equal(cls('ma', [{ ...rec('ma', ago(1)), exposures: 0, help: '' }, rec('ma', ago(2)), rec('ma', ago(3))]).dayCount, 2, '0 megjelenésű nap nem olvasási nap');
});

test('a Még bizonytalan csoportnak mindig van oka (véletlen sorokkal)', () => {
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
  for (let k = 0; k < 2000; k++) {
    const n = 3 + Math.floor(rnd() * 6);
    const list = Array.from({ length: n }, (_, d) => [n - d, { help: rnd() < 0.3 ? '1' : '0', dwell: rnd() < 0.7 ? [500 + rnd() * 4000] : [] }]);
    const s = cls('ma', days('ma', list), rnd() < 0.8 ? 1000 : null);
    assert.ok(GROUPS.includes(s.group));
    if (s.group === 'unsure' || s.group === 'practice') assert.ok(s.reason === 'help' || s.reason === 'slow', JSON.stringify(s));
    else assert.equal(s.reason, null);
  }
});

test('napszabály-kapcsoló: min_nap = 0 mellett 1 napos adat is besorolódik; a nem olvasott nem', () => {
  const hard = days('gyöngy', [[0, { help: '111' }]]);
  assert.equal(cls('gyöngy', hard).group, 'lowdata');
  assert.deepEqual(pick(cls('gyöngy', hard, null, SKIP)), { group: 'practice', reason: 'help' });
  assert.equal(cls('ma', days('ma', [[0, { help: '000' }]]), null, SKIP).group, 'fluent');
  assert.equal(cls('ma', days('ma', [[0, { help: '0' }]]), null, SKIP).group, 'lowdata', '3 alkalom nélkül nem „Megy”');
  assert.equal(cls('ma', days('ma', [[0, { help: '01' }]]), null, SKIP).group, 'lowdata', '2 alkalom: kevés adat, segítséggel sem sorolódik be hamarabb');
  assert.deepEqual(pick(cls('ma', days('ma', [[0, { help: '001' }]]), null, SKIP)), { group: 'unsure', reason: 'help' });
  assert.equal(cls('ma', [], null, SKIP).group, 'lowdata');
});

test('Kevés adat kapu: kevés nap vagy kevés alkalom; a hiányzó feltétel (need)', () => {
  const need = (recs, cfg = CFG) => { const s = cls('ma', recs, null, cfg); return [s.group, s.need]; };
  assert.deepEqual(need([]), ['lowdata', 'days']);
  assert.deepEqual(need(days('ma', [[2, { help: '000' }], [1, { help: '000' }]])), ['lowdata', 'days']);
  assert.deepEqual(need([], SKIP), ['lowdata', 'count'], 'kapcsolóval a nem olvasott is alkalomhiány');
  assert.deepEqual(need(days('ma', [[0, { help: '00' }]]), SKIP), ['lowdata', 'count']);
  const many = resolve({ ...structuredClone(CFG), allapot: { ...A, min_alkalom: 5 } });
  assert.deepEqual(need(days('ma', [[3, { help: '0' }], [2, { help: '0' }], [1, { help: '0' }]]), many), ['lowdata', 'count'], '3 nap, de csak 3 alkalom');
  assert.deepEqual(need(days('ma', [[3, { help: '00' }], [2, { help: '00' }], [1, { help: '0' }]]), many), ['fluent', null]);
});

test('ugyanaz a mérce segítséggel és anélkül: a segítség nem sorol be hamarabb', () => {
  for (const cfg of [CFG, SKIP]) {
    for (let n = 1; n < A.min_alkalom; n++) {
      for (const help of ['0'.repeat(n), '1'.repeat(n), '0'.repeat(n - 1) + '1']) {
        assert.equal(cls('ma', days('ma', [[0, { help }]]), null, cfg).group, 'lowdata', `${help} (min_nap=${cfg.allapot.min_nap})`);
      }
    }
  }
});

test('Még bizonytalan csak akkor, ha már olvasta segítség nélkül is (véletlen sorokkal, kapcsolóval és anélkül)', () => {
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2 ** 31; return seed / 2 ** 31; };
  const loose = resolve({ ...structuredClone(CFG), allapot: { ...A, gyakorol_segitseg_db: 4 } });
  for (const cfg of [CFG, SKIP, loose, resolve(loose, { skipDayRules: true })]) {
    for (let k = 0; k < 1500; k++) {
      const n = 1 + Math.floor(rnd() * 5);
      const list = Array.from({ length: n }, (_, d) => [n - d, { help: Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => (rnd() < 0.5 ? '1' : '0')).join('') }]);
      const s = cls('ma', days('ma', list), null, cfg);
      const help = list.map(([, o]) => o.help).join('');
      if (s.group === 'unsure') assert.ok(help.includes('0'), `${help} → unsure`);
      if (s.group !== 'lowdata') assert.ok(help.length >= cfg.allapot.min_alkalom && s.dayCount >= cfg.allapot.min_nap, `${help} → ${s.group}`);
    }
  }
  assert.deepEqual(pick(cls('ma', days('ma', [[0, { help: '111' }]]), null, resolve(loose, { skipDayRules: true }))), { group: 'practice', reason: 'help' }, 'mindig segítséggel: gyakorolni kell, akkor is, ha a segítség-küszöb nem teljesül');
});

test('a képernyőképek esetei (dev, napszabály-kapcsolóval)', () => {
  const g = (item, list) => cls(item, days(item, list), null, SKIP).group;
  assert.equal(g('áf', [[0, { help: '0' }]]), 'lowdata');
  assert.equal(g('pa-pa', [[0, { help: '0' }]]), 'lowdata');
  assert.equal(g('cu-ki', [[0, { help: '00' }]]), 'lowdata');
  assert.equal(g('ke-le', [[0, { help: '1' }]]), 'lowdata', 'korábban: Még bizonytalan, segítség nélküli olvasás nélkül');
  assert.equal(g('úl', [[1, { help: '1' }], [0, { help: '0' }]]), 'lowdata', '2 alkalom');
  assert.equal(g('pe-le', [[1, { help: '0' }], [0, { help: '00' }]]), 'fluent');
  const kele = cls('ke-le', days('ke-le', [[0, { help: '1' }]]), null, SKIP);
  assert.equal(TX.reasonSentence(kele, SKIP.allapot), 'Egy tételről csak akkor tudjuk a haladást megállapítani, ha legalább 3-szor olvasta.');
  assert.doesNotMatch(TX.cardText('lowdata', SKIP.allapot), /\b0\b/, 'soha nem „legalább 0”');
});

test('a haladas.json értéke hat: más küszöb más csoportot ad ugyanarra az adatra', () => {
  const cfg = resolve({ ...structuredClone(CFG), allapot: { ...A, megy_ido_szorzo: 1.8 } });
  assert.equal(cls('ma', three('ma', '000', 1700), 1000).group, 'unsure');
  assert.equal(cls('ma', three('ma', '000', 1700), 1000, cfg).group, 'fluent');
});

/* ---------- áttekintés, csoport oldala, részletek (8.) ---------- */

/** Napi összesítők a 4 csoporthoz (a szokásos tempó nincs meg, csak a segítség dönt). */
function sample() {
  return [
    ...three('ma', '000', 1000), ...days('me', [[5, { help: '0' }], [4, { help: '0' }], [0, { help: '0' }]]),
    ...three('gyár', '11111', 1000), ...three('gyöngy', '10110', 1000),
    ...three('mi', '001', 1000),
    ...days('mo', [[2, { help: '0' }], [1, { help: '0' }]]), rec('mu', ago(0)),
  ];
}
const LISTS = [{ name: 'A', items: ['ma', 'me', 'mi', 'mo', 'mu', 'zs'] }, { name: 'B', items: ['ma', 'gyár', 'gyöngy', 'Ma', 'sz'] }];

test('áttekintés: a négy szám összege = minden jelenlegi lista egyedi tételei; listánként is; sorrend', () => {
  const ov = overview(analyze(sample(), { now: NOW, cfg: CFG }), LISTS);
  assert.equal(ov.total, 10, 'ma, me, mi, mo, mu, zs, gyár, gyöngy, Ma, sz');
  assert.deepEqual(ov.counts, { fluent: 2, unsure: 1, practice: 2, lowdata: 5 });
  assert.equal(GROUPS.reduce((s, g) => s + ov.counts[g], 0), ov.total);
  assert.equal(ov.seen, 7);
  assert.equal(ov.grouped, 5);
  assert.deepEqual(ov.groups.fluent.map((x) => x.item), ['me', 'ma'], 'a legutóbb olvasott elöl');
  assert.deepEqual(ov.groups.practice.map((x) => x.item), ['gyár', 'gyöngy'], 'a több segítséget igénylő elöl');
  assert.deepEqual(ov.groups.lowdata.map((x) => x.item), ['mo', 'mu', 'zs', 'Ma', 'sz'], 'több nap elöl, a nem olvasottak listasorrendben a végén');
  assert.deepEqual(ov.perList, [
    { name: 'A', total: 6, fluent: 2, unsure: 1, practice: 0, lowdata: 3 },
    { name: 'B', total: 5, fluent: 1, unsure: 0, practice: 2, lowdata: 2 },
  ]);
  for (const l of ov.perList) assert.equal(GROUPS.reduce((s, g) => s + l[g], 0), l.total);
  assert.deepEqual(currentItems([{ items: ['a', 'a ', 'b'] }]), ['a', 'b']);
});

test('Még gyakorolni kell sorrend: segítségarány, majd darab, majd tempóarány', () => {
  const daily = [...three('a1', '111', 1000), ...three('a2', '11100', 1000), ...three('a3', '00000', 3000), ...three('a4', '00000', 2500),
    ...Array.from({ length: 10 }, (_, k) => rec(`z${k}`, ago(1), { dwell: [1000] }))];
  const ov = overview(analyze(daily, { now: NOW, cfg: CFG }), [{ name: 'L', items: ['a4', 'a3', 'a2', 'a1'] }]);
  assert.deepEqual(ov.groups.practice.map((x) => x.item), ['a1', 'a2', 'a3', 'a4']);
});

test('csoport oldala: a csoport összes tétele; Kevés adatnál két rész; ismeretlen csoport: null', () => {
  const an = analyze(sample(), { now: NOW, cfg: CFG });
  assert.deepEqual(groupView(an, 'fluent', LISTS).items.map((x) => x.item), ['me', 'ma']);
  assert.equal(groupView(an, 'fluent', LISTS).parts, null);
  const low = groupView(an, 'lowdata', LISTS);
  assert.deepEqual(low.parts.map((p) => [p.key, p.items.map((x) => x.item)]), [['read', ['mo', 'mu']], ['unread', ['zs', 'Ma', 'sz']]]);
  assert.equal(groupView(an, 'improving', LISTS), null);
  assert.deepEqual(groupView(analyze([], { now: NOW, cfg: CFG }), 'practice', LISTS).items, []);
});

test('részletek: alkalmak, különböző napok, első nap, napi alkalomszám; legfeljebb 14 nap', () => {
  const an = analyze([...days('ma', [[5, { help: '01' }], [3, { help: '000' }]]), rec('ma', ago(3), { device: 'b' })], { now: NOW, cfg: CFG });
  const d = detail(an, 'ma');
  assert.deepEqual([d.exposures, d.dayCount, d.firstDay], [6, 2, ago(5)]);
  assert.deepEqual(d.recentDays, [{ day: ago(5), count: 2, help: 'some' }, { day: ago(3), count: 4, help: 'none' }]);
  const all = detail(analyze(days('mi', [[2, { help: '11' }], [1, { help: '1' }, ], [0, { help: '10' }]]), { now: NOW, cfg: CFG }), 'mi');
  assert.deepEqual(all.recentDays.map((x) => x.help), ['all', 'all', 'some']);
  const long = detail(analyze(Array.from({ length: 20 }, (_, k) => rec('ma', ago(19 - k))), { now: NOW, cfg: CFG }), 'ma');
  assert.equal(long.recentDays.length, 14);
  assert.equal(detail(an, 'zs').exposures, 0);
  assert.equal(daysBetween('2026-10-25', '2026-10-26'), 1, 'az óraátállítás napján is');
});

/* ---------- szövegek ---------- */

test('ragok: tárgyrag és -szor/-szer/-ször', () => {
  const acc = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 1000].map((n) => `${n}-${accSuffix(n)}`);
  assert.deepEqual(acc, ['1-et', '2-t', '3-at', '4-et', '5-öt', '6-ot', '7-et', '8-at', '9-et', '10-et', '12-t', '20-at', '30-at', '40-et', '50-et', '60-at', '70-et', '80-at', '90-et', '100-at', '120-at', '1000-et']);
  const times = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20, 25, 100].map((n) => `${n}-${timesSuffix(n)}`);
  assert.deepEqual(times, ['1-szer', '2-szer', '3-szor', '4-szer', '5-ször', '6-szor', '7-szer', '8-szor', '9-szer', '10-szer', '20-szor', '25-ször', '100-szor']);
});

const join = (parts) => parts.map((p) => p[0]).join('');
const sum = (seen, total, f, u, p, l) => join(TX.summary({ seen, total, grouped: f + u + p, counts: { fluent: f, unsure: u, practice: p, lowdata: l } }));

test('összefoglaló: mind a négy csoport; 0 tagok kimaradnak; csoport nélkül; 0 Kevés adat; még semmi', () => {
  assert.equal(sum(100, 140, 5, 4, 3, 128),
    'Eddig 100 tételt olvasott a 140-ből. 12 már csoportba került: 5 megy, 4 még bizonytalan, 3-at még gyakorolni kell. A többi 128 tételről még kevés az adat.');
  assert.equal(sum(300, 340, 60, 90, 120, 70),
    'Eddig 300 tételt olvasott a 340-ből. 270 már csoportba került: 60 megy, 90 még bizonytalan, 120-at még gyakorolni kell. A többi 70 tételről még kevés az adat.');
  assert.equal(sum(10, 10, 5, 0, 5, 0), 'Eddig 10 tételt olvasott a 10-ből. 10 már csoportba került: 5 megy, 5-öt még gyakorolni kell.');
  assert.equal(sum(4, 5, 0, 2, 0, 3), 'Eddig 4 tételt olvasott az 5-ből. 2 már csoportba került: 2 még bizonytalan. A többi 3 tételről még kevés az adat.');
  assert.equal(sum(9, 140, 0, 0, 0, 140), 'Eddig 9 tételt olvasott a 140-ből. Még mind a 140 tételről kevés az adat.');
  assert.equal(sum(0, 140, 0, 0, 0, 140), 'Kezdd el használni a programot, hogy láthasd a haladást!');
  const bold = TX.summary({ seen: 100, total: 140, grouped: 12, counts: { fluent: 5, unsure: 4, practice: 3, lowdata: 128 } }).filter((p) => p[1]).map((p) => p[0]);
  assert.deepEqual(bold, ['100 tételt', '140', '12', '5', '4', '3', '128']);
});

test('kártyák: a szövegek a spec szerint, a számok a konfigurációból', () => {
  assert.deepEqual(TX.CARD_ORDER.map((k) => TX.cardText(k, A)), [
    'Az utóbbi 3 alkalommal takarás, megállítás és visszalépés nélkül olvasta, és nem akadt el rajta.',
    'Már olvasta segítség nélkül is, de néha még nehezen megy.',
    'Az utóbbi 5 alkalomból legalább 3-szor kellett segítség, vagy sokkal lassabban olvasta, mint a többi tételt.',
    'Egy tételről csak akkor tudjuk a haladást megállapítani, ha legalább 3 különböző napon olvasta.',
  ]);
  assert.deepEqual(TX.CARD_ORDER.map((k) => TX.CARDS[k].color), ['#2E6B66', '#8DBDB6', '#E7B96A', '#BDB4A4']);
  const a = { ...A, megy_utolso_n: 4, gyakorol_utolso_n: 6, gyakorol_segitseg_db: 5, min_nap: 2 };
  assert.match(TX.cardText('fluent', a), /utóbbi 4 alkalommal/);
  assert.match(TX.cardText('practice', a), /utóbbi 6 alkalomból legalább 5-ször/);
  assert.match(TX.cardText('lowdata', a), /legalább 2 különböző napon és összesen legalább 3-szor olvasta\./, 'a min_alkalom több, mint a min_nap');
  assert.equal(TX.cardText('lowdata', SKIP.allapot), 'Egy tételről csak akkor tudjuk a haladást megállapítani, ha legalább 3-szor olvasta.');
  assert.equal(TX.lowdataText(A, 'count'), 'Egy tételről csak akkor tudjuk a haladást megállapítani, ha legalább 3-szor olvasta.');
  assert.equal(TX.lowdataText(A, 'days'), 'Egy tételről csak akkor tudjuk a haladást megállapítani, ha legalább 3 különböző napon olvasta.');
  assert.equal(TX.partRead(A), 'Olvasta, még kevés napon');
  assert.equal(TX.partRead(SKIP.allapot), 'Olvasta, még kevésszer');
  assert.equal(TX.infoText(3), 'Az első tételek legkorábban a 3. napon kerülnek csoportba.');
  assert.equal(TX.groupTitle('fluent', 60), 'Megy: 60 tétel');
  assert.equal(TX.showAllAria('fluent', 60), 'Megy: mind a 60 tétel');
  assert.equal(TX.showAllAria('lowdata', 5), 'Kevés adat: mind az 5 tétel');
});

test('fő mondat mind a 7 esetben (a design szövegkatalógusa)', () => {
  const s = (group, reason, type, helpN = 0, helpK = 0) => TX.reasonSentence({ group, reason, type, helpN, helpK }, A);
  assert.equal(s('fluent', null, 'szó'), 'Az utóbbi 3 alkalommal takarás, megállítás és visszalépés nélkül olvasta, és nem akadt el rajta.');
  assert.equal(s('unsure', 'help', 'szótag'), 'Már olvasta segítség nélkül is, de néha még kell hozzá segítség.');
  assert.equal(s('unsure', 'slow', 'szó'), 'Segítség nélkül olvasta, de még lassabban, mint a többi szót.');
  assert.equal(s('practice', 'help', 'szó', 5, 3), 'Az utóbbi 5 alkalomból 3-szor kellett segítség.');
  assert.equal(s('practice', 'slow', 'szótag'), 'Lassabban olvasta, mint a többi szótagot.');
  assert.equal(s('practice', 'slow', 'betű'), 'Lassabban olvasta, mint a többi betűt.');
  assert.equal(TX.reasonSentence({ group: 'lowdata', reason: null, need: 'days', type: 'szó' }, A), 'Egy tételről csak akkor tudjuk a haladást megállapítani, ha legalább 3 különböző napon olvasta.');
  assert.equal(s('lowdata', null, 'szótag'), 'Egy tételről csak akkor tudjuk a haladást megállapítani, ha legalább 3 különböző napon olvasta.');
});

test('részletek szövegei: tények, dátum, pötty címkéje', () => {
  assert.equal(join(TX.facts({ exposures: 9, dayCount: 4, firstDay: '2026-10-24' })), 'Eddig 9 alkalommal olvasta, 4 különböző napon. Először: okt. 24.');
  assert.equal(TX.dayAria('2026-10-28', 4, 'all'), 'okt. 28., 4 alkalom, segítséggel');
  assert.equal(TX.dayAria('2026-11-03', 2, 'none'), 'nov. 3., 2 alkalom, segítség nélkül');
  assert.equal(TX.dayAria('2026-11-11', 2, 'some'), 'nov. 11., 2 alkalom, segítséggel és anélkül is');
  assert.equal(TX.dateLabel('2026-03-05'), 'márc. 5.');
});

test('listánként: szöveg és akadálymentes címke (mind a négy szám, vagy „mindegyikről kevés az adat”)', () => {
  assert.equal(TX.listText(2, 20), '2 megy a 20-ból');
  assert.equal(TX.listText(1, 5), '1 megy az 5-ből');
  assert.equal(TX.listAria({ name: 'Betűk', total: 20, fluent: 2, unsure: 1, practice: 1, lowdata: 16 }),
    'Betűk: 2 megy, 1 még bizonytalan, 1 még gyakorolni kell, 16 kevés adat, 20 tételből');
  assert.equal(TX.listAria({ name: 'Betűk', total: 20, fluent: 0, unsure: 0, practice: 0, lowdata: 20 }), 'Betűk: 20 tételből mindegyikről kevés az adat');
  assert.equal(TX.T.grey, 'A szürke rész: erről a tételről még kevés az adat.');
});

test('szövegek: nincs gondolatjel, a „tétel” szó egy helyről jön, és a régi szövegek eltűntek', () => {
  const all = [
    ...Object.values(TX.T).flat(), ...TX.CARD_ORDER.flatMap((k) => [TX.CARDS[k].title, TX.cardText(k, A)]),
    ...TX.summary({ seen: 1, total: 2, grouped: 1, counts: { fluent: 1, unsure: 1, practice: 1, lowdata: 1 } }).map((p) => p[0]),
    TX.infoText(3), TX.groupTitle('lowdata', 3), TX.showAllAria('unsure', 4),
  ];
  for (const s of all) assert.doesNotMatch(s, /[–—]/, s);
  assert.equal(TX.TERM.nom, 'tétel');
  for (const gone of ['emptyText', 'emptyAria', 'emptyCount', 'moreText', 'mayHelpText', 'cardNote', 'footLists', 'durationText', 'detailSentence']) {
    assert.equal(TX[gone], undefined, gone);
  }
  assert.doesNotMatch(all.join(' '), /Egyre jobban|Gyakoroljuk még|Már megy/);
});
