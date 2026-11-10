// Keresd meg! – rácsösszeállító heurisztika (docs/keresd-meg-heurisztika.md). Tiszta modul:
// nincs DOM, nincs hálózat; a véletlenforrás (`rng`) paraméter, így seedelve determinisztikus.
//
// Fogalmak: tétel (lista egy cellája), betű (a többjegyű egynek számít), típus (betű | szótag | szó),
// horgony (a rács első, egyenletes véletlennel húzott tétele), távolság (súlyozott Levenshtein a
// betűsorozatokon), fokozat (0–1), belső arány (a fokozat a kiegyenlítő görbén át), közös kezdet és
// kezdet súlya (docs/keresd-meg-azonos-kezdet.md).

const VOWELS = new Set([...'aáeéiíoóöőuúüű']);
const DIGRAPHS = ['cs', 'dz', 'gy', 'ly', 'ny', 'sz', 'ty', 'zs'];

/* ---------- tétel, betű, típus ---------- */

/** Normalizált kulcs: NFC, kisbetű, kötőjel nélkül. Az ismétlődést ez szűri. */
export const normalize = (s) => String(s).normalize('NFC').toLocaleLowerCase('hu').replace(/-/g, '').trim();

/** Mohó leghosszabb egyezés: dzs, majd a kétjegyűek, végül az egyes karakterek. */
export function tokenize(s) {
  const t = normalize(s), out = [];
  for (let i = 0; i < t.length;) {
    if (t.startsWith('dzs', i)) { out.push('dzs'); i += 3; continue; }
    const two = t.slice(i, i + 2);
    if (DIGRAPHS.includes(two)) { out.push(two); i += 2; continue; }
    const ch = String.fromCodePoint(t.codePointAt(i));
    out.push(ch); i += ch.length;
  }
  return out;
}

export const isVowel = (letter) => VOWELS.has(letter);

/** betű = 1 betű; szó = legalább 2 magánhangzó; szótag = minden más (1 magánhangzó, több betű). */
export function typeOf(s) {
  const t = tokenize(s);
  if (t.length === 1) return 'betű';
  return t.filter(isVowel).length >= 2 ? 'szó' : 'szótag';
}

/** Szótagszám: a magánhangzók száma (magyarban szótagonként egy). */
export const syllableCount = (s) => tokenize(s).filter(isVowel).length;

/* ---------- konfiguráció ---------- */

const REQUIRED_COSTS = ['egyeb_maganhangzo', 'egyeb_massalhangzo', 'magan_massal_csere', 'beszuras_torles'];
const DEPRECATED = ['nehez_elesseg', 'nehez_disztraktor_esely', 'konnyu_min_tav_betunkent', 'konnyu_min_tav_also_hatar'];
const KNOWN_LETTERS = new Set([...'abcdefghijklmnopqrstuvwxyzáéíóöőúüű', 'dzs', ...DIGRAPHS]);
const isNum = (x) => typeof x === 'number' && Number.isFinite(x);

/** Egy görbe érvényes-e: annyi elem, ahány fokozat; 0-val kezd, 1-gyel zár, monoton nő. */
function curveProblem(c, n, where) {
  if (!Array.isArray(c) || c.length !== n) return `${where}: ${n} elemű lista kell`;
  if (!c.every(isNum)) return `${where}: csak számok lehetnek`;
  if (c[0] !== 0 || c[n - 1] !== 1) return `${where}: 0-val kell kezdődnie és 1-gyel végződnie`;
  for (let i = 1; i < n; i++) if (c[i] < c[i - 1]) return `${where}: monoton nőnie kell`;
  return '';
}

/**
 * A parok.json ellenőrzése. Üres tömb: érvényes. A hibás konfigurációval a deploy megáll,
 * az app pedig nem kínálja a Keresd meg! játékot.
 * @returns {string[]} a hibák emberi nyelven
 */
