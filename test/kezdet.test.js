// Keresd meg! – azonos kezdet súlya (docs/keresd-meg-azonos-kezdet.md).
// A heurisztika többi tesztjéhez hasonlóan rögzített fixture-rel fut (test/fixtures/parok.json, lista.txt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalize, validateConfig, compileConfig, prefix, prefixScore, createPool, buildGrid, gridFrom,
  innerRatio, seeded, meanToAnchor, closePairs, readingDepth, calibrateCurve,
} from '../js/core/grid.js';
import { parseListsText } from '../js/core/lists.js';

const fx = (f) => new URL(`./fixtures/${f}`, import.meta.url);
const RAW = JSON.parse(readFileSync(fx('parok.json'), 'utf8'));
const LIST = [...new Set(parseListsText(readFileSync(fx('lista.txt'), 'utf8')).lists.flatMap((l) => l.items))];

/** A fixture konfigurációja adott β-val; undefined: a kulcs hiányzik. */
function cfgWith(beta) {
  const c = structuredClone(RAW);
  if (beta === undefined) delete c.racs.kezdet_suly; else c.racs.kezdet_suly = beta;
  return c;
}
const ccWith = (beta) => compileConfig(cfgWith(beta));
/** A fixture érvényes változata (a prototípus elavult kulcsai nélkül), a validációs tesztekhez. */
function validCfg() {
  const c = structuredClone(RAW);
  for (const k of ['nehez_elesseg', 'nehez_disztraktor_esely', 'konnyu_min_tav_betunkent', 'konnyu_min_tav_also_hatar']) delete c.racs[k];
  return c;
}

/* ---------- determinisztikus tesztvektorok ---------- */

test('közös kezdet: a spec tesztvektorai (többjegyű betű egy betű)', () => {
  assert.equal(prefix('ka-pa', 'ka-pu'), 3);
  assert.equal(prefix('ka-pa', 'pa-pa'), 0);
  assert.equal(prefix('szép', 'sas'), 0, 'sz ≠ s');
  assert.equal(prefix('sza', 'szi'), 1);
  assert.equal(prefix('dzsu', 'dzu'), 0, 'dzs ≠ dz');
  assert.equal(prefix('Ma-Ma', 'ma-ci'), 2, 'normalizálva');
  assert.equal(prefix('ma', 'ma-ma'), 2, 'előtag: a rövidebb hossza');
});

test('kezdet-pontszám M(x): a spec tesztvektorai; vizuálisan hasonló betű nem számít', () => {
  assert.equal(prefixScore('ka-pu', ['ka-pa']), 0.75);
  assert.equal(prefixScore('ma', ['mi']), 0.5);
  assert.equal(prefixScore('pa-ta', ['ka-pa', 'pa-pa']), 0.5, 'a rács bármelyik tagjához mér, nem csak a horgonyhoz');
  assert.equal(prefixScore('b', ['d']), 0);
  assert.equal(prefixScore('ma-ci', ['na-ci', 'ba-ci']), 0, 'm/n nem azonos kezdet');
  assert.equal(prefixScore('ka-pa', []), 0);
});

test('olvasási mélység: felismerési pont a kártya hosszához mérve, a rácsra átlag', () => {
  const pool = createPool(['ka-pa', 'ka-pu', 'pa-pa', 'ma', 'ma-ma'], ccWith(0));
  const at = (...ks) => ks.map((k) => pool.entries.findIndex((e) => e.key === k));
  // ka-pa és ka-pu: 4. betűig kell olvasni (1); pa-pa: az első betű elég (1/4)
  assert.equal(readingDepth(pool, at('kapa', 'kapu', 'papa')), (1 + 1 + 0.25) / 3);
  // ma a mama előtagja: a teljes kártya kell (1); mama: a 3. betű dönt (3/4)
  assert.equal(readingDepth(pool, at('ma', 'mama')), (1 + 0.75) / 2);
  assert.equal(readingDepth(pool, at('papa')), 0.25);
});

/* ---------- konfiguráció ---------- */

test('konfiguráció: kezdet_suly opcionális (hiányzó = 0), 0 és 1 között érvényes', () => {
  assert.deepEqual(validateConfig(validCfg()), [], 'kulcs nélkül');
  for (const b of [0, 0.5, 1]) {
    const c = validCfg(); c.racs.kezdet_suly = b;
    assert.deepEqual(validateConfig(c), [], `β = ${b}`);
  }
  assert.equal(compileConfig(validCfg()).prefixWeight, 0);
  assert.equal(ccWith(0.5).prefixWeight, 0.5);
});

test('konfiguráció: hibás kezdet_suly validációs hiba (a deploy megáll)', () => {
  for (const b of [-0.1, 1.5, '0.5', null, NaN, true, [0.5]]) {
    const c = validCfg(); c.racs.kezdet_suly = b;
    const p = validateConfig(c);
    assert.equal(p.length, 1, `${JSON.stringify(b)}: ${p}`);
    assert.match(p[0], /kezdet_suly/);
  }
});

