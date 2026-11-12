// Haladás: napló, mellényomás-szűrés, napi összesítők, konfiguráció, listaazonosság
// (docs/haladas-specifikacio.md 4–7.1, 10.). Rögzített órával: valódi várakozás nélkül.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startRound, step } from '../js/core/round.js';
import { transitionEvents } from '../js/core/practice-log.js';
import { roundExposures, dailyRecords, mergeDaily, dayOf, listHash, keepEnds, median } from '../js/core/exposures.js';
import { reconcileLists, overlap } from '../js/core/list-identity.js';
import { validate, resolve, DEFAULTS } from '../js/core/haladas-config.js';
import { createProgressLog } from '../js/data/progress-log.js';
import { encode, decode, VERSION } from '../js/data/progress-codec.js';
import { itemKey } from '../js/core/items.js';
import { tokenize } from '../js/core/grid.js';
import { envConfig } from '../js/core/env.js';

const ROOT = new URL('..', import.meta.url).pathname;
const S = DEFAULTS.szures;
const T0 = new Date(2026, 10, 2, 17, 0, 0).getTime();   // helyi idő: 2026-11-02 17:00
const DAY = 86400000;

/* ---------- segédek ---------- */

/** Memóriabeli Storage; `quota` bájt fölött QuotaExceededError-t dob. */
function memStorage(quota = Infinity) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem(k, v) {
      if (v.length > quota) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, String(v));
    },
    removeItem: (k) => m.delete(k),
    raw: m,
  };
}

let seq = 0;
const ids = () => `id${++seq}`;

/**
 * Egy Felolvasás kör lejátszása a valódi reducerrel és a naplóval.
 * steps: [esemény, eltelt ms a kör elejétől, arg?] vagy ['HIDE'|'SHOW', ms]; 'EXIT' kilép.
 */
function play(log, clock, { items, flash = 0, gap = 0, start = clock.t }, steps) {
  clock.t = start;
  const order = items.map((_, k) => k);
  let s = startRound(order, flash, gap, 0, { undoMs: S.javitott_melle_ms });
  log.beginRound({ seq: order, items, listNames: ['L'], flashMs: flash, gapMs: gap, count: items.length });
  for (const [ev, ms, arg] of steps) {
    clock.t = start + ms;
    if (ev === 'HIDE' || ev === 'SHOW') { log.visibility(ev === 'HIDE', s.index); continue; }
    if (ev === 'EXIT') { log.endRound(s.index); return; }
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
const day = (log, item) => log.root.daily.find((d) => d.item === item);

/* ---------- tételkulcs és betűbontás ---------- */

test('tételkulcs: kötőjel marad, kis- és nagybetű különbözik, szóköz és NFC nem számít', () => {
  assert.equal(new Set(['ma', 'ma-ma', 'mama'].map(itemKey)).size, 3);
  assert.notEqual(itemKey('Ház'), itemKey('ház'));
  assert.equal(itemKey('ház '), itemKey('ház'));
  assert.equal(itemKey('ház'), itemKey('ház'));
});

test('betűbontás: többjegyű és hosszú többjegyű betűk', () => {
  assert.deepEqual(tokenize('dzsungel'), ['dzs', 'u', 'n', 'g', 'e', 'l']);
  assert.deepEqual(tokenize('gyöngy'), ['gy', 'ö', 'n', 'gy']);
  assert.deepEqual(tokenize('asszony'), ['a', 'sz', 'sz', 'o', 'ny']);
  assert.deepEqual(tokenize('eggyel'), ['e', 'gy', 'gy', 'e', 'l']);
  assert.deepEqual(tokenize('kassa'), ['k', 'a', 's', 's', 'a'], 'ss után nincs z: két s');
});

/* ---------- konfiguráció ---------- */

test('haladas.json: a repóbeli fájl érvényes, és megegyezik a beépített alapértékekkel', () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'haladas.json'), 'utf8'));
  assert.deepEqual(validate(cfg), []);
  assert.deepEqual(resolve(cfg), DEFAULTS);
});

