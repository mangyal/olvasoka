// A Haladás nézet küszöbei (docs/haladas-specifikacio.md, 7.1): a repó gyökerében lévő haladas.json
// ellenőrzése és futásra kész alakja. Tiszta modul.
//
// A fájl a parok.json mintáját követi: szakaszok, `_leiras` magyarázó mezőkkel. Ismeretlen vagy hiányzó
// kulcs, rossz típus, értelmetlen érték: a validate hibalistát ad, a kiadás megáll
// (.github/scripts/check-haladas.mjs). A futó program ilyenkor a beépített alapértékekkel dolgozik.

/** Értékfajták: mi számít értelmes értéknek. */
const KINDS = {
  ms: { ok: (v) => Number.isInteger(v) && v > 0, msg: 'pozitív egész (ms) kell' },
  count: { ok: (v) => Number.isInteger(v) && v >= 1, msg: 'legalább 1 egész kell' },
  days: { ok: (v) => Number.isInteger(v) && v >= 0, msg: 'nemnegatív egész (nap) kell' },
  window: { ok: (v) => Number.isInteger(v) && v >= 1, msg: 'legalább 1 egész (nap) kell' },
  ratio: { ok: (v) => typeof v === 'number' && v >= 0 && v <= 1, msg: '0 és 1 közötti szám kell' },
  factor: { ok: (v) => typeof v === 'number' && Number.isFinite(v) && v > 0, msg: 'pozitív szám kell' },
};

/** A fájl szerkezete: szakasz → kulcs → [fajta, alapérték]. */
const SCHEMA = {
  szures: {
    javitott_melle_ms: ['ms', 2000],
    takaras_szandek_ms: ['ms', 3000],
    veletlen_atugras_ms: ['ms', 400],
    takaras_ugyetlenseg_ms: ['ms', 1000],
    max_olvasasi_ido_ms: ['ms', 30000],
  },
  allapot: {
    kiindulas_n: ['count', 3],
    uj_min_nap: ['days', 3],
    megy_utolso_segitseg_nelkul: ['count', 3],
    megy_relativ_ido_max: ['factor', 0.8],
    megy_tipus_median_szorzo: ['factor', 0.8],
    megy_gyors_villantas_ms: ['ms', 5000],
    megy_gyors_villantas_db: ['count', 2],
    javul_relativ_ido_max: ['factor', 0.9],
    gyakorol_min_nap: ['days', 5],
    gyakorol_min_eltelt_nap: ['days', 14],
    gyakorol_utolso_n: ['count', 5],
    gyakorol_segitseg_arany: ['ratio', 0.5],
    gyakorol_relativ_ido_min: ['factor', 0.9],
  },
  betu: {
    ablak_nap: ['window', 30],
    min_tetel: ['count', 3],
    kiemeles_szorzo: ['factor', 2],
    kartya_megjegyzes_arany: ['ratio', 0.5],
    kapcsolodo_max: ['count', 5],
  },
  tarolas: {
    nyers_megorzes_nap: ['window', 30],
    nyers_megorzes_kor: ['count', 30],
    ures_allapot_min_nap: ['days', 3],
  },
};

/** A napszabály-kapcsoló (10.) ezeket nullázza; a többi feltétel változatlan. */
export const DAY_RULES = Object.freeze([
  ['allapot', 'uj_min_nap'], ['allapot', 'gyakorol_min_nap'], ['allapot', 'gyakorol_min_eltelt_nap'],
  ['tarolas', 'ures_allapot_min_nap'],
]);

const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const deepFreeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, isObj(v) ? deepFreeze(v) : v])));

/** A beépített alapértékek (a 7.1 táblázata). */
export const DEFAULTS = deepFreeze(Object.fromEntries(Object.entries(SCHEMA).map(([sec, keys]) =>
  [sec, Object.fromEntries(Object.entries(keys).map(([k, [, d]]) => [k, d]))])));

/**
 * A haladas.json ellenőrzése. Üres tömb: érvényes.
 * @returns {string[]} a hibák emberi nyelven, `szakasz.kulcs: …` alakban
 */
export function validate(cfg) {
  if (!isObj(cfg)) return ['a konfiguráció nem objektum'];
  const p = [];
  for (const k of Object.keys(cfg)) {
    if (k === '_leiras') { if (typeof cfg[k] !== 'string') p.push('_leiras: szöveg kell'); continue; }
    if (!(k in SCHEMA)) p.push(`${k}: ismeretlen szakasz`);
  }
  for (const [sec, keys] of Object.entries(SCHEMA)) {
    const s = cfg[sec];
    if (!isObj(s)) { p.push(`${sec}: hiányzik vagy nem objektum`); continue; }
    for (const k of Object.keys(s)) {
      if (k === '_leiras') { if (typeof s[k] !== 'string') p.push(`${sec}._leiras: szöveg kell`); continue; }
      if (!(k in keys)) p.push(`${sec}.${k}: ismeretlen kulcs`);
    }
    for (const [k, [kind]] of Object.entries(keys)) {
      if (!(k in s)) { p.push(`${sec}.${k}: hiányzik`); continue; }
      if (!KINDS[kind].ok(s[k])) p.push(`${sec}.${k}: ${KINDS[kind].msg}, most: ${JSON.stringify(s[k])}`);
    }
  }
  if (!p.length) {
    const f = cfg.szures;
    if (f.veletlen_atugras_ms >= f.javitott_melle_ms) p.push('szures.veletlen_atugras_ms: kisebb kell legyen, mint a javitott_melle_ms');
    if (f.javitott_melle_ms >= f.max_olvasasi_ido_ms) p.push('szures.javitott_melle_ms: kisebb kell legyen, mint a max_olvasasi_ido_ms');
  }
  return p;
}

/**
 * Futásra kész konfiguráció: a `_leiras` mezők nélkül, fagyasztva. Érvénytelen vagy hiányzó bemenetnél az
 * alapértékek. `skipDayRules`: a napszámon alapuló küszöbök nullák (10.).
 */
export function resolve(cfg, { skipDayRules = false } = {}) {
  const base = cfg && !validate(cfg).length ? cfg : DEFAULTS;
  const out = Object.fromEntries(Object.keys(SCHEMA).map((sec) =>
    [sec, Object.fromEntries(Object.keys(SCHEMA[sec]).map((k) => [k, base[sec][k]]))]));
  if (skipDayRules) for (const [sec, k] of DAY_RULES) out[sec][k] = 0;
  return deepFreeze(out);
}
