// Haladás nézet (docs/haladas-specifikacio.md, 8.): áttekintés, tétel részletei, üres állapot.
// Csak rajzol: az adatok a core/mastery.js nézetmodelljeiből, a szövegek a core/haladas-texts.js-ből
// jönnek. A navigációt (hash, vissza) a main.js végzi; ez a modul a `nav` hívásain keresztül kér.
//
// Elrendezés (8.1a): fekvő telefon (≤ 500 px magas, fekvő, legalább 560 px széles), álló telefon
// (< 600 px széles), asztali (minden más).
// A tételek szövege mindig szövegként kerül a DOM-ba (textContent), soha nem HTML-ként.

import { overview, detail, analyze } from '../core/mastery.js';
import { itemKey } from '../core/items.js';
import {
  T, CARDS, CARD_ORDER, STATE_NAME, summary, moreText, listText, listAria, emptyText, emptyAria, emptyCount,
  detailSentence, dateLabel, mayHelpText, cardNote, footLists, dayAria,
} from '../core/haladas-texts.js';

// a fekvő elrendezés három oszlopa legalább 560 px szélességet kíván; ennél keskenyebben az álló elrendezés jön
const LAND = matchMedia('(max-height: 500px) and (orientation: landscape) and (min-width: 560px)');
const PORTRAIT = matchMedia('(max-width: 599px)');
/** Csempék kártyánként (8.1a). */
export const TILES = Object.freeze({ desktop: 6, portrait: 4, land: 3 });
const GREY = '#ECE5D6';

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

export const itemHash = (item) => `#haladas/tetel/${encodeURIComponent(itemKey(item))}`;

/**
 * @param {HTMLElement} root  a nézet tárolója (#haladas)
 * @param {{ data: () => { daily: object[], lists: object[], cfg: object, now: number, available: boolean },
 *           back: (target: string) => void }} o
 */
