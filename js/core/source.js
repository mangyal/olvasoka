// A listák forrása (spec 3.2): Google táblázat, tartalékként a repó lists.txt-je.
// A letöltést a hívó adja (`get`), így a tartalékra váltás hálózat nélkül tesztelhető.

import { parseListsText, parseSheetCsv } from './lists.js';

export const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTC1LeDZKtyeoWqy57jz7dUOsfY3FoutvTl3S5ogBvSKFWOWLbyxCjO2IISlCHXxMdCHSjrOM-T2Dq6/pub?output=csv';
export const SHEET_EDIT_URL = 'https://docs.google.com/spreadsheets/d/1j87SRjs4ZvyEJmModdTuNwPdyzgkwzx34yarw3qdCEM/edit?gid=0#gid=0';
export const TXT_URL = 'lists.txt';

/** Ideiglenes feature toggle (F-L12): 'sheet' (alapérték) vagy 'txt'. */
export const LIST_SOURCES = ['sheet', 'txt'];
export const DEFAULT_LIST_SOURCE = 'sheet';

/**
 * A `?source=` URL-paraméter, ha érvényes; különben a tárolt érték; különben az alapérték.
 * @returns {{ source:'sheet'|'txt', fromUrl:boolean }}
 */
export function pickListSource(search, saved) {
  const q = new URLSearchParams(search || '').get('source');
  if (LIST_SOURCES.includes(q)) return { source: q, fromUrl: true };
  return { source: LIST_SOURCES.includes(saved) ? saved : DEFAULT_LIST_SOURCE, fromUrl: false };
}

/** A tárolt szöveg értelmezése a forrása szerint. */
export function parseByKind(kind, text) {
  return kind === 'sheet' ? parseSheetCsv(text) : parseListsText(text);
}

/**
 * Listák betöltése.
 * 'sheet': a táblázat; ha nem érhető el, hibás, vagy nincs benne lista → lists.txt, `fallback` a táblázat hibájával.
 * 'txt': csak a lists.txt.
 * Ha semmi nem jött le, Error-t dob (a hívó a legutóbb letöltött példányt mutatja, F-L9).
 * @param {'sheet'|'txt'} mode
 * @param {(url:string) => Promise<{ text:string, type?:string }>} get  hibánál felhasználónak szóló üzenettel dob
 * @returns {Promise<{ lists, problems, duplicates, text:string, kind:'sheet'|'txt', fallback:string }>}
 */
export async function loadLists(mode, get) {
  let fallback = '';
  if (mode === 'sheet') {
    try {
      const { text, type = '' } = await get(SHEET_CSV_URL);
      if (/html/i.test(type) || /^\s*</.test(text)) {
        throw new Error('A táblázat nem CSV-t adott vissza. Ellenőrizd, hogy közzé van-e téve az interneten (CSV).');
      }
      const p = parseSheetCsv(text);
      if (!p.lists.length) throw new Error(p.problems.at(-1));
      return { ...p, text, kind: 'sheet', fallback: '' };
    } catch (e) {
      fallback = e.message || 'A táblázat nem érhető el.';
    }
  }
  try {
    const { text } = await get(TXT_URL);
    return { ...parseListsText(text), text, kind: 'txt', fallback };
  } catch (e) {
    if (!fallback) throw e;
    throw new Error(`${fallback} A tartalék lists.txt sem érhető el: ${e.message}`);
  }
}
