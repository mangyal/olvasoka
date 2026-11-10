// Keresd meg! rácsösszeállító heurisztika (docs/keresd-meg-heurisztika.md).
// Rögzített fixture-rel fut (test/fixtures/parok.json: a prototípus konfigurációja; lista.txt: a lista
// pillanatképe), nem az éles parok.json-nal, így a párok hangolása nem töri el a teszteket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalize, tokenize, typeOf, syllableCount, validateConfig, compileConfig, distance, innerRatio, curveFor,
  createPool, buildGrid, gridFrom, seeded, meanToAnchor, closePairs, calibrateCurve,
} from '../js/core/grid.js';
import { parseListsText } from '../js/core/lists.js';

const fx = (f) => new URL(`./fixtures/${f}`, import.meta.url);
const RAW = JSON.parse(readFileSync(fx('parok.json'), 'utf8'));
const CC = compileConfig(RAW);
const LIST = [...new Set(parseListsText(readFileSync(fx('lista.txt'), 'utf8')).lists.flatMap((l) => l.items))];

/* ---------- determinisztikus tesztvektorok ---------- */

test('tokenize: többjegyű betűk, kötőjel és nagybetű nélkül', () => {
  assert.deepEqual(tokenize('szép'), ['sz', 'é', 'p']);
  assert.deepEqual(tokenize('dzsungel'), ['dzs', 'u', 'n', 'g', 'e', 'l']);
  assert.deepEqual(tokenize('Ka-Pa'), ['k', 'a', 'p', 'a']);
  assert.deepEqual(tokenize('gyöngy'), ['gy', 'ö', 'n', 'gy']);
  assert.equal(normalize(' Ka-Pa '), 'kapa');
});

test('típus: betű · szótag · szó; szótagszám a magánhangzókból', () => {
  assert.equal(typeOf('sz'), 'betű');
  assert.equal(typeOf('al'), 'szótag');
  assert.equal(typeOf('ka-pa'), 'szó');
  assert.equal(typeOf('Á'), 'betű');
  assert.equal(syllableCount('ka-pu-ka'), 3);
});

test('távolság: a heurisztika tesztvektorai', () => {
  const d = (a, b) => distance(a, b, CC);
  assert.equal(d('pá', 'pa'), 0.3);
  for (const [a, b] of [['pá', 'bá'], ['fa', 'va'], ['b', 'd'], ['i', 'l']]) assert.equal(d(a, b), 0.5, `${a}–${b}`);
  assert.equal(d('ka-pa', 'ka-pu'), 0.8);
  assert.equal(d('ka-pa', 'pa-pa'), 0.8);
  assert.equal(d('pá', 'ta'), 1.1);
  assert.equal(d('ma', 'al'), 2.0);
  assert.equal(d('ma', 'ma'), 0);
  assert.equal(d('dzs', 'cs'), 0.5, 'többjegyű pár');
});

test('több kategória: a legkisebb költség érvényes (a–á: vizuális 0.5, hosszú/rövid 0.3)', () => {
  assert.equal(distance('a', 'á', CC), 0.3);
});

/* ---------- fokozat és görbe ---------- */

test('belső arány: töréspontok a fokozatoknál, köztük lineáris', () => {
  assert.equal(innerRatio(0, CC, 8), 0);
  assert.equal(innerRatio(0.25, CC, 8), 0.45);
  assert.equal(innerRatio(1, CC, 8), 1);
  assert.ok(Math.abs(innerRatio(0.125, CC, 8) - 0.225) < 1e-9);
});

test('görbe kártyaszámonként; hiányzó kulcsnál a legközelebbi', () => {
  const cc = { ...CC, curve: { 4: [0, 0.5, 0.6, 0.7, 1], 8: [0, 0.4, 0.6, 0.75, 1] } };
  assert.equal(innerRatio(0.25, cc, 4), 0.5);
  assert.equal(innerRatio(0.25, cc, 8), 0.4);
  assert.deepEqual(curveFor(cc, 7), cc.curve[8]);
});

/* ---------- konfiguráció ---------- */