test('konfiguráció: ismeretlen kulcs, rossz típus, értelmetlen érték, hiányzó kulcs', () => {
  const base = () => structuredClone(JSON.parse(readFileSync(join(ROOT, 'haladas.json'), 'utf8')));
  const bad = (f) => { const c = base(); f(c); return validate(c); };
  assert.match(bad((c) => { c.szures.uj = 1; }).join(), /szures\.uj: ismeretlen kulcs/);
  assert.match(bad((c) => { c.extra = {}; }).join(), /extra: ismeretlen szakasz/);
  assert.match(bad((c) => { c.szures.javitott_melle_ms = '2000'; }).join(), /javitott_melle_ms: pozitív egész/);
  assert.match(bad((c) => { c.szures.max_olvasasi_ido_ms = -1; }).join(), /max_olvasasi_ido_ms/);
  assert.match(bad((c) => { c.allapot.megy_ido_szorzo = 0; }).join(), /megy_ido_szorzo: pozitív szám/);
  assert.match(bad((c) => { c.allapot.min_nap = 1.5; }).join(), /min_nap: nemnegatív egész/);
  assert.match(bad((c) => { delete c.allapot.friss_meres_db; }).join(), /allapot\.friss_meres_db: hiányzik/);
  assert.match(bad((c) => { c.betu = { ablak_nap: 30 }; }).join(), /betu: ismeretlen szakasz/, 'a régi betűelemzés megszűnt');
  assert.match(bad((c) => { c.tarolas.ures_allapot_min_nap = 3; }).join(), /ures_allapot_min_nap: ismeretlen kulcs/);
  assert.match(bad((c) => { c.allapot.kiindulas_n = 3; }).join(), /kiindulas_n: ismeretlen kulcs/);
  assert.match(bad((c) => { c.szures.veletlen_atugras_ms = 5000; }).join(), /kisebb kell legyen/);
  assert.deepEqual(validate(null), ['a konfiguráció nem objektum']);
});

test('konfiguráció: a „Megy” és a „Még gyakorolni kell” küszöbei nem fedhetik át egymást', () => {
  const base = () => structuredClone(JSON.parse(readFileSync(join(ROOT, 'haladas.json'), 'utf8')));
  const bad = (f) => { const c = base(); f(c); return validate(c); };
  assert.deepEqual(validate(base()), [], 'a kezdő értékek (3 / 5 / 3, 1,5 < 2) érvényesek');
  assert.match(bad((c) => { c.allapot.megy_ido_szorzo = 2; }).join(), /megy_ido_szorzo: kisebb kell legyen/);
  assert.match(bad((c) => { c.allapot.megy_ido_szorzo = 2.5; }).join(), /megy_ido_szorzo: kisebb kell legyen/);
  assert.match(bad((c) => { c.allapot.gyakorol_segitseg_db = 2; }).join(), /gyakorol_segitseg_db: nagyobb kell legyen/, '3 segítség nélküli után 2/5 lehetne segítséges');
  assert.match(bad((c) => { c.allapot.megy_utolso_n = 2; }).join(), /gyakorol_segitseg_db: nagyobb kell legyen/);
  assert.match(bad((c) => { c.allapot.gyakorol_segitseg_db = 6; }).join(), /legfeljebb a gyakorol_utolso_n/);
  assert.deepEqual(bad((c) => { c.allapot.megy_utolso_n = 4; c.allapot.gyakorol_segitseg_db = 2; }), [], '4 segítség nélküli után legfeljebb 1/5');
});

test('konfiguráció: hibás bemenetnél az alapértékek; a napszabály-kapcsoló csak a napszámokat nullázza', () => {
  assert.deepEqual(resolve({ szures: 1 }), DEFAULTS);
  assert.deepEqual(resolve(null), DEFAULTS);
  const s = resolve(null, { skipDayRules: true });
  assert.equal(s.allapot.min_nap, 0);
  assert.equal(s.allapot.tempo_ablak_nap, 30, 'a tempó ablaka nem napszabály');
  assert.equal(s.tarolas.nyers_megorzes_nap, 30, 'a megőrzés nem napszabály');
  assert.deepEqual({ ...s.allapot, min_nap: 3 }, { ...DEFAULTS.allapot }, 'a többi feltétel változatlan');
  assert.ok(Object.isFrozen(s.allapot));
});

