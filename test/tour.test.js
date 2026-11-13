// Első lépések (bemutató): tárolás, megjelenítési feltétel, célelem, szövegek, elhelyezés.
// Spec: docs/bemutato-specifikacio.md (2., 3.2, 4.1, 5., 7.).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOUR_VERSION, TOUR_STEPS, normalizeTour, shouldAutoStart, fitsViewport, pickTarget, targetFor,
  stepContent, plainText, place, grow, holePath, SIDES, GAP, ARROW_MIN,
} from '../js/core/tour.js';
import { normalizeState } from '../js/core/settings.js';

const T = (over = {}) => ({ v: TOUR_VERSION, how: 'done', at: 1_700_000_000_000, ...over });

/* ---------- tárolás (5.) ---------- */
test('normalizeTour: érvényes érték megmarad, minden más null', () => {
  assert.deepEqual(normalizeTour(T()), T());
  assert.deepEqual(normalizeTour(T({ how: 'skipped' })), T({ how: 'skipped' }));
  assert.deepEqual(normalizeTour({ ...T(), extra: 1 }), T(), 'ismeretlen mező kimarad');
  for (const bad of [null, undefined, 'done', 1, true, [], {}, T({ how: 'maybe' }), T({ how: undefined }),
    T({ v: 0 }), T({ v: 1.5 }), T({ v: '1' }), T({ at: 'tegnap' }), T({ at: NaN }), T({ at: undefined })]) {
    assert.equal(normalizeTour(bad), null, JSON.stringify(bad));
  }
});

test('normalizeState: a tour mező megmarad, ha érvényes; null, ha érvénytelen; a v marad 4', () => {
  assert.deepEqual(normalizeState({ v: 4, tour: T() }).tour, T());
  assert.equal(normalizeState({ v: 4, tour: T() }).v, 4);
  assert.equal(normalizeState({ v: 4, tour: { how: 'done' } }).tour, null);
  assert.equal(normalizeState({ v: 4, tour: 'skipped' }).tour, null);
  assert.equal(normalizeState(null).tour, null);
});

test('normalizeState: a régi állapot tour nélkül is betölthető, a többi mező érintetlen', () => {
  const v3 = { v: 3, lastLists: ['A'], hideHelp: true, settings: { flashMs: 5000, gapMs: 0, count: 12, source: 'list' } };
  const s = normalizeState(v3);
  assert.equal(s.tour, null);
  assert.equal(s.hideHelp, true);
  assert.deepEqual(s.lastLists, ['A']);
  const v4 = normalizeState({ v: 4, mode: 'find', find: { cards: 6 } });
  assert.equal(v4.tour, null);
  assert.equal(v4.mode, 'find');
});

/* ---------- megjelenítési feltétel (4.1) ---------- */
test('shouldAutoStart: tour × hideHelp × cím × TOUR_VERSION', () => {
  const cases = [
    // [bemenet, várt]
    [{}, true],
    [{ tour: null, hideHelp: false, hash: '' }, true],
    [{ tour: null, hash: '#' }, true],
    [{ tour: T() }, false],
    [{ tour: T({ how: 'skipped' }) }, false],
    [{ tour: { how: 'done' } }, true, 'érvénytelen tárolt állapot = nincs'],
    [{ hideHelp: true }, false, 'aki kikapcsolta a súgót'],
    [{ hideHelp: 'true' }, true, 'csak a valódi true számít'],
    [{ hash: '#haladas' }, false],
    [{ hash: '#haladas/csoport/fluent' }, false],
    [{ hash: '#haladas/tetel/ma' }, false],
    [{ hash: '#haladasok' }, true, 'csak a Haladás útvonalai'],
    [{ tour: T({ v: 1 }), version: 2 }, true, 'régebbi tartalom: újra'],
    [{ tour: T({ v: 1, how: 'skipped' }), version: 2 }, true],
    [{ tour: T({ v: 2 }), version: 2 }, false],
    [{ tour: T({ v: 3 }), version: 2 }, false, 'újabb verzió (visszaállított kiadás): nem'],
    [{ tour: T({ v: 1 }), version: 2, hideHelp: true }, false],
    [{ tour: null, version: 2, hash: '#haladas' }, false],
  ];
  for (const [input, want, why = ''] of cases) assert.equal(shouldAutoStart(input), want, `${JSON.stringify(input)} ${why}`);
});

test('fitsViewport: a 320 × 256 minimumtól (döntés 2026-11-13)', () => {
  assert.equal(fitsViewport(320, 256), true);
  assert.equal(fitsViewport(844, 390), true, 'fekvő telefon');
  assert.equal(fitsViewport(319, 800), false);
  assert.equal(fitsViewport(1280, 255), false);
});