test('konfiguráció: a repó parok.json-ja érvényes, és a dev kezdőértéke 0.5', () => {
  const live = JSON.parse(readFileSync(new URL('../parok.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateConfig(live), []);
  assert.equal(live.racs.kezdet_suly, 0.5);
});

/* ---------- visszafelé kompatibilitás ---------- */

const POOL0 = createPool(LIST, ccWith(undefined));

/** Rácsok minden fokozaton és kártyaszámon, adott seedből. */
function grids(pool, seed, levels = pool.cc.levels) {
  const out = [];
  for (const n of [4, 6, 8]) for (const lv of levels) {
    const rng = seeded(seed + n);
    for (let k = 0; k < 60; k++) out.push(buildGrid(pool, n, lv, rng));
  }
  return out;
}

test('visszafelé kompatibilitás: kulcs nélkül és β = 0 mellett a rácsok pontosan a mostaniak', () => {
  const pool = createPool(LIST, ccWith(0));
  assert.deepEqual(grids(pool, 31), grids(POOL0, 31));
});

test('a 0-s fokozat rácsai β-tól függetlenek', () => {
  const base = grids(POOL0, 41, [0]);
  for (const b of [0.5, 1]) assert.deepEqual(grids(createPool(LIST, ccWith(b)), 41, [0]), base, `β = ${b}`);
});

test('betű horgony: a rács minden fokozaton β-tól független (egybetűs tételnek nincs kezdete)', () => {
  const pools = [0, 0.5, 1].map((b) => createPool(LIST, ccWith(b)));
  const letters = POOL0.entries.map((e, i) => i).filter((i) => POOL0.entries[i].type === 'betű');
  assert.ok(letters.length >= 10);
  for (const s of [0, 0.3, 0.6, 1]) for (const a of letters) {
    const [g0, ...rest] = pools.map((p) => gridFrom(p, a, 6, s, seeded(a * 7 + s * 100)));
    for (const g of rest) assert.deepEqual(g, g0, `${POOL0.entries[a].key}, s = ${s}`);
  }
});

/* ---------- rács-összeállítás (szabályok) ---------- */

test('azonos kezdet: M a rács minden tagjához mér → a horgonytól független pa-csoport is kialakul', () => {
  // β = 1, s = 1: a súly csak M(x)^p. A ka-pa mellett egyik jelöltnek sincs közös kezdete, így az első húzás
  // egyenletes; ha az egy pa-…, onnan csak a pa-… jelöltek súlya pozitív.
  const pool = createPool(['ka-pa', 'pa-pa', 'pa-ta', 'pa-ca', 'lo-mi', 'ro-fe', 'ti-nu'], ccWith(1));
  const a = 0, key = (g) => g.map((i) => pool.entries[i].key);
  let groups = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const g = key(gridFrom(pool, a, 4, 1, seeded(seed)));
    assert.equal(g[0], 'kapa');
    if (g[1].startsWith('pa')) { groups++; assert.deepEqual(new Set(g), new Set(['kapa', 'papa', 'pata', 'paca'])); }
  }
  assert.ok(groups > 60 && groups < 140, `pa-csoport: ${groups}/200`);
});

test('azonos kezdet: a feltöltés készletére is érvényes (szótag horgony, kevés szótag → szavak)', () => {
  // ma horgony, egyetlen további szótag: a feltöltés betű, majd szó. β = 1, s = 1 mellett a feltöltésből
  // a ma-kezdetű szavak jönnek, a többi súlya 0.
  const pool = createPool(['ma', 'lo', 'ma-ma', 'ma-ci', 'ro-fe', 'ti-nu'], ccWith(1));
  for (let seed = 1; seed <= 50; seed++) {
    const g = gridFrom(pool, 0, 4, 1, seeded(seed)).map((i) => pool.entries[i].key);
    assert.deepEqual(new Set(g), new Set(['ma', 'lo', 'mama', 'maci']), g.join(' · '));
  }
});

test('a szabálytesztek β = 0.5 mellett is teljesülnek (forrás, N különböző, típus)', () => {
  const pool = createPool(LIST, ccWith(0.5)), rng = seeded(17);
  const same = (a) => (a.type === 'szó' ? (e) => e.type === 'szó' && e.syl === a.syl : (e) => e.type === a.type);
  for (const lv of pool.cc.levels) for (const n of [4, 6, 8]) for (let k = 0; k < 40; k++) {
    const g = buildGrid(pool, n, lv, rng);
    assert.equal(new Set(g.items.map(normalize)).size, n);
    for (const t of g.items) assert.ok(LIST.includes(t), t);
    const a = pool.entries.find((e) => e.key === g.anchor);
    if (pool.entries.filter(same(a)).length >= n) {
      for (const t of g.items) assert.ok(same(a)(pool.entries.find((e) => e.key === normalize(t))), `${g.anchor} mellett ${t}`);
    }
  }
});

/* ---------- statisztikai tesztek (rögzített seed, fixture-lista, N = 8, fixture-listán kalibrált görbe) ---------- */

const N = 8;
/** Kalibrált görbe β-hoz (a deploy-kalibrálással azonos módon, a fixture-listán). */
function calibrated(beta) {
  const cc = ccWith(beta);
  return { ...cc, curve: calibrateCurve(createPool(LIST, cc), N, { seed: 1 }) };
}
const CAL = { 0: calibrated(0), 0.5: calibrated(0.5) };

/** Mutatók fokozatonként. anchors: 'szó' | 'összes'. K: rácsok száma fokozatonként. */
function stats(cc, seed, { anchors = 'összes', K = 1500 } = {}) {
  const pool = createPool(LIST, cc), rng = seeded(seed);
  const all = pool.entries.map((e, i) => i);
  const from = anchors === 'szó' ? all.filter((i) => pool.entries[i].type === 'szó') : all;
  return cc.levels.map((lv) => {
    const s = innerRatio(lv, cc, N);
    let md = 0, cp = 0, depth = 0, shared = 0;
    for (let k = 0; k < K; k++) {
      const g = gridFrom(pool, from[Math.floor(rng() * from.length)], N, s, rng);
      md += meanToAnchor(pool, g); cp += closePairs(pool, g); depth += readingDepth(pool, g);
      // azonos kezdetű kártyák: hány kártyának van a rácsban közös kezdetű társa
      shared += g.filter((x) => g.some((r) => r !== x && pool.pre[x][r] > 0)).length / g.length;
    }
    return { md: md / K, cp: cp / K, depth: depth / K, shared: shared / K };
  });
}
const fmt = (st, k, d = 2) => st.map((x) => x[k].toFixed(d)).join(' · ');

const W0 = stats(CAL[0], 2026, { anchors: 'szó' });
const W5 = stats(CAL[0.5], 2026, { anchors: 'szó' });

test('statisztika: szó horgonynál az olvasási mélység szigorúan monoton nő a fokozattal (β = 0.5)', () => {
  for (let i = 1; i < W5.length; i++) assert.ok(W5[i].depth > W5[i - 1].depth, `mélység: ${fmt(W5, 'depth', 3)}`);
});

test('statisztika: a legnehezebb fokozaton a szavak mélysége ≥ 10 százalékponttal nagyobb, mint β = 0 mellett', () => {
  const d0 = W0.at(-1).depth, d5 = W5.at(-1).depth;
  assert.ok(d5 - d0 >= 0.10, `β = 0: ${d0.toFixed(3)}, β = 0.5: ${d5.toFixed(3)}`);
});

test('statisztika: nehéz fokozaton több az azonos kezdetű kártya, a 0-s fokozaton változatlan', () => {
  assert.equal(W5[0].shared, W0[0].shared, 'a 0-s fokozat β-tól független');
  assert.ok(W5.at(-1).shared > W0.at(-1).shared + 0.1, `β = 0: ${fmt(W0, 'shared')}; β = 0.5: ${fmt(W5, 'shared')}`);
  for (let i = 1; i < W5.length; i++) assert.ok(W5[i].shared > W5[i - 1].shared, `β = 0.5: ${fmt(W5, 'shared')}`);
});

test('statisztika: a meglévő elfogadási feltételek β = 0.5 mellett is teljesülnek', () => {
  const st = stats(CAL[0.5], 2026);
  for (let i = 1; i < st.length; i++) {
    assert.ok(st[i].md < st[i - 1].md, `távolság csökken: ${fmt(st, 'md')}`);
    assert.ok(st[i].cp > st[i - 1].cp, `közeli párok nőnek: ${fmt(st, 'cp')}`);
  }
  assert.ok(st[0].cp <= 0.1, `0-s fokozat: ${st[0].cp}`);
  // lépcsők: a kalibrálásból kihagyott (más seedű) horgonyokon
  const ctl = stats(CAL[0.5], 77, { K: 2000 });
  const steps = ctl.slice(1).map((x, i) => ctl[i].md - x.md);
  const mean = steps.reduce((a, b) => a + b) / steps.length;
  for (const s of steps) assert.ok(Math.abs(s - mean) <= 0.05, `lépcsők: ${steps.map((x) => x.toFixed(3))}`);
});

test('kalibrálás: a görbe a β-hoz igazodik, és érvényes marad', () => {
  for (const b of [0, 0.5]) {
    const c = CAL[b].curve;
    assert.equal(c[0], 0); assert.equal(c.at(-1), 1);
    for (let i = 1; i < c.length; i++) assert.ok(c[i] >= c[i - 1]);
  }
  // a kalibrálás a parok.json β-jával épít rácsokat: más β → más mérés
  assert.notDeepEqual(CAL[0].curve, CAL[0.5].curve);
});
