// Szülői felület: a listák csak olvashatók; forrásuk a Google táblázat, tartalékként a repó lists.txt-je.

import { GAPS, estimate, fmtNum, CARDS, LEVEL_LABELS, findEstimate, levelToDegree } from '../core/settings.js';
import { nameKey } from '../core/items.js';
import { itemsOf } from '../core/selection.js';
import { distinctCount, effectiveCards, PHONE_MAX_CARDS } from '../core/find.js';
import { createPool, buildGrid } from '../core/grid.js';

const MOD = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
// érintős elsődleges mutató: az oldalsávban koppintás = hozzáad/elvesz (Ctrl nélkül)
const COARSE = matchMedia('(hover:none) and (pointer:coarse)');
// a súgó itt alsó lap (modális), máshol a panel melletti popover (design spec 6.)
const SHEET = matchMedia('(max-width:899px), (hover:none) and (pointer:coarse), (max-height:500px) and (orientation:landscape)');
const flashLabel = (ms) => (ms === 0 ? 'kézi' : `${fmtNum(ms / 1000)} mp`);
const DESC = {
  read: 'A gyerek hangosan felolvassa a felvillanó tételt, te figyeled a kiejtést.',
  find: 'Te felolvasod az egyiket, a gyerek megmutatja a képernyőn.',
};
const HOW_TITLE = { read: 'Felolvasás – így játsszátok', find: 'Keresd meg! – így játsszátok' };
/** F-K10: a nézet most telefon-e (a rövidebb oldal 500 px alatt). */
const phoneCards = (n) => effectiveCards(n, innerWidth, innerHeight);

const SEP = '\u0001', SEP2 = '\u0002';