test('konfiguráció: a repó parok.json-ja érvényes, elavult kulcs nélkül', () => {
  const live = JSON.parse(readFileSync(new URL('../parok.json', import.meta.url), 'utf8'));
  assert.deepEqual(validateConfig(live), []);
});

test('konfiguráció: hibás görbe, csoport, hiányzó kulcs és elavult kulcs jelez', () => {
  assert.ok(validateConfig(RAW).some((p) => /elavult/.test(p)), 'a prototípus elavult kulcsai');
  const ok = structuredClone(RAW);
  for (const k of ['nehez_elesseg', 'nehez_disztraktor_esely', 'konnyu_min_tav_betunkent', 'konnyu_min_tav_also_hatar']) delete ok.racs[k];
  assert.deepEqual(validateConfig(ok), []);
  const bad = (f) => { const c = structuredClone(ok); f(c); return validateConfig(c); };
  assert.ok(bad((c) => { c.racs.csuszka_gorbe = [0, 0.6, 0.5, 0.7, 1]; }).length, 'nem monoton');
  assert.ok(bad((c) => { c.racs.csuszka_gorbe = [0, 0.5, 1]; }).length, 'rossz hossz');
  assert.ok(bad((c) => { c.racs.csuszka_gorbe = { 8: [0.1, 0.5, 0.6, 0.7, 1] }; }).length, 'nem 0-val kezd');
  assert.ok(bad((c) => { c.kategoriak[0].csoportok.push('b'); }).length, 'egytagú csoport');
  assert.ok(bad((c) => { c.kategoriak[0].csoportok.push('b-x1'); }).length, 'ismeretlen betű');
  assert.ok(bad((c) => { delete c.beszuras_torles; }).length, 'hiányzó költség');
  assert.ok(bad((c) => { c.racs.csuszka_alapertelmezett = 0.3; }).length, 'alapérték nem fokozat');
  assert.deepEqual(bad((c) => { c.racs.csuszka_gorbe = { 4: [0, 0.5, 0.6, 0.7, 1], 8: [0, 0.4, 0.6, 0.75, 1] }; }), []);
  assert.ok(validateConfig(null).length);
});

/* ---------- szabálytesztek ---------- */

const POOL = createPool(LIST, CC);
const keys = new Set(POOL.entries.map((e) => e.key));

test('rács: minden tétel a forrásból, N különböző, az eredeti alakkal', () => {
  const rng = seeded(7);
  for (const lv of CC.levels) for (const n of [4, 6, 8]) for (let k = 0; k < 50; k++) {
    const g = buildGrid(POOL, n, lv, rng);
    assert.equal(g.items.length, n);
    assert.equal(new Set(g.items.map(normalize)).size, n, 'különböző tételek');
    for (const t of g.items) assert.ok(LIST.includes(t), `forrásból: ${t}`);
    assert.ok(g.items.map(normalize).includes(g.anchor), 'a horgony a rácsban');
  }
});

test('rács: azonos típusú készlet elég → nincs idegen típus; szónál a szótagszám is egyezik', () => {
  const rng = seeded(11);
  const count = (f) => POOL.entries.filter(f).length;
  for (let k = 0; k < 300; k++) {
    const g = buildGrid(POOL, 4, k % 5 / 4, rng);
    const a = POOL.entries.find((e) => e.key === g.anchor);
    const same = a.type === 'szó' ? (e) => e.type === 'szó' && e.syl === a.syl : (e) => e.type === a.type;
    if (count(same) < 4) continue;
    for (const t of g.items) {
      const e = POOL.entries.find((x) => x.key === normalize(t));
      assert.ok(same(e), `${g.anchor} mellett ${t}`);
    }
  }
});

test('rács: kis készlet (3 szótag, 6 betű), N = 4, szótag horgony → 3 szótag + 1 betű', () => {
  const pool = createPool(['ma', 'me', 'mi', 'a', 'e', 'i', 'o', 'u', 'm'], CC);
  const rng = seeded(3);
  let seen = 0;
  for (let k = 0; k < 200; k++) {
    const g = buildGrid(pool, 4, k % 5 / 4, rng);
    if (typeOf(g.anchor) !== 'szótag') continue;
    seen++;
    const types = g.items.map(typeOf);
    assert.equal(types.filter((t) => t === 'szótag').length, 3);
    assert.equal(types.filter((t) => t === 'betű').length, 1);
  }
  assert.ok(seen > 20);
});