/* ---------- célelem (2.1) ---------- */
test('pickTarget: az első látható a #listNav, #listChecks, #listsBtn sorból', () => {
  const vis = (...ids) => (id) => ids.includes(id);
  assert.equal(pickTarget(vis('listNav', 'listChecks', 'listsBtn')), 'listNav', 'széles');
  assert.equal(pickTarget(vis('listChecks')), 'listChecks', 'álló tablet');
  assert.equal(pickTarget(vis('listsBtn')), 'listsBtn', 'telefon');
  assert.equal(pickTarget(vis('listChecks', 'listsBtn')), 'listChecks');
  assert.equal(pickTarget(vis()), null, 'semmi nem látszik');
  assert.equal(targetFor(2, vis()), 'modeTabs');
  assert.equal(targetFor(3, vis()), 'progressBtn');
  assert.equal(targetFor(4, vis()), 'startBtn');
  assert.equal(targetFor(1, vis('listsBtn')), 'listsBtn');
});

/* ---------- szövegek (2.) ---------- */
test('stepContent: felirat, cím, gomb és haladásjelző lépésenként', () => {
  const titles = ['Válassz listát', 'Válassz játékot', 'Itt látod a haladást', 'Kezdődhet a közös olvasás'];
  for (let n = 1; n <= TOUR_STEPS; n++) {
    const c = stepContent(n);
    assert.equal(c.eyebrow, `Első lépések · ${n}/4`);
    assert.equal(c.title, titles[n - 1]);
    assert.equal(c.primary, n === 4 ? 'Kész' : 'Tovább');
    assert.equal(c.progressLabel, `${n}. lépés a 4-ből`);
  }
  assert.throws(() => stepContent(5), RangeError);
});

test('stepContent: az 1. lépés a célelem és az eszköz szerint', () => {
  const C = 'A játékban csak a kijelölt listák tételei jönnek elő.';
  const s = (o) => plainText(stepContent(1, o).lines);
  assert.equal(s({ target: 'listNav', touch: false, mod: 'Ctrl' }), `Kattints egy listára. ${C} Többet is kijelölhetsz Ctrl + kattintással.`);
  assert.equal(s({ target: 'listNav', touch: false, mod: '⌘' }), `Kattints egy listára. ${C} Többet is kijelölhetsz ⌘ + kattintással.`);
  assert.equal(s({ target: 'listNav', touch: true, mod: '⌘' }), `Koppints egy listára. ${C}`);
  assert.equal(s({ target: 'listChecks', touch: true }), `Pipáld be a listákat, amelyekből gyakoroltok. ${C}`);
  assert.equal(s({ target: 'listsBtn', touch: true }), `Koppints ide, és pipáld be a listákat. ${C}`);
  // a módosító billentyű <kbd>-ként
  assert.ok(stepContent(1, { target: 'listNav', mod: '⌘' }).lines[0].some((p) => p.kbd === '⌘'));
});

test('stepContent: a 2. lépés három sora, félkövér játéknevekkel', () => {
  const { lines } = stepContent(2);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[0][0], { b: 'Felolvasás' });
  assert.deepEqual(lines[1][0], { b: 'Keresd meg!' });
  assert.equal(plainText(lines), 'Felolvasás: a gyerek felolvassa a felvillanó tételt, te pedig ellenőrzöd.\n'
    + 'Keresd meg!: te mondasz egy tételt, ő megkeresi.\nAlatta beállíthatod a körök számát.');
});

test('stepContent: a 3. lépés a napszámot a beállításból veszi', () => {
  assert.match(plainText(stepContent(3, { minDays: 3 }).lines), /legalább 3 különböző napon olvasta\.$/);
  assert.match(plainText(stepContent(3, { minDays: 5 }).lines), /legalább 5 különböző napon/);
});

test('stepContent: a 4. lépés billentyűzetes és érintéses szövege, gyorsbillentyű nélkül', () => {
  const k = plainText(stepContent(4, { touch: false }).lines);
  const t = plainText(stepContent(4, { touch: true }).lines);
  assert.equal(k, 'Üljetek le együtt, és nyomd meg az Indítás gombot. A kör végén jutalomjáték vár a gyerekre.');
  assert.equal(t, 'Üljetek le együtt, és koppints az Indítás gombra. A kör végén jutalomjáték vár a gyerekre.');
  assert.ok(!stepContent(4).lines.flat().some((p) => p.kbd), 'nincs <kbd>');
});

test('stepContent: nincs gondolatjel, és kettőspont csak a 2. lépés játékneveinél (1.)', () => {
  for (let n = 1; n <= TOUR_STEPS; n++) {
    for (const o of [{ touch: false }, { touch: true }, { target: 'listChecks' }, { target: 'listsBtn' }]) {
      const c = stepContent(n, o);
      const all = [c.title, plainText(c.lines)].join('\n');
      assert.doesNotMatch(all, /[–—]/, `${n}. lépés: gondolatjel`);
      const colons = n === 2 ? plainText(c.lines).replace(/^(Felolvasás|Keresd meg!):/gm, '') : all;
      assert.doesNotMatch(colons, /:/, `${n}. lépés: kettőspont`);
    }
  }
});

