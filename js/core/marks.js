// Nagybetűk jelölése a listában (docs/megjelenes-specifikacio.md, NB-1–NB-5a). Tiszta modul.
//
// A listában a kapcsos zárójelbe tett betű azt jelenti: itt nagybetű állna (`{m}i-ki`, `{sz}é-ke`,
// mondatban több is: `{l}a-li {m}a-mi.`). A jelölés csak megjelenítési információ: a tétel a zárójelek
// nélküli alak (`mi-ki`), a jelölés a tétel mellé kerül (karakterpozíciók a zárójel nélküli alakban).
// Így minden más modul (csoport, kör, Keresd meg!, Haladás) a jelöletlen tételt látja.
//
// Érvényes jelölés: a zárójelben pontosan egy betű (a többjegyű betű egy betű), kisbetűvel, egy szó
// elején (döntés 2026-11-25: szó közepén nincs nagybetű, `mi-{k}i` hibás). A többjegyű betű nem
// vágható ketté (`{s}zó` hibás, `{sz}ó` jó).

import { multiAt, MULTI } from './grid.js';

/** @typedef {{ start: number, end: number }} Mark  UTF-16 indexek a zárójelek nélküli alakban, end kizáró */

const BAD = Object.freeze({ text: null, marks: null });

/** Egy betű-e (egy karakteres betű vagy többjegyű betű). */
const isLetter = (s) => ([...s].length === 1 ? /^\p{L}$/u.test(s) : MULTI.includes(s));

/** Szó eleje: a tétel eleje, vagy előtte nem betű, nem szám és nem kötőjel áll (pl. szóköz). */
const wordStart = (text, i) => i === 0 || !/[\p{L}\p{N}-]/u.test(text[i - 1]);

function validMark(text, { start, end }) {
  const letter = text.slice(start, end);
  if (letter !== letter.toLocaleLowerCase('hu')) return false;   // a zárójelben kisbetű áll
  if (!isLetter(letter) || !wordStart(text, start)) return false;
  // a jelölt betű a teljes betű: `{s}zó` (sz fele) és `{d}zsungel` hibás
  const t = text.toLocaleLowerCase('hu');
  const whole = multiAt(t, start) || String.fromCodePoint(t.codePointAt(start));
  return whole === letter;
}

/**
 * A tétel jelölései. Zárójel nélküli tételnél { text: a tétel, marks: [] }.
 * Érvénytelen jelölésnél (le nem zárt `{`, magányos `}`, üres `{}`, egymásba ágyazás, a zárójelben nem
 * egy betű, nagybetű vagy szó közepén) { text: null, marks: null } (NB-3: a tétel kimarad).
 * @param {string} raw  a tisztított tétel (cleanItem)
 * @returns {{ text: string|null, marks: Mark[]|null }}
 */
export function parseMarks(raw) {
  const s = String(raw);
  if (!/[{}]/.test(s)) return { text: s, marks: [] };
  let text = '';
  const marks = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '}') return BAD;
    if (ch !== '{') { text += ch; continue; }
    const j = s.indexOf('}', i + 1);
    if (j < 0) return BAD;
    const inner = s.slice(i + 1, j);
    if (!inner || inner.includes('{')) return BAD;
    marks.push({ start: text.length, end: text.length + inner.length });
    text += inner;
    i = j;
  }
  return marks.every((m) => validMark(text, m)) ? { text, marks } : BAD;
}

/**
 * A csomagok jelölései egy térképben (NB-5a): ha egy tétel jelölve és jelöletlenül is szerepel, a jelölt
 * alak látszik; több jelölt előfordulásnál a csomagok sorrendjében az első.
 * @param {{ marks?: Map<string, Mark[]> }[]} lists  a kijelölt csomagok
 * @returns {Map<string, Mark[]>}  tételkulcs → jelölések
 */
export function marksOf(lists) {
  const out = new Map();
  for (const l of lists) for (const [k, m] of l.marks || []) if (!out.has(k)) out.set(k, m);
  return out;
}

/** A jelölt alak visszaírva (`mi-ki` + [0,1] → `{m}i-ki`); teszthez és hibaüzenethez. */
export function withMarks(text, marks = []) {
  let out = '', at = 0;
  for (const { start, end } of [...marks].sort((a, b) => a.start - b.start)) {
    out += text.slice(at, start) + '{' + text.slice(start, end) + '}';
    at = end;
  }
  return out + text.slice(at);
}