test('kiadás: hibás vagy hiányzó haladas.json megállítja a check-haladas.mjs-t', () => {
  const dir = mkdtempSync(join(tmpdir(), 'haladas-'));
  mkdirSync(join(dir, 'js/core'), { recursive: true });
  for (const f of ['js/core/haladas-config.js']) cpSync(join(ROOT, f), join(dir, f));
  const run = () => spawnSync(process.execPath, [join(ROOT, '.github/scripts/check-haladas.mjs'), dir], { encoding: 'utf8' });
  assert.equal(run().status, 1, 'hiányzó fájl');
  writeFileSync(join(dir, 'haladas.json'), '{"szures":');
  assert.equal(run().status, 1, 'nem JSON');
  const cfg = JSON.parse(readFileSync(join(ROOT, 'haladas.json'), 'utf8'));
  cfg.allapot.ismeretlen = 1;
  writeFileSync(join(dir, 'haladas.json'), JSON.stringify(cfg));
  const r = run();
  assert.equal(r.status, 1); assert.match(r.stderr, /ismeretlen kulcs/);
  delete cfg.allapot.ismeretlen;
  cfg.allapot.megy_ido_szorzo = 2;
  writeFileSync(join(dir, 'haladas.json'), JSON.stringify(cfg));
  const o = run();
  assert.equal(o.status, 1, 'átfedő küszöbök: a kiadás megáll'); assert.match(o.stderr, /megy_ido_szorzo/);
  cfg.allapot.megy_ido_szorzo = 1.5;
  delete cfg.allapot.ismeretlen;
  writeFileSync(join(dir, 'haladas.json'), JSON.stringify(cfg));
  assert.equal(run().status, 0);
});

test('környezet: dev és éles napló külön kulcson, a kapcsoló alapból kikapcsolva', () => {
  assert.equal(envConfig('prod').progressKey, 'olvasoka.haladas');
  assert.equal(envConfig('dev').progressKey, 'olvasoka-dev.haladas');
  assert.equal(envConfig('prod').skipDayRules, false);
  assert.equal(envConfig('dev').skipDayRules, false);
});

/* ---------- naplózás ---------- */

test('átmenetek: kézi és időzítős lépés, szünet, takarás, kör vége', () => {
  let a = startRound([0, 1], 3000, 500, 0);
  const tr = (ev, t, arg) => { const b = step(a, ev, t, arg); const out = transitionEvents(a, ev, b); a = b; return out.map((e) => e.type).join(' '); };
  assert.equal(tr('COVER', 100, { i: 1, n: 2 }), 'cover', 'a takarás okozta pause nem külön esemény');
  assert.equal(tr('PAUSE', 200), 'resume');
  assert.equal(tr('COVER', 300, { i: 1, n: 2 }), 'uncover');
  assert.equal(tr('TICK', 3000), '', 'a folytatás után még 100 ms van hátra');
  assert.equal(tr('TICK', 3100), 'next');
  assert.equal(tr('PREV', 3200), 'prev show', 'szünetből vissza: újraolvasás');
  assert.equal(tr('BLUR', 3300), 'blur');
  assert.equal(tr('NEXT', 3400), 'next show');
  assert.equal(tr('NEXT', 3500), 'next end');
});

test('kör vége és megszakítása is naplózódik', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'] }, [['NEXT', 3000], ['NEXT', 6000]]);
  play(log, clock, { items: ['ma', 'me', 'mi'], start: T0 + 60000 }, [['NEXT', 3000], ['EXIT', 5000]]);
  const [r1, r2] = log.root.rounds;
  assert.equal(r1.completed, true); assert.equal(r1.abandonedAt, null);
  assert.equal(r2.completed, false); assert.equal(r2.abandonedAt, 1);
  assert.deepEqual(log.root.events.filter((e) => e.round === r2.id).map((e) => e.type), ['show', 'next', 'show', 'exit']);
  assert.match(r1.listHash, /^[0-9a-f]{8}$/);
});

/* ---------- mellényomás-szűrés (5.2) ---------- */

