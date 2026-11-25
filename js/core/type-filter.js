// Tételszűrő (docs/megjelenes-specifikacio.md, SZR-1–SZR-8). Tiszta modul.
//
// A szűrő a kikapcsolt típuskulcsok listája (V, C, VC, CV, S, W, M; üres = nincs szűrés). A típus a
// meglévő csoportokból (groups.js) jön: S = egyéb szótag (S:*), W = szó (W:*), M = mondat (M:*).
// A szűrés a csomagválasztás után, a húzás előtt történik: a sorok (ismétlésekkel) maradnak, csak a
// kiszűrt típusú sorok esnek ki, így a súlyozás és a csoportsorrend változatlan (SZR-5).

import { groupOf } from './groups.js';

/** A típuskulcsok a csoportok sorrendjében. */
export const TYPE_KEYS = Object.freeze(['V', 'C', 'VC', 'CV', 'S', 'W', 'M']);

/** A chipek és altípusaik (SZR-1, SZR-2). Szavak és Mondatok: egy altípus, nincs ▾. */
export const CHIPS = Object.freeze([
  { id: 'betu', label: 'Betűk', subs: [['V', 'Magánhangzók'], ['C', 'Mássalhangzók']] },
  { id: 'szotag', label: 'Szótagok', subs: [['CV', 'CV (pl. ma)'], ['VC', 'VC (pl. am)'], ['S', 'Egyéb']] },
  { id: 'szo', label: 'Szavak', subs: [['W', 'Szavak']] },
  { id: 'mondat', label: 'Mondatok', subs: [['M', 'Mondatok']] },
]);

/** A tétel típuskulcsa: a csoportkulcs eleje (S:CVC → S, W:2 → W, M:3 → M). */
export const typeKeyOf = (item) => groupOf(item).key.split(':')[0];

/** Bármilyen bemenetből érvényes szűrő: az ismert kulcsok, ismétlés nélkül, a TYPE_KEYS sorrendjében. */
export function clampFilter(off) {
  const set = new Set(Array.isArray(off) ? off : []);
  return TYPE_KEYS.filter((k) => set.has(k));
}

/** A szűrés után megmaradó sorok (ismétlésekkel, sorrendben). Üres szűrőnél ugyanaz a tömb. */
export function filterRows(rows, off) {
  if (!off.length) return rows;
  const out = new Set(off);
  return rows.filter((r) => !out.has(typeKeyOf(r)));
}

/** A különböző tételek száma típusonként. */
export function typeCounts(items) {
  const n = Object.fromEntries(TYPE_KEYS.map((k) => [k, 0]));
  for (const x of items) n[typeKeyOf(x)]++;
  return n;
}

/**
 * A chipsor (SZR-3, SZR-4): csak a jelen lévő típusok chipjei és altípusai. state: 'on' (minden jelen lévő
 * altípus be), 'part' (`Betűk · 1/2`), 'off'. n: a bekapcsolt különböző tételek száma. hasSub: van ▾
 * (legalább két jelen lévő altípus).
 * @param {Record<string, number>} counts  typeCounts
 * @param {string[]} off
 */
export function chipModel(counts, off) {
  const out = new Set(off);
  return CHIPS.flatMap((c) => {
    const subs = c.subs.filter(([k]) => counts[k] > 0).map(([key, label]) => ({ key, label, n: counts[key], on: !out.has(key) }));
    if (!subs.length) return [];
    const on = subs.filter((s) => s.on);
    const state = on.length === subs.length ? 'on' : on.length ? 'part' : 'off';
    return [{
      id: c.id, state, subs, hasSub: subs.length > 1,
      label: state === 'part' ? `${c.label} · ${on.length}/${subs.length}` : c.label,
      name: c.label,
      n: on.reduce((a, s) => a + s.n, 0),
      keys: subs.map((s) => s.key),
    }];
  });
}

/**
 * Koppintás a chipre (SZR-4): az összes jelen lévő altípus egyszerre vált; kikapcsolt chip bekapcsol, a
 * be- vagy részben bekapcsolt kikapcsol. A nem látszó altípusok tárolt állapota marad (SZR-6, D-7).
 */
export function toggleChip(off, chip) {
  const set = new Set(off);
  for (const k of chip.keys) { if (chip.state === 'off') set.delete(k); else set.add(k); }
  return clampFilter([...set]);
}

/** Egy altípus váltása. */
export function toggleSub(off, key) {
  const set = new Set(off);
  if (set.has(key)) set.delete(key); else set.add(key);
  return clampFilter([...set]);
}

/** A számláló (SZR-8): szűrés nélkül „62 tétel · 3 csomag”, szűréssel „34 / 62 tétel · 3 csomag”. */
export const countText = (shown, total, packs) =>
  `${shown === total ? total : `${shown} / ${total}`} tétel · ${packs} csomag`;
