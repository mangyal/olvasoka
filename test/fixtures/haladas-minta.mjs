// Determinisztikus mintaadat a Haladás tesztjeihez: sok Felolvasás kör a valódi reducerrel és naplóval,
// kézi és villantásos körökkel, takarással, megállítással, mellényomással, elrejtett oldallal, kilépéssel.
// Ugyanaz a mag mindig ugyanazt az eseménysort adja, a napló kódjától függetlenül (csak a reducer számít).
//
// Használat: test/haladas-allapot-valtozatlan.test.js; a rögzített kimenet
// (haladas-minta-v2.json, haladas-minta-allapot.json) a villantásos olvasási idő bevezetése előtti
// kóddal készült (node test/fixtures/haladas-minta.mjs --write).
import { startRound, step } from '../../js/core/round.js';
import { createProgressLog } from '../../js/data/progress-log.js';
import { analyze } from '../../js/core/mastery.js';
import { DEFAULTS, resolve } from '../../js/core/haladas-config.js';

export const ITEMS = ['ma', 'ma-ma', 'mama', 'pi', 'pi-ló', 'ló', 'só', 'sí', 'mé-z', 'Ő', 'b', 'd', 'ház', 'ke-res', 'gyöngy', 'dzsungel'];
export const START = new Date(2026, 9, 1, 17, 0, 0).getTime();   // helyi idő: 2026-10-01 17:00
export const DAYS = 40;
const DAY = 86400000;
const FLASHES = [0, 0, 1000, 2500, 5000, 10000];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), raw: m };
}

/** Egy kör a reducerrel; a TICK-ek a határidőkön jönnek, mint a valódi felületen. */
function playRound(log, clock, rand, { items, flash, gap }) {
  const order = items.map((_, k) => k);
  const start = clock.t;
  let s = startRound(order, flash, gap, 0, { undoMs: DEFAULTS.szures.javitott_melle_ms });
  log.beginRound({ seq: order, items, listNames: ['Minta'], flashMs: flash, gapMs: gap, count: items.length });
  let hidden = false;
  const send = (ev, arg) => { const a = s; s = step(s, ev, clock.t - start, arg); log.step(a, ev, s); };
  const waitTo = (target) => {
    while (!s.done && !s.paused && Number.isFinite(s.deadline) && start + s.deadline <= target) {
      clock.t = start + s.deadline;
      send('TICK');
    }
    clock.t = target;
  };
  for (let n = 0; n < 80 && !s.done; n++) {
    const r = rand();
    const wait = r < 0.05 ? 31000 + rand() * 5000 : 150 + rand() * (r < 0.5 ? 2500 : 9000);
    waitTo(clock.t + Math.round(wait));
    if (s.done) break;
    const a = rand();
    if (a < 0.55) send('NEXT');
    else if (a < 0.63) send('PREV');
    else if (a < 0.71) send('PAUSE');
    else if (a < 0.79) send('COVER_DOWN', { n: 2 });
    else if (a < 0.84) { log.visibility(!hidden, s.index); hidden = !hidden; }
    else if (a < 0.86) { log.endRound(s.index); return; }
    else if (a < 0.9) send('BLUR');
    // egyébként csak telik az idő (villantásnál lejárhat)
  }
  log.endRound(s.done ? null : s.index);
}

/**
 * A minta lejátszása egy friss naplón.
 * @returns {{ log, storage, clock, now: number }}
 */
export function buildSample({ seed = 20261112, days = DAYS, config = DEFAULTS } = {}) {
  const rand = rng(seed);
  const clock = { t: START };
  const storage = memStorage();
  let id = 0;
  const newId = () => `m${String(++id).padStart(4, '0')}`;
  const log = createProgressLog({ key: 'k', storage, now: () => clock.t, newId, config });
  for (let d = 0; d < days; d++) {
    if (rand() < 0.15) continue;                     // kihagyott nap
    clock.t = START + d * DAY + Math.round(rand() * 3 * 3600000);
    const rounds = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < rounds; k++) {
      const pool = [...ITEMS].sort(() => rand() - 0.5).slice(0, 6 + Math.floor(rand() * 6));
      const flash = FLASHES[Math.floor(rand() * FLASHES.length)];
      const gap = flash && rand() < 0.4 ? 1000 : 0;
      playRound(log, clock, rand, { items: pool, flash, gap });
      clock.t += 60000;
    }
  }
  return { log, storage, clock, now: START + days * DAY };
}

/** Az állapotszámítás összehasonlítható kivonata (tételállapotok és betűarányok). */
export function statesOf(daily, now) {
  const out = {};
  for (const [name, cfg] of [['alap', DEFAULTS], ['napszabaly_nelkul', resolve(null, { skipDayRules: true })]]) {
    const an = analyze(daily, { now, cfg });
    out[name] = {
      practiceDays: an.practiceDays,
      itemsRead: an.itemsRead,
      states: Object.fromEntries([...an.states].sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([k, v]) => [k, { state: v.state, exposures: v.exposures, dayCount: v.dayCount, relative: v.relative, helpRecent: v.helpRecent, coverMostly: v.coverMostly }])),
      letters: Object.fromEntries([...an.letters.rate].sort(([a], [b]) => (a < b ? -1 : 1))),
    };
  }
  return out;
}

if (process.argv.includes('--write')) {
  const { writeFileSync } = await import('node:fs');
  const { log, storage, now } = buildSample();
  const dir = new URL('.', import.meta.url);
  writeFileSync(new URL('haladas-minta-v2.json', dir), storage.getItem('k'));
  writeFileSync(new URL('haladas-minta-allapot.json', dir), JSON.stringify({ now, ...statesOf(log.root.daily, now) }, null, 1) + '\n');
  console.log('kész:', log.root.rounds.length, 'kör,', log.root.daily.length, 'napi összesítő');
}
