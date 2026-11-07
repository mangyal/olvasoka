// Indítás és állapotváltás: ADMIN ⇄ PRACTICE → REWARD → ADMIN.

import { createStore } from './data/store.js';
import { fetchLists } from './data/remote.js';
import { parseListsText } from './core/lists.js';
import { clampSettings } from './core/settings.js';
import { nameKey } from './core/items.js';
import { clickSelect, reconcile, sourceFor, applySource } from './core/selection.js';
import { initFont, fontLooksRight } from './font.js';
import { createAdmin } from './ui/admin.js';
import { createPractice } from './ui/practice.js';

const REPO = 'mangyal/olvasoka';

const $ = (id) => document.getElementById(id);
const el = new Proxy({}, { get: (c, k) => (c[k] ??= $(k)) });

const store = createStore();
const saved = store.read();

const app = {
  lists: [], problems: [], selected: [], anchor: null,
  listsState: 'loading',            // 'loading' | 'ok' | 'stale' | 'error'
  loadError: '', fetchedAt: saved.cache?.fetchedAt || 0,
  settings: saved.settings, lastLists: saved.lastLists, hideHelp: saved.hideHelp,
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
  store.write({ v: 3, settings: app.settings, lastLists: app.lastLists, hideHelp: app.hideHelp, cache });
}
const listKeys = () => app.lists.map((l) => nameKey(l.name));

// A kijelölés és a tételforrás mindig együtt változik: minden lista kijelölve ⇔ „Összes lista”.
function setSelection(sel) {
  const keys = listKeys();
  app.selected = sel;
  if (!app.selected.includes(app.anchor)) app.anchor = app.selected[0] || null;
  const set = new Set(sel);
  app.lastLists = app.lists.filter((l) => set.has(nameKey(l.name))).map((l) => l.name);
  if (keys.length) app.settings = { ...app.settings, source: sourceFor(sel, keys) };
}

function pickSelected() {
  const keys = listKeys();
  // „Összes lista” módban egy újonnan megjelent lista is bekerül
  const want = app.settings.source === 'all' ? keys
    : app.selected.length ? app.selected : app.lastLists.map(nameKey);
  setSelection(reconcile(want, keys));
}

const practice = createPractice(el, { onExit: () => { el.admin.hidden = false; admin.render(); } });

const admin = createAdmin(el, app, {
  // mod: { toggle, range } – Ctrl/Cmd, illetve Shift kattintás
  select(name, mod = {}) {
    const r = clickSelect(app.selected, nameKey(name), { ...mod, anchor: app.anchor, keys: listKeys() });
    app.anchor = r.anchor;
    setSelection(r.sel);
    persist(); admin.render();
  },
  setting(patch) {
    app.settings = clampSettings({ ...app.settings, ...patch });
    if ('source' in patch && app.lists.length) setSelection(applySource(app.settings.source, app.selected, listKeys()));
    persist(); admin.render();
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
// súgó: induláskor magától, amíg a „Ne jelenjen meg újra” nincs bepipálva; a fejlécből bármikor
function openHelp() { el.helpHide.checked = app.hideHelp; el.dlgHelp.showModal(); }
el.helpBtn.addEventListener('click', openHelp);
el.helpHide.addEventListener('change', () => { app.hideHelp = el.helpHide.checked; persist(); });
el.editLink.href = `https://github.com/${REPO}/edit/main/lists.txt`;

/* ---------- indulás ---------- */
pickSelected();
admin.render();
if (!app.hideHelp) openHelp();
initFont((late) => { app.font = late; if (!practice.active) admin.render(); })
  .then((f) => { app.font = f; if (!practice.active) admin.render(); });
refresh();

// PWA: offline indulás (sw.js). Csak https-en vagy localhoston; hiba esetén a program ugyanúgy fut.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
