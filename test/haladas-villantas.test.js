// Haladás: villantásos olvasási idő (flashDwell), 3. tárolt verzió, egyszeri pótlás, és hogy a tételállapotok
// nem változnak (docs/haladas-specifikacio.md 3., 4.2, 4.2a, 4.3, 5.2). Rögzített órával, várakozás nélkül.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startRound, step } from '../js/core/round.js';
import { roundExposures, mergeDaily, dailyRecords } from '../js/core/exposures.js';
import { DEFAULTS, resolve } from '../js/core/haladas-config.js';
import { createProgressLog } from '../js/data/progress-log.js';
import { encode, decode, VERSION } from '../js/data/progress-codec.js';
import { buildSample, statesOf } from './fixtures/haladas-minta.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const FIX = (f) => JSON.parse(readFileSync(join(ROOT, 'test/fixtures', f), 'utf8'));
const S = DEFAULTS.szures;
const T0 = new Date(2026, 10, 2, 17, 0, 0).getTime();   // helyi idő: 2026-11-02 17:00

/* ---------- segédek (mint a haladas-naplo.test.js-ben) ---------- */

function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
let n = 0;
const ids = () => `v${++n}`;

/** steps: [esemény, ms a kör elejétől, arg?] vagy ['HIDE'|'SHOW', ms]; 'EXIT' kilép, 'STOP' lezárás nélkül hagyja. */
function play(log, clock, { items, flash = 0, gap = 0, start = clock.t }, steps) {
  clock.t = start;
  const order = items.map((_, k) => k);
  let s = startRound(order, flash, gap, 0, { undoMs: S.javitott_melle_ms });
  log.beginRound({ seq: order, items, listNames: ['L'], flashMs: flash, gapMs: gap, count: items.length });
  for (const [ev, ms, arg] of steps) {
    clock.t = start + ms;
    if (ev === 'HIDE' || ev === 'SHOW') { log.visibility(ev === 'HIDE', s.index); continue; }
    if (ev === 'EXIT') { log.endRound(s.index); return; }
    if (ev === 'STOP') return;
    const a = s;
    s = step(s, ev, ms, arg);
    log.step(a, ev, s);
  }
  log.endRound(s.done ? null : s.index);
}
const fresh = (o = {}) => {
  const clock = { t: T0 };
  const storage = o.storage ?? memStorage();
  const log = createProgressLog({ key: 'k', storage, now: () => clock.t, newId: ids, config: o.config ?? DEFAULTS });
  return { log, clock, storage };
};
const reopen = (storage, clock, config = DEFAULTS) => createProgressLog({ key: 'k', storage, now: () => clock.t, newId: ids, config });
const day = (log, item) => log.root.daily.find((d) => d.item === item);

/** Egy kör megjelenései a naplóból (az első / megadott kör). */
function exposuresOf(log, k = 0) {
  const r = log.root.rounds[k];
  return roundExposures(r, log.root.events.filter((e) => e.round === r.id), S).exposures;
}
const byItem = (xs, item) => xs.find((e) => e.item === item);

/** 3. verziójú tárolt adat 2. verzióvá (ahogy egy régi programváltozat írta volna). */
function toV2(s) {
  return {
    ...s, v: 2,
    r: s.r.map((r) => r.slice(0, 14)),
    d: s.d.map((x) => [...x.slice(0, 11), ...(x.length > 12 ? [x[12]] : [])]),
  };
}
const withoutFlash = (daily) => daily.map(({ flashDwell, ...d }) => d);

/* ---------- 1–7, A–C: mikor van villantásos olvasási idő ---------- */

