// Haladás és a 2.14 (csoportosítás, súlyozás ismétléssel): a kör sorrendjének módja (order), a 4. tárolt
// verzió, és hogy az ismétlődő tételek nem duplázzák a tételsorokat (H-1–H-4, S-4). Rögzített órával.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startRound, step } from '../js/core/round.js';
import { listHash } from '../js/core/exposures.js';
import { DEFAULTS } from '../js/core/haladas-config.js';
import { analyze, grouped, currentItems } from '../js/core/mastery.js';
import { createProgressLog } from '../js/data/progress-log.js';
import { encode, decode, VERSION } from '../js/data/progress-codec.js';

const ROOT = new URL('..', import.meta.url).pathname;
const FIX = (f) => JSON.parse(readFileSync(join(ROOT, 'test/fixtures', f), 'utf8'));
const T0 = new Date(2026, 10, 16, 17, 0, 0).getTime();

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
let n = 0;
const fresh = (storage = memStorage()) => {
  const clock = { t: T0 };
  return { clock, storage, log: createProgressLog({ key: 'k', storage, now: () => clock.t, newId: () => `s${++n}`, config: DEFAULTS }) };
};

/** Kézi kör: seq a sorok indexei; minden tételnél `ms` ideig olvas, aztán NEXT. */
function play(log, clock, { rows, seq, order, ms = 1500 }) {
  let s = startRound(seq, 0, 0, 0, { undoMs: DEFAULTS.szures.javitott_melle_ms });
  log.beginRound({ seq, items: rows, listNames: ['L'], flashMs: 0, gapMs: 0, count: seq.length, order });
  let t = 0;
  while (!s.done) {
    t += ms; clock.t = T0 + t;
    const a = s; s = step(s, 'NEXT', t); log.step(a, 'NEXT', s);
  }
  log.endRound(null);
}

test('H-2: az új kör rekordja order: "grouped" vagy "mixed" (a kapcsoló állása)', () => {
  const { log, clock } = fresh();
  play(log, clock, { rows: ['a', 'e'], seq: [0, 1], order: 'grouped' });
  play(log, clock, { rows: ['a', 'e'], seq: [1, 0], order: 'mixed' });
  assert.deepEqual(log.root.rounds.map((r) => r.order), ['grouped', 'mixed']);
});

test('H-4: 4. verzió, a kör sor utolsó eleme o (1 = grouped, 0 = mixed); oda-vissza azonos', () => {
  const { log, clock, storage } = fresh();
  play(log, clock, { rows: ['a', 'e'], seq: [0, 1], order: 'grouped' });
  play(log, clock, { rows: ['a', 'e'], seq: [0, 1], order: 'mixed' });
  const s = JSON.parse(storage.getItem('k'));
  assert.equal(VERSION, 4);
  assert.equal(s.v, 4);
  assert.deepEqual(s.r.map((r) => [r.length, r.at(-1)]), [[16, 1], [16, 0]]);
  const back = decode(s);
  assert.deepEqual(back.rounds.map((r) => r.order), ['grouped', 'mixed']);
  assert.deepEqual(decode(encode(back)), back);
});

test('H-4: a 3. verziós adat betöltése után a régi körök "mixed"-ek, a mentés 4. verziót ír', () => {
  const { log, clock, storage } = fresh();
  play(log, clock, { rows: ['a', 'e'], seq: [0, 1], order: 'grouped' });
  const v3 = JSON.parse(storage.getItem('k'));
  v3.v = 3; v3.r = v3.r.map((r) => r.slice(0, 15));
  const old = memStorage();
  old.setItem('k', JSON.stringify(v3));
  const { log: l2, clock: c2 } = fresh(old);
  assert.deepEqual(l2.root.rounds.map((r) => r.order), ['mixed']);
  play(l2, c2, { rows: ['a', 'e'], seq: [0, 1], order: 'grouped' });
  const saved = JSON.parse(old.getItem('k'));
  assert.equal(saved.v, 4);
  assert.deepEqual(saved.r.map((r) => r[15]), [0, 1]);
});

test('H-4: a rögzített mintaállapotok (1–3. verzió) betöltésekor minden kör "mixed"', () => {
  for (const f of ['haladas-minta-v2.json']) {
    const r = decode(FIX(f));
    assert.ok(r.rounds.length > 0);
    assert.ok(r.rounds.every((x) => x.order === 'mixed'), f);
  }
  const v1 = decode({ v: 1, deviceId: 'd', child: 'c', events: [], rounds: [{ id: 'x', t0: 1, mode: 'read', flashMs: 0 }], daily: [], lists: {} });
  assert.equal(v1.rounds[0].order, 'mixed');
});

test('H-1: egy körön belül kétszer megjelenő tétel napi összesítőjében 2 megjelenés és 2 olvasási idő', () => {
  const { log, clock } = fresh();
  const rows = ['ka', 'mo', 'ka'];
  play(log, clock, { rows, seq: [0, 1, 2], order: 'grouped', ms: 1500 });
  const ka = log.root.daily.find((d) => d.item === 'ka');
  assert.equal(ka.exposures, 2);
  assert.deepEqual(ka.dwellMs, [1500, 1500]);
  assert.deepEqual(log.root.rounds[0].items, ['ka', 'mo', 'ka'], 'a kör tételsora pozíció szerint (H-3)');
});

test('S-4: a lista hash-e a különböző tételkulcsokból; ismétlés nélküli listán változatlan', () => {
  assert.equal(listHash(['a', 'e', 'a', 'e', 'o']), listHash(['a', 'e', 'o']));
  assert.equal(listHash(['ka', 'mo']), listHash(['mo', 'ka']));
  assert.notEqual(listHash(['ma']), listHash(['Ma']));
  // rögzített értékek (a 2.14 előtti programmal számolva): ismétlés nélküli lista hash-e nem változik
  assert.equal(listHash(['a', 'e', 'o']), 'c43ab106');
  assert.equal(listHash(['fa', 'ke-fe', 'lu-fi']), '587568e5');
  assert.equal(listHash(['fa', 'ke-fe', 'fa', 'lu-fi']), '587568e5');
});

test('S-4: a Haladás lista nézetei tételenként egy sort mutatnak, ismétléses listán is', () => {
  const lists = [{ name: 'L', items: ['a', 'e', 'a', 'e', 'o'] }];
  assert.deepEqual(currentItems(lists), ['a', 'e', 'o']);
  const an = analyze([], { now: T0, cfg: DEFAULTS });
  const g = grouped(an, lists);
  const all = Object.values(g).flatMap((x) => (Array.isArray(x) ? x : x.items || [])).map((x) => x.item ?? x);
  assert.deepEqual([...all].sort(), ['a', 'e', 'o']);
});
