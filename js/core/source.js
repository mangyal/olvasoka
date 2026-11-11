// A listák forrása (spec 3.2): mindig a Google táblázat, tartalékként a repó lists.txt-je.
// A letöltést a hívó adja (`get`), így a tartalékra váltás hálózat nélkül tesztelhető.

import { parseListsText, parseSheetCsv } from './lists.js';
import { ENV } from './env.js';

// A táblázat címei környezetenként a core/env.js-ben vannak.
export const SHEET_CSV_URL = ENV.sheet.csv;
export const SHEET_EDIT_URL = ENV.sheet.edit;
export const TXT_URL = 'lists.txt';

/** A tárolt szöveg értelmezése a forrása szerint. */
export function parseByKind(kind, text) {
  return kind === 'sheet' ? parseSheetCsv(text) : parseListsText(text);
}

/**
 * Listák betöltése: a táblázat; ha nem érhető el, hibás, vagy nincs benne lista → lists.txt,
 * `fallback` a táblázat hibájával. Ha semmi nem jött le, Error-t dob (a hívó a legutóbb letöltött
 * példányt mutatja, F-L9).
 * @param {(url:string) => Promise<{ text:string, type?:string }>} get  hibánál felhasználónak szóló üzenettel dob
 * @returns {Promise<{ lists, problems, duplicates, text:string, kind:'sheet'|'txt', fallback:string }>}
 */
export async function loadLists(get) {
  let fallback;
  try {
    const { text, type = '' } = await get(SHEET_CSV_URL);
    if (/html/i.test(type) || /^\s*</.test(text)) {
      throw new Error('A táblázat nem a várt formában jött. Nézd meg, hogy közzé van-e téve CSV-ként.');
    }
    const p = parseSheetCsv(text);
    if (!p.lists.length) throw new Error(p.problems.at(-1));
    return { ...p, text, kind: 'sheet', fallback: '' };
  } catch (e) {
    fallback = e.message || 'A táblázat nem érhető el.';
  }
  try {
    const { text } = await get(TXT_URL);
    return { ...parseListsText(text), text, kind: 'txt', fallback };
  } catch (e) {
    throw new Error(`${fallback} A tartalék lists.txt sem érhető el: ${e.message}`);
  }
}