test('1. villantás, gombnyomás a lejárat előtt: az eltelt idő a flashDwellMs, a dwellMs üres', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'], flash: 10000 }, [['NEXT', 3200], ['NEXT', 4000]]);
  const e = byItem(exposuresOf(log), 'ma');
  assert.equal(e.flashDwellMs, 3200);
  assert.equal(e.dwellMs, null);
  const d = day(log, 'ma');
  assert.deepEqual(d.flashDwell, [{ ms: 3200, flashMs: 10000 }], 'a villantás hosszával együtt');
  assert.deepEqual(d.dwellMs, []);
  assert.equal(d.manualExposures, 0);
  assert.equal(d.unsupportedFastFlash, 0, '10 mp-es villantás nem gyors (régi szabály)');
  const fast = fresh();
  play(fast.log, fast.clock, { items: ['ma'], flash: 3000 }, [['NEXT', 1000]]);
  assert.equal(day(fast.log, 'ma').unsupportedFastFlash, 1, '3 mp-es villantás gyors, mint eddig');
});

test('2. lejárt villantás (auto): nincs idő, a megjelenés számít', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me', 'mi'], flash: 1000 }, [['TICK', 1000], ['TICK', 2000], ['TICK', 3000]]);
  assert.ok(exposuresOf(log).every((e) => e.flashDwellMs === null));
  for (const it of ['ma', 'me', 'mi']) {
    assert.deepEqual(day(log, it).flashDwell, []);
    assert.equal(day(log, it).exposures, 1);
  }
});

test('3. javított mellényomás villantásos körben: a két szakasz ideje összeadódik', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'], flash: 10000 }, [['NEXT', 1500], ['PREV', 2500], ['NEXT', 4000], ['NEXT', 6000]]);
  assert.equal(log.root.rounds[0].corrections, 1);
  const e = byItem(exposuresOf(log), 'ma');
  assert.equal(e.flashDwellMs, 3000, '1500 + 1500, a közbülső látogatás törlődik');
  assert.equal(e.supported, false, 'a javítás nem segítség');
});

test('C. mellényomás javítása után lejár a villantás: nincs idő', () => {
  const { log, clock } = fresh();
  // 1000-nél tovább, 1500-nál vissza (marad 2000 ms), 3500-nál lejár
  play(log, clock, { items: ['ma', 'me'], flash: 3000 }, [['NEXT', 1000], ['PREV', 1500], ['TICK', 3500], ['NEXT', 5000]]);
  assert.equal(byItem(exposuresOf(log), 'ma').flashDwellMs, null);
  assert.equal(byItem(exposuresOf(log), 'me').flashDwellMs, 1500);
});

test('4. megállítás közbeni gombnyomás: az idő benne van, a megjelenés segítséggel számít', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma'], flash: 2000 }, [['PAUSE', 1000], ['NEXT', 4000]]);
  const e = byItem(exposuresOf(log), 'ma');
  assert.equal(e.flashDwellMs, 4000, 'a megállítás ideje olvasási idő, a villantásnál is hosszabb lehet');
  assert.equal(e.supported, true);
});

test('5. az elrejtett oldal ideje nem számít bele', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma'], flash: 10000 }, [['HIDE', 1000], ['SHOW', 3000], ['NEXT', 5000]]);
  assert.equal(byItem(exposuresOf(log), 'ma').flashDwellMs, 3000);
});

test('6. 30 mp feletti idő: nincs idő, a megjelenés számít', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'], flash: 10000 }, [['PAUSE', 1000], ['NEXT', 30001], ['PAUSE', 31000], ['NEXT', 60001]]);
  assert.equal(byItem(exposuresOf(log), 'ma').flashDwellMs, null);
  assert.equal(byItem(exposuresOf(log), 'me').flashDwellMs, 30000, 'pontosan 30 mp még számít');
  assert.equal(day(log, 'ma').exposures, 1);
});

test('7. kézi kör: flashDwellMs mindig null, a dwellMs a régi', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'] }, [['NEXT', 2000], ['NEXT', 4500]]);
  assert.ok(exposuresOf(log).every((e) => e.flashDwellMs === null));
  assert.deepEqual(day(log, 'ma').dwellMs, [2000]);
  assert.deepEqual(day(log, 'me').dwellMs, [2500]);
  assert.deepEqual(day(log, 'ma').flashDwell, []);
});