export function createProgressView(root, { data, back }) {
  let route = null;
  let statOpen = false;

  const backLink = (label, target) => h('a', {
    class: 'hl-back', href: target || '#',
    onclick: (e) => { e.preventDefault(); back(target); },
  }, label);

  const tile = (item, related = false) => h('a', { class: 'hl-tile f-item', href: itemHash(item), 'data-related': related || null }, item);

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

  function card(key, ov, max) {
    const c = CARDS[key], items = ov.cards[key];
    const note = key === 'practice' && ov.practiceNote ? h('p', { class: 'hl-note' }, cardNote(ov.practiceNote)) : null;
    return h('section', { class: 'hl-card', 'data-state': key, style: { '--c': c.color }, 'aria-labelledby': `hlCard-${key}` },
      h('div', { class: 'hl-card-head' }, h('h2', { id: `hlCard-${key}` }, c.title), h('span', { class: 'hl-count num' }, String(items.length))),
      h('p', { class: 'hl-means' }, c.means),
      note,
      items.length
        ? h('div', { class: 'hl-tiles' }, items.slice(0, max).map((x) => tile(x.item)))
        : h('p', { class: 'hl-none' }, T.emptyCard),
      items.length > max ? h('p', { class: 'hl-more' }, moreText(items.length - max)) : null);
  }

  function listRow(l) {
    const pc = (n) => `${l.total ? (n / l.total) * 100 : 0}%`;
    return h('div', { class: 'hl-list' },
      h('div', { class: 'hl-list-name' }, l.name),
      h('div', { class: 'hl-bar', role: 'img', 'aria-label': listAria(l) },
        h('span', { style: { width: pc(l.fluent), background: CARDS.fluent.color } }),
        h('span', { style: { width: pc(l.improving), background: CARDS.improving.color } }),
        h('span', { style: { width: pc(l.practice), background: CARDS.practice.color } })),
      h('div', { class: 'hl-list-text' }, listText(l.fluent, l.total)));
  }

  function renderOverview(d, ov, mode) {
    return [
      h('div', { class: 'hl-top' },
        h('header', { class: 'hl-header' }, backLink(T.back, ''), h('h1', { tabindex: '-1' }, T.title), rich('p', { class: 'hl-sum' }, summary(ov))),
        statBox(mode)),
      notice(d),
      h('div', { class: 'hl-cards' }, CARD_ORDER.map((k) => card(k, ov, TILES[mode]))),
      h('section', { class: 'hl-lists', 'aria-labelledby': 'hlListsH' },
        h('h2', { id: 'hlListsH' }, T.perList), ov.perList.map(listRow), h('p', { class: 'hl-muted' }, T.grey)),
      h('section', { class: 'hl-how', 'aria-labelledby': 'hlHowH' }, h('h2', { id: 'hlHowH' }, T.howTitle), h('p', {}, T.how)),
      h('p', { class: 'hl-foot' }, T.local),
    ];
  }

  /* ---------- üres állapot (8.4) ---------- */
  function renderEmpty(d, ov) {
    const have = Math.min(ov.practiceDays, ov.minDays);
    return [
      h('header', { class: 'hl-header' }, backLink(T.back, ''), h('h1', { tabindex: '-1' }, T.open)),
      notice(d),
      h('section', { class: 'hl-empty' },
        h('div', { class: 'hl-empty-text' },
          h('h2', {}, T.emptyTitle),
          rich('p', {}, emptyText(ov.practiceDays, ov.itemsRead)),
          h('p', { class: 'hl-muted' }, T.local)),
        h('div', { class: 'hl-empty-meter' },
          h('div', { class: 'hl-segs', role: 'img', 'aria-label': emptyAria(have, ov.minDays) },
            Array.from({ length: ov.minDays }, (_, k) => h('span', { class: k < have ? 'on' : null }))),
          h('p', { class: 'hl-muted' }, emptyCount(have, ov.minDays)))),
    ];
  }

  /* ---------- tétel részletei (8.3) ---------- */
  function renderItem(d, it) {
    const color = CARDS[it.state]?.color || GREY;
    const main = h('section', { class: 'hl-main', style: { '--c': color } },
      h('div', { class: 'hl-big f-item', lang: 'hu' }, it.item),
      h('h1', { tabindex: '-1' }, STATE_NAME[it.state]),
      h('p', {}, detailSentence(it)));
    const days = it.recentDays.length ? h('section', { class: 'hl-days', 'aria-labelledby': 'hlDaysH' },
      h('h2', { id: 'hlDaysH' }, T.whenRead),
      h('ul', { class: 'hl-dots' }, it.recentDays.map((x) => h('li', { 'aria-label': dayAria(x.day, x.helped) },
        h('span', { class: `hl-dot${x.helped ? ' helped' : ''}`, 'aria-hidden': 'true' }),
        h('span', { class: 'hl-date', 'aria-hidden': 'true' }, dateLabel(x.day))))),
      h('div', { class: 'hl-legend' },
        h('span', {}, h('span', { class: 'hl-dot helped', 'aria-hidden': 'true' }), h('span', { class: 'hl-legend-long' }, T.helped), h('span', { class: 'hl-legend-short' }, T.helpedShort)),
        h('span', {}, h('span', { class: 'hl-dot', 'aria-hidden': 'true' }), T.unhelped))) : null;
    const help = it.help ? h('section', { class: 'hl-help', 'aria-labelledby': 'hlHelpH' },
      h('h2', { id: 'hlHelpH' }, T.mayHelp),
      rich('p', {}, mayHelpText(it.help.letter)),
      h('div', { class: 'hl-tiles' }, it.help.related.map((x) => tile(x, true)))) : null;
    const lists = footLists(it.lists);
    return [
      backLink(T.backToOverview, '#haladas'),
      notice(d),
      h('div', { class: 'hl-detail' }, main, h('div', { class: 'hl-side' }, days, help)),
      h('p', { class: 'hl-foot' }, lists ? h('span', {}, lists) : null, lists ? h('span', { class: 'hl-sep', 'aria-hidden': 'true' }, ' · ') : null, h('span', {}, T.footStat)),
    ];
  }

  function render(r = route) {
    route = r;
    if (!r) return;
    const d = data();
    const an = analyze(d.daily, { now: d.now, cfg: d.cfg });
    const mode = layout();
    let kids;
    if (r.view === 'item') kids = renderItem(d, detail(an, r.item, d.lists));
    else {
      const ov = overview(an, d.lists);
      kids = ov.empty ? renderEmpty(d, ov) : renderOverview(d, ov, mode);
      root.dataset.view = ov.empty ? 'empty' : 'overview';
    }
    if (r.view === 'item') root.dataset.view = 'item';
    root.dataset.layout = mode;
    root.replaceChildren(h('div', { class: 'hl-wrap' }, kids));
  }

  /** Nézetváltáskor: a tetejére görget, a fókusz a címre (felolvasó). */
  function show(r) {
    const same = route && r && route.view === r.view && route.item === r.item;
    render(r);
    if (!same) { root.scrollTop = 0; root.querySelector('h1')?.focus({ preventScroll: true }); }
  }

  for (const m of [LAND, PORTRAIT]) m.addEventListener('change', () => { if (!root.hidden) render(); });

  return {
    show,
    refresh: () => { if (!root.hidden) render(); },
    /** Esc: a részletekből az áttekintéshez, onnan a szülői felületre. */
    key(e) {
      if (e.code !== 'Escape') return false;
      if (document.querySelector('dialog:modal')) return false;
      e.preventDefault();
      back(route?.view === 'item' ? '#haladas' : '');
      return true;
    },
  };
}
