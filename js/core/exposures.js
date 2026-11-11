// Nyers naplóból megjelenések, megjelenésekből napi tételösszesítők (docs/haladas-specifikacio.md, 5.2, 4.2).
// Tiszta modul: az időt és a konfigurációt kívülről kapja.
//
// Fogalmak:
//   látogatás   egy `show` és a tétel elhagyása (next, prev, exit, end) közötti szakasz
//   megjelenés  a kör egy pozíciójának (i) összes érvényes látogatása; ebből lesz a napi összesítő
//
// Szűrés (szures.* a haladas.json-ból):
//   kézi → majd javitott_melle_ms-on belül ←   javított mellényomás: a közbülső látogatás törlődik, a
//                                               visszatérés folytatás (az idő összeadódik), nem segítség
//   a megjelenés látható ideje < veletlen_atugras_ms   véletlen átugrás: nem megjelenés
//   takarás + felfedés takaras_ugyetlenseg_ms-on belül  figyelmen kívül marad
//   egyéb ← (szünetből is)                     valódi újraolvasás: segítség azon a tételen, ahová visszalép;
//                                               az újraolvasás ideje nem számít bele az olvasási időbe
//   olvasási idő > max_olvasasi_ido_ms         a megjelenés számít, az idő nem
// Látható idő: az oldal elrejtése (hidden → visible) nem olvasási idő; a megállítás alatt eltelt idő igen.

import { itemKey } from './items.js';