test('A. gombnyomás a tételek közti szünetben: nincs idő (a villantás már lejárt)', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'], flash: 1000, gap: 2000 }, [['TICK', 1000], ['NEXT', 1500], ['NEXT', 2700]]);
  assert.equal(byItem(exposuresOf(log), 'ma').flashDwellMs, null);
  assert.equal(byItem(exposuresOf(log), 'me').flashDwellMs, 1200);
});

test('B. kilépés a kör közben: a látható tételnek nincs ideje, a korábbiaknak megmarad', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me', 'mi'], flash: 10000 }, [['NEXT', 2000], ['EXIT', 3500]]);
  const xs = exposuresOf(log);
  assert.equal(byItem(xs, 'ma').flashDwellMs, 2000);
  assert.equal(byItem(xs, 'me').flashDwellMs, null);
  assert.equal(day(log, 'me').exposures, 1, '1,5 mp-ig látszott: megjelenés');
});

test('újraolvasás villantásos körben: az újraolvasás ideje nem számít, a megszakított látogatásé sem', () => {
  const { log, clock } = fresh();
  // ma: 2000-nél tovább; me: 5000-nél (3 mp után) vissza → ma újraolvasás 6000-ig; me újra 6000–8000
  play(log, clock, { items: ['ma', 'me'], flash: 10000 }, [['NEXT', 2000], ['PREV', 5000], ['NEXT', 6000], ['NEXT', 8000]]);
  const xs = exposuresOf(log);
  assert.equal(byItem(xs, 'ma').flashDwellMs, 2000);
  assert.equal(byItem(xs, 'ma').prevs, 1);
  assert.equal(byItem(xs, 'me').flashDwellMs, 2000);
});

/* ---------- 8. napi összesítő ---------- */

test('8. több mint 20 villantásos idő egy napon: az első és az utolsó 10, időrendben', () => {
  const { log, clock } = fresh();
  for (let k = 0; k < 25; k++) play(log, clock, { items: ['ma'], flash: 10000, start: T0 + k * 60000 }, [['NEXT', 1000 + k * 100]]);
  const got = day(log, 'ma').flashDwell.map((f) => f.ms);
  const all = Array.from({ length: 25 }, (_, k) => 1000 + k * 100);
  assert.deepEqual(got, [...all.slice(0, 10), ...all.slice(-10)]);
  assert.equal(day(log, 'ma').exposures, 25);
});

test('8. mergeDaily: régi (mező nélküli) összesítővel is működik', () => {
  const base = dailyRecords([{ item: 'ma', day: '2026-11-02', t: 1, manual: false, flashMs: 2000, flashDwellMs: 800, dwellMs: null, covers: 0, pauses: 0, prevs: 0, supported: false }],
    { deviceId: 'd', child: 'c', fastFlashMs: 5000 })[0];
  const { flashDwell, ...old } = base;
  assert.deepEqual(mergeDaily(old, base).flashDwell, [{ ms: 800, flashMs: 2000 }]);
  assert.deepEqual(mergeDaily(base, old).flashDwell, [{ ms: 800, flashMs: 2000 }]);
});

/* ---------- 9, D, E: tárolt formátum ---------- */

test('9. 3. verzió oda-vissza: villantásos idők 100 ms-ra kerekítve, a villantás hosszával', () => {
  const { log, clock, storage } = fresh();
  play(log, clock, { items: ['ma', 'me'], flash: 2500 }, [['NEXT', 1240], ['NEXT', 2490]]);
  const s = JSON.parse(storage.getItem('k'));
  assert.equal(s.v, 3);
  assert.equal(s.r[0][14], 1, 'fd');
  const row = s.d.find((x) => x[0] === 'ma');
  assert.deepEqual(row[11], [[12, 25]]);
  assert.equal(row.length, 12, 'saját eszköz: nincs eszköz elem');
  const back = decode(s);
  assert.deepEqual(back.daily.find((d) => d.item === 'ma').flashDwell, [{ ms: 1200, flashMs: 2500 }]);
  assert.deepEqual(back.daily.find((d) => d.item === 'me').flashDwell, [{ ms: 1300, flashMs: 2500 }], '1250 → 1300');
  assert.equal(back.rounds[0].flashDwellDone, true);
  assert.deepEqual(decode(encode(back)), back);
});

