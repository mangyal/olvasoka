// Szülői felület: a listák csak olvashatók; forrásuk a Google táblázat, tartalékként a repó lists.txt-je.

import { GAPS, estimate, fmtNum } from '../core/settings.js';
import { nameKey } from '../core/items.js';
import { itemsOf } from '../core/selection.js';

const MOD = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';
// érintős elsődleges mutató: az oldalsávban koppintás = hozzáad/elvesz (Ctrl nélkül)
const COARSE = matchMedia('(hover:none) and (pointer:coarse)');
// a súgó itt alsó lap (modális), máshol a panel melletti popover (design spec 6.)
const SHEET = matchMedia('(max-width:899px), (hover:none) and (pointer:coarse), (max-height:500px) and (orientation:landscape)');
const flashLabel = (ms) => (ms === 0 ? 'kézi' : `${fmtNum(ms / 1000)} mp`);

export function createAdmin(el, app, act) {
  const dismissed = new Set();

  /* ---------- segédek ---------- */
  const isSel = (l) => app.selected.includes(nameKey(l.name));
  const selected = () => app.lists.filter(isSel);

  function roundItems() {
    if (app.settings.source === 'all') return [...new Set(app.lists.flatMap((l) => l.items))];
    return itemsOf(app.lists, app.selected, nameKey);
  }

  function startState() {
    if (app.font.state === 'loading') return { enabled: false, label: 'Betűtípus töltődik…' };
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
    el.warnings.replaceChildren(...w.filter(([id]) => !dismissed.has(id)).map(([id, text]) => {
      const d = document.createElement('div'); d.className = 'warn-item pad';
      const p = document.createElement('p'); p.textContent = text;
      const b = document.createElement('button'); b.type = 'button'; b.textContent = '×';
      b.setAttribute('aria-label', 'Figyelmeztetés bezárása');
      b.addEventListener('click', () => { dismissed.add(id); renderWarnings(); });
      d.append(p, b); return d;
    }));
  }

  function renderNav() {
    el.listNav.replaceChildren(...app.lists.map((l) => {
      const li = document.createElement('li');
      const b = document.createElement('button'); b.type = 'button';
      const sel = isSel(l);
      b.className = 'nav-item' + (sel ? ' sel' : '');
      b.setAttribute('aria-pressed', String(sel));
      const name = document.createElement('span'); name.textContent = l.name;
      const cnt = document.createElement('span'); cnt.className = 'nav-count'; cnt.textContent = l.items.length;
      b.append(name, cnt);
      b.addEventListener('click', (e) => {
        const touch = e.pointerType === 'touch' || e.pointerType === 'pen' || (COARSE.matches && e.pointerType !== 'mouse');
        act.select(l.name, { toggle: e.ctrlKey || e.metaKey || (touch && !e.shiftKey), range: e.shiftKey });
      });
      li.append(b); return li;
    }));
    el.navHint.textContent = COARSE.matches ? 'Koppintással több listát is kijelölhetsz.'
      : `${MOD}+kattintás: több lista · Shift+kattintás: tartomány`;
    el.navHint.hidden = app.lists.length < 2;

    // keskeny nézet: jelölőnégyzetek (érintőképernyőn nincs Ctrl)
    el.listChecks.replaceChildren(...app.lists.map((l) => {
      const lab = document.createElement('label'); lab.className = 'pick';
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = isSel(l);
      const name = document.createElement('span'); name.textContent = l.name;
      const cnt = document.createElement('span'); cnt.className = 'nav-count'; cnt.textContent = l.items.length;
      c.addEventListener('change', () => act.select(l.name, { toggle: true }));
      lab.append(c, name, cnt); return lab;
    }));
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
    const n = itemsOf(app.lists, app.selected, nameKey).length;
    const text = sel.length ? `${sel.length} lista · ${n} tétel` : 'Nincs kijelölt lista';
    return { k: sel.length, n, text, names: sel.map((l) => l.name).join(' · ') };
  }

  /* ---------- mobil listaválasztó lap (E11) ---------- */
  function renderListsSheet() {
    el.listsRows.replaceChildren(...app.lists.map((l) => {
      const lab = document.createElement('label'); lab.className = 'ls-row';
      const c = document.createElement('input'); c.type = 'checkbox'; c.checked = isSel(l);
      const name = document.createElement('span'); name.className = 'ls-name'; name.textContent = l.name;
      const cnt = document.createElement('span'); cnt.className = 'nav-count'; cnt.textContent = l.items.length;
      c.addEventListener('change', () => act.select(l.name, { toggle: true }));
      lab.append(c, name, cnt); return lab;
    }));
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
    if (sel.length === 1) {
      el.listName.textContent = l.name;
      el.listCount.textContent = `${l.items.length} tétel`;
      el.listBody.replaceChildren(chipBox(l.items));
      return;
    }
    el.listName.textContent = `${sel.length} lista kijelölve`;
    el.listCount.textContent = `${itemsOf(app.lists, app.selected, nameKey).length} különböző tétel`;
    el.listBody.replaceChildren(...sel.map((x) => {
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
    const e = estimate(app.settings);
    el.estCount.textContent = e.count;
    el.estTime.textContent = e.time;
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
    renderWarnings(); renderNav(); renderList(); renderSource(); renderSettings(); renderStart();
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

  /* ---------- módfülek (4.1): a Keresd meg! még inaktív, nem vált ---------- */
  el.tabFind.addEventListener('click', (e) => e.preventDefault());

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