test('→ majd 2 mp-en belül ←: nincs segítség, az idő összeadódik, a corrections nő', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me', 'mi'] }, [['NEXT', 3000], ['PREV', 4000], ['NEXT', 6000], ['NEXT', 9000], ['NEXT', 12000]]);
  const ma = day(log, 'ma');
  assert.equal(ma.exposures, 1);
  assert.equal(ma.supportedExposures, 0);
  assert.deepEqual(ma.dwellMs, [5000], '3000 + 2000, a „me” 1 mp-e nélkül');
  assert.equal(day(log, 'me').exposures, 1, 'a közbülső 1 mp-es látogatás törlődik, a későbbi számít');
  assert.deepEqual(day(log, 'me').dwellMs, [3000]);
  assert.equal(log.root.rounds[0].corrections, 1);
});

test('…és a visszatérés után 3 mp-en belül takarás: egy takarás, nem visszalépés', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma-ma', 'me'] }, [['NEXT', 1000], ['PREV', 1500], ['COVER', 2500, { i: 1, n: 2 }], ['NEXT', 6000], ['NEXT', 8000]]);
  const r = day(log, 'ma-ma');
  assert.equal(r.covers, 1); assert.equal(r.prevs, 0); assert.equal(r.help, '1');
});

test('2 mp-nél későbbi ←: valódi újraolvasás, segítség azon a tételen, ahová visszalép', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'] }, [['NEXT', 3000], ['PREV', 5500], ['NEXT', 8000], ['NEXT', 10000]]);
  const ma = day(log, 'ma'), me = day(log, 'me');
  assert.equal(ma.prevs, 1); assert.equal(ma.help, '1');
  assert.deepEqual(ma.dwellMs, [3000], 'az újraolvasás ideje nem számít bele');
  assert.equal(me.prevs, 0); assert.equal(me.help, '0');
  assert.deepEqual(me.dwellMs, [2000], 'a me utolsó, továbblépéssel zárt látogatása');
  assert.equal(log.root.rounds[0].corrections, 0);
});

test('időzítős továbblépés után 2 mp-en belül ←: újraolvasás (nem mellényomás)', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'], flash: 3000 }, [['TICK', 3000], ['PREV', 3500], ['TICK', 6500], ['TICK', 9500], ['TICK', 12500]]);
  assert.equal(day(log, 'ma').prevs, 1);
  assert.equal(log.root.rounds[0].corrections, 0);
});

test('400 ms alatti megjelenés nem megjelenés', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me', 'mi'] }, [['NEXT', 2000], ['NEXT', 2399], ['NEXT', 5000]]);
  assert.equal(day(log, 'me'), undefined);
  assert.equal(day(log, 'mi').exposures, 1);
  const { log: l2, clock: c2 } = fresh();
  play(l2, c2, { items: ['ma', 'me', 'mi'] }, [['NEXT', 2000], ['NEXT', 2400], ['NEXT', 5000]]);
  assert.equal(day(l2, 'me').exposures, 1, 'pontosan 400 ms már megjelenés');
});

test('30 mp feletti idő: a megjelenés számít, a mediánba nem kerül', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'] }, [['NEXT', 30001], ['NEXT', 60001]]);
  const ma = day(log, 'ma');
  assert.equal(ma.exposures, 1); assert.equal(ma.manualExposures, 1);
  assert.deepEqual(ma.dwellMs, []); assert.equal(ma.medianDwellMs, null);
  assert.deepEqual(day(log, 'me').dwellMs, [30000], 'pontosan 30 mp még számít');
});

test('takarás és felfedés 1 mp-en belül: figyelmen kívül marad', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma-ma', 'ke-fe'] }, [
    ['COVER', 1000, { i: 0, n: 2 }], ['COVER', 1999, { i: 0, n: 2 }], ['NEXT', 4000],
    ['COVER', 5000, { i: 0, n: 2 }], ['COVER', 6000, { i: 0, n: 2 }], ['NEXT', 8000],
  ]);
  assert.equal(day(log, 'ma-ma').covers, 0); assert.equal(day(log, 'ma-ma').help, '0');
  assert.equal(day(log, 'ke-fe').covers, 1, 'pontosan 1 mp: már takarás');
});