test('D. más eszközről átvett összesítő: a 3. verzióban az eszköz a 13. elem, a 2. verzióban a 12. volt', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma'], flash: 10000 }, [['NEXT', 2000]]);
  const own = log.root.daily[0];
  const foreign = { ...own, id: own.id.replace(log.root.deviceId, 'r-masik'), flashDwell: [{ ms: 900, flashMs: 1000 }] };
  const root = { ...log.root, daily: [own, foreign] };
  const s = encode(root);
  assert.equal(s.d[1][12], 'r-masik');
  assert.deepEqual(decode(s).daily, root.daily, '3. verzió oda-vissza');
  const old = decode(toV2(s));
  assert.equal(old.daily[1].id, foreign.id, 'a 2. verzió eszköz eleme jó helyről olvasódik');
  assert.deepEqual(old.daily.map((d) => d.flashDwell), [[], []]);
  assert.deepEqual(withoutFlash(old.daily), withoutFlash(root.daily));
});

test('9. a 2. és az 1. verzió átalakul: üres villantásos idő, pótlásra váró körök', () => {
  const v2 = decode(FIX('haladas-minta-v2.json'));
  assert.equal(v2.v, VERSION);
  assert.ok(v2.daily.every((d) => Array.isArray(d.flashDwell) && d.flashDwell.length === 0));
  assert.ok(v2.rounds.every((r) => r.flashDwellDone === false));
  const v1 = decode({ v: 1, deviceId: 'd', child: 'c', events: [], rounds: [{ id: 'x', t0: 1, mode: 'read', flashMs: 0, folded: true }],
    daily: [{ id: 'd|c|ma|2026-11-02', item: 'ma', dwellMs: [] }], lists: {} });
  assert.deepEqual(v1.daily[0].flashDwell, []);
  assert.equal(v1.rounds[0].flashDwellDone, false);
});

test('E. ismeretlen, újabb verziót továbbra sem írunk felül', () => {
  const storage = memStorage();
  storage.setItem('k', JSON.stringify({ v: VERSION + 1, r: [], d: [] }));
  const { log, clock } = fresh({ storage });
  play(log, clock, { items: ['ma'], flash: 10000 }, [['NEXT', 2000]]);
  assert.equal(JSON.parse(storage.getItem('k')).v, VERSION + 1);
});

/* ---------- 10, F, G, H: egyszeri pótlás ---------- */

/** Minden nyers eseményt megtartó konfiguráció: a pótlás eredménye összevethető az élő lezárással. */
const KEEP_ALL = (() => {
  const c = JSON.parse(readFileSync(join(ROOT, 'haladas.json'), 'utf8'));
  c.tarolas.nyers_megorzes_kor = 10000;
  c.tarolas.nyers_megorzes_nap = 10000;
  return resolve(c);
})();

test('10. pótlás: ha minden nyers esemény megvan, ugyanaz lesz, mint az élő lezárásnál; minden más bitre azonos', () => {
  const { log, storage, now } = buildSample({ config: KEEP_ALL });
  assert.ok(log.root.daily.some((d) => d.flashDwell.length > 0), 'a mintában van villantásos idő');
  const old = memStorage();
  old.setItem('k', JSON.stringify(toV2(JSON.parse(storage.getItem('k')))));
  const clock = { t: now };
  const want = decode(JSON.parse(storage.getItem('k'))).daily;   // tárolt alakban (100 ms-ra kerekítve) vetjük össze
  const l2 = reopen(old, clock, KEEP_ALL);
  assert.deepEqual(decode(encode(l2.root)).daily, want);
  assert.ok(l2.root.rounds.every((r) => r.flashDwellDone));
  assert.equal(JSON.parse(old.getItem('k')).v, 3, 'a pótlás után mentődik');
  const l3 = reopen(old, clock, KEEP_ALL);
  assert.deepEqual(decode(encode(l3.root)).daily, want, 'második betöltés: nem fűz hozzá újra');
});

