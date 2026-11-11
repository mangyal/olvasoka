// Tételállapotok és a Haladás nézet adatai a napi összesítőkből (docs/haladas-specifikacio.md, 7., 7.2, 8.).
// Tiszta modul: az időt (`now`) és a konfigurációt kívülről kapja; DOM és tárolás nélkül.
//
// Állapotok: 'unseen' (nem látott), 'new' (még ismerkedik vele), 'fluent' (Már megy),
// 'improving' (Egyre jobban megy), 'practice' (Gyakoroljuk még).

import { tokenize, typeOf } from './grid.js';
import { dayOf, median } from './exposures.js';
import { itemKey } from './items.js';

const DAY = 86400000;

/** Két YYYY-MM-DD nap különbsége napokban (a nyári időszámítás nem zavar: déli időponttal számol). */
export function daysBetween(a, b) {
  const t = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
  return Math.round((t(b) - t(a)) / DAY);
}

const ratio = (seq) => (seq.length ? [...seq].filter((c) => c === '1').length / seq.length : 0);

/** Egy tétel története a napi összesítőiből, időrendben. */
function history(records) {
  const days = [...records].sort((a, b) => a.day.localeCompare(b.day)).filter((d) => d.exposures > 0);
  return {
    days,
    help: days.map((d) => d.help).join(''),
    dwell: days.flatMap((d) => d.dwellMs),
    fastFlash: days.reduce((s, d) => s + d.unsupportedFastFlash, 0),
    exposures: days.reduce((s, d) => s + d.exposures, 0),
  };
}

/** A tétel betűi (a többjegyű egynek számít), és típusa (betű, szótag, szó). */
const lettersOf = (item) => tokenize(item);

/**
 * Az azonos típusú tételek karakterenkénti medián olvasási ideje az ablakban (7.: „Már megy”).
 * @returns {Map<string, number>} típus → ms/betű
 */
export function typeMedians(byItem, fromDay) {
  const vals = new Map();
  for (const [item, recs] of byItem) {
    const n = lettersOf(item).length;
    if (!n) continue;
    const t = typeOf(item);
    if (!vals.has(t)) vals.set(t, []);
    for (const r of recs) if (r.day >= fromDay) vals.get(t).push(...r.dwellMs.map((x) => x / n));
  }
  return new Map([...vals].filter(([, v]) => v.length).map(([t, v]) => [t, median(v)]));
}

/**
 * Egy tétel állapota és a részletekhez kellő számok.
 * @param {string} item
 * @param {object[]} records  a tétel napi összesítői
 * @param {{ today: string, cfg: object, typeMedian?: number|null }} o
 */
export function itemState(item, records, { today, cfg, typeMedian = null }) {
  const a = cfg.allapot;
  const h = history(records);
  const n = a.kiindulas_n;
  const base = h.dwell.length >= n ? median(h.dwell.slice(0, n)) : null;
  const recent = h.dwell.length >= n ? median(h.dwell.slice(-n)) : null;
  const relative = base && recent != null ? recent / base : null;
  const dayCount = h.days.length;
  const firstDay = h.days[0]?.day ?? null;
  const lastDay = h.days.at(-1)?.day ?? null;
  const sinceFirst = firstDay ? daysBetween(firstDay, today) : 0;
  const lastHelp = h.help.slice(-a.megy_utolso_segitseg_nelkul);
  const recentHelp = h.help.slice(-a.gyakorol_utolso_n);
  const out = {
    item, exposures: h.exposures, dayCount, firstDay, lastDay, sinceFirst, relative,
    helpRecent: ratio(recentHelp),
    days: h.days.map((d) => ({ day: d.day, helped: d.supportedExposures > 0 })),
    coverMostly: false, state: 'unseen',
  };
  if (!h.exposures) return out;

  // „takarás” vagy „segítség” a mondatban: a legutóbbi napokon a takarás volt-e a több
  const tail = h.days.slice(-a.gyakorol_utolso_n);
  const covers = tail.reduce((s, d) => s + d.covers, 0), others = tail.reduce((s, d) => s + d.pauses + d.prevs, 0);
  out.coverMostly = covers > 0 && covers >= others;

  const letters = lettersOf(item).length;
  const perChar = recent != null && letters ? recent / letters : null;
  const fluent = dayCount >= a.uj_min_nap
    && lastHelp.length >= a.megy_utolso_segitseg_nelkul && !lastHelp.includes('1')
    && ((relative != null && relative <= a.megy_relativ_ido_max)
      || (perChar != null && typeMedian != null && perChar <= a.megy_tipus_median_szorzo * typeMedian)
      || h.fastFlash >= a.megy_gyors_villantas_db);
  const practice = !fluent && dayCount >= a.gyakorol_min_nap && sinceFirst >= a.gyakorol_min_eltelt_nap
    && (ratio(recentHelp) >= a.gyakorol_segitseg_arany || (relative != null && relative > a.gyakorol_relativ_ido_min));
  const improving = !fluent && !practice && dayCount >= a.uj_min_nap
    && ((relative != null && relative <= a.javul_relativ_ido_max)
      || (h.help.length >= n && ratio(h.help.slice(-n)) < ratio(h.help.slice(0, n))));
  out.state = fluent ? 'fluent' : practice ? 'practice' : improving ? 'improving' : 'new';
  return out;
}