export function createAdmin(el, app, act) {
  const dismissed = new Set();

  /* ---------- segédek ---------- */
  const isSel = (l) => app.selected.includes(nameKey(l.name));
  const selected = () => app.lists.filter(isSel);

  /* A tételek egy rendereléshez többször is kellenek; csak akkor számolódnak újra, ha a listák vagy a
     kijelölés megváltozott (mindkettő cserével változik, helyben soha). A visszaadott tömb nem módosítható. */
  let selMemo = { lists: null, selected: null, items: [] };
  let allMemo = { lists: null, items: [] };
  function selectedItems() {
    if (selMemo.lists !== app.lists || selMemo.selected !== app.selected) {
      selMemo = { lists: app.lists, selected: app.selected, items: itemsOf(app.lists, app.selected, nameKey) };
    }
    return selMemo.items;
  }
  function roundItems() {
    if (app.settings.source !== 'all') return selectedItems();
    if (allMemo.lists !== app.lists) allMemo = { lists: app.lists, items: [...new Set(app.lists.flatMap((l) => l.items))] };
    return allMemo.items;
  }

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
  /** A listák szerkezete (név, tételszám): ha ez nem változik, a listasáv elemei megmaradnak. */
  const listsKey = () => app.lists.map((l) => l.name + SEP + l.items.length).join(SEP2);

  /** Jelölőnégyzetes listasor (keskeny nézet és mobil lap). */
  function checkRow(l, rowClass, nameClass) {
    const lab = document.createElement('label'); lab.className = rowClass;
    const c = document.createElement('input'); c.type = 'checkbox';
    const name = document.createElement('span'); name.textContent = l.name;
    if (nameClass) name.className = nameClass;
    const cnt = document.createElement('span'); cnt.className = 'nav-count'; cnt.textContent = l.items.length;
    c.addEventListener('change', () => act.select(l.name, { toggle: true }));
    lab.append(c, name, cnt); return lab;
  }
  /** A jelölőnégyzetek állapota a kijelölésből (a sorok a listák sorrendjében vannak). */
  function syncChecks(box) {
    box.querySelectorAll('input[type=checkbox]').forEach((c, k) => { c.checked = isSel(app.lists[k]); });
  }

  const findMode = () => app.mode === 'find';

  function startState() {
    if (app.font.state === 'loading') return { enabled: false, label: 'Betűtípus töltődik…' };
    if (findMode() && app.pairs.state === 'loading') return { enabled: false, label: 'Töltődik…' };
    if (!app.lists.length) {
      return app.listsState === 'loading'
        ? { enabled: false, label: 'Listák töltődnek…' }
        : { enabled: false, msg: 'Nincs elérhető lista.' };
    }
    const all = app.settings.source === 'all';
    const k = all ? app.lists.length : selected().length;
    const n = roundItems().length;
    if (!n) {
      return { enabled: false, msg: all ? 'Egyik listában sincs tétel.' : k > 1 ? 'A kijelölt listákban nincs tétel.' : 'A listában nincs tétel.' };
    }
    // F-S8: a Keresd meg!-hez legalább két különböző tétel kell
    if (findMode() && distinctCount(roundItems()) < 2) return { enabled: false, msg: 'Legalább két különböző tétel kell.' };
    // a gomb alatt csak hiba vagy figyelmeztetés (a lista- és tételszámot a fejléc mutatja)
    const fontWarn = app.font.state === 'failed';
    return { enabled: true, msg: fontWarn ? 'A betűk alakja eltérhet.' : '', warn: fontWarn };
  }

  /* ---------- renderelés ---------- */
  function renderWarnings() {
    const w = [];
    if (!app.storageOK) w.push(['storage', 'A beállítások nem maradnak meg bezárás után, és hálózat nélkül nem lesz lista.']);
    if (app.font.state === 'failed') w.push(['font', 'A gyakorló betűtípus nem töltődött be – a betűk alakja eltérhet.']);
    if (app.loadError && app.lists.length) w.push(['stale', `${app.loadError} A legutóbb letöltött listák látszanak.`]);
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

  function renderNav() {
    const lk = listsKey();
    rebuild(el.listNav, lk, () => app.lists.map((l) => {
      const li = document.createElement('li');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'nav-item';
      const name = document.createElement('span'); name.textContent = l.name;
      const cnt = document.createElement('span'); cnt.className = 'nav-count'; cnt.textContent = l.items.length;
      b.append(name, cnt);
      b.addEventListener('click', (e) => {
        const touch = e.pointerType === 'touch' || e.pointerType === 'pen' || (COARSE.matches && e.pointerType !== 'mouse');
        act.select(l.name, { toggle: e.ctrlKey || e.metaKey || (touch && !e.shiftKey), range: e.shiftKey });
      });
      li.append(b); return li;
    }));
    el.listNav.querySelectorAll('.nav-item').forEach((b, k) => {
      const sel = isSel(app.lists[k]);
      b.classList.toggle('sel', sel);
      b.setAttribute('aria-pressed', String(sel));
    });
    el.navHint.textContent = COARSE.matches ? 'Koppintással több listát is kijelölhetsz.'
      : `${MOD}+kattintás: több lista · Shift+kattintás: tartomány`;
    el.navHint.hidden = app.lists.length < 2;

    // keskeny nézet: jelölőnégyzetek (érintőképernyőn nincs Ctrl)
    rebuild(el.listChecks, lk, () => app.lists.map((l) => checkRow(l, 'pick')));
    syncChecks(el.listChecks);
    el.picker.hidden = !app.lists.length;
    const sum = selectionSummary();
    el.pickSum.textContent = sum.text;
    el.listsBtnLabel.textContent = sum.n ? `Listák · ${sum.n} tétel` : 'Listák';
    el.listsBtnNames.textContent = sum.names || 'Nincs kijelölt lista';
    if (el.dlgLists.open) renderListsSheet();
  }

  /** A kijelölés összesítője: „2 lista · 38 tétel”, a nevek „·”-tal. */
  function selectionSummary() {
    const sel = selected();
    const n = selectedItems().length;
    const text = sel.length ? `${sel.length} lista · ${n} tétel` : 'Nincs kijelölt lista';
    return { k: sel.length, n, text, names: sel.map((l) => l.name).join(' · ') };
  }

  /* ---------- mobil listaválasztó lap (E11) ---------- */
  function renderListsSheet() {
    rebuild(el.listsRows, listsKey(), () => app.lists.map((l) => checkRow(l, 'ls-row', 'ls-name')));
    syncChecks(el.listsRows);
    const sum = selectionSummary();
    el.listsSum.textContent = sum.k ? `${sum.k} lista / ${sum.n} tétel` : 'Nincs kijelölt lista';
  }
  function openLists() {
    renderListsSheet();
    // a görgetési helyzet megmarad, ha egy pipálás újrarajzolja a sorokat
    el.dlgLists.showModal();
  }

  const chipBox = (items) => {
    const d = document.createElement('div'); d.className = 'chips';
    d.append(...items.map((t) => {
      const c = document.createElement('span'); c.className = 'chip'; c.textContent = t; return c;
    }));
    return d;
  };

  function renderList() {
    const sel = selected();
    const l = sel[0];
    el.listView.hidden = !l;
    el.listEmpty.hidden = !!l;
    if (!l) {
      el.listEmptyText.textContent = app.listsState === 'loading'
        ? 'Listák töltődnek…'
        : (app.loadError || 'Még nincs lista.');
      return;
    }
    // a tétel-kártyák (akár több száz) csak a kijelölt listák tartalmának változásakor épülnek újra
    const key = sel.map((x) => x.name + SEP + x.items.join(SEP)).join(SEP2);
    if (sel.length === 1) {
      el.listName.textContent = l.name;
      el.listCount.textContent = `${l.items.length} tétel`;
      rebuild(el.listBody, key, () => [chipBox(l.items)]);
      return;
    }
    el.listName.textContent = `${sel.length} lista kijelölve`;
    el.listCount.textContent = `${selectedItems().length} különböző tétel`;
    rebuild(el.listBody, key, () => sel.map((x) => {
      const g = document.createElement('section'); g.className = 'group';
      const h = document.createElement('div'); h.className = 'ed-head';
      const h3 = document.createElement('h3'); h3.textContent = x.name;
      const n = document.createElement('span'); n.className = 'muted num'; n.textContent = `${x.items.length} tétel`;
      h.append(h3, n);
      g.append(h, chipBox(x.items));
      return g;
    }));
  }

  function renderSource() {
    const t = app.fetchedAt ? new Date(app.fetchedAt) : null;
    const today = t && t.toDateString() === new Date().toDateString();
    const when = t
      ? (today ? t.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })
               : t.toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }))
      : '';
    el.sourceInfo.textContent =
      app.listsState === 'loading' ? 'Listák frissítése…'
      : app.listsState === 'ok' ? `Frissítve: ${when}`
      : t ? `Nincs kapcsolat – a ${when} állapot látszik` : '';
    el.refreshBtn.disabled = app.listsState === 'loading';
    // F-L13: diszkrét jelzés, ha a listák a tartalék lists.txt-ből jöttek
    const fb = app.kind === 'txt';
    el.fallbackInfo.hidden = !fb;
    if (fb) el.fallbackWhy.textContent = app.fallback || 'A táblázat a legutóbbi letöltéskor nem volt elérhető.';
  }

  function renderSettings() {
    const s = app.settings;
    el.flashIn.value = s.flashMs / 1000;
    el.flashOut.textContent = flashLabel(s.flashMs);
    for (const r of el.gapOpts.querySelectorAll('input')) r.checked = +r.value === s.gapMs;
    el.srcList.checked = s.source !== 'all';
    el.srcAll.checked = s.source === 'all';
    el.countIn.value = s.count;
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
    el.srcListF.checked = app.settings.source !== 'all';
    el.srcAllF.checked = app.settings.source === 'all';
    // F-K10: telefonon a 8 szürke és nem választható; a tárolt beállítás nem változik
    const phone = phoneCards(8) < 8;
    el.cardsLegend.textContent = phone ? `Kártyák · telefonon max. ${PHONE_MAX_CARDS}` : 'Kártyák';
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
    const key = [cc ? 1 : 0, n, app.find.level, itemsKey].join('|');
    if (!force && key === sampleKey) return;
    sampleKey = key;
    if (!cc || distinctCount(items) < 2) { el.sampleBox.hidden = true; el.sample.replaceChildren(); return; }
    el.sampleBox.hidden = false;
    if (poolMemo.cc !== cc || poolMemo.key !== itemsKey) poolMemo = { cc, key: itemsKey, pool: createPool(items, cc) };
    const pool = poolMemo.pool;
    const g = buildGrid(pool, n, levelToDegree(app.find.level, cc.levels), Math.random);
    el.sample.replaceChildren(...g.items.map((t) => {
      const c = document.createElement('span'); c.className = 'sample-card'; c.textContent = t; c.title = t; return c;
    }));
  }

  function renderStart() {
    const st = startState();
    el.startBtn.disabled = !st.enabled;
    el.startBtn.textContent = st.label || 'Indítás';
    el.startMsg.textContent = st.msg || '';
    el.startMsg.className = 'start-msg' + (st.warn ? ' wrn' : '');
    el.panelStart.classList.toggle('has-msg', !!st.msg);
  }

  function render() {
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
  for (const r of [el.srcList, el.srcAll]) r.addEventListener('change', () => { if (r.checked) act.setting({ source: r.value }); });
  const setCount = (v) => act.setting({ count: Number.isFinite(+v) && String(v).trim() !== '' ? +v : app.settings.count });
  el.countIn.addEventListener('change', () => setCount(el.countIn.value));
  el.countIn.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); setCount(el.countIn.value); } });
  el.countDec.addEventListener('click', () => setCount(app.settings.count - 1));
  el.countInc.addEventListener('click', () => setCount(app.settings.count + 1));
  el.refreshBtn.addEventListener('click', act.refresh);
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
  for (const r of [el.srcListF, el.srcAllF]) r.addEventListener('change', () => { if (r.checked) act.setting({ source: r.value }); });
  const setTasks = (v) => act.find({ tasks: Number.isFinite(+v) && String(v).trim() !== '' ? +v : app.find.tasks });
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

  /* ---------- mobil listaválasztó lap ---------- */
  el.listsBtn.addEventListener('click', openLists);
  el.listsDone.addEventListener('click', () => el.dlgLists.close());
  el.dlgLists.addEventListener('click', (e) => { if (e.target === el.dlgLists) el.dlgLists.close(); });
  el.dlgLists.addEventListener('close', () => el.listsBtn.focus());
  el.listsAll.addEventListener('click', () => act.selectAll(true));
  el.listsNone.addEventListener('click', () => act.selectAll(false));
  COARSE.addEventListener('change', () => renderNav());

  /** Esc: először a nyitott popover zár (a modális lapokat a böngésző zárja). */
  function key(e) {
    if (e.key === 'Escape' && el.howPop.open && !el.howPop.matches(':modal')) {
      e.preventDefault(); closeHow(); return true;
    }
    return false;
  }
  el.startBtn.addEventListener('click', (e) => act.start(e));
  el.fontBtn.addEventListener('click', act.fontTest);

  return { render, roundItems, key, closeHow: () => closeHow(false), canStart: () => startState().enabled };
}
