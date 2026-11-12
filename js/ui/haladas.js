// Haladás nézet (docs/haladas-specifikacio.md, 8.): áttekintés, csoport oldala, tétel részletei.
// Csak rajzol: az adatok a core/mastery.js nézetmodelljeiből, a szövegek a core/haladas-texts.js-ből
// jönnek. A navigációt (hash, vissza) a main.js végzi; ez a modul a `nav` hívásain keresztül kér.
//
// Elrendezés (8.1): fekvő telefon (≤ 500 px magas, fekvő, legalább 560 px széles), álló telefon
// (< 600 px széles), asztali (minden más).
// A tételek szövege mindig szövegként kerül a DOM-ba (textContent), soha nem HTML-ként.

import { overview, groupView, detail, analyze, GROUPS } from '../core/mastery.js';
import { itemKey } from '../core/items.js';
import {
  T, CARDS, CARD_ORDER, summary, cardText, infoText, listText, listAria, groupTitle, showAllAria,
  reasonSentence, facts, dateLabel, dayAria,
} from '../core/haladas-texts.js';

// a fekvő elrendezés három oszlopa legalább 560 px szélességet kíván; ennél keskenyebben az álló elrendezés jön
const LAND = matchMedia('(max-height: 500px) and (orientation: landscape) and (min-width: 560px)');
const PORTRAIT = matchMedia('(max-width: 599px)');
/** Csempék kártyánként az áttekintésen (8.2). */
export const TILES = Object.freeze({ desktop: 6, portrait: 4, land: 3 });

/** A napi pötty osztálya: teljesen sárga, fehér, vagy félig-félig (segítséggel és anélkül is). */
const DOT = Object.freeze({ all: ' helped', some: ' mixed', none: '' });

const layout = () => (LAND.matches ? 'land' : PORTRAIT.matches ? 'portrait' : 'desktop');

/** Kis DOM-építő: h('p', { class: 'x' }, 'szöveg', elem). Az attribútum `on*` kulcsa eseményfigyelő. */
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') for (const [p, x] of Object.entries(v)) e.style.setProperty(p.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), x);
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter((x) => x != null && x !== false));
  return e;
}
/** A szövegrészekből ([szöveg, kiemelt?]) álló mondat. */
const rich = (tag, attrs, parts) => h(tag, attrs, parts.map(([t, b]) => (b ? h('strong', {}, t) : t)));

/** Jobbra mutató nyíl a „Mutasd mindet” mellé (díszítés). */
function chevron() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ width: 14, height: 14, viewBox: '0 0 14 14', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, v);
  const p = document.createElementNS(NS, 'path');
  for (const [k, v] of Object.entries({ d: 'M5 3l4 4-4 4', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })) p.setAttribute(k, v);
  svg.append(p);
  return svg;
}

