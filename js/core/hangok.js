// Betűszínezés (docs/megjelenes-specifikacio.md, SZ-1–SZ-4, NB-6–NB-8). Tiszta modul.
//
// A hangok.json mondja meg, melyik betű magánhangzó, zöngés vagy zöngétlen mássalhangzó. Ha a fájl
// nem tölthető be vagy hibás, a beépített DEFAULT_SOUNDS érvényes (D-5); a teszt ellenőrzi, hogy a kettő
// egyezik. A szegmensek (segments) a megjelenítéshez kellenek: a tétel karakterei hangcsoport és
// nagybetű-jelölés szerint összevont darabokban. Hogy a beállítás (Nincs / Hangok szerint, Nincs /
// Körvonal) mit mutat, azt a CSS dönti el (look-color, look-mark osztály a gyökérelemen).

import { multiAt, MULTI } from './grid.js';

/** A hangok.json kulcsai és a megjelenítés osztálykódjai: v = magánhangzó, d = zöngés, u = zöngétlen. */
export const SOUND_KEYS = Object.freeze({ maganhangzo: 'v', zonges: 'd', zongetlen: 'u' });

/** A beépített besorolás (SZ-2); egyezik a repó hangok.json-jával. */
export const DEFAULT_SOUNDS = Object.freeze({
  maganhangzo: ['a', 'á', 'e', 'é', 'i', 'í', 'o', 'ó', 'ö', 'ő', 'u', 'ú', 'ü', 'ű'],
  zonges: ['b', 'd', 'dz', 'dzs', 'g', 'gy', 'j', 'l', 'ly', 'm', 'n', 'ny', 'r', 'v', 'z', 'zs'],
  zongetlen: ['c', 'cs', 'f', 'h', 'k', 'p', 's', 'sz', 't', 'ty'],
});

/** Egy betű-e: egy kisbetű, vagy a többjegyű betűk egyike. */
const isLetter = (s) => ([...s].length === 1 ? /^\p{Ll}$/u.test(s) : MULTI.includes(s));

/**
 * A hangok.json ellenőrzése. Üres tömb: érvényes. A `_` kezdetű kulcs megjegyzés.
 * @returns {string[]} a hibák emberi nyelven
 */
export function validateSounds(cfg) {
  if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) return ['a konfiguráció nem objektum'];
  const p = [], seen = new Map();
  for (const k of Object.keys(cfg)) if (!k.startsWith('_') && !(k in SOUND_KEYS)) p.push(`${k}: ismeretlen kulcs`);
  for (const k of Object.keys(SOUND_KEYS)) {
    const xs = cfg[k];
    if (!Array.isArray(xs)) { p.push(`${k}: lista kell`); continue; }
    for (const x of xs) {
      if (typeof x !== 'string' || !isLetter(x)) { p.push(`${k}: hibás betű: ${JSON.stringify(x)}`); continue; }
      if (seen.has(x)) p.push(`${k}: a „${x}” már szerepel itt: ${seen.get(x)}`);
      else seen.set(x, k);
    }
  }
  return p;
}

/**
 * Futásra kész besorolás: betű → 'v' | 'd' | 'u'. Feltételezi, hogy a validateSounds rendben volt.
 * @returns {Map<string, 'v'|'d'|'u'>}
 */
export function compileSounds(cfg) {
  const m = new Map();
  for (const [k, code] of Object.entries(SOUND_KEYS)) for (const x of cfg[k]) m.set(x, /** @type {'v'|'d'|'u'} */ (code));
  return m;
}

/** A beépített besorolás futásra kész alakban. */
export const DEFAULT_CLASSES = compileSounds(DEFAULT_SOUNDS);

/**
 * A tétel betűi az eredeti szövegben (kis- és nagybetű, kötőjel, szóköz megmarad), ugyanazzal a mohó
 * szabállyal, mint a grid.js tokenize-a: dzs, majd a kétjegyűek, végül az egyes karakterek; a hosszú
 * többjegyű mássalhangzó első karaktere a többjegyű betű (`asszony`: a, sz, sz, o, ny). Nem betű
 * (kötőjel, szóköz, írásjel) nem kerül bele.
 * @param {string} text
 * @returns {{ start: number, end: number, letter: string }[]}  letter: kisbetűs alak; end kizáró, UTF-16 index
 */
export function letterRuns(text) {
  const s = String(text);
  const low = s.toLocaleLowerCase('hu');
  const t = low.length === s.length ? low : [...s].map((c) => c.toLocaleLowerCase('hu')).join('');
  const out = [];
  for (let i = 0; i < t.length;) {
    const ch = String.fromCodePoint(t.codePointAt(i));
    if (!/\p{L}/u.test(ch)) { i += ch.length; continue; }
    const next = multiAt(t, i + 1);
    if (t[i] === t[i + 1] && next && next[0] === t[i]) { out.push({ start: i, end: i + 1, letter: next }); i += 1; continue; }
    const m = multiAt(t, i);
    if (m) { out.push({ start: i, end: i + m.length, letter: m }); i += m.length; continue; }
    out.push({ start: i, end: i + ch.length, letter: ch });
    i += ch.length;
  }
  return out;
}

/**
 * A tétel megjelenítési darabjai: az egymás melletti, azonos hangcsoportú és azonos jelölésű karakterek
 * egy darabban. cls: 'v' | 'd' | 'u', vagy '' a nem besorolt karakternél (kötőjel, szóköz, írásjel,
 * idegen betű; SZ-3). A nagybetű a kisbetű párja szerint (SZ-4). mark: a jelölt betű (NB-5).
 * @param {string} text  a tétel (jelölés nélkül)
 * @param {{ start: number, end: number }[]} [marks]
 * @param {Map<string, string>} [classes]  betű → osztálykód
 * @returns {{ text: string, cls: string, mark: boolean }[]}
 */
export function segments(text, marks = [], classes = DEFAULT_CLASSES) {
  const s = String(text);
  if (!s) return [];
  const cls = new Array(s.length).fill(''), mark = new Array(s.length).fill(false);
  for (const r of letterRuns(s)) {
    const c = classes.get(r.letter) || '';
    for (let i = r.start; i < r.end; i++) cls[i] = c;
  }
  for (const m of marks) for (let i = m.start; i < m.end && i < s.length; i++) mark[i] = true;
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const last = out.at(-1);
    if (last && last.cls === cls[i] && last.mark === mark[i]) last.text += s[i];
    else out.push({ text: s[i], cls: cls[i], mark: mark[i] });
  }
  return out;
}
