// A Haladás nézet adatai a szülő eszközén (docs/haladas-specifikacio.md, 4.): eseménynapló, körök,
// napi tételösszesítők, listaazonosság. Minden tárolás try/catch között (a js/data/store.js mintájára):
// ha a tárolás nem elérhető, a gyakorlás változatlanul működik, a napló csak memóriában él.
//
// Memóriabeli gyökér: { v, deviceId, child, events, daily, rounds, lists } (olvasható objektumok).
// A tárolt alak tömör (data/progress-codec.js, 3. verzió); az 1. és 2. verzió betöltéskor átalakul.
// - Villantásos olvasási idő (flashDwell): az új körök a lezáráskor kitöltik. A korábbi verzióval lezárt
//   körökét betöltéskor egyszer pótoljuk a még meglévő nyers eseményekből (`flashDwellDone`, tárolva: fd).
// - A nyers események a legutóbbi `tarolas.nyers_megorzes_kor` lezárt körből és legfeljebb
//   `tarolas.nyers_megorzes_nap` napig maradnak (ami bármelyiken túl van, törlődik); addig a napi összesítők
//   belőlük újraszámolhatók (core/exposures.js). A kör végén a kör megjelenései egyszer hozzáadódnak.
// - Kvótahibánál előbb a legrégebbi nyers események törlődnek (az összesítésük után), a napi összesítők soha.
// - Ismeretlen (újabb) verziójú gyökeret nem írunk felül: a napló ilyenkor csak memóriában él.

import { transitionEvents } from '../core/practice-log.js';
import { roundExposures, dailyRecords, mergeDaily, dayOf, listHash, keepEnds, flashDwellOf } from '../core/exposures.js';
import { reconcileLists } from '../core/list-identity.js';
import { itemKey, nameKey } from '../core/items.js';
import { DEFAULTS } from '../core/haladas-config.js';
import { encode, decode, VERSION } from './progress-codec.js';

export { VERSION };
const DAY = 86400000;

/** Rövid véletlen azonosító: 10 karakter 36-os számrendszerben (kb. 51 bit). */
export function randomId() {
  const c = globalThis.crypto;
  const b = new Uint8Array(8);
  if (c?.getRandomValues) c.getRandomValues(b); else for (let i = 0; i < 8; i++) b[i] = Math.floor(Math.random() * 256);
  let n = 0n;
  for (const x of b) n = (n << 8n) | BigInt(x);
  return (n % (36n ** 10n)).toString(36).padStart(10, '0');
}

const emptyRoot = (newId) => ({ v: VERSION, deviceId: `r-${newId()}`, child: 'default', events: [], daily: [], rounds: [], lists: {} });

const isQuota = (e) => e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);

/**
 * @param {object} o
 * @param {string} o.key              tárolási név (ENV.progressKey)
 * @param {Storage|null} [o.storage]  alapból a localStorage, ha elérhető
 * @param {() => number} [o.now]      falióra (ms); tesztben rögzített
 * @param {() => string} [o.newId]
 * @param {object} [o.config]         a resolve()-olt haladas.json
 */
