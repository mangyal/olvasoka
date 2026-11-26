// Szülői felület. A kártyacsomagok (a kódban: listák) csak olvashatók; forrásuk a Google táblázat,
// tartalékként a repó lists.txt-je. Elrendezés: docs/kartyacsomagok-specifikacio.md.

import { GAPS, estimate, fmtNum, CARDS, LEVEL_LABELS, findEstimate, levelToDegree } from '../core/settings.js';
import { nameKey, distinctItems } from '../core/items.js';
import { itemsOf } from '../core/selection.js';
import { canFind, onlySentences, effectiveCards, PHONE_MAX_CARDS } from '../core/find.js';
import { createPool, buildGrid } from '../core/grid.js';
import { marksOf } from '../core/marks.js';
import { sampleItems, miniSample, lookSummary } from '../core/look.js';
import { itemSpan, fillHtml } from './glyphs.js';
import { filterRows, typeCounts, chipModel, toggleChip, toggleSub, countText } from '../core/type-filter.js';

export const MOD = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
// a súgó itt alsó lap (modális), máshol a panel melletti popover (design spec 6.)
const SHEET = matchMedia('(max-width:899px), (hover:none) and (pointer:coarse), (max-height:500px) and (orientation:landscape)');
// a Megjelenés helye: keskeny nézetben (álló tablet, telefon, fekvő telefon) a csomagválasztó alatt, máshol az előnézet fölött
const NARROW = matchMedia('(max-width:899px), (max-height:500px) and (orientation:landscape)');
// telefon (álló és fekvő): a szűrő altípusai lebegő listában, sötétített háttérrel (L-5)
const PHONE = matchMedia('(max-width:600px), (max-height:500px) and (orientation:landscape)');
const flashLabel = (ms) => (ms === 0 ? 'kézi' : `${fmtNum(ms / 1000)} mp`);
const DESC = {
  read: 'A gyerek hangosan felolvassa a felvillanó kártyát, te figyeled a kiejtést.',
  find: 'Te kimondasz egy kártyát, a gyerek megkeresi és rámutat.',
};
const HOW_TITLE = { read: 'Felolvasás – így játsszátok', find: 'Keresd meg! – így játsszátok' };
/** F-K10: a nézet most telefon-e (a rövidebb oldal 500 px alatt). */
const phoneCards = (n) => effectiveCards(n, innerWidth, innerHeight);

const SEP = '\u0001', SEP2 = '\u0002';
/** A számmező értéke számként; üres vagy nem szám esetén a régi érték marad. */
const numOr = (v, old) => (Number.isFinite(+v) && String(v).trim() !== '' ? +v : old);

