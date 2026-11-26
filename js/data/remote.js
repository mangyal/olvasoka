// A listák letöltése (spec 3.2). `no-cache`: a böngésző mindig rákérdez, így a friss változat jön.
// A forrásválasztás és a tartalékra váltás a core/source.js-ben van; ez a modul csak letölt.

import { loadLists, TXT_URL } from '../core/source.js';
import { validateConfig, compileConfig } from '../core/grid.js';
import { validate as validateProgress } from '../core/haladas-config.js';
import { validateSounds, compileSounds } from '../core/hangok.js';

export const PAIRS_URL = 'parok.json';
export const PROGRESS_URL = 'haladas.json';
export const SOUNDS_URL = 'hangok.json';
const label = (url) => (url === TXT_URL ? 'A lists.txt' : url === PAIRS_URL ? 'A parok.json' : url === PROGRESS_URL ? 'A haladas.json'
  : url === SOUNDS_URL ? 'A hangok.json' : 'A táblázat');

/** Egy cím letöltése időkorláttal; hibánál a felhasználónak szóló üzenettel dob. */
export async function get(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctrl.signal });
    if (!res.ok) throw new Error(`${label(url)} nem érhető el (HTTP ${res.status}).`);
    return { text: await res.text(), type: res.headers.get('content-type') || '' };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${label(url)} letöltése túl sokáig tartott.`, { cause: e });
    if (e instanceof TypeError) throw new Error(`${label(url)} nem tölthető le. Ellenőrizd az internetkapcsolatot.`, { cause: e });
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export const fetchLists = () => loadLists((url) => get(url));

/** Egy JSON konfiguráció letöltve és ellenőrizve; hibánál a felhasználónak szóló üzenettel dob.
 *  @param {(cfg: any) => string[]} validate  a talált hibák (üres: rendben) */
async function fetchJson(url, validate) {
  const { text } = await get(url);
  let cfg;
  try { cfg = JSON.parse(text); } catch { throw new Error(`${label(url)} nem érvényes JSON.`); }
  const p = validate(cfg);
  if (p.length) throw new Error(`${label(url)} hibás: ${p.join('; ')}`);
  return cfg;
}

/** A Keresd meg! konfigurációja (parok.json), ellenőrizve és futásra készen; hibánál dob. */
export const fetchPairs = async () => compileConfig(await fetchJson(PAIRS_URL, validateConfig));

/** A betűszínezés hangcsoportjai (hangok.json), ellenőrizve, futásra készen; hibánál dob (a hívó a beépítettel fut, D-5). */
export const fetchSounds = async () => compileSounds(await fetchJson(SOUNDS_URL, validateSounds));

/** A Haladás küszöbei (haladas.json), ellenőrizve; hibánál dob (a hívó az alapértékekkel fut tovább). */
export const fetchProgressConfig = () => fetchJson(PROGRESS_URL, validateProgress);