test('megállítás: segítség, és az ideje olvasási idő; az elrejtett oldal ideje nem', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'] }, [
    ['PAUSE', 1000], ['PAUSE', 5000], ['NEXT', 6000],
    ['HIDE', 7000], ['SHOW', 67000], ['NEXT', 68000],
  ]);
  assert.equal(day(log, 'ma').pauses, 1); assert.deepEqual(day(log, 'ma').dwellMs, [6000]);
  assert.deepEqual(day(log, 'me').dwellMs, [2000], 'az elrejtett 60 mp nem számít');
  assert.equal(day(log, 'me').pauses, 0, 'az elrejtés nem megállítás');
});

test('ablakfókusz elvesztése (BLUR): nem segítség', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'], flash: 5000 }, [['BLUR', 1000], ['PAUSE', 3000], ['TICK', 7000], ['TICK', 12000]]);
  assert.equal(day(log, 'ma').supportedExposures, 0);
});

test('villantás: nincs olvasási idő; a gyors, segítség nélküli megjelenések számolódnak', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'], flash: 5000 }, [['TICK', 5000], ['TICK', 10000]]);
  play(log, clock, { items: ['ma'], flash: 5500, start: T0 + 60000 }, [['TICK', 5500]]);
  const ma = day(log, 'ma');
  assert.equal(ma.exposures, 2); assert.equal(ma.manualExposures, 0);
  assert.deepEqual(ma.dwellMs, []);
  assert.equal(ma.unsupportedFastFlash, 1, 'csak a ≤ 5000 ms-os');
});

test('a küszöbök a konfigurációból jönnek: más küszöb, más eredmény ugyanarra az adatra', () => {
  const steps = [['NEXT', 3000], ['PREV', 5500], ['NEXT', 8000], ['NEXT', 10000]];
  const strict = fresh();
  play(strict.log, strict.clock, { items: ['ma', 'me'] }, steps);
  assert.equal(day(strict.log, 'ma').prevs, 1);
  const cfg = JSON.parse(readFileSync(join(ROOT, 'haladas.json'), 'utf8'));
  cfg.szures.javitott_melle_ms = 3000;
  const loose = fresh({ config: resolve(cfg) });
  play(loose.log, loose.clock, { items: ['ma', 'me'] }, steps);
  assert.equal(day(loose.log, 'ma').prevs, 0, '2,5 mp a 3 mp-es ablakon belül: javított mellényomás');
});

/* ---------- napi összesítők ---------- */

test('napi összesítő: tétel × nap, a segítség sorrendje és az idők időrendben', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'] }, [['NEXT', 2000], ['NEXT', 4000]]);
  play(log, clock, { items: ['ma', 'me'], start: T0 + 3600000 }, [['PAUSE', 500], ['NEXT', 3000], ['NEXT', 4000]]);
  play(log, clock, { items: ['ma'], start: T0 + DAY }, [['NEXT', 1500]]);
  const days = log.root.daily.filter((d) => d.item === 'ma').sort((a, b) => a.day.localeCompare(b.day));
  assert.deepEqual(days.map((d) => d.day), ['2026-11-02', '2026-11-03']);
  assert.equal(days[0].help, '01');
  assert.deepEqual(days[0].dwellMs, [2000, 3000]);
  assert.equal(days[0].medianDwellMs, 2500);
  assert.match(days[0].id, /^r-id\d+\|default\|ma\|2026-11-02$/);
});

test('napi összesítő: két kör ugyanazon a napon összeadódik', () => {
  const a = { exposures: 1, manualExposures: 1, dwellMs: [2000], medianDwellMs: 2000, covers: 0, pauses: 0, prevs: 0, supportedExposures: 0, unsupportedFastFlash: 0, help: '0' };
  const m = mergeDaily(a, { ...a, dwellMs: [4000], covers: 1, supportedExposures: 1, help: '1' });
  assert.equal(m.exposures, 2); assert.equal(m.help, '01'); assert.equal(m.medianDwellMs, 3000); assert.equal(m.covers, 1);
});

test('napi összesítő: legfeljebb 20 érték, az elejéből és a végéből', () => {
  assert.deepEqual(keepEnds([...Array(25).keys()]), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([]), null);
});