export function validateConfig(cfg) {
  const p = [];
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return ['a konfiguráció nem objektum'];
  for (const k of REQUIRED_COSTS) if (!isNum(cfg[k]) || cfg[k] <= 0) p.push(`${k}: pozitív szám kell`);
  if (!Array.isArray(cfg.kategoriak)) p.push('kategoriak: lista kell');
  else cfg.kategoriak.forEach((k, i) => {
    const at = `kategoriak[${i}]`;
    if (!k || typeof k !== 'object') { p.push(`${at}: objektum kell`); return; }
    if (typeof k.nev !== 'string' || !k.nev) p.push(`${at}.nev: hiányzik`);
    if (!isNum(k.koltseg) || k.koltseg <= 0) p.push(`${at}.koltseg: pozitív szám kell`);
    if (!Array.isArray(k.csoportok)) { p.push(`${at}.csoportok: lista kell`); return; }
    for (const g of k.csoportok) {
      const m = typeof g === 'string' ? g.split('-') : [];
      if (m.length < 2 || m.some((x) => !KNOWN_LETTERS.has(x)) || new Set(m).size !== m.length) {
        p.push(`${at}: hibás csoport: ${JSON.stringify(g)}`);
      }
    }
  });
  const r = cfg.racs;
  if (!r || typeof r !== 'object') { p.push('racs: hiányzik'); return p; }
  const lv = r.csuszka_szintek;
  if (!Array.isArray(lv) || lv.length < 2 || !lv.every(isNum) || lv[0] !== 0 || lv.at(-1) !== 1
    || lv.some((x, i) => i && x <= lv[i - 1])) {
    p.push('racs.csuszka_szintek: 0-tól 1-ig szigorúan növő számok kellenek');
  } else {
    if (!lv.includes(r.csuszka_alapertelmezett)) p.push('racs.csuszka_alapertelmezett: a csuszka_szintek egyike kell');
    const c = r.csuszka_gorbe;
    if (Array.isArray(c)) {
      const e = curveProblem(c, lv.length, 'racs.csuszka_gorbe'); if (e) p.push(e);
    } else if (c && typeof c === 'object') {
      const keys = Object.keys(c);
      if (!keys.length) p.push('racs.csuszka_gorbe: üres');
      for (const n of keys) {
        if (!/^[1-9]\d*$/.test(n)) p.push(`racs.csuszka_gorbe: a kulcs kártyaszám kell („${n}”)`);
        const e = curveProblem(c[n], lv.length, `racs.csuszka_gorbe.${n}`); if (e) p.push(e);
      }
    } else p.push('racs.csuszka_gorbe: lista vagy kártyaszámonkénti objektum kell');
  }
  if (!isNum(r.csuszka_elesites) || r.csuszka_elesites <= 0) p.push('racs.csuszka_elesites: pozitív szám kell');
  // opcionális: hiányzó kulcs = 0 (a kezdet nem számít)
  if ('kezdet_suly' in r && !(isNum(r.kezdet_suly) && r.kezdet_suly >= 0 && r.kezdet_suly <= 1)) {
    p.push('racs.kezdet_suly: 0 és 1 közötti szám kell');
  }
  for (const k of DEPRECATED) if (k in r) p.push(`racs.${k}: elavult kulcs, törölni kell`);
  return p;
}

/**
 * A konfiguráció futásra kész alakja: a párok költségtáblája és a rácsparaméterek.
 * Ha egy pár több kategóriában is szerepel, a legkisebb költség érvényes.
 */
export function compileConfig(cfg) {
  const pairs = new Map();
  for (const k of cfg.kategoriak) {
    for (const g of k.csoportok) {
      const m = g.split('-');
      for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) {
        const key = pairKey(m[i], m[j]);
        pairs.set(key, Math.min(pairs.get(key) ?? Infinity, k.koltseg));
      }
    }
  }
  const r = cfg.racs;
  return {
    pairs,
    vowel: cfg.egyeb_maganhangzo, consonant: cfg.egyeb_massalhangzo, mixed: cfg.magan_massal_csere,
    indel: cfg.beszuras_torles,
    levels: r.csuszka_szintek.slice(), defaultLevel: r.csuszka_alapertelmezett,
    sharpen: r.csuszka_elesites, curve: r.csuszka_gorbe,
    prefixWeight: r.kezdet_suly ?? 0,
  };
}

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/* ---------- távolság ---------- */

/** Két betű cseréjének költsége. */
export function subCost(a, b, cc) {
  if (a === b) return 0;
  const p = cc.pairs.get(pairKey(a, b));
  const va = isVowel(a), vb = isVowel(b);
  const base = va && vb ? cc.vowel : !va && !vb ? cc.consonant : cc.mixed;
  return p === undefined ? base : Math.min(p, base);
}

