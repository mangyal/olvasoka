// A listák letöltése (spec 3.2). `no-cache`: a böngésző mindig rákérdez, így a friss változat jön.
// A forrásválasztás és a tartalékra váltás a core/source.js-ben van; ez a modul csak letölt.

import { loadLists, TXT_URL } from '../core/source.js';

const label = (url) => (url === TXT_URL ? 'A lists.txt' : 'A táblázat');

/** Egy cím letöltése időkorláttal; hibánál a felhasználónak szóló üzenettel dob. */
export async function get(url, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctrl.signal });
    if (!res.ok) throw new Error(`${label(url)} nem érhető el (HTTP ${res.status}).`);
    return { text: await res.text(), type: res.headers.get('content-type') || '' };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`${label(url)} letöltése túl sokáig tartott.`);
    if (e instanceof TypeError) throw new Error(`${label(url)} nem tölthető le. Ellenőrizd az internetkapcsolatot.`);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

/** @param {'sheet'|'txt'} mode */
export const fetchLists = (mode) => loadLists(mode, (url) => get(url));