test('napi összesítő: a nap a helyi naptári nap', () => {
  assert.equal(dayOf(new Date(2026, 10, 2, 23, 59).getTime()), '2026-11-02');
  assert.equal(dayOf(new Date(2026, 10, 3, 0, 1).getTime()), '2026-11-03');
});

test('a lista hash-e a tartalomból: sorrend és ismétlés nem számít, a szöveg igen', () => {
  assert.equal(listHash(['ma', 'me', 'ma']), listHash(['me', 'ma']));
  assert.notEqual(listHash(['ma', 'me']), listHash(['Ma', 'me']));
});

/* ---------- tárolás és tömörítés (4.1, 4.3) ---------- */

test('30 napnál régebbi nyers események törlődnek, a napi összesítők megmaradnak', () => {
  const { log, clock, storage } = fresh();
  play(log, clock, { items: ['ma'] }, [['NEXT', 2000]]);
  play(log, clock, { items: ['me'], start: T0 + 31 * DAY }, [['NEXT', 2000]]);
  assert.ok(log.root.events.every((e) => e.item === 'me'));
  assert.deepEqual(log.root.daily.map((d) => d.item).sort(), ['ma', 'me']);
  const saved = decode(JSON.parse(storage.getItem('k')));
  assert.equal(saved.v, VERSION);
  assert.equal(saved.daily.length, 2);
  assert.equal(saved.rounds.length, 2);
});

test('a nyers napló a legutóbbi 30 kört tartja meg; a napi összesítők mind megmaradnak; a méret korlátos', () => {
  const { log, clock, storage } = fresh();
  const items = ['ma', 'me', 'mi', 'mo', 'mu', 'ma-ma', 'ke-fe', 'fó-ka', 'lu-fi', 'fa-lu'];
  const steps = items.map((_, k) => ['NEXT', 2000 * (k + 1)]);
  for (let r = 0; r < 100; r++) play(log, clock, { items, start: T0 + r * 60000 }, steps);
  const kept = new Set(log.root.events.map((e) => e.round));
  assert.equal(kept.size, 30);
  assert.deepEqual([...kept], log.root.rounds.slice(-30).map((r) => r.id), 'a legutóbbiak');
  assert.equal(log.root.rounds.length, 100, 'a körök rövid alakja megmarad');
  assert.equal(day(log, 'ma').exposures, 100, 'az összesítők mind megmaradnak');
  const kb = storage.getItem('k').length / 1024;
  assert.ok(kb < 200, `100 kör után ${kb.toFixed(0)} kB`);
});

test('a kör-korlát a konfigurációból jön', () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'haladas.json'), 'utf8'));
  cfg.tarolas.nyers_megorzes_kor = 2;
  const { log, clock } = fresh({ config: resolve(cfg) });
  for (let r = 0; r < 5; r++) play(log, clock, { items: ['ma'], start: T0 + r * 60000 }, [['NEXT', 2000]]);
  assert.equal(new Set(log.root.events.map((e) => e.round)).size, 2);
});

/* ---------- tárolt formátum (4.2a) ---------- */

const strip = (r) => ({ ...r, events: r.events.map(({ id, ...e }) => e) });

test('tömör formátum: oda-vissza alakítás után ugyanaz a napló, ugyanazok az összesítők', () => {
  const { log, clock, storage } = fresh();
  log.syncLists([{ name: 'L', items: ['ma-ma', 'ke-fe', 'mi'] }]);
  play(log, clock, { items: ['ma-ma', 'ke-fe', 'mi'], flash: 3000, gap: 500 }, [
    ['COVER', 500, { i: 1, n: 2 }], ['PAUSE', 900], ['BLUR', 1000], ['TICK', 2000], ['PREV', 2200], ['HIDE', 2500], ['SHOW', 4000],
    ['TICK', 6000], ['NEXT', 6100], ['NEXT', 7000], ['EXIT', 7500],
  ]);
  const stored = JSON.parse(storage.getItem('k'));
  assert.equal(stored.v, VERSION);
  assert.deepEqual(strip(decode(stored)), strip(log.root));
  assert.deepEqual(decode(encode(log.root)).daily, log.root.daily);
  const again = createProgressLog({ key: 'k', storage, now: () => clock.t, newId: ids });
  assert.deepEqual(again.root.daily, log.root.daily, 'újratöltés után ugyanaz');
});

