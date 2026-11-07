// Indítás és állapotváltás: ADMIN ⇄ PRACTICE → REWARD → ADMIN.

import { createStore } from './data/store.js';
import { fetchLists } from './data/remote.js';
import { parseListsText } from './core/lists.js';
import { clampSettings } from './core/settings.js';
import { nameKey } from './core/items.js';
import { initFont, fontLooksRight } from './font.js';
import { createAdmin } from './ui/admin.js';
import { createPractice } from './ui/practice.js';

const REPO = 'mangyal/olvasoka';

const $ = (id) => document.getElementById(id);
const el = new Proxy({}, { get: (c, k) => (c[k] ??= $(k)) });

const store = createStore();
const saved = store.read();

const app = {
  lists: [], problems: [], selected: null,
  listsState: 'loading',            // 'loading' | 'ok' | 'stale' | 'error'
  loadError: '', fetchedAt: saved.cache?.fetchedAt || 0,
  settings: saved.settings, lastList: saved.lastList,
  font: { state: 'loading', name: 'Arial' },
  storageOK: store.available,
};
let cache = saved.cache;

// azonnali indulás a legutóbb letöltött listákkal, amíg a friss megjön
if (cache) {
  const p = parseListsText(cache.text);
  app.lists = p.lists; app.problems = p.problems;
}

function persist() {
  store.write({ v: 2, settings: app.settings, lastList: app.lastList, cache });
}
function pickSelected() {
  const keys = app.lists.map((l) => nameKey(l.name));
  for (const k of [app.selected, app.lastList && nameKey(app.lastList)]) if (k && keys.includes(k)) { app.selected = k; return; }
  app.selected = keys[0] || null;
}

const practice = createPractice(el, { onExit: () => { el.admin.hidden = false; admin.render(); } });

const admin = createAdmin(el, app, {
  select(name) {
    app.selected = nameKey(name); app.lastList = name; persist(); admin.render();
  },
  setting(patch) {
    app.settings = clampSettings({ ...app.settings, ...patch }); persist(); admin.render();
  },
  refresh,
  start(ev) {
    if (practice.active || !admin.canStart() || document.querySelector('dialog[open]')) return;
    el.admin.hidden = true;
    practice.start(admin.roundItems(), app.settings, ev);
  },
  fontTest() {
    const ok = fontLooksRight(app.font);
    el.fontResult.textContent = ok
      ? (app.font.name === 'Arial'
        ? '✓ Rendben – az Arial betűtípus jelenik meg.'
        : '✓ Rendben – az Arimo jelenik meg (az Ariallal azonos betűalakú helyettesítő, mert ezen a gépen nincs Arial).')
      : app.font.state === 'loading' ? 'A betűtípus még töltődik…' : '✕ Nem az Arial jelenik meg.';
    el.fontResult.className = ok ? '' : 'err';
    el.dlgFont.showModal();
  },
});

async function refresh() {
  app.listsState = 'loading'; admin.render();
  try {
    const r = await fetchLists();
    app.lists = r.lists; app.problems = r.problems; app.loadError = '';
    app.listsState = 'ok'; app.fetchedAt = Date.now();
    cache = { text: r.text, fetchedAt: app.fetchedAt };
    persist();
  } catch (e) {
    app.loadError = e.message;
    app.listsState = app.lists.length ? 'stale' : 'error';
  }
  pickSelected();
  admin.render();
}

/* ---------- billentyűk ---------- */
document.addEventListener('keydown', (e) => {
  if (practice.active) { practice.key(e); return; }
  if ((e.ctrlKey || e.metaKey) && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
    e.preventDefault();
    if (!e.repeat) el.startBtn.click();
  }
}, true);

document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
el.editLink.href = `https://github.com/${REPO}/edit/main/lists.txt`;

/* ---------- indulás ---------- */
pickSelected();
admin.render();
initFont((late) => { app.font = late; if (!practice.active) admin.render(); })
  .then((f) => { app.font = f; if (!practice.active) admin.render(); });
refresh();
