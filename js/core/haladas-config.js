// A Haladás nézet küszöbei (docs/haladas-specifikacio.md, 7.8): a repó gyökerében lévő haladas.json
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
    gyors_villantas_ms: ['ms', 5000],
  },
  allapot: {
    min_nap: ['days', 3],
    megy_utolso_n: ['count', 3],
    megy_ido_szorzo: ['factor', 1.5],
    gyakorol_utolso_n: ['count', 5],
    gyakorol_segitseg_db: ['count', 3],
    gyakorol_ido_szorzo: ['factor', 2],
    friss_meres_db: ['count', 3],
    tempo_ablak_nap: ['window', 30],
    tempo_min_meres: ['count', 10],
  },
  tarolas: {
    nyers_megorzes_nap: ['window', 30],
    nyers_megorzes_kor: ['count', 30],
  },
};

/** A napszabály-kapcsoló (10.) ezt nullázza; a többi feltétel (a tempó ablaka is) változatlan. */
export const DAY_RULES = Object.freeze([['allapot', 'min_nap']]);

const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const deepFreeze = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, isObj(v) ? deepFreeze(v) : v])));

/** A beépített alapértékek (a 7.8 táblázata). */
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
    // a „Megy” és a „Még gyakorolni kell” nem fedheti át egymást (7.8)
    const a = cfg.allapot;
    if (a.megy_ido_szorzo >= a.gyakorol_ido_szorzo) p.push('allapot.megy_ido_szorzo: kisebb kell legyen, mint a gyakorol_ido_szorzo');
    if (a.gyakorol_segitseg_db > a.gyakorol_utolso_n) p.push('allapot.gyakorol_segitseg_db: legfeljebb a gyakorol_utolso_n lehet');
    else if (a.gyakorol_segitseg_db <= a.gyakorol_utolso_n - a.megy_utolso_n) {
      p.push('allapot.gyakorol_segitseg_db: nagyobb kell legyen, mint gyakorol_utolso_n − megy_utolso_n (különben egy tétel egyszerre „Megy” és „Még gyakorolni kell”)');
    }
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