test('az 1. verzió (olvasható objektumok) betöltéskor átalakul, a következő mentés tömör', () => {
  const { log, clock } = fresh();
  play(log, clock, { items: ['ma', 'me'] }, [['NEXT', 2000], ['NEXT', 4000]]);
  const v1 = { ...structuredClone(log.root), v: 1, rounds: log.root.rounds.map(({ items, ...r }) => r) };
  const storage = memStorage();
  storage.setItem('k', JSON.stringify(v1));
  const l2 = createProgressLog({ key: 'k', storage, now: () => clock.t, newId: ids });
  assert.deepEqual(l2.root.daily, log.root.daily);
  assert.deepEqual(l2.root.rounds[0].items, ['ma', 'me'], 'a kör tételei az eseményekből');
  play(l2, clock, { items: ['mi'], start: T0 + 60000 }, [['NEXT', 2000]]);
  const saved = JSON.parse(storage.getItem('k'));
  assert.equal(saved.v, VERSION);
  assert.equal(decode(saved).events.filter((e) => e.item === 'ma').length, 2, 'a régi események is átkerültek');
});

test('méret: 19 darab 16 tételes kör: körönként 0,4 kB alatt, napi 19 olvasásos összesítő 130 karakter alatt', () => {
  const { log, clock, storage } = fresh();
  const items = ['ma', 'me', 'mi', 'mo', 'mu', 'ma-ma', 'ke-fe', 'fó-ka', 'lu-fi', 'fa-lu', 'pi', 'pó', 'sí', 'ló', 'tál', 'kesz-tyű'];
  const steps = items.flatMap((_, k) => (k % 5 === 0 ? [['COVER', 2000 * k + 500, { i: 1, n: 2 }], ['NEXT', 2000 * (k + 1)]] : [['NEXT', 2000 * (k + 1)]]));
  for (let r = 0; r < 19; r++) play(log, clock, { items, start: T0 + r * 60000 }, steps);
  const s = JSON.parse(storage.getItem('k'));
  const len = (x) => JSON.stringify(x).length;
  const perRound = len(s.e) / 19, perDaily = len(s.d) / s.d.length;
  assert.ok(perRound < 400, `kör: ${perRound.toFixed(0)} karakter`);
  assert.ok(perDaily < 130, `összesítő: ${perDaily.toFixed(0)} karakter`);
  assert.ok(storage.getItem('k').length < 20000, `19 kör: ${storage.getItem('k').length} karakter`);
});

test('kvótahiba: előbb a legrégebbi nyers események törlődnek, a napi összesítők soha', () => {
  const storage = memStorage();
  const { log, clock } = fresh({ storage });
  for (let k = 0; k < 6; k++) play(log, clock, { items: ['ma', 'me', 'mi'], start: T0 + k * 600000 }, [['NEXT', 2000], ['NEXT', 4000], ['NEXT', 6000]]);
  const full = storage.getItem('k').length;
  const tight = memStorage(full - 150);   // kb. két kör nyers eseményei nem férnek el
  const { log: l2, clock: c2 } = fresh({ storage: tight });
  for (let k = 0; k < 6; k++) play(l2, c2, { items: ['ma', 'me', 'mi'], start: T0 + k * 600000 }, [['NEXT', 2000], ['NEXT', 4000], ['NEXT', 6000]]);
  assert.ok(l2.available, 'a mentés sikerült');
  const saved = decode(JSON.parse(tight.getItem('k')));
  assert.ok(saved.events.length < log.root.events.length);
  assert.equal(saved.daily.find((d) => d.item === 'ma').exposures, 6);
});