/* ---------- betűk (7.2) ---------- */

/**
 * Betűnkénti segítségarány az ablakban: a betűt tartalmazó tételek megjelenéseinek hányadánál volt segítség.
 * Csak az legalább `min_tetel` különböző tételben szereplő betű kap arányt.
 * @returns {{ rate: Map<string, number>, without: (letter: string) => number }}
 */
export function letterStats(byItem, fromDay, minItems) {
  const per = [];
  for (const [item, recs] of byItem) {
    let exp = 0, sup = 0;
    for (const r of recs) if (r.day >= fromDay) { exp += r.exposures; sup += r.supportedExposures; }
    if (exp) per.push({ letters: new Set(lettersOf(item)), exp, sup });
  }
  const acc = new Map();
  for (const p of per) for (const l of p.letters) {
    const a = acc.get(l) || { items: 0, exp: 0, sup: 0 };
    acc.set(l, { items: a.items + 1, exp: a.exp + p.exp, sup: a.sup + p.sup });
  }
  const rate = new Map([...acc].filter(([, a]) => a.items >= minItems).map(([l, a]) => [l, a.sup / a.exp]));
  const without = (l) => {
    let exp = 0, sup = 0;
    for (const p of per) if (!p.letters.has(l)) { exp += p.exp; sup += p.sup; }
    return exp ? sup / exp : 0;
  };
  return { rate, without };
}

/** A tétel leggyengébb betűje: a benne lévők közül a legnagyobb segítségarányú (ha van arány). */
export function weakestLetter(item, rate) {
  let best = null;
  for (const l of new Set(lettersOf(item))) {
    if (rate.has(l) && (best == null || rate.get(l) > rate.get(best))) best = l;
  }
  return best;
}

/* ---------- elemzés és nézetmodellek ---------- */

/**
 * A teljes elemzés: tételenkénti állapot, betűstatisztika, gyakorlási napok.
 * @param {object[]} daily  a gyerek napi összesítői (bármelyik eszközről)
 * @param {{ now: number, cfg: object }} o
 */
export function analyze(daily, { now, cfg }) {
  const today = dayOf(now);
  const fromDay = dayOf(now - cfg.betu.ablak_nap * DAY);
  const byItem = new Map();
  for (const d of daily) {
    if (!byItem.has(d.item)) byItem.set(d.item, []);
    byItem.get(d.item).push(d);
  }
  const medians = typeMedians(byItem, fromDay);
  const states = new Map();
  for (const [item, recs] of byItem) {
    states.set(item, itemState(item, recs, { today, cfg, typeMedian: medians.get(typeOf(item)) ?? null }));
  }
  const letters = letterStats(byItem, fromDay, cfg.betu.min_tetel);
  const practiceDays = new Set(daily.filter((d) => d.exposures > 0).map((d) => d.day));
  return { today, cfg, states, letters, practiceDays: practiceDays.size, itemsRead: byItem.size };
}

const unseen = (item) => ({ item, state: 'unseen', exposures: 0, days: [], dayCount: 0, relative: null, helpRecent: 0 });
export const stateOf = (an, item) => an.states.get(itemKey(item)) || unseen(itemKey(item));

/** A jelenlegi listák egyedi tételkulcsai, megjelenési sorrendben. */
export const currentItems = (lists) => [...new Set(lists.flatMap((l) => l.items.map(itemKey)))];

