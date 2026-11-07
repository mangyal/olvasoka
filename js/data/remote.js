// A lists.txt letöltése ugyanarról a címről, ahonnan az oldal jön (GitHub Pages).
// `no-cache`: a böngésző mindig rákérdez, így a commit után kb. egy percen belül a friss lista jön.

import { parseListsText } from '../core/lists.js';

export async function fetchLists(url = 'lists.txt', timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctrl.signal });
    if (!res.ok) throw new Error(`A lists.txt nem érhető el (HTTP ${res.status}).`);
    const text = await res.text();
    return { ...parseListsText(text), text };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('A listák letöltése túl sokáig tartott.');
    if (e instanceof TypeError) throw new Error('Nem sikerült letölteni a listákat. Ellenőrizd az internetkapcsolatot.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}