export function createProgressLog({ key, storage = probe(), now = () => Date.now(), newId = randomId, config = DEFAULTS } = {}) {
  let cfg = config;
  let writable = Boolean(storage);
  let root = load();
  let cur = null;                    // a futó kör: { round, items: string[], events: [] }

  function load() {
    if (!storage) return emptyRoot(newId);
    try {
      const raw = storage.getItem(key);
      if (!raw) return emptyRoot(newId);
      const stored = JSON.parse(raw);
      const r = decode(stored);
      if (!r) {
        console.warn(`Haladás: ismeretlen adatverzió (${stored?.v}), a napló most nem mentődik.`);
        writable = false;
        return emptyRoot(newId);
      }
      return r;
    } catch {
      return emptyRoot(newId);       // sérült tartalom: újrakezdjük (a régi a következő íráskor felülíródik)
    }
  }

  function save() {
    if (!writable) return false;
    for (;;) {
      try { storage.setItem(key, JSON.stringify(encode(root))); return true; } catch (e) {
        if (!isQuota(e) || !dropOldestEvents()) { writable = false; return false; }
      }
    }
  }

  /** Kvótahiba: a legrégebbi negyed nyers esemény törlődik (a napi összesítő már tartalmazza). */
  function dropOldestEvents() {
    const folded = new Set(root.rounds.filter((r) => r.folded).map((r) => r.id));
    const old = root.events.filter((e) => folded.has(e.round));
    if (!old.length) return false;
    const drop = new Set(old.slice(0, Math.max(1, Math.ceil(old.length / 4))).map((e) => e.id));
    root.events = root.events.filter((e) => !drop.has(e.id));
    return true;
  }

  const cutoffDay = () => dayOf(now() - cfg.tarolas.nyers_megorzes_nap * DAY);

  /**
   * Egy kör lezárása: kör-összegzés, a megjelenései hozzáadódnak a napi összesítőkhöz (egyszer: `folded`),
   * majd a régi nyers események törlődnek.
   */
  function fold(round) {
    const evs = root.events.filter((e) => e.round === round.id);
    if (evs.length && round.mode === 'read') {
      const r = roundExposures(round, evs, cfg.szures);
      Object.assign(round, { completed: r.completed, abandonedAt: r.abandonedAt, corrections: r.corrections });
      const fresh = dailyRecords(r.exposures, { deviceId: root.deviceId, child: root.child, fastFlashMs: cfg.szures.gyors_villantas_ms });
      const at = new Map(root.daily.map((d, k) => [d.id, k]));
      for (const d of fresh) {
        if (at.has(d.id)) root.daily[at.get(d.id)] = mergeDaily(root.daily[at.get(d.id)], d);
        else { at.set(d.id, root.daily.length); root.daily.push(d); }
      }
    }
    round.folded = true;
    round.flashDwellDone = true;
    compact();
  }

  /**
   * Egyszeri pótlás: a korábbi verzióval lezárt villantásos Felolvasás körök villantásos idői a megmaradt
   * nyers eseményekből. Csak a napi összesítő `flashDwell` mezője változik (a többi már benne van).
   * A körök időrendben (t0); a hiányos nyers eseményű kör kimarad. Minden érintett kör `flashDwellDone`
   * lesz, így ismételt betöltéskor nem fűz hozzá újra.
   * @returns {boolean} változott-e valami
   */
  function backfillFlashDwell() {
    const todo = root.rounds.filter((r) => r.folded && !r.flashDwellDone).sort((a, b) => a.t0 - b.t0);
    if (!todo.length) return false;
    const evs = new Map(todo.map((r) => [r.id, []]));
    for (const e of root.events) evs.get(e.round)?.push(e);
    const at = new Map(root.daily.map((d, k) => [d.id, k]));
    for (const r of todo) {
      r.flashDwellDone = true;
      const xs = evs.get(r.id);
      if (r.mode !== 'read' || !(r.flashMs > 0) || !complete(xs)) continue;
      const groups = new Map();
      for (const e of roundExposures(r, xs, cfg.szures).exposures) {
        const id = `${root.deviceId}|${root.child}|${e.item}|${e.day}`;
        if (!groups.has(id)) groups.set(id, []);
        groups.get(id).push(e);
      }
      for (const [id, group] of groups) {
        const d = root.daily[at.get(id)];
        const add = flashDwellOf(group);
        if (d && add.length) d.flashDwell = keepEnds([...(d.flashDwell || []), ...add]);
      }
    }
    return true;
  }

  /** A nyers napló korlátja: a legutóbbi N lezárt kör, és legfeljebb a megőrzési napokig. A futó kör marad. */
  function compact() {
    const cut = cutoffDay();
    const folded = root.rounds.filter((r) => r.folded);
    const old = new Set(folded.slice(0, Math.max(0, folded.length - cfg.tarolas.nyers_megorzes_kor)).map((r) => r.id));
    root.events = root.events.filter((e) => !old.has(e.round) && dayOf(e.t) >= cut);
  }

  function push(type, i, extra = {}) {
    if (!cur) return;
    root.events.push({ id: `${cur.round.id}:${cur.n++}`, round: cur.round.id, t: now(), i, item: cur.items[i], type, ...extra });
  }

  // indulás: előbb a régebbi körök villantásos idejének pótlása (amíg a nyers események megvannak, és hogy
  // az idők időrendben maradjanak), majd a korábban félbemaradt (pl. bezárt lappal véget ért) körök lezárása
  const filled = backfillFlashDwell();
  for (const r of root.rounds) if (!r.folded) fold(r);
  compact();
  if (filled) save();

  return {
    get available() { return writable; },
    get root() { return root; },
    get config() { return cfg; },
    /** A haladas.json betöltése után (a futó kört nem érinti). */
    setConfig(c) { cfg = c; },

    /** Listaazonosság a most betöltött listákra (6.). */
    syncLists(lists) {
      const r = reconcileLists(root.lists, lists.map((l) => ({ name: l.name, items: l.items })), { now: now(), newId });
      root.lists = r.lists;
      save();
      return r.idOf;
    },

    /**
     * Felolvasás kör indulása. A Keresd meg! kör egyelőre nem naplózódik.
     * @param {{ seq: number[], items: string[], listNames: string[], flashMs: number, gapMs: number, count: number }} o
     *   seq: a kör sorozata (indexek az items-be); a napló a kör pozícióit (i) használja
     */
    beginRound({ seq, items, listNames, flashMs, gapMs, count }) {
      const ids = new Map(Object.entries(root.lists).map(([id, l]) => [nameKey(l.names.at(-1)), id]));
      const round = {
        id: newId(), child: root.child, t0: now(), mode: 'read',
        listNames: [...listNames], listIds: listNames.map((n) => ids.get(nameKey(n)) || null),
        listHash: listHash(items), flashMs, gapMs, count, completed: false, abandonedAt: null, corrections: 0, folded: false, flashDwellDone: false,
        items: seq.map((k) => itemKey(items[k])),
      };
      root.rounds.push(round);
      cur = { round, items: round.items, n: 0 };
      push('show', 0);
      save();
    },

    /** A reducer egy átmenete (core/round.js step előtt és után). */
    step(a, ev, b) {
      if (!cur) return;
      for (const e of transitionEvents(a, ev, b)) {
        const { type, i, ...extra } = e;
        push(type, i, extra);
      }
    },

    /** Az oldal elrejtése / újra látszik: az elrejtett idő nem olvasási idő. */
    visibility(hidden, i) {
      if (!cur) return;
      push(hidden ? 'hidden' : 'visible', i);
      if (hidden) save();            // a lap bezárulhat: ami eddig történt, megmarad
    },

    /** A kör vége: jutalom (a step már naplózta az `end`-et) vagy kilépés közben (`exitAt`: a látható pozíció). */
    endRound(exitAt = null) {
      if (!cur) return;
      if (exitAt != null) push('exit', exitAt);
      const { round } = cur;
      cur = null;
      fold(round);
      save();
    },
  };
}

/** A kör nyers eseményei teljesek-e: az első esemény az első pozíció megjelenése (az elejéről törlődik). */
function complete(events) {
  return events.length > 0 && events[0].type === 'show' && events[0].i === 0;
}

function probe() {
  try {
    const s = globalThis.localStorage;
    const k = '__olvasoka_probe';
    s.setItem(k, '1'); s.removeItem(k);
    return s;
  } catch { return null; }
}