const ORDER = {
  // Gyakoroljuk még: a legtöbb segítséget igénylő elöl; a többin a legutóbb látott elöl
  practice: (a, b) => b.helpRecent - a.helpRecent || (b.relative ?? 0) - (a.relative ?? 0) || a.item.localeCompare(b.item, 'hu'),
  recent: (a, b) => (b.lastDay || '').localeCompare(a.lastDay || '') || b.exposures - a.exposures || a.item.localeCompare(b.item, 'hu'),
};

/**
 * Az áttekintés adatai (8.2).
 * @param {object} an        analyze() eredménye
 * @param {{ name: string, items: string[] }[]} lists  a jelenlegi listák (mind; az összes = ezek egyedi tételei)
 */
export function overview(an, lists) {
  const all = currentItems(lists).map((k) => stateOf(an, k));
  const of = (s) => all.filter((x) => x.state === s);
  const cards = {
    fluent: of('fluent').sort(ORDER.recent),
    improving: of('improving').sort(ORDER.recent),
    practice: of('practice').sort(ORDER.practice),
  };
  const perList = lists.map((l) => {
    const keys = [...new Set(l.items.map(itemKey))];
    const c = { fluent: 0, improving: 0, practice: 0 };
    for (const k of keys) { const s = stateOf(an, k).state; if (s in c) c[s]++; }
    return { name: l.name, total: keys.length, ...c };
  });
  const b = an.cfg.betu;
  return {
    total: all.length,
    seen: all.filter((x) => x.state !== 'unseen').length,
    counts: { fluent: cards.fluent.length, improving: cards.improving.length, practice: cards.practice.length },
    cards,
    practiceNote: cardLetter(cards.practice.map((x) => x.item), an.letters.rate, b.kartya_megjegyzes_arany),
    perList,
    empty: an.practiceDays < an.cfg.tarolas.ures_allapot_min_nap,
    practiceDays: an.practiceDays, itemsRead: an.itemsRead, minDays: an.cfg.tarolas.ures_allapot_min_nap,
  };
}

/**
 * Kártya-megjegyzés (7.2): a „Gyakoroljuk még” tételek legalább `share` részében közös betű. Ha több ilyen
 * is van, a nagyobb segítségarányú (a gyenge betű a hasznos jel, nem a gyakori magánhangzó). Legalább 2 tétel kell.
 */
export function cardLetter(items, rate, share) {
  if (items.length < 2) return null;
  const count = new Map();
  for (const it of items) for (const l of new Set(lettersOf(it))) count.set(l, (count.get(l) || 0) + 1);
  const cands = [...count].filter(([, c]) => c / items.length >= share).map(([l, c]) => ({ l, c, r: rate.get(l) ?? -1 }));
  cands.sort((a, b) => b.r - a.r || b.c - a.c || a.l.localeCompare(b.l, 'hu'));
  return cands[0]?.l ?? null;
}

/**
 * A tétel részletei (8.3).
 * @param {object} an
 * @param {string} item
 * @param {{ name: string, items: string[] }[]} lists
 */
export function detail(an, item, lists) {
  const s = stateOf(an, item);
  const key = itemKey(item);
  const b = an.cfg.betu;
  let help = null;
  if (s.state !== 'unseen' && typeOf(key) !== 'betű') {
    const l = weakestLetter(key, an.letters.rate);
    const r = l == null ? 0 : an.letters.rate.get(l);
    if (l != null && r > 0 && r >= b.kiemeles_szorzo * an.letters.without(l)) {
      const related = currentItems(lists)
        .filter((k) => k !== key && new Set(lettersOf(k)).has(l))
        .map((k) => stateOf(an, k))
        .filter((x) => x.state === 'practice' || x.state === 'improving')
        .sort((x, y) => (x.state === y.state ? ORDER.practice(x, y) : x.state === 'practice' ? -1 : 1))
        .slice(0, b.kapcsolodo_max)
        .map((x) => x.item);
      if (related.length) help = { letter: l, related };
    }
  }
  return {
    ...s,
    lists: lists.filter((l) => l.items.some((x) => itemKey(x) === key)).map((l) => l.name),
    recentDays: s.days.slice(-14),
    help,
    slower: s.relative != null && s.relative > an.cfg.allapot.gyakorol_relativ_ido_min,
  };
}