/** Súlyozott Levenshtein két betűsorozat (tokenize) között. */
export function distanceTokens(a, b, cc) {
  const n = a.length, m = b.length;
  let prev = Array.from({ length: m + 1 }, (_, j) => j * cc.indel);
  for (let i = 1; i <= n; i++) {
    const cur = [i * cc.indel];
    for (let j = 1; j <= m; j++) {
      cur[j] = Math.min(prev[j] + cc.indel, cur[j - 1] + cc.indel, prev[j - 1] + subCost(a[i - 1], b[j - 1], cc));
    }
    prev = cur;
  }
  return Math.round(prev[m] * 1e9) / 1e9;   // lebegőpontos zaj nélkül (0.3 + 0.8 = 1.1)
}

export const distance = (x, y, cc) => distanceTokens(tokenize(x), tokenize(y), cc);

/* ---------- közös kezdet ---------- */

/** Két betűsorozat leghosszabb közös előtagja, betűben (csak pontos egyezés; `sz` ≠ `s`). */
export function prefixTokens(a, b) {
  const m = Math.min(a.length, b.length);
  let i = 0;
  while (i < m && a[i] === b[i]) i++;
  return i;
}

/** pre(x, y): két tétel közös kezdete betűben. */
export const prefix = (x, y) => prefixTokens(tokenize(x), tokenize(y));

/** M(x) = max_r pre(x, r) / |x|: a jelölt legnagyobb közös kezdete a rács tagjaival, x hosszához mérve. */
export function prefixScore(x, grid) {
  const t = tokenize(x);
  if (!t.length) return 0;
  return grid.reduce((m, r) => Math.max(m, prefixTokens(t, tokenize(r))), 0) / t.length;
}

/* ---------- fokozat → belső arány ---------- */

/** A kártyaszámhoz tartozó görbe: közös lista, vagy kártyaszámonként; hiányzó kulcsnál a legközelebbi N. */
export function curveFor(cc, n) {
  const c = cc.curve;
  if (Array.isArray(c)) return c;
  const keys = Object.keys(c).map(Number).sort((a, b) => a - b);
  const k = keys.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best), keys[0]);
  return c[String(k)];
}

/** Darabonként lineáris: a fokozat (0–1) a töréspontokon át belső aránnyá (0–1). */
export function innerRatio(level, cc, n) {
  const lv = cc.levels, c = curveFor(cc, n);
  const x = Math.min(1, Math.max(0, +level || 0));
  for (let i = 1; i < lv.length; i++) {
    if (x <= lv[i]) return c[i - 1] + (c[i] - c[i - 1]) * (x - lv[i - 1]) / (lv[i] - lv[i - 1]);
  }
  return 1;
}

/* ---------- készlet és rács ---------- */

/**
 * A kör tételeiből a heurisztika készlete: normalizálva egyedi tételek, az eredeti alakkal
 * (a kártyán az látszik, pl. „ka-pu”), típussal, szótagszámmal és a páronkénti távolságokkal.
 * A távolságtábla egyszer készül, a rácsok gyorsan épülnek belőle.
 * @param {string[]} items
 */
export function createPool(items, cc) {
  const seen = new Set(), entries = [];
  for (const raw of items) {
    const key = normalize(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const tokens = tokenize(raw);
    entries.push({ text: raw, key, tokens, type: typeOf(raw), syl: tokens.filter(isVowel).length });
  }
  const n = entries.length;
  const d = Array.from({ length: n }, () => new Float64Array(n));
  const pre = Array.from({ length: n }, () => new Uint8Array(n));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    d[i][j] = d[j][i] = distanceTokens(entries[i].tokens, entries[j].tokens, cc);
    pre[i][j] = pre[j][i] = Math.min(255, prefixTokens(entries[i].tokens, entries[j].tokens));
  }
  return { entries, d, pre, cc };
}

// a feltöltés sorrendje (szabály 2.)
const FILL = { 'betű': ['szótag', 'szó'], 'szótag': ['betű', 'szó'], 'szó': ['szótag', 'betű'] };

/**
 * A horgonyhoz a készletek, sorrendben: előbb az azonos típusúak (szónál az azonos szótagszámúak),
 * aztán a feltöltés. Szónál az eltérő szótagszámú szavak a többi típus előtt jönnek.
 */
