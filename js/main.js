// Indítás és állapotváltás: ADMIN ⇄ PRACTICE → REWARD → ADMIN, Keresd meg! módban ADMIN ⇄ FIND → REWARD → ADMIN.

import { createStore } from './data/store.js';
import { fetchLists, fetchPairs, fetchProgressConfig } from './data/remote.js';
import { createProgressLog } from './data/progress-log.js';
import { resolve as resolveProgress } from './core/haladas-config.js';
import { parseByKind, SHEET_EDIT_URL } from './core/source.js';
import { clampSettings, clampFind, normalizeMode, levelToDegree } from './core/settings.js';
import { buildTasks, effectiveCards } from './core/find.js';
import { nameKey } from './core/items.js';
import { clickSelect, reconcile, sourceFor, applySource } from './core/selection.js';
import { initFont, fontLooksRight } from './font.js';
import { ENV } from './core/env.js';
import { VERSION } from './version.js';
import { createAdmin } from './ui/admin.js';
import { createPractice } from './ui/practice.js';

const $ = (id) => document.getElementById(id);
const el = new Proxy({}, { get: (c, k) => (c[k] ??= $(k)) });

const store = createStore();
const saved = store.read();

const app = {
  lists: [], problems: [], selected: [], anchor: null,
  listsState: 'loading',            // 'loading' | 'ok' | 'stale' | 'error'
  loadError: '', fetchedAt: saved.cache?.fetchedAt || 0,
  mode: saved.mode,                 // a kiválasztott játék: 'read' | 'find'
  settings: saved.settings, find: saved.find, lastLists: saved.lastLists, hideHelp: saved.hideHelp,
  pairs: { state: 'loading', cc: null },  // a Keresd meg! konfigurációja (parok.json); 'failed': a fül inaktív
  kind: saved.cache?.kind || null,  // amiből a látható listák jöttek
  fallback: '',                     // miért nem a táblázatból jöttek (F-L13)
  font: { state: 'loading', name: 'Arial' },
  // élő érték: ha egy későbbi írás bukik (pl. betelt a tárhely), a figyelmeztetés is megjelenik (F-S4)
  get storageOK() { return store.available; },
};
let cache = saved.cache;

// azonnali indulás a legutóbb letöltött listákkal, amíg a friss megjön
if (cache) {
  const p = parseByKind(cache.kind, cache.text);
  app.lists = p.lists; app.problems = p.problems;
}