/** Helyi naptári nap (YYYY-MM-DD) a böngésző időzónájában. */
export function dayOf(t) {
  const d = new Date(t);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A lista tartalmi hash-e: 8 hexa karakter a rendezett, egyedi tételkulcsokból (FNV-1a, 32 bit). */
export function listHash(items) {
  const text = [...new Set(items.map(itemKey))].sort().join('\n');
  let h = 0x811c9dc5;
  for (const ch of new TextEncoder().encode(text)) { h ^= ch; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

export function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/* ---------- látogatások ---------- */

function visitsOf(events) {
  const visits = [];
  let v = null, gapPrev = false;
  const close = (t, leave, extra = {}) => {
    if (!v) return;
    if (v.hiddenAt != null) { v.hiddenMs += t - v.hiddenAt; v.hiddenAt = null; }
    Object.assign(v, { end: t, leave, ...extra });
    visits.push(v); v = null;
  };
  for (const e of events) {
    switch (e.type) {
      case 'show':
        close(e.t, 'exit');
        v = { i: e.i, item: e.item, start: e.t, hiddenMs: 0, hiddenAt: null, covers: [], pauses: 0, afterGapPrev: gapPrev };
        gapPrev = false;
        break;
      case 'next': close(e.t, 'next', { auto: Boolean(e.auto) }); break;
      case 'prev': if (e.fromGap) gapPrev = true; else close(e.t, 'prev'); break;
      case 'exit': case 'end': close(e.t, e.type); break;
      case 'pause': if (v) v.pauses++; break;
      case 'cover': if (v) v.covers.push({ t: e.t, end: null }); break;
      case 'uncover': { const c = v?.covers.at(-1); if (c && c.end == null) c.end = e.t; break; }
      case 'hidden': if (v && v.hiddenAt == null) v.hiddenAt = e.t; break;
      case 'visible': if (v && v.hiddenAt != null) { v.hiddenMs += e.t - v.hiddenAt; v.hiddenAt = null; } break;
      default: break;            // resume, blur: nem változtat
    }
  }
  if (v) close(events.at(-1).t, 'exit');   // a lap bezárult a kör közben
  for (const x of visits) x.ms = Math.max(0, x.end - x.start - x.hiddenMs);
  return visits;
}

/* ---------- megjelenések ---------- */

/**
 * Egy kör megjelenései.
 * @param {{ id: string, flashMs: number }} round
 * @param {object[]} events  a kör eseményei időrendben ({ t, type, i, item, … })
 * @param {object} szures    a haladas.json `szures` szakasza
 * @returns {{ exposures: object[], corrections: number, completed: boolean, abandonedAt: number|null }}
 */
export function roundExposures(round, events, szures) {
  const visits = visitsOf(events);
  const by = new Map();             // i → gyűjtő
  const acc = (v) => {
    if (!by.has(v.i)) by.set(v.i, { i: v.i, item: v.item, t: v.start, seenMs: 0, chain: 0, dwell: null, covers: 0, pauses: 0, prevs: 0 });
    return by.get(v.i);
  };
  let corrections = 0;
  let kind = 'normal';              // a következő látogatás fajtája: normal | continue | reread
  for (let k = 0; k < visits.length; k++) {
    const v = visits[k], p = visits[k - 1];
    const mispress = v.leave === 'prev' && v.ms < szures.javitott_melle_ms
      && p && p.leave === 'next' && !p.auto && p.i === v.i - 1 && kind !== 'reread';
    if (mispress) { corrections++; kind = 'continue'; continue; }   // a közbülső látogatás törlődik
    const a = acc(v);
    const me = v.afterGapPrev ? 'reread' : kind;
    a.seenMs += v.ms;
    a.pauses += v.pauses;
    a.covers += v.covers.filter((c) => c.end == null || c.end - c.t >= szures.takaras_ugyetlenseg_ms).length;
    if (me === 'reread') a.prevs++;
    else a.chain = me === 'continue' ? a.chain + v.ms : v.ms;
    if (me !== 'reread' && v.leave === 'next' && !v.auto) a.dwell = a.chain;
    kind = v.leave === 'prev' ? 'reread' : 'normal';
  }

  const manual = round.flashMs === 0;
  const exposures = [...by.values()]
    .filter((a) => a.seenMs >= szures.veletlen_atugras_ms)
    .sort((x, y) => x.t - y.t)
    .map((a) => {
      const dwellMs = manual && a.dwell != null && a.dwell <= szures.max_olvasasi_ido_ms ? a.dwell : null;
      return {
        round: round.id, i: a.i, item: itemKey(a.item), t: a.t, day: dayOf(a.t), flashMs: round.flashMs, manual,
        dwellMs, covers: a.covers, pauses: a.pauses, prevs: a.prevs, supported: a.covers + a.pauses + a.prevs > 0,
      };
    });
  const last = events.at(-1);
  const completed = events.some((e) => e.type === 'end');
  return { exposures, corrections, completed, abandonedAt: !completed && last?.type === 'exit' ? last.i ?? null : null };
}

/* ---------- napi összesítők ---------- */

/**
 * Két összesítő ugyanarra a tétel × napra (a meglévő és egy újabb kör megjelenései) egyben.
 * A sorozatok időrendben fűződnek; a medián a megmaradt értékekből számol (napi 20 alatt pontos).
 */
export function mergeDaily(a, b) {
  const dwell = keepEnds([...a.dwellMs, ...b.dwellMs]);
  const add = (k) => a[k] + b[k];
  return {
    ...a,
    exposures: add('exposures'), manualExposures: add('manualExposures'),
    dwellMs: dwell, medianDwellMs: median(dwell),
    covers: add('covers'), pauses: add('pauses'), prevs: add('prevs'),
    supportedExposures: add('supportedExposures'), unsupportedFastFlash: add('unsupportedFastFlash'),
    help: keepEnds([...a.help, ...b.help]).join(''),
  };
}

/** Hosszú sorozatból az eleje és a vége (a kiindulás az elejéből, a legutóbbiak a végéből számolnak). */
export function keepEnds(xs, n = 20) {
  return xs.length <= n ? xs : [...xs.slice(0, n / 2), ...xs.slice(-n / 2)];
}

/**
 * Napi tételösszesítők (tétel × nap) a megjelenésekből.
 * @param {object[]} exposures  bármennyi kör megjelenései
 * @param {{ deviceId: string, child: string, fastFlashMs: number }} o
 * @returns {object[]} a 4.2 szerinti rekordok, `help` mezővel: megjelenésenként '1' (segítséggel) vagy '0',
 *   időrendben (legfeljebb 20: az első és az utolsó 10)
 */
export function dailyRecords(exposures, { deviceId, child, fastFlashMs }) {
  const groups = new Map();
  for (const e of [...exposures].sort((x, y) => x.t - y.t)) {
    const id = `${deviceId}|${child}|${e.item}|${e.day}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(e);
  }
  return [...groups].map(([id, xs]) => {
    const dwell = xs.filter((e) => e.dwellMs != null).map((e) => e.dwellMs);
    const sum = (k) => xs.reduce((s, e) => s + e[k], 0);
    return {
      id, child, item: xs[0].item, day: xs[0].day,
      exposures: xs.length,
      manualExposures: xs.filter((e) => e.manual).length,
      dwellMs: keepEnds(dwell),
      medianDwellMs: median(dwell),
      covers: sum('covers'), pauses: sum('pauses'), prevs: sum('prevs'),
      supportedExposures: xs.filter((e) => e.supported).length,
      unsupportedFastFlash: xs.filter((e) => !e.supported && !e.manual && e.flashMs <= fastFlashMs).length,
      help: keepEnds(xs.map((e) => (e.supported ? '1' : '0'))).join(''),
    };
  });
}