/** Információs ikon (díszítés). */
function infoIcon() {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  for (const [k, v] of Object.entries({ width: 22, height: 22, viewBox: '0 0 22 22', 'aria-hidden': 'true', focusable: 'false' })) svg.setAttribute(k, v);
  const c = document.createElementNS(NS, 'circle');
  for (const [k, v] of Object.entries({ cx: 11, cy: 11, r: 9, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8 })) c.setAttribute(k, v);
  const p = document.createElementNS(NS, 'path');
  for (const [k, v] of Object.entries({ d: 'M11 10v5.5M11 6.8v.2', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' })) p.setAttribute(k, v);
  svg.append(c, p);
  return svg;
}

export const itemHash = (item) => `#haladas/tetel/${encodeURIComponent(itemKey(item))}`;
export const groupHash = (key) => `#haladas/csoport/${key}`;
/** Az útvonal kulcsa (a görgetési pozíció megjegyzéséhez). */
const routeKey = (r) => (r.view === 'item' ? itemHash(r.item) : r.view === 'group' ? groupHash(r.group) : '#haladas');

/**
 * @param {HTMLElement} root  a nézet tárolója (#haladas)
 * @param {{ data: () => { daily: object[], lists: object[], cfg: object, now: number, available: boolean },
 *           back: (target: string) => void, open: (hash: string, from: string) => void }} o
 *   open: tétel megnyitása a csoport oldaláról, hogy a vissza oda vigyen
 */
export function createProgressView(root, { data, back, open }) {
  let route = null;
  let statOpen = false;
  const scrolls = new Map();         // útvonal → görgetési pozíció (visszalépéskor visszaáll)

  const backLink = (label, target) => h('a', {
    class: 'hl-back', href: target || '#',
    onclick: (e) => { e.preventDefault(); back(target); },
  }, label);

  /** Tétel csempe; a csoport oldaláról nyitva megjegyzi, honnan jött. */
  const tile = (item, from = null) => h('a', {
    class: 'hl-tile f-item', href: itemHash(item), lang: 'hu',
    onclick: from ? (e) => {
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.button) return;
      e.preventDefault(); open(itemHash(item), from);
    } : null,
  }, item);

  function notice(d) {
    return d.available ? null : h('p', { class: 'hl-notice', role: 'status' }, T.noStorage);
  }

  /* ---------- áttekintés (8.2) ---------- */
  function statBox(mode) {
    if (mode !== 'portrait') {
      return h('section', { class: 'hl-stat', 'aria-labelledby': 'hlStatH' },
        h('h2', { id: 'hlStatH' }, T.statTitle), h('p', {}, `${T.statFirst} ${T.statRest}`));
    }
    const more = h('p', { id: 'hlStatMore', hidden: !statOpen }, T.statRest);
    const label = h('span', { class: 'hl-toggle' }, statOpen ? T.less : T.more);
    const btn = h('button', {
      type: 'button', class: 'hl-stat-btn', 'aria-expanded': String(statOpen), 'aria-controls': 'hlStatMore',
      onclick: () => {
        statOpen = !statOpen;
        btn.setAttribute('aria-expanded', String(statOpen));
        label.textContent = statOpen ? T.less : T.more;
        more.hidden = !statOpen;
      },
    }, h('span', { class: 'hl-stat-title' }, T.statTitle), label);
    return h('section', { class: 'hl-stat' }, h('h2', { class: 'hl-stat-h' }, btn), h('p', {}, T.statFirst), more);
  }

  const showAll = (key, n) => h('a', { class: 'hl-all', href: groupHash(key), 'aria-label': showAllAria(key, n) }, T.showAll, chevron());

  function card(key, ov, max, a) {
    const items = ov.groups[key], n = items.length;
    const head = h('div', { class: 'hl-card-head' }, h('h2', { id: `hlCard-${key}` }, CARDS[key].title), h('span', { class: 'hl-count num' }, String(n)));
    const means = h('p', { class: 'hl-means' }, cardText(key, a));
    const none = n ? null : h('p', { class: 'hl-none' }, T.emptyCard);
    const attrs = { class: `hl-card${key === 'lowdata' ? ' hl-low' : ''}`, 'data-group': key, 'data-empty': n ? null : true, style: { '--c': CARDS[key].color }, 'aria-labelledby': `hlCard-${key}` };
    if (key === 'lowdata') {
      return h('section', attrs, h('div', { class: 'hl-low-row' }, h('div', { class: 'hl-low-text' }, head, means, none), n ? showAll(key, n) : null));
    }
    return h('section', attrs, head, means,
      n ? h('div', { class: 'hl-tiles' }, items.slice(0, max).map((x) => tile(x.item))) : none,
      n ? showAll(key, n) : null);
  }

  function listRow(l) {
    return h('div', { class: 'hl-list' },
      h('div', { class: 'hl-list-name' }, l.name),
      h('div', { class: 'hl-bar', role: 'img', 'aria-label': listAria(l) },
        CARD_ORDER.filter((k) => l[k] > 0).map((k) => h('span', { 'data-group': k, style: { flexGrow: String(l[k]), background: CARDS[k].color } }))),
      h('div', { class: 'hl-list-text' }, listText(l.fluent, l.total)));
  }

  function renderOverview(d, ov, mode) {
    const a = d.cfg.allapot;
    const info = !ov.grouped && ov.minDays > 0
      ? h('p', { class: 'hl-info', role: 'status' }, infoIcon(), h('span', {}, infoText(ov.minDays)))
      : null;
    return [
      h('div', { class: 'hl-top' },
        h('header', { class: 'hl-header' }, backLink(T.back, ''), h('h1', { tabindex: '-1' }, T.title), rich('p', { class: 'hl-sum' }, summary(ov))),
        statBox(mode)),
      notice(d),
      info,
      h('div', { class: 'hl-cards' }, CARD_ORDER.map((k) => card(k, ov, TILES[mode], a))),
      h('section', { class: 'hl-lists', 'aria-labelledby': 'hlListsH' },
        h('h2', { id: 'hlListsH' }, T.perList), ov.perList.map(listRow), h('p', { class: 'hl-muted' }, T.grey)),
      h('section', { class: 'hl-how', 'aria-labelledby': 'hlHowH' }, h('h2', { id: 'hlHowH' }, T.howTitle), T.how.map((p) => h('p', {}, p))),
      h('p', { class: 'hl-foot' }, T.local),
    ];
  }

  /* ---------- csoport oldala (8.3) ---------- */
  function renderGroup(d, g) {
    const from = groupHash(g.key);
    const tiles = (items) => h('div', { class: 'hl-tiles' }, items.map((x) => tile(x.item, from)));
    const body = g.parts
      ? g.parts.filter((p) => p.items.length).map((p) => h('section', { class: 'hl-sub', 'data-part': p.key, 'aria-labelledby': `hlSub-${p.key}` },
        h('h2', { id: `hlSub-${p.key}` }, p.key === 'read' ? T.partRead : T.partUnread, ' ', h('span', { class: 'hl-sub-n' }, `(${p.items.length})`)),
        tiles(p.items)))
      : [g.items.length ? tiles(g.items) : null];
    return [
      backLink(T.backToOverview, '#haladas'),
      notice(d),
      h('section', { class: 'hl-group', 'data-group': g.key, 'data-empty': g.items.length ? null : true, style: { '--c': CARDS[g.key].color } },
        h('h1', { tabindex: '-1' }, groupTitle(g.key, g.items.length)),
        h('p', { class: 'hl-means' }, cardText(g.key, d.cfg.allapot)),
        g.items.length ? body : h('p', { class: 'hl-none' }, T.emptyCard)),
      h('p', { class: 'hl-foot' }, T.groupFoot),
    ];
  }

  /* ---------- tétel részletei (8.4) ---------- */
  function renderItem(d, it, from) {
    const main = h('section', { class: 'hl-main', 'data-group': it.group, style: { '--c': CARDS[it.group].color } },
      h('div', { class: 'hl-big f-item', lang: 'hu' }, it.item),
      h('h1', { tabindex: '-1' }, CARDS[it.group].title),
      h('p', { class: 'hl-reason' }, reasonSentence(it, d.cfg.allapot)),
      it.exposures ? rich('p', { class: 'hl-facts' }, facts(it)) : h('p', { class: 'hl-unread' }, T.notRead));
    const days = it.recentDays.length ? h('section', { class: 'hl-days', 'aria-labelledby': 'hlDaysH' },
      h('h2', { id: 'hlDaysH' }, T.whenRead),
      h('ul', { class: 'hl-dots' }, it.recentDays.map((x) => h('li', { 'aria-label': dayAria(x.day, x.count, x.help) },
        h('span', { class: `hl-dot${DOT[x.help]}`, 'aria-hidden': 'true' }),
        h('span', { class: 'hl-date', 'aria-hidden': 'true' }, dateLabel(x.day))))),
      h('div', { class: 'hl-legend' },
        h('span', {}, h('span', { class: 'hl-dot helped', 'aria-hidden': 'true' }), h('span', { class: 'hl-legend-long' }, T.helped), h('span', { class: 'hl-legend-short' }, T.helpedShort)),
        h('span', {}, h('span', { class: 'hl-dot', 'aria-hidden': 'true' }), T.unhelped),
        h('span', {}, h('span', { class: 'hl-dot mixed', 'aria-hidden': 'true' }), h('span', { class: 'hl-legend-long' }, T.mixed), h('span', { class: 'hl-legend-short' }, T.mixedShort)))) : null;
    return [
      backLink(from === '#haladas' ? T.backToOverview : T.back, from),
      notice(d),
      h('div', { class: 'hl-detail' }, main, days ? h('div', { class: 'hl-side' }, days) : null),
      h('p', { class: 'hl-foot' }, T.footStat),
    ];
  }

  function render(r = route) {
    route = r;
    if (!r) return;
    const d = data();
    const an = analyze(d.daily, { now: d.now, cfg: d.cfg });
    const mode = layout();
    let kids;
    if (r.view === 'item') kids = renderItem(d, detail(an, r.item), r.from || '#haladas');
    else if (r.view === 'group' && GROUPS.includes(r.group)) kids = renderGroup(d, groupView(an, r.group, d.lists));
    else kids = renderOverview(d, overview(an, d.lists), mode);
    root.dataset.view = r.view === 'item' ? 'item' : r.view === 'group' ? 'group' : 'overview';
    root.dataset.layout = mode;
    root.replaceChildren(h('div', { class: 'hl-wrap' }, kids));
  }

  /**
   * Nézetváltáskor: előre lépve a tetejére görget, visszalépve az előző pozícióra áll vissza;
   * a fókusz a címre kerül (felolvasó).
   */
  function show(r, { restore = false } = {}) {
    const same = route && r && routeKey(route) === routeKey(r) && route.from === r.from;
    if (route && !root.hidden && !same) scrolls.set(routeKey(route), root.scrollTop);
    render(r);
    if (same) return;
    const key = routeKey(r);
    root.scrollTop = restore && scrolls.has(key) ? scrolls.get(key) : 0;
    root.querySelector('h1')?.focus({ preventScroll: true });
  }

  for (const m of [LAND, PORTRAIT]) m.addEventListener('change', () => { if (!root.hidden) render(); });

  return {
    show,
    refresh: () => { if (!root.hidden) render(); },
    /** Esc: a részletekből oda, ahonnan jött; a csoport oldaláról az áttekintéshez; onnan a szülői felületre. */
    key(e) {
      if (e.code !== 'Escape') return false;
      if (document.querySelector('dialog:modal')) return false;
      e.preventDefault();
      back(route?.view === 'item' ? (route.from || '#haladas') : route?.view === 'group' ? '#haladas' : '');
      return true;
    },
  };
}