function persist() {
  // amíg a parok.json nem jött meg (vagy hibás), a tárolt mód nem íródik felül: legközelebb újra próbálja
  const mode = app.pairs.state === 'ok' ? app.mode : saved.mode;
  store.write({ v: 4, mode: normalizeMode(mode), settings: app.settings, find: app.find, lastLists: app.lastLists, hideHelp: app.hideHelp, cache });
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

// Haladás: a gyakorlás naplója a szülő eszközén (docs/haladas-specifikacio.md). Ha a tárolás nem
// elérhető, memóriában fut; a gyakorlást semmi nem akasztja meg.
const progress = createProgressLog({ key: ENV.progressKey, config: resolveProgress(null, { skipDayRules: ENV.skipDayRules }) });

/** A kör listáinak nevei: „Összes lista” módban mind, különben a kijelöltek. */
const roundListNames = () => (app.settings.source === 'all' ? app.lists.map((l) => l.name) : app.lastLists);

const practice = createPractice(el, { onExit: () => { el.admin.hidden = false; admin.render(); }, progress });

const admin = createAdmin(el, app, {
  // mod: { toggle, range } – Ctrl/Cmd, illetve Shift kattintás
  select(name, mod = {}) {
    const r = clickSelect(app.selected, nameKey(name), { ...mod, anchor: app.anchor, keys: listKeys() });
    app.anchor = r.anchor;
    setSelection(r.sel);
    persist(); admin.render();
  },
  // mobil listaválasztó: Mind / Egyik sem
  selectAll(all) {
    const keys = listKeys();
    app.anchor = all ? keys[0] || null : null;
    setSelection(all ? keys : []);
    persist(); admin.render();
  },
  mode(m) {
    app.mode = normalizeMode(m, app.pairs.state === 'failed' ? ['read'] : undefined);
    persist(); admin.render();
  },
  find(patch) {
    app.find = clampFind({ ...app.find, ...patch });
    persist(); admin.render();
  },
  setting(patch) {
    app.settings = clampSettings({ ...app.settings, ...patch });
    if ('source' in patch && app.lists.length) setSelection(applySource(app.settings.source, app.selected, listKeys()));
    persist(); admin.render();
  },
  refresh,
  start(ev) {
    // modális ablak (súgó, betűteszt, alsó lap) alatt nem indul; a nem modális súgó-popover bezárul
    if (practice.active || !admin.canStart() || document.querySelector('dialog:modal')) return;
    admin.closeHow();
    el.admin.hidden = true;
    if (app.mode === 'find') {
      // F-K1, F-K10: minden feladat a kör indulásakor készül; telefonon legfeljebb 6 kártya
      const cards = effectiveCards(app.find.cards, innerWidth, innerHeight);
      const cc = app.pairs.cc;
      const tasks = buildTasks(admin.roundItems(), { cards, tasks: app.find.tasks, level: levelToDegree(app.find.level, cc.levels) }, cc);
      practice.startFind(tasks, cards, ev);
      return;
    }
    practice.start(admin.roundItems(), app.settings, ev, { listNames: roundListNames(), undoMs: progress.config.szures.javitott_melle_ms });
  },
  fontTest() {
    const ok = fontLooksRight(app.font);
    el.fontResult.textContent = ok
      ? (app.font.name === 'Arial'
        ? '✓ Rendben – az Arial betűtípus jelenik meg.'
        : '✓ Rendben – az Arimo látszik, ami az Arial pontos megfelelője (ezen a gépen nincs Arial).')
      : app.font.state === 'loading' ? 'A betűtípus még töltődik…' : '✕ Nem az Arial látszik – a gyerek nem a tanult betűalakokat fogja látni (pl. ő, ű)!';
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
    app.kind = r.kind; app.fallback = r.fallback;
    cache = { text: r.text, fetchedAt: app.fetchedAt, kind: r.kind };
    persist();
    if (app.lists.length) progress.syncLists(app.lists);
  } catch (e) {
    app.loadError = e.message;
    app.listsState = app.lists.length ? 'stale' : 'error';
  }
  pickSelected();
  admin.render();
}

/* ---------- Keresd meg! konfiguráció (parok.json) ---------- */
// Hibás vagy betölthetetlen konfigurációval a Keresd meg! fül inaktív, a Felolvasás érintetlen.
async function loadPairs() {
  try {
    app.pairs = { state: 'ok', cc: await fetchPairs() };
  } catch (e) {
    console.warn('Keresd meg!: a parok.json nem használható.', e.message);
    app.pairs = { state: 'failed', cc: null };
    app.mode = 'read';
  }
  if (!practice.active) admin.render();
}

/* ---------- Haladás küszöbei (haladas.json) ---------- */
// Hiányzó vagy hibás fájlnál a beépített alapértékekkel fut, és a konzolra figyelmeztet (7.1).
async function loadProgressConfig() {
  try {
    progress.setConfig(resolveProgress(await fetchProgressConfig(), { skipDayRules: ENV.skipDayRules }));
  } catch (e) {
    console.warn('Haladás: a haladas.json nem használható, az alapértékekkel fut.', e.message);
  }
}

/* ---------- billentyűk ---------- */
document.addEventListener('keydown', (e) => {
  if (practice.active) { practice.key(e); return; }
  if (admin.key(e)) return;
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
// a táblázat szerkesztője; a hozzáférést a Google kezeli (F-L11)
el.editLink.href = SHEET_EDIT_URL;
el.listsEdit.href = SHEET_EDIT_URL;

/* ---------- verzió és környezet ---------- */
// a fejlécben a verzió; a dev környezet feltűnő jelzést kap, hogy ne lehessen összetéveszteni
el.appVersion.textContent = `v${VERSION}`;
if (ENV.env === 'dev') {
  document.documentElement.dataset.env = 'dev';
  document.title = 'Olvasóka DEV';
  el.appVersion.textContent = `DEV · v${VERSION}`;
}

/* ---------- indulás ---------- */
pickSelected();
admin.render();
if (!app.hideHelp) openHelp();
initFont((late) => { app.font = late; if (!practice.active) admin.render(); })
  .then((f) => { app.font = f; if (!practice.active) admin.render(); });
refresh();
loadPairs();
loadProgressConfig();

// PWA: offline indulás (sw.js). Csak https-en vagy localhoston; hiba esetén a program ugyanúgy fut.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
