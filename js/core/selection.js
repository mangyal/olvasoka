// Listák kijelölése (egy vagy több). Tiszta modul.
//
// A kijelölés listakulcsok (nameKey) tömbje, mindig a listák megjelenési sorrendjében,
// és sosem üres, ha van lista.

/**
 * Kattintás a listasávban.
 * @param {string[]} sel     a jelenlegi kijelölés
 * @param {string} key       a kattintott lista kulcsa
 * @param {{ toggle?:boolean, range?:boolean, anchor?:string|null, keys:string[] }} o
 *   toggle: Ctrl/Cmd (hozzáad vagy kivesz), range: Shift (tartomány az anchortól),
 *   keys: az összes lista kulcsa megjelenési sorrendben
 * @returns {{ sel:string[], anchor:string }}
 */
export function clickSelect(sel, key, { toggle = false, range = false, anchor = null, keys }) {
  const order = (set) => keys.filter((k) => set.has(k));
  if (!keys.includes(key)) return { sel: order(new Set(sel)), anchor };

  if (range) {
    const a = keys.includes(anchor) ? anchor : key;
    const [i, j] = [keys.indexOf(a), keys.indexOf(key)].sort((x, y) => x - y);
    const span = keys.slice(i, j + 1);
    const set = new Set(toggle ? [...sel, ...span] : span);
    return { sel: order(set), anchor: a };
  }

  if (toggle) {
    const set = new Set(sel);
    if (set.has(key)) { if (set.size > 1) set.delete(key); } else set.add(key);
    return { sel: order(set), anchor: key };
  }

  return { sel: [key], anchor: key };
}

/** A már nem létező listák kimaradnak. Ha semmi nem marad, az első lista (ha van). */
export function reconcile(sel, keys) {
  const set = new Set(sel);
  const out = keys.filter((k) => set.has(k));
  return out.length ? out : keys.slice(0, 1);
}

/**
 * A kijelölt listák tételeinek uniója, ismétlődés nélkül, a listák sorrendjében.
 * @param {{name:string, items:string[]}[]} lists
 * @param {string[]} sel
 * @param {(name:string)=>string} keyOf
 */
export function itemsOf(lists, sel, keyOf) {
  const set = new Set(sel);
  return [...new Set(lists.filter((l) => set.has(keyOf(l.name))).flatMap((l) => l.items))];
}

/** A tételforrás a kijelölésből: ha minden lista ki van jelölve, 'all', különben 'list'. */
export function sourceFor(sel, keys) {
  return keys.length > 0 && keys.every((k) => sel.includes(k)) ? 'all' : 'list';
}

/**
 * A forrásválasztó megnyomása után a kijelölés.
 * 'all': minden lista. 'list': ha minden ki volt jelölve, csak az első; különben marad.
 */
export function applySource(source, sel, keys) {
  if (source === 'all') return keys.slice();
  return sourceFor(sel, keys) === 'all' ? keys.slice(0, 1) : reconcile(sel, keys);
}
