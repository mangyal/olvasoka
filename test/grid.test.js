// Keresd meg! rácsösszeállító heurisztika (docs/keresd-meg-heurisztika.md).
// Rögzített fixture-rel fut (test/fixtures/parok.json: a prototípus konfigurációja; lista.txt: a lista
// pillanatképe), nem az éles parok.json-nal, így a párok hangolása nem töri el a teszteket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalize, tokenize, typeOf, syllableCount, validateConfig, compileConfig, distance, innerRatio, curveFor,
  createPool, buildGrid, gridFrom, seeded, meanToAnchor, closePairs, calibrateCurve, anchorChoices,
} from '../js/core/grid.js';
import { groupOf } from '../js/core/groups.js';
import { itemKey } from '../js/core/items.js';
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
const entryOf = (pool, t) => pool.entries.find((e) => e.key === itemKey(t));

test('készlet: különböző tételek itemKey szerint (Ma ≠ ma ≠ m-a), súly = sorok száma, csoport (K-1, K-4)', () => {
  const pool = createPool(['ma', 'Ma', 'm-a', 'ma', 'me', 'ma'], CC);
  assert.deepEqual(pool.entries.map((e) => [e.text, e.weight, e.group]),
    [['ma', 3, 'CV'], ['Ma', 1, 'CV'], ['m-a', 1, 'CV'], ['me', 1, 'CV']]);
  assert.equal(pool.groupSize.get('CV'), 4);
});

test('rács: minden tétel a forrásból, különböző, az eredeti alakkal; a horgony a rácsban', () => {
  const rng = seeded(7);
  for (const lv of CC.levels) for (const n of [4, 6, 8]) for (let k = 0; k < 50; k++) {
    const g = buildGrid(POOL, n, lv, rng);
    const size = POOL.groupSize.get(entryOf(POOL, g.anchor).group);
    assert.equal(g.items.length, Math.min(n, size));
    assert.equal(new Set(g.items.map(itemKey)).size, g.items.length, 'különböző tételek');
    for (const t of g.items) assert.ok(LIST.includes(t), `forrásból: ${t}`);
    assert.ok(g.items.map(itemKey).includes(g.anchor), 'a horgony a rácsban');
  }
});

test('rács: minden tétel a horgony csoportjából, minden fokozaton és kártyaszámon (K-2)', () => {
  const rng = seeded(11);
  for (const lv of CC.levels) for (const n of [4, 6, 8]) for (let k = 0; k < 100; k++) {
    const g = buildGrid(POOL, n, lv, rng);
    const want = entryOf(POOL, g.anchor).group;
    for (const t of g.items) assert.equal(groupOf(t).key, want, `${g.anchor} mellett ${t}`);
  }
});

test('rács: kis csoport → csak a csoport tételei, legalább 2 kártya; 1 tételes csoport tétele soha (K-3, K-4)', () => {
  // CV: ma, me, mi (3) · V: a, e, i, o, u (5) · C: m (1, soha)
  const pool = createPool(['ma', 'me', 'mi', 'a', 'e', 'i', 'o', 'u', 'm'], CC);
  const rng = seeded(3);
  let cv = 0;
  for (let k = 0; k < 400; k++) {
    const g = buildGrid(pool, 4, k % 5 / 4, rng);
    assert.ok(!g.items.includes('m'), 'az 1 tételes csoport tétele nem jelenik meg');
    if (groupOf(g.anchor).key === 'CV') {
      cv++;
      assert.deepEqual(new Set(g.items), new Set(['ma', 'me', 'mi']));
    } else assert.equal(g.items.length, 4);
  }
  assert.ok(cv > 50);
});

test('rács: csak 1 tételes csoportok → nincs feladat', () => {
  const pool = createPool(['a', 'm', 'ma', 'ok'], CC);
  assert.deepEqual(buildGrid(pool, 4, 0, seeded(1)), { anchor: '', items: [] });
});

test('rács: a horgony a sorok számával súlyozott (K-4)', () => {
  // a: 3 sor, e, i, o: 1-1 sor → az a horgony esélye 3/6
  const pool = createPool(['a', 'a', 'a', 'e', 'i', 'o'], CC);
  const rng = seeded(21), K = 6000;
  let a = 0;
  for (let k = 0; k < K; k++) if (buildGrid(pool, 4, 0, rng).anchor === 'a') a++;
  assert.ok(Math.abs(a / K - 0.5) < 0.03, `a horgony aránya: ${a / K}`);
});

test('rács: a sorrend fokozattól függetlenül véletlen (a horgony bárhol lehet)', () => {
  const pool = createPool(LIST.filter((t) => groupOf(t).key === 'CV'), CC);
  for (const lv of [0, 1]) {
    const rng = seeded(5), pos = new Array(6).fill(0);
    for (let k = 0; k < 1200; k++) {
      const g = buildGrid(pool, 6, lv, rng);
      pos[g.items.map(itemKey).indexOf(g.anchor)]++;
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

/** A horgony a választható tételekből (legalább 2 tételes csoport); `only`: csak ezek a csoportok. */
function stats(cc, seed, K = 1500, only = null) {
  const pool = createPool(LIST, cc), rng = seeded(seed);
  const an = anchorChoices(pool).filter((i) => !only || only(pool.groupSize.get(pool.entries[i].group)));
  return cc.levels.map((lv) => {
    const s = innerRatio(lv, cc, 8);
    let md = 0, cp = 0;
    for (let k = 0; k < K; k++) {
      const g = gridFrom(pool, an[Math.floor(rng() * an.length)], 8, s, rng);
      md += meanToAnchor(pool, g); cp += closePairs(pool, g);
    }
    return { md: md / K, cp: cp / K };
  });
}

test('statisztika: mindkét mutató szigorúan monoton', () => {
  const st = stats(CC, 2026);
  for (let i = 1; i < st.length; i++) {
    assert.ok(st[i].md < st[i - 1].md, `távolság csökken: ${st.map((x) => x.md.toFixed(2))}`);
    assert.ok(st[i].cp > st[i - 1].cp, `közeli párok nőnek: ${st.map((x) => x.cp.toFixed(2))}`);
  }
});

test('statisztika: a 0-s fokozaton ≤ 0.1 közeli pár, ahol a csoport elég nagy (legalább 3 × N tétel)', () => {
  // Kis csoportban (pl. 9 magánhangzó, 8 kártya) a hasonló párok (a–á, o–ó) nem kerülhetők el (2.14, K-2).
  const st = stats(CC, 2026, 1500, (size) => size >= 24);
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

test('kalibrálás: csak 1 tételes csoportok → az alapgörbe (nincs horgony)', () => {
  const pool = createPool(['a', 'm', 'ma', 'ok'], CC);
  assert.deepEqual(calibrateCurve(pool, 4), CC.levels);
});