/* ---------- elhelyezés (3.2) ---------- */
const VIEW = { w: 1280, h: 800 };
const SIZE = { w: 320, h: 180 };
const rect = (left, top, w, h) => ({ left, top, right: left + w, bottom: top + h });
const inside = (p, size, view, m = 8) => p.left >= m && p.top >= m && p.left + size.w <= view.w - m && p.top + size.h <= view.h - m;
const overlaps = (p, size, r) => !(p.left + size.w <= r.left || p.left >= r.right || p.top + size.h <= r.top || p.top >= r.bottom);

test('place: az elsődleges oldalra kerül, a nyíl a célelem közepére mutat', () => {
  const hole = rect(0, 70, 232, 300);            // a listasáv balra
  const p = place(hole, SIZE, VIEW, 'right');
  assert.equal(p.side, 'right');
  assert.equal(p.left, hole.right + GAP);
  assert.equal(p.top + p.arrow, 220, 'a nyíl a célelem függőleges közepén');
  assert.ok(p.fits && inside(p, SIZE, VIEW));
  const b = place(rect(1000, 10, 100, 40), SIZE, VIEW, 'below');
  assert.equal(b.side, 'below');
  assert.equal(b.top, 50 + GAP);
});

test('place: ha nem fér el, a szemközti oldalra fordul', () => {
  const r = place(rect(1100, 300, 160, 60), SIZE, VIEW, 'right');
  assert.equal(r.side, 'left');
  const a = place(rect(500, 30, 100, 40), SIZE, VIEW, 'above');
  assert.equal(a.side, 'below');
});

test('place: ha egyik oldalon sem, akkor alá vagy fölé', () => {
  // széles célelem (pl. álló tableten a játékfülek): jobbra-balra nincs hely
  const view = { w: 820, h: 1180 };
  const hole = rect(20, 400, 780, 90);
  const p = place(hole, SIZE, view, 'left');
  assert.equal(p.side, 'below');
  assert.ok(!overlaps(p, SIZE, hole) && inside(p, SIZE, view));
  const low = place(rect(20, 1000, 780, 90), SIZE, view, 'left');
  assert.equal(low.side, 'above');
});

test('place: végső esetben oda kerül, ahol a legtöbb hely van, és az ablakon belül marad', () => {
  const view = { w: 400, h: 300 };
  const p = place(rect(10, 60, 380, 200), SIZE, view, 'right');
  assert.equal(p.fits, false);
  assert.ok(inside(p, SIZE, view));
});

test('place: a nyíl legalább 20 px-re a buborék szélétől, a buborék az ablakon belül', () => {
  // a célelem az ablak jobb felső sarkában (pl. a Haladás gomb)
  const p = place(rect(1180, 10, 90, 36), SIZE, VIEW, 'below');
  assert.ok(inside(p, SIZE, VIEW));
  assert.ok(p.arrow >= ARROW_MIN && p.arrow <= SIZE.w - ARROW_MIN);
  const corner = place(rect(1270, 10, 8, 8), SIZE, VIEW, 'below');
  assert.equal(corner.arrow, SIZE.w - ARROW_MIN);
  const left = place(rect(0, 400, 4, 4), SIZE, VIEW, 'above');
  assert.equal(left.arrow, ARROW_MIN);
});

test('place: telefonon teljes szélesség, 16 px margóval', () => {
  const view = { w: 390, h: 844 }, size = { w: 358, h: 170 };
  const p = place(rect(16, 90, 358, 52), size, view, SIDES.phone[1], { margin: 16 });
  assert.equal(p.left, 16);
  assert.equal(p.side, 'below');
  const s = place(rect(16, 760, 358, 56), size, view, SIDES.phone[4], { margin: 16 });
  assert.equal(s.side, 'above');
  assert.equal(s.top + size.h + GAP, 760);
});

test('SIDES: a spec táblázata', () => {
  assert.deepEqual({ ...SIDES.wide }, { 1: 'right', 2: 'left', 3: 'below', 4: 'left' });
  assert.deepEqual({ ...SIDES.phone }, { 1: 'below', 2: 'above', 3: 'below', 4: 'above' });
});

test('grow és holePath: 6 px-szel nagyobb lyuk, evenodd útvonal', () => {
  assert.deepEqual(grow(rect(10, 20, 100, 50)), { left: 4, top: 14, right: 116, bottom: 76 });
  const p = holePath({ w: 1280, h: 800 }, grow(rect(10, 20, 100, 50)), 12);
  assert.match(p, /^path\(evenodd, "M0 0H1280V800H0Z/);
  assert.match(p, /M16 14H104A12 12 0 0 1 116 26/);
  // a sugár legfeljebb a lyuk fele
  assert.match(holePath({ w: 100, h: 100 }, { left: 0, top: 0, right: 10, bottom: 10 }, 40), /A5 5/);
});