test('F. pótlás: a körök tárolási sorrendjétől függetlenül időrendben fűz', () => {
  const { log, storage, now } = buildSample({ config: KEEP_ALL, days: 12 });
  const v2 = toV2(JSON.parse(storage.getItem('k')));
  v2.r.reverse();
  const old = memStorage();
  old.setItem('k', JSON.stringify(v2));
  const l2 = reopen(old, { t: now }, KEEP_ALL);
  const flash = (daily) => Object.fromEntries(daily.map((d) => [d.id, d.flashDwell]));
  assert.deepEqual(flash(l2.root.daily), flash(log.root.daily));
  // célzottan: ugyanaz a tétel ugyanazon a napon három körben, fordított tárolási sorrendben
  const t = fresh();
  for (const [k, ms] of [[0, 1100], [1, 2200], [2, 3300]]) play(t.log, t.clock, { items: ['ma'], flash: 10000, start: T0 + k * 60000 }, [['NEXT', ms]]);
  const rev = toV2(JSON.parse(t.storage.getItem('k')));
  rev.r.reverse();
  const st = memStorage();
  st.setItem('k', JSON.stringify(rev));
  assert.deepEqual(day(reopen(st, t.clock), 'ma').flashDwell.map((f) => f.ms), [1100, 2200, 3300]);
});

test('10. pótlás a rögzített 2. verziójú mintán: csak a flashDwell változik, a nyers eseményes körökből', () => {
  const stored = FIX('haladas-minta-v2.json');
  const before = decode(stored);
  const storage = memStorage();
  storage.setItem('k', JSON.stringify(stored));
  const { now } = FIX('haladas-minta-allapot.json');
  const log = reopen(storage, { t: now - 86400000 * 9 });   // a minta utolsó napja után nem sokkal
  assert.deepEqual(withoutFlash(log.root.daily), withoutFlash(before.daily));
  assert.ok(log.root.rounds.every((r) => r.flashDwellDone));
  const withRaw = new Set(before.events.map((e) => e.round));
  const flashRounds = before.rounds.filter((r) => r.flashMs > 0 && withRaw.has(r.id));
  assert.ok(flashRounds.length > 5);
  const total = log.root.daily.reduce((s, d) => s + d.flashDwell.length, 0);
  assert.ok(total > 0, `pótolt idők: ${total}`);
  // csak a nyers eseményes körök napjain lehet villantásos idő
  const rawDays = new Set(before.events.map((e) => new Date(e.t).toDateString()));
  for (const d of log.root.daily) if (d.flashDwell.length) assert.ok(rawDays.has(new Date(d.day + 'T12:00').toDateString()), d.id);
});

test('G. félbemaradt kör a régi adatban: egyszer számít, és a korábbi körök ideje elé nem kerül', () => {
  const { log, clock, storage } = fresh();
  play(log, clock, { items: ['ma'], flash: 10000 }, [['NEXT', 2000]]);
  play(log, clock, { items: ['ma'], flash: 10000, start: T0 + 60000 }, [['NEXT', 3000], ['HIDE', 3500], ['STOP', 3600]]);
  const old = memStorage();
  old.setItem('k', JSON.stringify(toV2(JSON.parse(storage.getItem('k')))));
  const l2 = reopen(old, clock);
  assert.equal(day(l2, 'ma').exposures, 2);
  assert.deepEqual(day(l2, 'ma').flashDwell.map((f) => f.ms), [2000, 3000]);
  assert.ok(l2.root.rounds.every((r) => r.folded && r.flashDwellDone));
});

