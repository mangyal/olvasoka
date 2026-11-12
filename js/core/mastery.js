// Csoportok és a Haladás nézet adatai a napi összesítőkből (docs/haladas-specifikacio.md, 7., 8.).
// Tiszta modul: az időt (`now`) és a konfigurációt kívülről kapja; DOM és tárolás nélkül.
//
// Csoportok: 'fluent' (Megy), 'unsure' (Még bizonytalan), 'practice' (Még gyakorolni kell),
// 'lowdata' (Kevés adat). Ok (7.6): 'help' vagy 'slow' (a Még bizonytalan és a Még gyakorolni kell
// csoportban), egyébként null. Kevés adatnál a hiányzó feltétel (`need`): 'days' (kevés nap) vagy 'count'
// (kevés alkalom), egyébként null.

import { typeOf } from './grid.js';
import { itemKey } from './items.js';

const DAY = 86400000;

/** A csoportok azonosítói, a felületi sorrendben. */
export const GROUPS = Object.freeze(['fluent', 'unsure', 'practice', 'lowdata']);

/** Két YYYY-MM-DD nap különbsége napokban (a nyári időszámítás nem zavar: UTC napokkal számol). */
export function daysBetween(a, b) {
  const t = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((t(b) - t(a)) / DAY);
}

/** Pontos középérték (kerekítés nélkül); üres listára null. */
export function mid(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const VOWELS = new Set('aáeéiíoóöőuúüű');
/** Szótagszám (7.2): a kulcs magánhangzóinak száma, kis- és nagybetű egyaránt; ha 0, akkor 1. */
export function syllables(item) {
  let n = 0;
  for (const ch of itemKey(item).toLowerCase()) if (VOWELS.has(ch)) n++;
  return Math.max(1, n);
}

/**
 * Egy tétel története a napi összesítőiből (7.1). Ugyanaz a nap több eszközről is jöhet: egy napnak
 * számít; a napon belül előbb a kézi (`dwellMs`), utána a villantásos (`flashDwell`) idők.
 */
export function history(records) {
  const byDay = new Map();
  for (const r of [...records].sort((a, b) => a.day.localeCompare(b.day))) {
    if (!(r.exposures > 0)) continue;
    if (!byDay.has(r.day)) byDay.set(r.day, []);
    byDay.get(r.day).push(r);
  }
  const days = [...byDay].map(([day, rs]) => ({
    day,
    count: rs.reduce((s, r) => s + r.exposures, 0),
    helpedCount: rs.reduce((s, r) => s + (r.supportedExposures || 0), 0),
    help: rs.map((r) => r.help || '').join(''),
    times: [...rs.flatMap((r) => r.dwellMs || []), ...rs.flatMap((r) => (r.flashDwell || []).map((f) => f.ms))],
  }));
  return {
    days,
    help: days.map((d) => d.help).join(''),
    times: days.flatMap((d) => d.times),
    exposures: days.reduce((s, d) => s + d.count, 0),
  };
}

/**
 * Szokásos tempó típusonként (7.3): az adott típus összes tételének szótagonkénti mért ideje az utolsó
 * `tempo_ablak_nap` gyakorlási naphoz kötött ablakból, középértékkel; csak legalább `tempo_min_meres`
 * mérésből. A záró nap az utolsó gyakorlási nap (hosszú szünet után sem ürül ki az ablak).
 * @param {Map<string, object[]>} byItem  tétel → napi összesítők
 * @returns {Map<string, number>} típus → ms/szótag
 */
export function typeTempo(byItem, { window, minCount }) {
  let last = null;
  for (const recs of byItem.values()) for (const r of recs) if (r.exposures > 0 && (last == null || r.day > last)) last = r.day;
  const vals = new Map();
  if (last == null) return vals;
  for (const [item, recs] of byItem) {
    const t = typeOf(item), n = syllables(item);
    if (!vals.has(t)) vals.set(t, []);
    for (const r of recs) {
      if (!(r.exposures > 0) || daysBetween(r.day, last) >= window) continue;
      for (const ms of r.dwellMs || []) vals.get(t).push(ms / n);
      for (const f of r.flashDwell || []) vals.get(t).push(f.ms / n);
    }
  }
  return new Map([...vals].filter(([, v]) => v.length >= minCount).map(([t, v]) => [t, mid(v)]));
}

/** Friss idő (7.4): az utolsó `n` mért idő szótagonkénti középértéke; ha nincs ennyi, null. */
export function freshTime(item, times, n) {
  return times.length >= n ? mid(times.slice(-n)) / syllables(item) : null;
}

const count1 = (s) => [...s].filter((c) => c === '1').length;

/**
 * Egy tétel csoportja, oka és a részletekhez kellő számok (7.5, 7.6).
 * @param {string} item
 * @param {object[]} records  a tétel napi összesítői
 * @param {{ cfg: object, tempo?: number|null }} o  tempo: a tétel típusának szokásos tempója (ms/szótag)
 */
export function classify(item, records, { cfg, tempo = null }) {
  const a = cfg.allapot;
  const h = history(records);
  const fresh = freshTime(item, h.times, a.friss_meres_db);
  const ratio = fresh != null && tempo ? fresh / tempo : null;
  const out = {
    item, type: typeOf(item), exposures: h.exposures, dayCount: h.days.length,
    firstDay: h.days[0]?.day ?? null, lastDay: h.days.at(-1)?.day ?? null,
    // napi segítség: 'all' (minden alkalom segítséggel), 'some' (segítséggel és anélkül is), 'none'
    days: h.days.map(({ day, count, helpedCount }) => ({ day, count, help: helpedCount <= 0 ? 'none' : helpedCount >= count ? 'all' : 'some' })),
    ratio, fresh, group: 'lowdata', reason: null, need: null, helpN: 0, helpK: 0, helpRecent: 0,
  };
  // Közös kapu minden csoport előtt (7.5/1.): kevés nap vagy kevés alkalom → Kevés adat, a hiányzó feltétellel.
  // A min_alkalom ≥ 1, így a még nem olvasott tétel a napszabály-kapcsolóval is Kevés adat.
  if (h.days.length < a.min_nap) return { ...out, need: 'days' };
  if (h.exposures < a.min_alkalom) return { ...out, need: 'count' };

  const recent = h.help.slice(-a.gyakorol_utolso_n);
  out.helpN = recent.length; out.helpK = count1(recent);
  out.helpRecent = recent.length ? out.helpK / recent.length : 0;
  const helpCond = recent.length > 0 && out.helpK >= a.gyakorol_segitseg_db;
  if (helpCond || (ratio != null && ratio >= a.gyakorol_ido_szorzo)) {
    return { ...out, group: 'practice', reason: helpCond ? 'help' : 'slow' };
  }
  const last = h.help.slice(-a.megy_utolso_n);
  const lastHelped = last.includes('1');
  const slow = ratio != null && ratio > a.megy_ido_szorzo;
  // a kapu miatt van legalább min_alkalom ≥ megy_utolso_n alkalom (7.8)
  if (!lastHelped && !slow) return { ...out, group: 'fluent' };
  // „Még bizonytalan” csak akkor, ha már olvasta segítség nélkül is; ha mindig segítség kellett, gyakorolni kell
  if (lastHelped && !h.help.includes('0')) return { ...out, group: 'practice', reason: 'help' };
  return { ...out, group: 'unsure', reason: lastHelped ? 'help' : 'slow' };
}

/* ---------- elemzés és nézetmodellek ---------- */

/**
 * A teljes elemzés: tételenkénti csoport, szokásos tempók, gyakorlási napok.
 * @param {object[]} daily  a gyerek napi összesítői (bármelyik eszközről)
 * @param {{ now: number, cfg: object }} o
 */
export function analyze(daily, { now, cfg }) {
  const byItem = new Map();
  for (const d of daily) {
    if (!byItem.has(d.item)) byItem.set(d.item, []);
    byItem.get(d.item).push(d);
  }
  const tempo = typeTempo(byItem, { window: cfg.allapot.tempo_ablak_nap, minCount: cfg.allapot.tempo_min_meres });
  const states = new Map();
  for (const [item, recs] of byItem) states.set(item, classify(item, recs, { cfg, tempo: tempo.get(typeOf(item)) ?? null }));
  const practiceDays = new Set(daily.filter((d) => d.exposures > 0).map((d) => d.day));
  return { now, cfg, states, tempo, practiceDays: practiceDays.size, itemsRead: [...states.values()].filter((s) => s.exposures > 0).length };
}

/** Egy tétel állapota; a még nem olvasott tétel is (Kevés adat). */
export const stateOf = (an, item) => an.states.get(itemKey(item)) || classify(itemKey(item), [], { cfg: an.cfg });

/** A jelenlegi listák egyedi tételkulcsai, megjelenési sorrendben. */
export const currentItems = (lists) => [...new Set(lists.flatMap((l) => l.items.map(itemKey)))];

/** Tételsorrend csoportonként (8.2); az egyenlők a listák sorrendjében maradnak (stabil rendezés). */
const recentFirst = (a, b) => (b.lastDay || '').localeCompare(a.lastDay || '') || b.exposures - a.exposures;
export const ORDER = Object.freeze({
  fluent: recentFirst,
  unsure: recentFirst,
  // a legtöbb segítséget igénylő elöl (arány, majd darab), majd a nagyobb tempóarány
  practice: (a, b) => b.helpRecent - a.helpRecent || b.helpK - a.helpK || (b.ratio ?? 0) - (a.ratio ?? 0),
  // a több napon olvasott elöl, azonos napszámnál a legutóbb olvasott; a még nem olvasottak a végén
  lowdata: (a, b) => b.dayCount - a.dayCount || recentFirst(a, b),
});

/** A jelenlegi listák tételei csoportonként, a 8.2 sorrendjében. */
export function grouped(an, lists) {
  const all = currentItems(lists).map((k) => stateOf(an, k));
  return Object.fromEntries(GROUPS.map((g) => [g, all.filter((x) => x.group === g).sort(ORDER[g])]));
}

/**
 * Az áttekintés adatai (8.2).
 * @param {object} an        analyze() eredménye
 * @param {{ name: string, items: string[] }[]} lists  a jelenlegi listák (mind; az összes = ezek egyedi tételei)
 */
export function overview(an, lists) {
  const groups = grouped(an, lists);
  const counts = Object.fromEntries(GROUPS.map((g) => [g, groups[g].length]));
  const perList = lists.map((l) => {
    const c = Object.fromEntries(GROUPS.map((g) => [g, 0]));
    const keys = [...new Set(l.items.map(itemKey))];
    for (const k of keys) c[stateOf(an, k).group]++;
    return { name: l.name, total: keys.length, ...c };
  });
  const total = GROUPS.reduce((s, g) => s + counts[g], 0);
  return {
    total,
    seen: GROUPS.reduce((s, g) => s + groups[g].filter((x) => x.exposures > 0).length, 0),
    grouped: total - counts.lowdata,
    counts, groups, perList,
    minDays: an.cfg.allapot.min_nap,
  };
}

/**
 * Egy csoport oldala (8.3). A Kevés adat csoportban két rész: olvasta (még kevés napon) és még nem olvasta.
 * Ismeretlen csoportnál null.
 */
export function groupView(an, key, lists) {
  if (!GROUPS.includes(key)) return null;
  const items = grouped(an, lists)[key];
  const parts = key === 'lowdata'
    ? [{ key: 'read', items: items.filter((x) => x.exposures > 0) }, { key: 'unread', items: items.filter((x) => !x.exposures) }]
    : null;
  return { key, items, parts };
}

/** A tétel részletei (8.4): a csoport, az ok és a tények. */
export function detail(an, item) {
  const s = stateOf(an, item);
  return { ...s, recentDays: s.days.slice(-14) };
}
