// Listaazonosság betöltéskor (docs/haladas-specifikacio.md, 6.). Tiszta modul.
//
// A tételtörténet a tételkulcshoz tartozik, ezért a listák változása azt nem érinti. A listaszintű adat
// (melyik körben melyik lista volt) a lista azonosítójához kötődik, és átnevezéskor átkerül:
//   azonos név (nameKey)                                → ugyanaz a lista
//   eltérő név, a régi tételeinek legalább 60%-a megvan  → átnevezett lista (a régi azonosító marad)
//   egyébként                                            → új lista
// A már nem látható listák megmaradnak (a régi körök hivatkoznak rájuk).

import { nameKey, itemKey } from './items.js';
import { listHash } from './exposures.js';

export const RENAME_OVERLAP = 0.6;

/** A régi lista tételeinek hányad része van meg az újban. */
export function overlap(oldItems, newItems) {
  if (!oldItems.length) return 0;
  const now = new Set(newItems);
  return oldItems.filter((x) => now.has(x)).length / oldItems.length;
}

/**
 * @param {Record<string, { names: string[], items: string[], hash: string, firstSeen: number, lastSeen: number }>} stored
 * @param {{ name: string, items: string[] }[]} current  a most betöltött listák
 * @param {{ now: number, newId: () => string }} o
 * @returns {{ lists: object, idOf: Map<string, string> }}  idOf: a jelenlegi lista nameKey-e → azonosító
 */
export function reconcileLists(stored, current, { now, newId }) {
  const lists = Object.fromEntries(Object.entries(stored || {}).map(([id, l]) => [id, { ...l, names: [...l.names] }]));
  const byName = new Map(Object.entries(lists).map(([id, l]) => [nameKey(l.names.at(-1)), id]));
  const idOf = new Map();
  const taken = new Set();
  const pending = [];
  for (const c of current) {
    const id = byName.get(nameKey(c.name));
    if (id && !taken.has(id)) { taken.add(id); idOf.set(nameKey(c.name), id); } else pending.push(c);
  }
  // a név szerint nem talált listák: átnevezés, ha egy szabad régi lista tételeinek nagy része megvan
  const currentNames = new Set(current.map((c) => nameKey(c.name)));
  for (const c of pending) {
    const items = [...new Set(c.items.map(itemKey))];
    let best = null, bestScore = 0;
    for (const [id, l] of Object.entries(lists)) {
      if (taken.has(id) || currentNames.has(nameKey(l.names.at(-1)))) continue;
      const s = overlap(l.items, items);
      if (s >= RENAME_OVERLAP && s > bestScore) { best = id; bestScore = s; }
    }
    const id = best || newId();
    if (!best) lists[id] = { names: [c.name], items: [], hash: '', firstSeen: now, lastSeen: now };
    else lists[id].names.push(c.name);
    taken.add(id); idOf.set(nameKey(c.name), id);
  }
  for (const c of current) {
    const l = lists[idOf.get(nameKey(c.name))];
    const items = [...new Set(c.items.map(itemKey))];
    if (l.names.at(-1) !== c.name) l.names.push(c.name);   // csak kis-/nagybetű vagy szóköz változott
    Object.assign(l, { items, hash: listHash(items), lastSeen: now });
  }
  return { lists, idOf };
}