function tiers(pool, a) {
  const A = pool.entries[a];
  const idx = (f) => pool.entries.map((e, i) => i).filter((i) => i !== a && f(pool.entries[i]));
  const out = [];
  if (A.type === 'szó') {
    out.push(idx((e) => e.type === 'szó' && e.syl === A.syl));
    out.push(idx((e) => e.type === 'szó' && e.syl !== A.syl));
  } else out.push(idx((e) => e.type === A.type));
  for (const t of FILL[A.type]) out.push(idx((e) => e.type === t));
  return out;
}

/** Egy súlyozott húzás; ha minden súly 0, egyenletes. */
function pickWeighted(cands, weights, rng) {
  let sum = 0;
  for (const w of weights) sum += w;
  if (!(sum > 0)) return Math.floor(rng() * cands.length);
  let r = rng() * sum;
  for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return cands.length - 1;
}

function shuffle(a, rng) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Egy rács a horgony indexével (a készletben). Belső használatra és a kalibráláshoz:
 * a sorrend a horgonnyal kezdődik, nincs keverve.
 * @param {number} s  belső arány (0 = távoli, 1 = horgonyhoz közeli)
 */
export function gridFrom(pool, a, n, s, rng) {
  const { d, pre, entries } = pool, p = pool.cc.sharpen, b = pool.cc.prefixWeight ?? 0;
  const grid = [a];
  // T(x) = 1 − e^(−min_r d(x,r)) a rács eddigi tagjaitól; K(x) = e^(−d(x,h)) a horgonytól;
  // M(x) = max_r pre(x,r) / |x| a rács minden eddigi tagjától; K'(x) = (1 − β)·K(x) + β·M(x), |x| > 1
  const minD = new Map(), maxPre = new Map();
  for (const tier of tiers(pool, a)) {
    const cands = tier.slice();
    for (const x of cands) {
      minD.set(x, d[x][a]);
      if (b) maxPre.set(x, grid.reduce((m, r) => Math.max(m, pre[x][r]), 0));
    }
    while (grid.length < n && cands.length) {
      const weights = cands.map((x) => {
        const T = 1 - Math.exp(-minD.get(x));
        const K = Math.exp(-d[x][a]);
        // β = 0: pontosan a régi K (a rácsok a mostaniakkal azonosak). Egybetűs jelöltnél nincs
        // értelmezhető közös kezdet: ott is K marad, különben a (1 − β)·K a betűrácsokat könnyítené.
        const len = entries[x].tokens.length;
        const K2 = b && len > 1 ? (1 - b) * K + b * maxPre.get(x) / len : K;
        return Math.pow((1 - s) * T + s * K2, p);
      });
      const k = pickWeighted(cands, weights, rng);
      const x = cands.splice(k, 1)[0];
      grid.push(x);
      for (const y of cands) {
        minD.set(y, Math.min(minD.get(y), d[y][x]));
        if (b) maxPre.set(y, Math.max(maxPre.get(y), pre[y][x]));
      }
    }
    if (grid.length >= n) break;
  }
  return grid;
}

/**
 * Egy rács (feladat) a heurisztika szerint.
 * @param {object} pool  createPool eredménye
 * @param {number} n     kártyaszám
 * @param {number} level fokozat 0–1
 * @param {() => number} rng
 * @param {{ avoid?: string }} [o]  avoid: a horgony ne legyen ez a kulcs (az előző feladat horgonya)
 * @returns {{ anchor: string, items: string[] }}  items: véletlen sorrendben, az eredeti alakkal
 */
export function buildGrid(pool, n, level, rng, o = {}) {
  const L = pool.entries.length;
  if (!L) return { anchor: '', items: [] };
  let choices = pool.entries.map((e, i) => i);
  if (o.avoid && L > 1) choices = choices.filter((i) => pool.entries[i].key !== o.avoid);
  const a = choices[Math.floor(rng() * choices.length)];
  const s = innerRatio(level, pool.cc, n);
  const grid = shuffle(gridFrom(pool, a, Math.min(n, L), s, rng), rng);
  return { anchor: pool.entries[a].key, items: grid.map((i) => pool.entries[i].text) };
}

/* ---------- kalibrálás (deploy) ---------- */

