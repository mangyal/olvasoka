// A Haladás tárolt formátuma (docs/haladas-specifikacio.md, 4.2a). Tiszta modul.
//
// A program a memóriában olvasható objektumokkal dolgozik (lásd progress-log.js); ez a modul csak a
// localStorage-be írt alakot tömöríti és bontja ki. A logika és a statisztika a formátumtól független.
//
// 2. verzió (tömör):
// {
//   v: 2, dev: deviceId, ch: child,
//   r: [[id, t0, mode, listNames, listIds, listHash, flashMs, gapMs, count, completed, abandonedAt,
//        corrections, folded, items]],          // items: a kör tételei pozíció szerint (az események innen kapják)
//   e: { [körId]: "esemény;esemény;…" },        // esemény: "dt,i,kód" (dt: ms az előzőtől, 36-os számrendszer)
//   d: [[item, day, exposures, manual, dwell, covers, pauses, prevs, supported, fast, help, device?]],
//                                                // dwell: olvasási idők 100 ms-os egységben (2340 ms → 23)
//   l: { [listaId]: [names, items, hash, firstSeen, lastSeen] }
// }
// Eseménykódok: s show, n next, N next (idő járt le), p prev, P prev (szünetből), z pause, Z resume, b blur,
// c<db> cover, u uncover, h hidden, v visible, e end, x exit.
// Az 1. verzió (olvasható objektumok) betöltéskor átalakul; a következő mentés már a 2. verziót írja.

import { median } from '../core/exposures.js';

export const VERSION = 2;
/** Az olvasási idők tárolt felbontása (ms). A küszöbök 0,8–0,9-es arányaihoz bőven elég. */
const DWELL = 100;

const CODE = { show: 's', pause: 'z', resume: 'Z', blur: 'b', uncover: 'u', hidden: 'h', visible: 'v', end: 'e', exit: 'x' };
const TYPE = Object.fromEntries(Object.entries(CODE).map(([t, c]) => [c, t]));

function eventCode(e) {
  if (e.type === 'next') return e.auto ? 'N' : 'n';
  if (e.type === 'prev') return e.fromGap ? 'P' : 'p';
  if (e.type === 'cover') return `c${e.coveredCount ?? 1}`;
  return CODE[e.type];
}
function eventOf(code) {
  const c = code[0];
  if (c === 'n' || c === 'N') return { type: 'next', auto: c === 'N' };
  if (c === 'p') return { type: 'prev' };
  if (c === 'P') return { type: 'prev', fromGap: true };
  if (c === 'c') return { type: 'cover', coveredCount: Number(code.slice(1)) || 1 };
  return { type: TYPE[c] };
}

const dailyId = (device, child, item, day) => `${device}|${child}|${item}|${day}`;

/** Memóriabeli gyökér → tárolt (2. verzió). */
export function encode(root) {
  const byRound = new Map();
  for (const e of root.events) {
    if (!byRound.has(e.round)) byRound.set(e.round, []);
    byRound.get(e.round).push(e);
  }
  const t0 = new Map(root.rounds.map((r) => [r.id, r.t0]));
  const e = {};
  for (const [id, evs] of byRound) {
    let prev = t0.get(id) ?? evs[0].t;
    e[id] = evs.map((x) => {
      const dt = Math.max(0, x.t - prev); prev = x.t;
      return `${dt.toString(36)},${x.i.toString(36)},${eventCode(x)}`;
    }).join(';');
  }
  return {
    v: VERSION, dev: root.deviceId, ch: root.child,
    r: root.rounds.map((r) => [r.id, r.t0, r.mode === 'find' ? 'f' : 'r', r.listNames, r.listIds, r.listHash,
      r.flashMs, r.gapMs, r.count, r.completed ? 1 : 0, r.abandonedAt, r.corrections, r.folded ? 1 : 0, r.items || []]),
    e,
    d: root.daily.map((x) => {
      const row = [x.item, x.day, x.exposures, x.manualExposures, x.dwellMs.map((ms) => Math.round(ms / DWELL)), x.covers, x.pauses, x.prevs,
        x.supportedExposures, x.unsupportedFastFlash, x.help];
      const device = x.id.slice(0, x.id.indexOf('|'));
      if (device !== root.deviceId) row.push(device);       // más eszközről átvett (2. fázis)
      return row;
    }),
    l: Object.fromEntries(Object.entries(root.lists).map(([id, l]) => [id, [l.names, l.items, l.hash, l.firstSeen, l.lastSeen]])),
  };
}

/** Tárolt (1. vagy 2. verzió) → memóriabeli gyökér. Ismeretlen verziónál null. */
export function decode(s) {
  if (s?.v === 1) return fromV1(s);
  if (s?.v !== VERSION) return null;
  const rounds = (s.r || []).map((r) => ({
    id: r[0], child: s.ch, t0: r[1], mode: r[2] === 'f' ? 'find' : 'read', listNames: r[3], listIds: r[4], listHash: r[5],
    flashMs: r[6], gapMs: r[7], count: r[8], completed: r[9] === 1, abandonedAt: r[10], corrections: r[11],
    folded: r[12] === 1, items: r[13],
  }));
  const byId = new Map(rounds.map((r) => [r.id, r]));
  const events = [];
  for (const [id, text] of Object.entries(s.e || {})) {
    const r = byId.get(id);
    if (!r || !text) continue;
    let t = r.t0;
    text.split(';').forEach((tok, n) => {
      const [dt, i, code] = tok.split(',');
      t += parseInt(dt, 36);
      const pos = parseInt(i, 36);
      events.push({ id: `${id}:${n}`, round: id, t, i: pos, item: r.items[pos], ...eventOf(code) });
    });
  }
  events.sort((a, b) => a.t - b.t);
  return {
    v: VERSION, deviceId: s.dev, child: s.ch, events, rounds,
    daily: (s.d || []).map((x) => ({
      id: dailyId(x[11] || s.dev, s.ch, x[0], x[1]), child: s.ch, item: x[0], day: x[1],
      exposures: x[2], manualExposures: x[3], dwellMs: x[4].map((d) => d * DWELL), medianDwellMs: median(x[4].map((d) => d * DWELL)),
      covers: x[5], pauses: x[6], prevs: x[7], supportedExposures: x[8], unsupportedFastFlash: x[9], help: x[10],
    })),
    lists: Object.fromEntries(Object.entries(s.l || {}).map(([id, l]) => [id, { names: l[0], items: l[1], hash: l[2], firstSeen: l[3], lastSeen: l[4] }])),
  };
}

/** 1. verzió: olvasható objektumok; a körök tétellistája az eseményekből áll össze. */
function fromV1(s) {
  const rounds = (s.rounds || []).map((r) => ({ ...r }));
  const items = new Map(rounds.map((r) => [r.id, []]));
  for (const e of s.events || []) if (items.has(e.round)) items.get(e.round)[e.i] = e.item;
  for (const r of rounds) if (!r.items) r.items = Array.from(items.get(r.id), (x) => x ?? '');
  return { v: VERSION, deviceId: s.deviceId, child: s.child, events: s.events || [], daily: s.daily || [], rounds, lists: s.lists || {} };
}
