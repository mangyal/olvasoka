// Szülői felület (A változat): a listák csak olvashatók, a forrásuk a lists.json a GitHubon.

import { GAPS } from '../core/settings.js';
import { nameKey } from '../core/items.js';

const fmtNum = (x) => String(x).replace('.', ',');
const flashLabel = (ms) => (ms === 0 ? 'kézi' : `${fmtNum(ms / 1000)} mp`);

export function createAdmin(el, app, act) {
  const dismissed = new Set();

  /* ---------- segédek ---------- */
  const selected = () => app.lists.find((l) => nameKey(l.name) === app.selected) || null;

  function roundItems() {
    if (app.settings.source === 'all') return [...new Set(app.lists.flatMap((l) => l.items))];
    const l = selected();
    return l ? l.items.slice() : [];
  }

  function startState() {
    if (app.font.state === 'loading') return { enabled: false, label: 'Betűtípus töltődik…' };
    if (!app.lists.length) {
      return app.listsState === 'loading'
        ? { enabled: false, label: 'Listák töltődnek…' }
        : { enabled: false, msg: 'Nincs elérhető lista.' };
    }
    const all = app.settings.source === 'all';
    const n = roundItems().length;
    if (!n) return { enabled: false, msg: all ? 'Egyik listában sincs tétel.' : 'A listában nincs tétel.' };
    const fontWarn = app.font.state === 'failed';
    const parts = [];
    if (all) parts.push(`${app.lists.length} lista, ${n} különböző tétel`);
    if (fontWarn) parts.push('A betűk alakja eltérhet.');
    return { enabled: true, msg: parts.join(' · '), warn: fontWarn };
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
      const sel = nameKey(l.name) === app.selected;
      b.className = 'nav-item' + (sel ? ' sel' : '');
      if (sel) b.setAttribute('aria-current', 'true');
      const name = document.createElement('span'); name.textContent = l.name;
      const cnt = document.createElement('span'); cnt.className = 'nav-count'; cnt.textContent = l.items.length;
      b.append(name, cnt);
      b.addEventListener('click', () => act.select(l.name));
      li.append(b); return li;
    }));
    el.listSelect.replaceChildren(...app.lists.map((l) => new Option(l.name, l.name, false, nameKey(l.name) === app.selected)));
    el.listSelect.hidden = !app.lists.length;
  }

  function renderList() {
    const l = selected();
    el.listView.hidden = !l;
    el.listEmpty.hidden = !!l;
    if (!l) {
      el.listEmptyText.textContent = app.listsState === 'loading'
        ? 'Listák töltődnek…'
        : (app.loadError || 'A lists.json-ban még nincs lista.');
      return;
    }
    el.listName.textContent = l.name;
    el.listCount.textContent = `${l.items.length} tétel`;
    el.chips.replaceChildren(...l.items.map((t) => {
      const c = document.createElement('span'); c.className = 'chip'; c.textContent = t; return c;
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
    const s = app.settings;
    if (s.flashMs === 0) { el.estimate.textContent = 'kézi léptetés'; return; }
    const total = Math.round(s.count * (s.flashMs + s.gapMs) / 1000);
    el.estimate.textContent = total < 60 ? `kb. ${total} mp`
      : `kb. ${Math.floor(total / 60)} perc${total % 60 ? ` ${total % 60} mp` : ''}`;
  }

  function renderStart() {
    const st = startState();
    el.startBtn.disabled = !st.enabled;
    el.startBtn.textContent = st.label || 'Indítás';
    el.startMsg.textContent = st.msg || '';
    el.startMsg.className = 'start-msg' + (st.warn ? ' wrn' : '');
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
  el.listSelect.addEventListener('change', () => act.select(el.listSelect.value));
  el.refreshBtn.addEventListener('click', act.refresh);
  el.startBtn.addEventListener('click', (e) => act.start(e));
  el.fontBtn.addEventListener('click', act.fontTest);

  return { render, roundItems, canStart: () => startState().enabled };
}