test('rács: N-nél kevesebb egyedi tétel → mind (F-K3); ismétlődés egyszer számít', () => {
  const pool = createPool(['ma', 'Ma', 'm-a', 'me', 'mi'], CC);
  const g = buildGrid(pool, 6, 0, seeded(1));
  assert.equal(g.items.length, 3);
  assert.deepEqual(new Set(g.items.map(normalize)), new Set(['ma', 'me', 'mi']));
});

test('rács: a sorrend fokozattól függetlenül véletlen (a horgony bárhol lehet)', () => {
  for (const lv of [0, 1]) {
    const rng = seeded(5), pos = new Array(6).fill(0);
    for (let k = 0; k < 1200; k++) {
      const g = buildGrid(POOL, 6, lv, rng);
      pos[g.items.map(normalize).indexOf(g.anchor)]++;
    }
    for (const c of pos) assert.ok(c > 120 && c < 280, `horgony helye: ${pos}`);
  }
});

test('rács: az avoid kulcs nem lehet horgony (két egymást követő feladat)', () => {
  const rng = seeded(9);
  for (let k = 0; k < 200; k++) assert.notEqual(buildGrid(POOL, 4, 0.5, rng, { avoid: 'ma' }).anchor, 'ma');
  const two = createPool(['ma', 'me'], CC);
  for (let k = 0; k < 50; k++) assert.equal(buildGrid(two, 4, 0, rng, { avoid: 'ma' }).anchor, 'me');
});

test('rács: seedelt rng-vel determinisztikus', () => {
  const a = buildGrid(POOL, 8, 0.5, seeded(123)), b = buildGrid(POOL, 8, 0.5, seeded(123));
  assert.deepEqual(a, b);
});

/* ---------- statisztikai tesztek (rögzített seed, fixture-lista, N = 8) ---------- */

function stats(cc, seed, K = 1500) {
  const pool = createPool(LIST, cc), rng = seeded(seed), L = pool.entries.length;
  return cc.levels.map((lv) => {
    const s = innerRatio(lv, cc, 8);
    let md = 0, cp = 0;
    for (let k = 0; k < K; k++) {
      const g = gridFrom(pool, Math.floor(rng() * L), 8, s, rng);
      md += meanToAnchor(pool, g); cp += closePairs(pool, g);
    }
    return { md: md / K, cp: cp / K };
  });
}

test('statisztika: mindkét mutató szigorúan monoton; a 0-s fokozaton ≤ 0.1 közeli pár', () => {
  const st = stats(CC, 2026);
  for (let i = 1; i < st.length; i++) {
    assert.ok(st[i].md < st[i - 1].md, `távolság csökken: ${st.map((x) => x.md.toFixed(2))}`);
    assert.ok(st[i].cp > st[i - 1].cp, `közeli párok nőnek: ${st.map((x) => x.cp.toFixed(2))}`);
  }
  assert.ok(st[0].cp <= 0.1, `0-s fokozat: ${st[0].cp}`);
});

test('kalibrálás: a görbe monoton, és ellenőrző horgonyokon a lépcsők ±0.05-on belül egyenletesek', () => {
  const pool = createPool(LIST, CC);
  const curve = calibrateCurve(pool, 8, { seed: 1 });
  assert.equal(curve[0], 0); assert.equal(curve.at(-1), 1);
  for (let i = 1; i < curve.length; i++) assert.ok(curve[i] >= curve[i - 1]);
  const st = stats({ ...CC, curve }, 77, 2000);   // más seed: a kalibrálásból kihagyott horgonyok
  const steps = st.slice(1).map((x, i) => st[i].md - x.md);
  const mean = steps.reduce((a, b) => a + b) / steps.length;
  for (const s of steps) assert.ok(Math.abs(s - mean) <= 0.05, `lépcsők: ${steps.map((x) => x.toFixed(3))}`);
});