export function createAdmin(el, app, act) {
  const dismissed = new Set();

  /* ---------- segédek ---------- */
  const isSel = (l) => app.selected.includes(nameKey(l.name));
  const selected = () => app.lists.filter(isSel);
  const allMode = () => app.settings.source === 'all';

  /* A tételek egy rendereléshez többször is kellenek; csak akkor számolódnak újra, ha a listák vagy a
     kijelölés megváltozott (mindkettő cserével változik, helyben soha). A visszaadott tömb nem módosítható.
     Sor: a lista egy bejegyzése, ismétlésekkel (a kör ezekből húz, 2.14 S-2). A felület mindenhol a
     különböző tételeket mutatja (S-3). */
  /* Tételszűrő (SZR-5, D-3): a szűrés a csomagválasztás után jön; a felület mindenhol a szűrés utáni
     különböző tételeket mutatja és számolja. A szűrő (app.typeFilter) cserével változik, helyben soha. */
  const off = () => app.typeFilter;
  let selMemo = { lists: null, selected: null, filter: null, rowsAll: [], itemsAll: [], rows: [], items: [], marks: new Map() };
  let allMemo = { lists: null, filter: null, rowsAll: [], rows: [], marks: new Map() };
  const distinctOf = new WeakMap(), filteredOf = new WeakMap();
  /** Egy lista különböző tételei, első előfordulásuk sorrendjében (a lista objektumához tárolva). */
  function listItems(l) {
    if (!distinctOf.has(l)) distinctOf.set(l, distinctItems(l.items));
    return distinctOf.get(l);
  }
  /** Egy lista szűrés utáni különböző tételei (a felület ezt mutatja és számolja, D-3). */
  function shownItems(l) {
    const f = filteredOf.get(l);
    if (f && f.filter === off()) return f.items;
    const items = filterRows(listItems(l), off());
    filteredOf.set(l, { filter: off(), items });
    return items;
  }
  function selMemoNow() {
    if (selMemo.lists !== app.lists || selMemo.selected !== app.selected || selMemo.filter !== off()) {
      const same = selMemo.lists === app.lists && selMemo.selected === app.selected;
      const rowsAll = same ? selMemo.rowsAll : itemsOf(app.lists, app.selected, nameKey);
      const itemsAll = same ? selMemo.itemsAll : distinctItems(rowsAll);
      // NB-5a: a kijelölt csomagokban jelölt tétel mindenhol jelölt alakban látszik
      selMemo = { lists: app.lists, selected: app.selected, filter: off(), rowsAll, itemsAll,
        rows: filterRows(rowsAll, off()), items: filterRows(itemsAll, off()), marks: same ? selMemo.marks : marksOf(selected()) };
    }
    return selMemo;
  }
  /** A kijelölt listák különböző tételei a szűrés után (felület). */
  const selectedItems = () => selMemoNow().items;
  /** A kijelölt listák különböző tételei szűrés nélkül (a szűrő chipjei és a számláló teljes értéke). */
  const selectedItemsAll = () => selMemoNow().itemsAll;
  /** A kör sorai (ismétlésekkel), a szűrés után: a kijelölt listákéi vagy, „Összes lista” forrásnál, az összesé. */
  function roundItems() {
    if (app.settings.source !== 'all') return selMemoNow().rows;
    return allMemoNow().rows;
  }
  /** A kör sorai szűrés nélkül. */
  const roundRowsAll = () => (app.settings.source !== 'all' ? selMemoNow().rowsAll : allMemoNow().rowsAll);
  /** A szűrő kizárt-e tételt a körből (Umami: filtered, N-3). */
  const roundFiltered = () => roundItems().length < roundRowsAll().length;
  function allMemoNow() {
    if (allMemo.lists !== app.lists || allMemo.filter !== off()) {
      const same = allMemo.lists === app.lists;
      const rowsAll = same ? allMemo.rowsAll : app.lists.flatMap((l) => l.items);
      allMemo = { lists: app.lists, filter: off(), rowsAll, rows: filterRows(rowsAll, off()), marks: same ? allMemo.marks : marksOf(app.lists) };
    }
    return allMemo;
  }
  /** A kör tételeinek nagybetű-jelölései (tételkulcs → jelölés), a kör forrása szerint (NB-5a). */
  const roundMarks = () => (app.settings.source !== 'all' ? selMemoNow().marks : allMemoNow().marks);
  /** A felület jelölései: a kijelölt csomagokéi. */
  const selMarks = () => selMemoNow().marks;
  /** A jelölések kulcsa az újrarajzoláshoz: a zárójel hozzáadása a tételt nem változtatja, a rajzot igen. */
  const marksKey = (m) => [...m].map(([k, v]) => k + SEP + v.map((r) => `${r.start}.${r.end}`).join()).join(SEP2);
  let glyphVer = 0;                 // a hangok.json betöltése után minden tétel újrarajzolódik

  /* Egy DOM-rész csak akkor épül újra, ha a tartalma (kulcsa) megváltozott; különben a hívó csak az
     állapotát (kijelölés, pipa) frissíti. Így kattintás után a fókusz a gombon/jelölőnégyzeten marad
     (billentyűzet, felolvasó), és a szülői felület nem rajzol újra minden elemet minden lépésnél. */
  const built = new WeakMap();
  function rebuild(box, key, make) {
    if (built.get(box) === key) return false;
    box.replaceChildren(...make());
    built.set(box, key);
    return true;
  }
  /** A listák szerkezete (név, különböző tételek száma): ha ez nem változik, a listasáv elemei megmaradnak. */
  const listsKey = () => app.lists.map((l) => l.name + SEP + shownItems(l).length).join(SEP2);

  /** Jelölőnégyzetes csomagsor (álló tablet és a telefonos lap). */
  function checkRow(l, rowClass, nameClass) {
    const lab = document.createElement('label'); lab.className = rowClass;
    const c = document.createElement('input'); c.type = 'checkbox';
    const name = document.createElement('span'); name.textContent = l.name;
    if (nameClass) name.className = nameClass;
    const cnt = document.createElement('span'); cnt.className = 'nav-count'; cnt.textContent = shownItems(l).length;
    c.addEventListener('change', () => act.select(l.name));
    lab.append(c, name, cnt); return lab;
  }
  /** A jelölőnégyzetek állapota a kijelölésből (a sorok a listák sorrendjében vannak). */
  function syncChecks(box) {
    box.querySelectorAll('input[type=checkbox]').forEach((c, k) => { c.checked = isSel(app.lists[k]); });
  }

  const findMode = () => app.mode === 'find';

  function startState() {
    if (app.font.state === 'loading') return { enabled: false, label: 'Betűtípus töltődik…' };
    if (findMode() && app.pairs.state === 'loading') return { enabled: false, label: 'Játék töltődik…' };
    if (!app.lists.length) {
      return app.listsState === 'loading'
        ? { enabled: false, label: 'Csomagok töltődnek…' }
        : { enabled: false, msg: 'Nincs elérhető csomag.' };
    }
    const all = allMode();
    const k = all ? app.lists.length : selected().length;
    if (!roundRowsAll().length) {
      return { enabled: false, msg: all ? 'Egyik csomagban sincs kártya.' : !k ? 'Jelölj ki legalább egy csomagot.' : k > 1 ? 'A kijelölt csomagokban nincs kártya.' : 'A csomagban nincs kártya.' };
    }
    // SZR-7: a szűrő mindent kizárt; a becslés helyén mondjuk meg, a lista helyén a teendőt
    if (!roundItems().length) return { enabled: false, msg: '', emptyFilter: true };
    // K-5: a Keresd meg!-hez kell egy csoport legalább két különböző tétellel
    // M-9: a mondat nem játszható; ha csak mondat van, ezt mondjuk meg, nem a tételszámot
    if (findMode() && !canFind(roundItems())) {
      return { enabled: false, msg: onlySentences(roundItems())
        ? 'A Keresd meg!-ben mondatok nem szerepelnek. Válassz betűt, szótagot vagy szót is.'
        : 'A Keresd meg!-hez legalább két különböző kártya kell.' };
    }
    // a gomb alatt csak hiba vagy figyelmeztetés (a csomag- és tételszámot az előnézet mutatja)
    const fontWarn = app.font.state === 'failed';
    return { enabled: true, msg: fontWarn ? 'A betűk alakja eltérhet.' : '', warn: fontWarn };
  }

  /* ---------- renderelés ---------- */
  function renderWarnings() {
    const w = [];
    if (!app.storageOK) w.push(['storage', 'A beállításaid nem mentődnek el (pl. privát böngészés), és internet nélkül nem lesz csomag.']);
    if (app.font.state === 'failed') w.push(['font', 'Nem töltődött be a gyakorló betűtípus – a gyerek nem a tanult betűalakokat fogja látni.']);
    if (app.loadError && app.lists.length) w.push(['stale', `${app.loadError} A legutóbb letöltött csomagok látszanak.`]);
    app.problems.forEach((p, i) => w.push(['p' + i + p, p]));
    const shown = w.filter(([id]) => !dismissed.has(id));
    rebuild(el.warnings, shown.map(([id, text]) => id + SEP + text).join(SEP2), () => shown.map(([id, text]) => {
      const d = document.createElement('div'); d.className = 'warn-item pad';
      const p = document.createElement('p'); p.textContent = text;
      const b = document.createElement('button'); b.type = 'button'; b.textContent = '×';
      b.setAttribute('aria-label', 'Figyelmeztetés bezárása');
      b.addEventListener('click', () => { dismissed.add(id); renderWarnings(); });
      d.append(p, b); return d;
    }));
  }

  /** A forráskapcsolók (oldalsáv, álló tablet, telefonos lap) állapota. */
  function syncSwitches() {
    for (const r of document.querySelectorAll('.src-switch input')) r.checked = r.value === app.settings.source;
  }

  function renderNav() {
    const lk = listsKey();
    const all = allMode();
    syncSwitches();
    rebuild(el.listNav, lk, () => app.lists.map((l) => {
      const li = document.createElement('li');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'nav-item';
      b.setAttribute('role', 'checkbox');
      b.dataset.name = l.name;
      const box = document.createElement('span'); box.className = 'nav-box'; box.setAttribute('aria-hidden', 'true');
      box.append(tick());
      const name = document.createElement('span'); name.className = 'nav-name'; name.textContent = l.name;
      const cnt = document.createElement('span'); cnt.className = 'nav-count'; cnt.textContent = shownItems(l).length;
      b.append(box, name, cnt);
      li.append(b); return li;
    }));
    el.listNav.querySelectorAll('.nav-item').forEach((b, k) => {
      const sel = isSel(app.lists[k]);
      b.classList.toggle('sel', sel);
      b.setAttribute('aria-checked', String(sel));
    });
    el.sidebar.classList.toggle('all', all);
    const sum = selectionSummary();
    el.navSum.textContent = sum.head;
    el.navNone.hidden = all || !sum.k;
    el.navHint.hidden = app.lists.length < 2;

    // álló tablet: jelölőnégyzetes chipek
    rebuild(el.listChecks, lk, () => app.lists.map((l) => checkRow(l, 'pick')));
    syncChecks(el.listChecks);
    el.listPick.classList.toggle('all', all);
    el.picker.hidden = !app.lists.length;
    el.pickSum.textContent = sum.text;
    // telefon: csomag gomb (4.1)
    el.listsBtnLabel.textContent = `${all ? 'Összes csomag' : 'Kijelölt csomagok'} · ${sum.n} kártya`;
    el.listsBtnNames.textContent = all ? `Mind a ${app.lists.length} csomag` : (sum.names || 'Nincs kijelölt csomag');
    if (el.dlgLists.open) renderListsSheet();
  }

  /** A kijelölés összesítője. head: „2 csomag kijelölve” / „Mind a 9 csomag”; text: „2 csomag · 38 tétel”. */
  function selectionSummary() {
    const sel = selected();
    const n = selectedItems().length;
    const all = allMode();
    const head = all ? `Mind a ${app.lists.length} csomag` : `${sel.length} csomag kijelölve`;
    const text = sel.length ? `${all ? head : `${sel.length} csomag`} · ${n} kártya` : 'Nincs kijelölt csomag';
    return { k: sel.length, n, head, text, names: sel.map((l) => l.name).join(', ') };
  }

  /* ---------- telefonos csomagválasztó lap (4.1) ---------- */
  function renderListsSheet() {
    syncSwitches();
    rebuild(el.listsRows, listsKey(), () => app.lists.map((l) => checkRow(l, 'ls-row', 'ls-name')));
    syncChecks(el.listsRows);
    el.listsRows.classList.toggle('all', allMode());
    const sum = selectionSummary();
    el.listsCount.textContent = sum.head;
    el.listsNone.hidden = allMode() || !sum.k;
    el.listsSum.textContent = sum.k ? `${sum.n} kártya` : 'Jelölj ki legalább egy csomagot.';
  }
  function openLists() {
    renderListsSheet();
    // a görgetési helyzet megmarad, ha egy pipálás újrarajzolja a sorokat
    el.dlgLists.showModal();
  }

  const SVG = 'http://www.w3.org/2000/svg';
  /** A pipa ikon (a sor jelölőnégyzetében). */
  function tick() {
    const svg = document.createElementNS(SVG, 'svg'); svg.setAttribute('viewBox', '0 0 24 24');
    const path = document.createElementNS(SVG, 'path'); path.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
    svg.append(path); return svg;
  }

  const chipBox = (items) => {
    const d = document.createElement('div'); d.className = 'chips';
    const marks = selMarks();
    d.append(...items.map((t) => itemSpan(t, marks.get(t), 'chip')));
    return d;
  };
  /** A kijelölt csomagok tételei csomagonként (asztali előnézet és a kinyitott telefonos előnézet). */
  // D-3: csak a szűrés utáni tételek; a szűrés után üres csomag nem látszik
  const groups = (sel) => sel.filter((x) => shownItems(x).length).map((x) => {
    const g = document.createElement('section'); g.className = 'group';
    const h = document.createElement('div'); h.className = 'ed-head';
    const h3 = document.createElement('h3'); h3.textContent = x.name;
    const n = document.createElement('span'); n.className = 'muted num'; n.textContent = `${shownItems(x).length} kártya`;
    h.append(h3, n);
    g.append(h, chipBox(shownItems(x)));
    return g;
  });
  const EMPTY_FILTER = 'A szűrő minden kártyát kizárt. Kapcsolj be legalább egy típust.';

  /** Előnézet (3.2): „Ezekkel játszotok”, a kijelölt csomagok tételei csomagonként. */
  function renderList() {
    const sel = selected();
    const none = sel.length > 0 && !selectedItems().length && selectedItemsAll().length > 0;   // SZR-7
    el.listView.hidden = !sel.length || none;
    el.listEmpty.hidden = !!sel.length && !none;
    el.listCount.textContent = sel.length ? countText(selectedItems().length, selectedItemsAll().length, sel.length) : '';
    if (none) {
      el.listEmpty.classList.add('dashed');
      el.listEmptyText.textContent = EMPTY_FILTER;
    } else if (!sel.length) {
      const none = app.lists.length && app.listsState !== 'loading';
      el.listEmpty.classList.toggle('dashed', !!none);
      el.listEmptyText.textContent = app.listsState === 'loading' && !app.lists.length
        ? 'Csomagok töltődnek…'
        : (app.lists.length ? 'Jelölj ki legalább egy csomagot bal oldalt.' : (app.loadError || 'Még nincs csomag.'));
    } else {
      // a tétel-kártyák (akár több száz) csak a kijelölt csomagok tartalmának változásakor épülnek újra
      rebuild(el.listBody, previewKey(sel), () => groups(sel));
    }
    renderPhonePreview(sel);
  }
  const previewKey = (sel) => glyphVer + SEP2 + off().join() + SEP2 + marksKey(selMarks()) + SEP2 + sel.map((x) => x.name + SEP + x.items.join(SEP)).join(SEP2);

  /* Telefonos előnézet (4.1): kis kártyák két sorban, a többi levágva; „Mind a {k} tétel megtekintése”
     helyben kinyitja (csomagonként), „Kevesebb” becsukja. Nem nyitja meg a lapot. */
  let pvOpen = false;
  const PV_MAX = 80;                // összecsukva ennyinél több kártya úgysem látszik két sorban
  function renderPhonePreview(sel = selected()) {
    const items = selectedItems();
    el.phonePreview.classList.toggle('open', pvOpen);
    el.pvMore.hidden = !items.length;
    el.pvMore.textContent = pvOpen ? 'Kevesebb' : `Mind a ${items.length} kártya megtekintése`;
    el.pvMore.setAttribute('aria-expanded', String(pvOpen));
    const key = (pvOpen ? 'o' : 'c') + SEP2 + previewKey(sel);
    rebuild(el.pvBody, key, () => {
      if (!items.length) {
        const p = document.createElement('p'); p.className = 'pv-empty muted';
        p.textContent = selectedItemsAll().length ? EMPTY_FILTER : 'Jelölj ki legalább egy csomagot.';
        return [p];
      }
      return pvOpen ? groups(sel) : [chipBox(items.slice(0, PV_MAX))];
    });
  }
  el.pvMore.addEventListener('click', () => { pvOpen = !pvOpen; renderPhonePreview(); });

  function renderSource() {
    const t = app.fetchedAt ? new Date(app.fetchedAt) : null;
    const today = t && t.toDateString() === new Date().toDateString();
    const when = t
      ? (today ? t.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
               : t.toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
      : '';
    el.sourceInfo.textContent =
      app.listsState === 'loading' ? 'Csomagok frissítése…'
      : app.listsState === 'ok' ? `Frissítve: ${when}`
      : t ? `Nincs kapcsolat · utoljára frissítve: ${when}` : '';
    el.refreshBtn.disabled = app.listsState === 'loading';
    // F-L13: diszkrét jelzés, ha a csomagok a tartalék lists.txt-ből jöttek
    const fb = app.kind === 'txt';
    el.fallbackInfo.hidden = !fb;
    if (fb) el.fallbackWhy.textContent = app.fallback || 'A táblázat a legutóbbi letöltéskor nem volt elérhető.';
  }

  function renderSettings() {
    const s = app.settings;
    el.flashIn.value = s.flashMs / 1000;
    el.flashOut.textContent = flashLabel(s.flashMs);
    for (const r of el.gapOpts.querySelectorAll('input')) r.checked = +r.value === s.gapMs;
    el.countIn.value = s.count;
    el.mixedIn.checked = s.mixed;
    renderEstimate();
  }

  function renderEstimate() {
    if (findMode()) {
      // a becslés a kör tényleges kártyaszámát mutatja (telefonon legfeljebb 6, F-K10)
      const [tasks, cards] = findEstimate({ ...app.find, cards: phoneCards(app.find.cards) }).split(' · ');
      el.estCount.textContent = tasks; el.estTime.textContent = cards;
      return;
    }
    const e = estimate(app.settings);
    el.estCount.textContent = e.count;
    el.estTime.textContent = e.time;
  }
  /** SZR-7: üres szűrőnél a becslés helyén ez áll (mindkét játéknál). */
  function renderEstimateEmpty(empty) {
    el.estimate.classList.toggle('empty', empty);
    if (empty) { el.estCount.textContent = 'Nincs kártya a szűrőben'; el.estTime.textContent = ''; }
  }

  /* ---------- játékfülek és a Keresd meg! beállításai (U-A8) ---------- */
  function renderMode() {
    const find = findMode();
    const ok = app.pairs.state !== 'failed';
    el.tabRead.setAttribute('aria-selected', String(!find));
    el.tabFind.setAttribute('aria-selected', String(find));
    el.tabRead.tabIndex = find ? -1 : 0;
    el.tabFind.tabIndex = find && ok ? 0 : -1;
    // hibás vagy betölthetetlen parok.json: a fül inaktív, a Felolvasás érintetlen
    if (ok) el.tabFind.removeAttribute('aria-disabled'); else el.tabFind.setAttribute('aria-disabled', 'true');
    el.tabFind.title = ok ? 'Keresd meg!' : 'A Keresd meg! most nem érhető el.';
    el.findSoon.hidden = ok;
    if (ok) el.tabFind.removeAttribute('aria-describedby'); else el.tabFind.setAttribute('aria-describedby', 'findSoon');
    el.panelRead.hidden = find;
    el.panelFind.hidden = !find;
    el.modeDesc.textContent = DESC[app.mode];
    el.howH.textContent = HOW_TITLE[app.mode];
    el.howRead.hidden = find;
    el.howFind.hidden = !find;
  }

  function renderFind() {
    const f = app.find;
    // F-K10: telefonon a 8 szürke és nem választható; a tárolt beállítás nem változik
    const phone = phoneCards(8) < 8;
    el.cardsLegend.textContent = phone ? `Kártyák a képernyőn · telefonon max. ${PHONE_MAX_CARDS}` : 'Kártyák a képernyőn';
    for (const r of el.cardOpts.querySelectorAll('input')) {
      const n = +r.value, off = phone && n > PHONE_MAX_CARDS;
      r.checked = n === phoneCards(f.cards);
      if (off) r.setAttribute('aria-disabled', 'true'); else r.removeAttribute('aria-disabled');
      r.closest('label').classList.toggle('off', off);
    }
    el.tasksIn.value = f.tasks;
    el.levelIn.value = f.level;
    el.levelOut.textContent = `${f.level} · ${LEVEL_LABELS[f.level]}`;
    el.levelIn.setAttribute('aria-valuetext', `${f.level}, ${LEVEL_LABELS[f.level]}`);
    renderSample();
  }

  /* Minta: egy lehetséges feladat kis kártyákon; beállítás-változásra és a „Másik minta” gombra frissül. */
  let sampleKey = '';
  // a készlet (páronkénti távolságok, O(n²)) csak a tételektől és a konfigurációtól függ: a nehézség
  // vagy a kártyaszám változásakor nem számolódik újra
  let poolMemo = { cc: null, key: null, pool: null };
  function renderSample(force = false) {
    const cc = app.pairs.cc;
    const items = roundItems();
    const n = phoneCards(app.find.cards);
    const itemsKey = items.join(SEP);
    const key = [cc ? 1 : 0, n, app.find.level, glyphVer, marksKey(roundMarks()), itemsKey].join('|');
    if (!force && key === sampleKey) return;
    sampleKey = key;
    if (!cc || !canFind(items)) { el.sampleBox.hidden = true; el.sample.replaceChildren(); return; }
    el.sampleBox.hidden = false;
    if (poolMemo.cc !== cc || poolMemo.key !== itemsKey) poolMemo = { cc, key: itemsKey, pool: createPool(items, cc) };
    const pool = poolMemo.pool;
    const g = buildGrid(pool, n, levelToDegree(app.find.level, cc.levels), Math.random);
    const marks = roundMarks();
    el.sample.replaceChildren(...g.items.map((t) => {
      const c = itemSpan(t, marks.get(t), 'sample-card'); c.title = t; return c;
    }));
  }

  function renderStart() {
    const st = startState();
    el.startBtn.disabled = !st.enabled;
    el.startBtn.textContent = st.label || 'Indítás';
    el.startMsg.textContent = st.msg || '';
    el.startMsg.className = 'start-msg' + (st.warn ? ' wrn' : '');
    el.panelStart.classList.toggle('has-msg', !!st.msg);
    renderEstimateEmpty(!!st.emptyFilter);
  }

  /* ---------- Megjelenés (docs/megjelenes-specifikacio.md, L-1, L-3, L-4, L-6, MI-1–MI-3; kartyak-oszlop ÖM-1–ÖM-8) ---------- */
  // a Megjelenés sor kinyitva; minden nézetben csukva indul, nem tárolódik, és a nézetváltás nem csukja be (ÖM-3)
  let lookOpen = false;
  /** A középső oszlop sorrendje (docs/kartyak-oszlop-specifikacio.md, FK-2, FK-4, FK-6): „Kártyák” cím + számláló,
   *  Megjelenés, tapadó rész (mondat, szűrő). Asztalon a cím és a Megjelenés az oszlop elején, a tapadó rész az előnézet
   *  tetején (hogy a lista tetejére tapadjon); keskeny nézetben mind a csomagválasztó (és a telefonos csomag gomb) után. */
  function placeCards() {
    if (NARROW.matches) {
      if (el.listsBtn.nextElementSibling !== el.cardsHead) el.listsBtn.after(el.cardsHead);
      if (el.cardsHead.nextElementSibling !== el.look) el.cardsHead.after(el.look);
      if (el.look.nextElementSibling !== el.playHead) el.look.after(el.playHead);
    } else {
      if (el.edInner.firstElementChild !== el.cardsHead) el.edInner.prepend(el.cardsHead);
      if (el.cardsHead.nextElementSibling !== el.look) el.cardsHead.after(el.look);
      if (el.previewOnly.firstElementChild !== el.playHead) el.previewOnly.prepend(el.playHead);
    }
  }
  function renderLook() {
    const look = app.look;
    for (const r of el.look.querySelectorAll('input[name=lookColor]')) r.checked = r.value === look.color;
    for (const r of el.look.querySelectorAll('input[name=lookMark]')) r.checked = r.value === look.mark;
    el.lookLegend.hidden = look.color !== 'sound';
    el.lookTip.hidden = !(look.color === 'sound' && look.mark === 'outline');
    el.lookRowSum.textContent = lookSummary(look);
    el.look.classList.toggle('open', lookOpen);
    el.lookRow.setAttribute('aria-expanded', String(lookOpen));
    // MI-1–MI-3: a kijelölt csomagok tételeiből, típusonként az első; tétel nélkül a sor nem látszik
    const items = selectedItems(), marks = selMarks();
    const sample = sampleItems(items, marks);
    el.lookSampleL.hidden = el.lookSample.hidden = !sample.length;
    rebuild(el.lookSample, glyphVer + SEP2 + marksKey(marks) + SEP2 + sample.join(SEP), () => sample.map((t) => itemSpan(t, marks.get(t), 'look-card')));
    const mini = miniSample(items, marks);
    rebuild(el.lookMini, glyphVer + SEP2 + mini + SEP + (marks.get(mini) || []).map((r) => r.start).join(), () => [fillHtml(document.createElement('span'), mini, marks.get(mini))]);
  }

  /* ---------- Tételszűrő (SZR-1–SZR-8, L-2–L-5) ---------- */
  let subOpen = null;               // a nyitott altípus-lista chipjének azonosítója
  const caretSvg = () => {
    const svg = document.createElementNS(SVG, 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('icon');
    const path = document.createElementNS(SVG, 'path'); path.setAttribute('d', 'M6 9l6 6 6-6');
    svg.append(path); return svg;
  };
  function renderFilter() {
    const model = chipModel(typeCounts(selectedItemsAll()), off());
    el.typeFilter.hidden = !model.length;
    el.tfNote.hidden = !model.length;
    // a chipek szerkezete (melyik chip, van-e ▾) csak a csomagok változásakor épül újra; az állapot helyben frissül,
    // így koppintás után a fókusz a gombon marad
    rebuild(el.tfRow, model.map((c) => c.id + (c.hasSub ? '▾' : '')).join(), () => model.map((c) => {
      const wrap = document.createElement('span'); wrap.className = 'tf-chip'; wrap.dataset.id = c.id;
      const main = document.createElement('button'); main.type = 'button'; main.className = 'tf-main';
      const tickBox = document.createElement('span'); tickBox.className = 'tf-tick'; tickBox.setAttribute('aria-hidden', 'true'); tickBox.append(tick());
      const label = document.createElement('span'); label.className = 'tf-label';
      const n = document.createElement('span'); n.className = 'tf-n num';
      main.append(tickBox, label, n);
      main.addEventListener('click', () => {
        const cur = chipModel(typeCounts(selectedItemsAll()), off()).find((x) => x.id === c.id);
        if (cur) act.typeFilter(toggleChip(off(), cur));
      });
      wrap.append(main);
      if (c.hasSub) {
        const caret = document.createElement('button'); caret.type = 'button'; caret.className = 'tf-caret';
        caret.setAttribute('aria-label', `${c.name} részletei`);
        caret.setAttribute('aria-controls', 'tfPop');
        caret.append(caretSvg());
        caret.addEventListener('click', () => { subOpen = subOpen === c.id ? null : c.id; renderFilter(); });
        wrap.append(caret);
      }
      return wrap;
    }));
    for (const c of model) {
      const wrap = el.tfRow.querySelector(`.tf-chip[data-id="${c.id}"]`);
      wrap.dataset.state = c.state;
      const main = wrap.querySelector('.tf-main');
      main.setAttribute('aria-pressed', c.state === 'on' ? 'true' : c.state === 'part' ? 'mixed' : 'false');
      main.querySelector('.tf-label').textContent = c.label;
      main.querySelector('.tf-n').textContent = c.n;
      wrap.querySelector('.tf-caret')?.setAttribute('aria-expanded', String(subOpen === c.id));
    }
    renderSubs(model.find((c) => c.id === subOpen && c.hasSub));
  }
  /** Az altípusok listája (SZR-2, L-5): asztalon a chip alatt, telefonon lebegő lista sötétített háttérrel. */
  function renderSubs(c) {
    if (!c) subOpen = null;
    el.tfPop.hidden = !c;
    el.tfBackdrop.hidden = !c || !PHONE.matches;
    // bezáráskor a tartalom és a rebuild kulcsa is törlődik, különben újranyitáskor üres maradna a lista
    if (!c) { el.tfPop.replaceChildren(); built.delete(el.tfPop); return; }
    rebuild(el.tfPop, c.id + SEP + c.subs.map((s) => s.key).join(), () => {
      const h = document.createElement('p'); h.className = 'tf-pop-head'; h.textContent = `${c.name} részletei`;
      return [h, ...c.subs.map((s) => {
        const lab = document.createElement('label'); lab.className = 'tf-sub'; lab.dataset.key = s.key;
        const box = document.createElement('input'); box.type = 'checkbox';
        const t = document.createElement('span'); t.className = 'tf-sub-label'; t.textContent = s.label;
        const n = document.createElement('span'); n.className = 'tf-n num';
        box.addEventListener('change', () => act.typeFilter(toggleSub(off(), s.key)));
        lab.append(box, t, n); return lab;
      })];
    });
    el.tfPop.setAttribute('aria-label', `${c.name} részletei`);
    for (const s of c.subs) {
      const lab = el.tfPop.querySelector(`.tf-sub[data-key="${s.key}"]`);
      lab.querySelector('input').checked = s.on;
      lab.querySelector('.tf-n').textContent = s.n;
    }
    // helyzet: a ▾ alatt (asztal, tablet); telefonon a chipsor alatt, teljes szélességben (css)
    const caret = el.tfRow.querySelector(`.tf-chip[data-id="${c.id}"] .tf-caret`);
    const box = el.typeFilter.getBoundingClientRect(), chip = caret.closest('.tf-chip').getBoundingClientRect();
    el.tfPop.style.setProperty('--pop-left', `${Math.max(0, Math.round(chip.left - box.left))}px`);
    el.tfPop.style.setProperty('--pop-top', `${Math.round(chip.bottom - box.top + 6)}px`);
    // telefon: lebegő lista a chipsor szélességében (fekvőben a bal oszlopban), alatta; ha ott nem fér el, fölötte
    if (PHONE.matches) {
      const h = el.tfPop.offsetHeight;
      let top = chip.bottom + 6;
      if (top + h > innerHeight - 8) top = Math.max(8, chip.top - 6 - h);
      el.tfPop.style.setProperty('--pop-fixed', `${Math.round(top)}px`);
      el.tfPop.style.setProperty('--pop-x', `${Math.round(box.left)}px`);
      el.tfPop.style.setProperty('--pop-w', `${Math.round(box.width)}px`);
    }
  }
  function closeSubs(focusCaret = false) {
    if (!subOpen) return;
    const id = subOpen;
    subOpen = null;
    renderFilter();
    if (focusCaret) el.tfRow.querySelector(`.tf-chip[data-id="${id}"] .tf-caret`)?.focus();
  }

  function render(force = false) {
    if (force) glyphVer++;
    placeCards(); renderLook(); renderFilter();
    renderWarnings(); renderNav(); renderList(); renderSource(); renderMode(); renderSettings();
    if (findMode()) renderFind();
    renderStart();
  }

  /* ---------- események ---------- */
  el.gapOpts.replaceChildren(...GAPS.map((g) => {
    const lab = document.createElement('label');
    const r = document.createElement('input'); r.type = 'radio'; r.name = 'gap'; r.value = g; r.id = 'gap' + g;
    const s = document.createElement('span'); s.textContent = fmtNum(g / 1000);
    lab.append(r, s);
    r.addEventListener('change', () => { if (r.checked) act.setting({ gapMs: g }); });
    return lab;
  }));
  el.flashIn.addEventListener('input', () => {
    app.settings.flashMs = Math.round(+el.flashIn.value * 2) * 500;
    el.flashOut.textContent = flashLabel(app.settings.flashMs); renderEstimate();
  });
  el.flashIn.addEventListener('change', () => act.setting({ flashMs: app.settings.flashMs }));
  // Kijelölt csomagok | Összes csomag (3.1): mindhárom kapcsoló ugyanazt a beállítást váltja (settings.source)
  for (const r of document.querySelectorAll('.src-switch input')) r.addEventListener('change', () => { if (r.checked) act.setting({ source: r.value }); });
  const setCount = (v) => act.setting({ count: numOr(v, app.settings.count) });
  el.countIn.addEventListener('change', () => setCount(el.countIn.value));
  el.countIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setCount(el.countIn.value); } });
  el.countDec.addEventListener('click', () => setCount(app.settings.count - 1));
  el.countInc.addEventListener('click', () => setCount(app.settings.count + 1));
  el.mixedIn.addEventListener('change', () => act.setting({ mixed: el.mixedIn.checked }));
  el.refreshBtn.addEventListener('click', act.refresh);
  for (const r of el.look.querySelectorAll('input[name=lookColor]')) r.addEventListener('change', () => { if (r.checked) act.look({ color: r.value }); });
  for (const r of el.look.querySelectorAll('input[name=lookMark]')) r.addEventListener('change', () => { if (r.checked) act.look({ mark: r.value }); });
  el.lookRow.addEventListener('click', () => { lookOpen = !lookOpen; renderLook(); });
  NARROW.addEventListener('change', placeCards);
  PHONE.addEventListener('change', () => closeSubs());
  // az altípus-lista: kívülre koppintás vagy Esc zárja (L-5)
  document.addEventListener('pointerdown', (e) => {
    if (subOpen && !el.tfPop.contains(e.target) && !e.target.closest?.('.tf-caret')) closeSubs();
  }, true);
  el.tfPop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSubs(true); } });
  el.tfRow.addEventListener('keydown', (e) => { if (e.key === 'Escape' && subOpen) { e.preventDefault(); e.stopPropagation(); closeSubs(true); } });
  // a chipsor görgetésekor (telefon) és átméretezéskor a lista a helyén marad
  el.tfRow.addEventListener('scroll', () => { if (subOpen) renderFilter(); }, { passive: true });
  addEventListener('resize', () => { if (subOpen) renderFilter(); });
  el.modKey.textContent = MOD;

  /* ---------- módfülek (4.1): Felolvasás · Keresd meg! ---------- */
  const pick = (m) => {
    if (m === 'find' && app.pairs.state === 'failed') return;
    if (m !== app.mode) { closeHow(false); act.mode(m); }
  };
  el.tabRead.addEventListener('click', () => pick('read'));
  el.tabFind.addEventListener('click', () => pick('find'));
  // nyilakkal a fülek között (WAI-ARIA tabs); az inaktív fül kimarad
  el.modeTabs.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const to = e.key === 'Home' || (e.key === 'ArrowLeft') ? 'read' : 'find';
    pick(to);
    (app.mode === 'find' ? el.tabFind : el.tabRead).focus();
  });

  /* Keresd meg! beállítások */
  el.cardOpts.replaceChildren(...CARDS.map((n) => {
    const lab = document.createElement('label');
    const r = document.createElement('input'); r.type = 'radio'; r.name = 'cards'; r.value = n; r.id = 'cards' + n;
    const sp = document.createElement('span'); sp.textContent = n;
    lab.append(r, sp);
    r.addEventListener('change', () => {
      if (!r.checked) return;
      if (r.getAttribute('aria-disabled') === 'true') { renderFind(); return; }
      act.find({ cards: n });
    });
    return lab;
  }));
  const setTasks = (v) => act.find({ tasks: numOr(v, app.find.tasks) });
  el.tasksIn.addEventListener('change', () => setTasks(el.tasksIn.value));
  el.tasksIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setTasks(el.tasksIn.value); } });
  el.tasksDec.addEventListener('click', () => setTasks(app.find.tasks - 1));
  el.tasksInc.addEventListener('click', () => setTasks(app.find.tasks + 1));
  el.levelIn.addEventListener('input', () => {
    const l = +el.levelIn.value;
    el.levelOut.textContent = `${l} · ${LEVEL_LABELS[l]}`;
  });
  el.levelIn.addEventListener('change', () => act.find({ level: +el.levelIn.value }));
  el.sampleBtn.addEventListener('click', () => renderSample(true));
  // forgatás / átméretezés: a telefonos korlát (F-K10) a becslésben, a kártyaszámban és a mintában
  let phoneNow = phoneCards(8) < 8;
  addEventListener('resize', () => {
    const p = phoneCards(8) < 8;
    if (p !== phoneNow) { phoneNow = p; if (findMode()) { renderFind(); renderEstimate(); } }
  });

  /* Ha bármelyik fül tartalma (ikon, név, „Nem elérhető”) nem fér el a keretben, mindkét fülön csak
     az ikon marad, a kerethez méretezve (css: .mode-tabs.icon-only). A név a felolvasóé és a title-é marad.
     Méréskor a teljes tartalommal mérünk, így szélesedéskor a felirat visszajön. */
  const tabs = [el.tabRead, el.tabFind];
  const overflows = (box, c) => {
    const b = box.getBoundingClientRect(), r = c.getBoundingClientRect(), bw = box.clientLeft;
    return r.width > 0 && (r.left < b.left + bw - 0.5 || r.right > b.right - bw + 0.5 || r.top < b.top + bw - 0.5 || r.bottom > b.bottom - bw + 0.5);
  };
  function fitTabs() {
    el.modeTabs.classList.remove('icon-only');
    const over = tabs.some((t) => t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1
      || [...t.querySelectorAll('.mode-icon, .mode-name, .mode-soon')].some((c) => overflows(t, c) || c.scrollWidth > c.clientWidth + 1 || c.scrollHeight > c.clientHeight + 1));
    el.modeTabs.classList.toggle('icon-only', over);
  }
  if ('ResizeObserver' in window) new ResizeObserver(fitTabs).observe(el.modeTabs);
  document.fonts?.ready.then(fitTabs);
  fitTabs();

  /* ---------- „Így játsszátok” (6.) ---------- */
  let howReturn = false;            // bezáráskor vissza a fókusz a súgógombra
  function openHow() {
    howReturn = true;
    el.howBtn.setAttribute('aria-expanded', 'true');
    if (SHEET.matches) { el.howPop.showModal(); el.howClose.focus(); return; }
    // a popover a súgógomb magasságában, a panel bal széléhez tapadva
    const top = el.howBtn.getBoundingClientRect().top - el.panel.getBoundingClientRect().top - 8;
    el.howPop.style.setProperty('--how-top', `${Math.max(8, Math.round(top))}px`);
    el.howPop.show();
    el.howClose.focus();
  }
  // A 'close' esemény aszinkron; a saját bezárásunk ezért azonnal rendezi az állapotot és a fókuszt,
  // az esemény csak a böngésző által zárt alsó lapot (Esc) kezeli.
  function howClosed() {
    el.howBtn.setAttribute('aria-expanded', 'false');
    if (howReturn) el.howBtn.focus();
    howReturn = false;
  }
  function closeHow(returnFocus = true) {
    if (!el.howPop.open) return;
    howReturn = returnFocus;
    el.howPop.close();
    howClosed();
  }
  el.howPop.addEventListener('close', howClosed);
  el.howBtn.addEventListener('click', () => (el.howPop.open ? closeHow() : openHow()));
  el.howClose.addEventListener('click', () => closeHow());
  el.howOk.addEventListener('click', () => closeHow());
  // alsó lapnál a háttérre koppintás zár (a lap tartalma a .how-body-ban van)
  el.howPop.addEventListener('click', (e) => { if (e.target === el.howPop) closeHow(); });
  // popovernél a kívülre kattintás zár (a fókusz ott marad, ahová kattintottak)
  document.addEventListener('pointerdown', (e) => {
    if (el.howPop.open && !el.howPop.matches(':modal') && !el.howPop.contains(e.target) && !el.howBtn.contains(e.target)) closeHow(false);
  }, true);
  SHEET.addEventListener('change', () => closeHow(false));

  /* ---------- csomagsorok az oldalsávban (3.1) ----------
     Kattintás: a sor pipáját váltja; Shift + kattintás: tartomány az előző kattintott sortól. Egérrel (és
     tollal) végighúzva a lenyomott sor új állapotát kapja minden sor, amelyen az egér áthalad; felengedéskor
     vagy az oszlopból kilépve vége. Érintésnél a végighúzás görget, a koppintás vált (a click). A billentyűzet
     (Tab, Szóköz) a gomb natív click eseményét adja (detail = 0). */
  const rowAt = (x, y) => document.elementFromPoint(x, y)?.closest('#listNav .nav-item') || null;
  let drag = null;                  // { on, id } egérrel végighúzás közben
  let mouseDown = -Infinity;        // az utolsó egeres lenyomás ideje: az utána jövő click már kezelve van
  el.listNav.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.nav-item');
    if (!b || e.button !== 0 || (e.pointerType !== 'mouse' && e.pointerType !== 'pen')) return;
    e.preventDefault();             // ne jelöljön ki szöveget; a fókusz kézzel kerül a sorra
    if (b.hasPointerCapture?.(e.pointerId)) b.releasePointerCapture(e.pointerId);   // toll: implicit elfogás
    mouseDown = performance.now();
    const on = act.select(b.dataset.name, { range: e.shiftKey });
    el.listNav.querySelector(`.nav-item[data-name="${CSS.escape(b.dataset.name)}"]`)?.focus({ preventScroll: true });
    drag = { on, id: e.pointerId };
    document.addEventListener('pointermove', dragMove, true);
    document.addEventListener('pointerup', dragEnd, true);
    document.addEventListener('pointercancel', dragEnd, true);
  });
  function dragMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const r = el.sidebar.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom || !e.buttons) { dragEnd(); return; }
    const b = rowAt(e.clientX, e.clientY);
    if (b) act.paint(b.dataset.name, drag.on);
  }
  function dragEnd() {
    drag = null;
    document.removeEventListener('pointermove', dragMove, true);
    document.removeEventListener('pointerup', dragEnd, true);
    document.removeEventListener('pointercancel', dragEnd, true);
  }
  el.listNav.addEventListener('click', (e) => {
    const b = e.target.closest('.nav-item');
    if (!b) return;
    // egérrel a lenyomás már váltott; a billentyűzet (detail = 0) és az érintés itt vált
    if (e.detail > 0 && performance.now() - mouseDown < 3000) { mouseDown = -Infinity; return; }
    act.select(b.dataset.name, { range: e.shiftKey && e.detail > 0 });
  });
  el.navNone.addEventListener('click', () => act.selectNone());

  /* ---------- telefonos csomagválasztó lap ---------- */
  el.listsBtn.addEventListener('click', openLists);
  el.listsDone.addEventListener('click', () => el.dlgLists.close());
  el.dlgLists.addEventListener('click', (e) => { if (e.target === el.dlgLists) el.dlgLists.close(); });
  el.dlgLists.addEventListener('close', () => el.listsBtn.focus());
  el.listsNone.addEventListener('click', () => act.selectNone());

  /** Esc: először a nyitott popover zár (a modális lapokat a böngésző zárja). */
  function key(e) {
    if (e.key === 'Escape' && el.howPop.open && !el.howPop.matches(':modal')) {
      e.preventDefault(); closeHow(); return true;
    }
    return false;
  }
  el.startBtn.addEventListener('click', (e) => act.start(e));
  el.fontBtn.addEventListener('click', act.fontTest);

  return { render, roundItems, roundMarks, roundFiltered, key, closeHow: () => closeHow(false), canStart: () => startState().enabled };
}