test('tárolás nélkül a napló memóriában fut, és nem dob', () => {
  const clock = { t: T0 };
  const log = createProgressLog({ key: 'k', storage: null, now: () => clock.t, newId: ids });
  assert.equal(log.available, false);
  play(log, clock, { items: ['ma'] }, [['NEXT', 2000]]);
  assert.equal(log.root.daily.length, 1);
  const throwing = { getItem() { throw new Error('x'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
  const l2 = createProgressLog({ key: 'k', storage: throwing, now: () => clock.t, newId: ids });
  assert.doesNotThrow(() => play(l2, clock, { items: ['ma'] }, [['NEXT', 2000]]));
  assert.equal(l2.available, false);
});

test('ismeretlen (újabb) verzió: nem írjuk felül', () => {
  const storage = memStorage();
  storage.setItem('k', JSON.stringify({ v: VERSION + 1, events: [], daily: [{ x: 1 }] }));
  const { log, clock } = fresh({ storage });
  play(log, clock, { items: ['ma'] }, [['NEXT', 2000]]);
  assert.equal(JSON.parse(storage.getItem('k')).v, VERSION + 1);
  assert.equal(log.available, false);
});

test('félbemaradt kör (bezárt lap): a következő induláskor lezárul', () => {
  const storage = memStorage();
  const clock = { t: T0 };
  const a = createProgressLog({ key: 'k', storage, now: () => clock.t, newId: ids });
  a.beginRound({ seq: [0, 1], items: ['ma', 'me'], listNames: ['L'], flashMs: 0, gapMs: 0, count: 2 });
  let s = startRound([0, 1], 0, 0, 0);
  clock.t = T0 + 2000; const b = step(s, 'NEXT', 2000); a.step(s, 'NEXT', b); s = b;
  clock.t = T0 + 2500; a.visibility(true, 1);           // a lap elrejtődik, majd bezárul
  const again = createProgressLog({ key: 'k', storage, now: () => clock.t, newId: ids });
  assert.equal(again.root.rounds[0].folded, true);
  assert.equal(again.root.daily.find((d) => d.item === 'ma').exposures, 1);
});

/* ---------- listaazonosság (6.) ---------- */

test('listaazonosság: azonos név, 60% feletti átfedésű átnevezés, új lista', () => {
  let n = 0;
  const newId = () => `L${++n}`;
  const first = reconcileLists({}, [{ name: '30. oldal', items: ['ma', 'me', 'mi', 'mo', 'mu'] }, { name: 'Saját', items: ['ló'] }], { now: 1, newId });
  assert.equal(first.idOf.get('30. oldal'), 'L1');
  const renamed = reconcileLists(first.lists, [
    { name: '30. oldal (új)', items: ['ma', 'me', 'mi', 'xx'] },    // 3/5 = 60% → átnevezés
    { name: 'saját', items: ['ló', 'sí'] },                           // azonos név (kis-/nagybetű)
    { name: 'Más', items: ['ma'] },                                   // 1/5: új lista
  ], { now: 2, newId });
  assert.equal(renamed.idOf.get('30. oldal (új)'), 'L1');
  assert.deepEqual(renamed.lists.L1.names, ['30. oldal', '30. oldal (új)']);
  assert.equal(renamed.idOf.get('saját'), 'L2');
  assert.equal(renamed.idOf.get('más'), 'L3');
  assert.deepEqual(renamed.lists.L1.items, ['ma', 'me', 'mi', 'xx'], 'a tartalom mindig a jelenlegi');
  const below = reconcileLists(first.lists, [{ name: 'X', items: ['ma', 'me'] }, { name: 'Saját', items: ['ló'] }], { now: 3, newId });
  assert.notEqual(below.idOf.get('x'), 'L1', '2/5 = 40%: új lista');
  assert.ok(below.lists.L1, 'a régi lista megmarad');
  assert.equal(overlap([], ['a']), 0);
});

test('listaazonosság: a kör a listák azonosítóját is tárolja', () => {
  const { log, clock } = fresh();
  const idOf = log.syncLists([{ name: 'L', items: ['ma', 'me'] }]);
  play(log, clock, { items: ['ma', 'me'] }, [['NEXT', 2000], ['NEXT', 4000]]);
  assert.deepEqual(log.root.rounds[0].listIds, [idOf.get('l')]);
  assert.deepEqual(log.root.rounds[0].listNames, ['L']);
});

test('roundExposures közvetlenül: üres kör', () => {
  assert.deepEqual(roundExposures({ id: 'r', flashMs: 0 }, [], S).exposures, []);
  assert.deepEqual(dailyRecords([], { deviceId: 'd', child: 'c', fastFlashMs: 5000 }), []);
});
