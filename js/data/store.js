// Helyi tárolás (localStorage). Minden hozzáférés try/catch között: privát ablakban,
// letiltott tárolásnál az alkalmazás memóriából fut tovább.

import { normalizeState } from '../core/settings.js';
import { ENV } from '../core/env.js';

// éles: 'olvasoka' (a régi név), dev: 'olvasoka-dev' – a kettő nem írja felül egymást
const KEY = ENV.storageKey;

export function createStore() {
  let ok = probe();
  return {
    get available() { return ok; },
    read() {
      if (!ok) return normalizeState(null);
      try { return normalizeState(JSON.parse(localStorage.getItem(KEY) || 'null')); }
      catch { return normalizeState(null); }
    },
    write(state) {
      if (!ok) return false;
      try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
      catch { ok = false; return false; }
    },
  };
}

function probe() {
  try { const k = '__olvasoka_probe'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true; }
  catch { return false; }
}