test('H. hiányos nyers események (törölt eleje, vagy nincs egy sem): a kör kimarad, de pótoltnak számít', () => {
  const { log, clock, storage } = fresh();
  play(log, clock, { items: ['ma', 'me'], flash: 10000 }, [['NEXT', 2000], ['NEXT', 4000]]);
  play(log, clock, { items: ['mi'], flash: 10000, start: T0 + 60000 }, [['NEXT', 1500]]);
  play(log, clock, { items: ['mo'], flash: 10000, start: T0 + 120000 }, [['NEXT', 1700]]);
  const v2 = toV2(JSON.parse(storage.getItem('k')));
  const [r1, r2] = v2.r.map((r) => r[0]);
  v2.e[r1] = v2.e[r1].split(';').slice(1).join(';');   // az eleje törlődött (kvóta vagy éjféli napkorlát)
  delete v2.e[r2];                                     // a kör nyers eseményei már nincsenek meg
  const old = memStorage();
  old.setItem('k', JSON.stringify(v2));
  const l2 = reopen(old, clock);
  assert.deepEqual(day(l2, 'ma').flashDwell, []);
  assert.deepEqual(day(l2, 'me').flashDwell, []);
  assert.deepEqual(day(l2, 'mi').flashDwell, []);
  assert.deepEqual(day(l2, 'mo').flashDwell, [{ ms: 1700, flashMs: 10000 }]);
  assert.ok(l2.root.rounds.every((r) => r.flashDwellDone));
});

test('pótlás: kézi körnél nincs mit pótolni, de pótoltnak számít', () => {
  const { log, clock, storage } = fresh();
  play(log, clock, { items: ['ma'] }, [['NEXT', 2000]]);
  const old = memStorage();
  old.setItem('k', JSON.stringify(toV2(JSON.parse(storage.getItem('k')))));
  const l2 = reopen(old, clock);
  assert.deepEqual(day(l2, 'ma').flashDwell, []);
  assert.deepEqual(day(l2, 'ma').dwellMs, [2000]);
  assert.equal(l2.root.rounds[0].flashDwellDone, true);
});

/* ---------- 11. a rögzített minta besorolása (az egyszerűsített szabályokkal szándékosan frissítve) ---------- */

test('11. rögzített minta: a futó program és a mentett adat ugyanazt a csoportot adja', () => {
  const { now, memoria, tarolt } = FIX('haladas-minta-allapot.json');
  const groups = (x) => Object.fromEntries(Object.entries(x.alap.states).map(([k, v]) => [k, [v.group, v.reason]]));
  // a) ugyanaz a lejátszás, a futó program számításai
  const { log, storage: s3 } = buildSample();
  assert.deepEqual(statesOf(log.root.daily, now), memoria);
  // b) a 3. verziós mentés újratöltve (az idők 100 ms-ra kerekítve)
  assert.deepEqual(statesOf(reopen(s3, { t: now }).root.daily, now), tarolt);
  // c) a kerekítés egyetlen tétel csoportját és okát sem változtatja meg
  assert.deepEqual(groups(tarolt), groups(memoria));
  assert.ok(Object.values(memoria.alap.states).some((v) => v.group === 'fluent') && Object.values(memoria.alap.states).some((v) => v.group === 'practice'));
  // d) a régi kód által mentett 2. verziójú adat: a napi összesítők a villantásos időn kívül bitre azonosak, és besorolható
  const storage = memStorage();
  storage.setItem('k', JSON.stringify(FIX('haladas-minta-v2.json')));
  const v2 = statesOf(reopen(storage, { t: now }).root.daily, now);
  assert.deepEqual(Object.keys(v2.alap.states), Object.keys(memoria.alap.states));
  assert.deepEqual(withoutFlash(decode(JSON.parse(s3.getItem('k'))).daily), withoutFlash(decode(FIX('haladas-minta-v2.json')).daily));
});