/** Determinisztikus véletlenforrás (mulberry32) a kalibráláshoz és a tesztekhez. */
export function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** A mutató egy rácson: a tételek átlagos távolsága a horgonytól (kisebb = nehezebb). */
export const meanToAnchor = (pool, grid) =>
  grid.length < 2 ? 0 : grid.slice(1).reduce((t, x) => t + pool.d[x][grid[0]], 0) / (grid.length - 1);

/** Közeli párok száma egy rácsban (bármely két tag, d ≤ 0.5). */
export function closePairs(pool, grid, limit = 0.5) {
  let c = 0;
  for (let i = 0; i < grid.length; i++) for (let j = i + 1; j < grid.length; j++) if (pool.d[grid[i]][grid[j]] <= limit + 1e-9) c++;
  return c;
}

/**
 * Olvasási mélység egy rácson (mérőszám, nem része a súlynak): kártyánként hány betűt kell kiolvasni,
 * mire a rácsban egyedi lesz (felismerési pont: min(|x|, 1 + max_r pre(x, r))), a kártya hosszához
 * mérve; a rácsra a kártyák átlaga. 0–1.
 */
export function readingDepth(pool, grid) {
  if (!grid.length) return 0;
  let sum = 0;
  for (const x of grid) {
    const len = pool.entries[x].tokens.length;
    let m = 0;
    for (const r of grid) if (r !== x) m = Math.max(m, pool.pre[x][r]);
    sum += Math.min(len, m + 1) / len;
  }
  return sum / grid.length;
}

/**
 * A mutató átlaga adott belső arány mellett, rögzített horgonymintán.
 * @param {number[]} anchors  készletindexek (típusarányos minta = egyenletes a teljes listából)
 */
export function measure(pool, n, s, anchors, perAnchor, seed) {
  const rng = seeded(seed);
  let sum = 0, cnt = 0;
  for (const a of anchors) for (let k = 0; k < perAnchor; k++) { sum += meanToAnchor(pool, gridFrom(pool, a, n, s, rng)); cnt++; }
  return cnt ? sum / cnt : 0;
}

/**
 * A kiegyenlítő görbe egy kártyaszámra (heurisztika: Kalibrálás deploy-kor).
 * A belső arány 21 pontján méri a mutatót, a két végpont közti tartományt a fokozatok számának
 * megfelelő egyenlő lépcsőre osztja, és lineáris interpolációval visszakeresi a töréspontokat.
 * @param {{ anchors?: number, perAnchor?: number, points?: number, seed?: number }} [o]
 *   anchors: a horgonyminta mérete (alapból a teljes lista), perAnchor: rács horgonyonként (legalább 20)
 * @returns {number[]}  a töréspontok, 0-tól 1-ig, monoton
 */
export function calibrateCurve(pool, n, { anchors = Infinity, perAnchor = 20, points = 21, seed = 1 } = {}) {
  const L = pool.entries.length;
  const levels = pool.cc.levels;
  if (L < 2) return levels.slice();
  // alapból minden tétel egyszer horgony: ez pontosan típusarányos; kisebb mintánál véletlen horgonyok
  const rng = seeded(seed ^ 0x9e3779b9);
  const sample = anchors >= L ? pool.entries.map((e, i) => i)
    : Array.from({ length: anchors }, () => Math.floor(rng() * L));
  const xs = Array.from({ length: points }, (_, i) => i / (points - 1));
  // ugyanaz a seed minden ponton: a pontok közti különbség az arányból jön, nem a mintavételből
  let ys = xs.map((x) => measure(pool, n, x, sample, perAnchor, seed));
  // a mutató csökken az aránnyal; a mintavételi zajt monoton burkolóval simítjuk
  for (let i = 1; i < ys.length; i++) ys[i] = Math.min(ys[i], ys[i - 1]);
  const top = ys[0], bottom = ys.at(-1);
  if (!(top - bottom > 1e-9)) return levels.slice();
  const out = levels.map((lv, i) => {
    if (i === 0) return 0;
    if (i === levels.length - 1) return 1;
    const target = top - (top - bottom) * lv;
    for (let k = 1; k < xs.length; k++) {
      if (ys[k] <= target) {
        const span = ys[k - 1] - ys[k];
        const f = span > 1e-12 ? (ys[k - 1] - target) / span : 0;
        return Math.round((xs[k - 1] + f * (xs[k] - xs[k - 1])) * 1000) / 1000;
      }
    }
    return 1;
  });
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i], out[i - 1]);
  return out;
}
