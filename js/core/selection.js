// Csomagok (a kódban: listák) kijelölése. Tiszta modul. Spec: docs/kartyacsomagok-specifikacio.md, 3.1.
//
// A kijelölés listakulcsok (nameKey) tömbje, mindig a listák megjelenési sorrendjében. Lehet üres
// („Egyik sem”); ilyenkor nem indul kör. A „Kijelölt csomagok” / „Összes csomag” forrás külön állapot
// (settings.source): az Összes nem írja felül a szülő saját kijelölését (lastLists).

const order = (keys, set) => keys.filter((k) => set.has(k));

/**
 * Kattintás egy csomagsorra: a sor pipáját váltja (a többi marad). Shifttel tartomány az előző kattintott
 * sortól (anchor) a kattintott sorig, mindegyik a kattintott sor új állapotát kapja.
 * @param {string[]} sel     a jelenlegi kijelölés
 * @param {string} key       a kattintott csomag kulcsa
 * @param {{ range?:boolean, anchor?:string|null, keys:string[] }} o  keys: az összes kulcs megjelenési sorrendben
 * @returns {{ sel:string[], anchor:string|null, on:boolean }}  on: a kattintott sor új állapota
 */
export function clickSelect(sel, key, { range = false, anchor = null, keys }) {
  if (!keys.includes(key)) return { sel: order(keys, new Set(sel)), anchor, on: false };
  const on = !sel.includes(key);
  const span = range && keys.includes(anchor) ? rangeKeys(keys, anchor, key) : [key];
  return { sel: paint(sel, span, on, keys), anchor: key, on };
}

/** A két kulcs közti (zárt) tartomány a megjelenési sorrendben. */
export function rangeKeys(keys, a, b) {
  const [i, j] = [keys.indexOf(a), keys.indexOf(b)].sort((x, y) => x - y);
  return i < 0 ? [b] : keys.slice(i, j + 1);
}

/** A megadott csomagok be- (on) vagy kipipálva; a többi marad. Végighúzáshoz és tartományhoz. */
export function paint(sel, targets, on, keys) {
  const set = new Set(sel);
  for (const k of targets) if (keys.includes(k)) { if (on) set.add(k); else set.delete(k); }
  return order(keys, set);
}

/**
 * A betöltéskor kívánt kijelölés, mielőtt a reconcile a létező listákhoz igazítja:
 * „Összes csomag” módban mind; különben a mostani kijelölés; ha nincs (vagy egyik listája sem létezik már),
 * a legutóbb mentett; ha az sincs (első betöltés, vagy a szülő mindent kivett), a táblázatban alapból
 * kijelöltek (F-L1d). Ha az is üres, a reconcile az első listát adja, mint eddig.
 * @param {{ source:string, selected:string[], last:string[], preset:string[], keys:string[] }} o  listakulcsok
 */
export function wantedSelection({ source, selected, last, preset, keys }) {
  if (source === 'all') return keys;
  const has = (sel) => sel.some((k) => keys.includes(k));
  return [selected, last, preset].find(has) || [];
}

/** A már nem létező listák kimaradnak. Ha semmi nem marad, az első lista (ha van): csak betöltéskor. */
export function reconcile(sel, keys) {
  const out = order(keys, new Set(sel));
  return out.length ? out : keys.slice(0, 1);
}

/** A már nem létező listák kimaradnak; az üres kijelölés üres marad (a szülő választása). */
export const existing = (sel, keys) => order(keys, new Set(sel));

/**
 * A kijelölt listák sorai a listák sorrendjében, ismétlésekkel (2.14, S-2): ha egy tétel két kijelölt
 * listán szerepel, kétszer jön. A különböző tételeket a distinctItems (items.js) adja.
 * @param {{name:string, items:string[]}[]} lists
 * @param {string[]} sel
 * @param {(name:string)=>string} keyOf
 */
export function itemsOf(lists, sel, keyOf) {
  const set = new Set(sel);
  return lists.filter((l) => set.has(keyOf(l.name))).flatMap((l) => l.items);
}
