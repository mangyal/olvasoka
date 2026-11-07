// A lists.json letöltése ugyanarról a címről, ahonnan az oldal jön (GitHub Pages).
// `no-cache`: a böngésző mindig rákérdez, így a commit után kb. egy percen belül a friss lista jön.

import { parseListsJson } from '../core/lists.js';

export async function fetchLists(url = 'lists.json', timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: 'no-cache', signal: ctrl.signal });
    if (!res.ok) throw new Error(`A lists.json nem érhető el (HTTP ${res.status}).`);
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch (e) {
      throw new Error(`A lists.json nem érvényes JSON (${e.message}). Javítsd a GitHubon.`);
    }
    const parsed = parseListsJson(data);
    if (!parsed.ok) throw new Error(parsed.error);
    return { ...parsed, data };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('A listák letöltése túl sokáig tartott.');
    if (e instanceof TypeError) throw new Error('Nem sikerült letölteni a listákat. Ellenőrizd az internetkapcsolatot.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}
