// Szótag-takarás (spec 4.5, elfogadás 18–19).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syllables, syllableCount, toggleCover, stepCover, coversMore } from '../js/core/cover.js';
import { startRound, step, remainingMs } from '../js/core/round.js';

const run = (s, events) => events.reduce((acc, [ev, t, arg]) => step(acc, ev, t, arg), s);
const shown = (c, n) => Array.from({ length: n }, (_, j) => !c[j]);

test('szótagolás kötőjelnél, üres szakasz nem szótag (F-P17)', () => {
  assert.deepEqual(syllables('ka-ta'), [{ text: 'ka', start: 0, end: 2 }, { text: 'ta', start: 3, end: 5 }]);
  assert.deepEqual(syllables('ke-fe-le').map((x) => x.text), ['ke', 'fe', 'le']);
  assert.equal(syllableCount('ka--ta'), 2);
  assert.equal(syllableCount('-ka'), 1);
  assert.equal(syllableCount('ka-'), 1);
  assert.equal(syllableCount('-'), 0);
  assert.equal(syllableCount('alma'), 1);
  assert.deepEqual(syllables('ő-sz').map((x) => [x.start, x.end]), [[0, 1], [2, 4]]);
});

test('↓ sorozat kétszótagúnál: egész → csak ka → csak ta → egész (elfogadás 18)', () => {
  let c = [];
  c = stepCover(c, 2); assert.deepEqual(shown(c, 2), [true, false]);
  c = stepCover(c, 2); assert.deepEqual(shown(c, 2), [false, true]);
  c = stepCover(c, 2); assert.deepEqual(c, []);
});

test('↓ sorozat háromszótagúnál öt állapottal zárul', () => {
  const states = [[]];
  for (let k = 0; k < 4; k++) states.push(stepCover(states.at(-1), 3));
  assert.deepEqual(states.map((c) => shown(c, 3).map(Number).join('')), ['111', '100', '010', '001', '111']);
});

test('↓ kevert takarásnál a „csak az 1.” állapotra ugrik; minden letakarva is kevertnek számít', () => {
  assert.deepEqual(shown(stepCover([false, true, true, false], 4), 4), [true, false, false, false]);
  assert.deepEqual(shown(stepCover([true, true], 2), 2), [true, false]);
  assert.deepEqual(shown(stepCover([false, false, true], 3), 3), [true, false, false]);
});

test('kattintás egy szótagra csak azt váltja; minden letakarható; egyszótagún nincs hatás', () => {
  let c = toggleCover([], 1, 3); assert.deepEqual(c, [false, true, false]);
  c = toggleCover(c, 0, 3); c = toggleCover(c, 2, 3); assert.deepEqual(c, [true, true, true]);
  c = toggleCover(toggleCover(toggleCover(c, 0, 3), 1, 3), 2, 3); assert.deepEqual(c, [], 'mind felfedve = egész');
  const one = [];
  assert.equal(toggleCover(one, 0, 1), one);
  assert.equal(stepCover(one, 1), one);
  assert.equal(toggleCover(one, 5, 2), one, 'nem létező szótag');
  assert.ok(coversMore([], [true, false]));
  assert.ok(!coversMore([true, true], [true, false]));
});

test('reducer: ↓ egyszótagún és szünetben (gap) nincs hatása', () => {
  let s = startRound([0, 1], 1000, 500, 0);
  assert.equal(step(s, 'COVER_DOWN', 10, { n: 1 }), s);
  s = step(s, 'TICK', 1000); assert.equal(s.phase, 'gap');
  assert.equal(step(s, 'COVER_DOWN', 1100, { n: 2 }), s);
  assert.equal(step(s, 'COVER', 1100, { i: 0, n: 2 }), s);
});

test('futó időnél az első takarás pause-t ad, a felfedés nem folytat (F-P20, elfogadás 19)', () => {
  let s = startRound([0, 1], 3000, 0, 0);
  s = step(s, 'COVER', 1000, { i: 1, n: 2 });
  assert.ok(s.paused); assert.deepEqual(s.covered, [false, true]); assert.equal(remainingMs(s, 99999), 2000);
  s = step(s, 'COVER', 1500, { i: 1, n: 2 });
  assert.ok(s.paused, 'felfedés nem indítja'); assert.deepEqual(s.covered, []);
  s = run(s, [['COVER_DOWN', 1600, { n: 2 }], ['PAUSE', 5000]]);
  assert.ok(!s.paused); assert.deepEqual(s.covered, [false, true], 'P után a takarás marad');
  assert.equal(s.deadline, 7000, 'a hátralévő idő fut le');
  s = step(s, 'TICK', 7000);
  assert.equal(s.index, 1); assert.deepEqual(s.covered, [], 'időlejárat után egész');
});

test('futás közbeni újabb letakarás újra megállít; felfedés futás közben nem', () => {
  let s = run(startRound([0, 1], 3000, 0, 0), [['COVER_DOWN', 100, { n: 3 }], ['PAUSE', 200]]);
  const u = step(s, 'COVER', 300, { i: 1, n: 3 });
  assert.ok(!u.paused, 'csak felfed'); assert.deepEqual(shown(u.covered, 3), [true, true, false]);
  const d = step(s, 'COVER_DOWN', 300, { n: 3 });
  assert.ok(d.paused, 'újabb szótag kerül takarásba');
});

test('kézi léptetésnél és pause alatt takar, az idő állapota nem változik', () => {
  let m = startRound([0, 1], 0, 0, 0);
  m = step(m, 'COVER_DOWN', 50, { n: 2 });
  assert.equal(m.paused, false); assert.equal(m.deadline, Infinity); assert.deepEqual(shown(m.covered, 2), [true, false]);
  let p = run(startRound([0, 1], 3000, 0, 0), [['PAUSE', 1000]]);
  const before = { paused: p.paused, remaining: p.remaining };
  p = step(p, 'COVER', 1200, { i: 0, n: 2 });
  assert.deepEqual({ paused: p.paused, remaining: p.remaining }, before);
  assert.deepEqual(p.covered, [true, false]);
});

test('bármely tételváltás után covered üres (F-P21)', () => {
  const covered = () => run(startRound([0, 1, 2], 3000, 500, 0), [['NEXT', 10], ['COVER', 20, { i: 0, n: 2 }]]);
  for (const [ev, t] of [['NEXT', 30], ['PREV', 30], ['PAUSE', 30]]) {
    let s = step(covered(), ev, t);
    if (ev === 'PAUSE') s = step(s, 'NEXT', 40);       // pause alatt is lép
    assert.deepEqual(s.covered, [], ev);
  }
  const g = run(covered(), [['PAUSE', 30], ['TICK', 4000]]);
  assert.equal(g.phase, 'gap'); assert.deepEqual(g.covered, []);
  assert.deepEqual(step(g, 'PREV', 4600).covered, [], '← a szünetben');
  const m = run(startRound([0, 1], 0, 0, 0), [['COVER', 5, { i: 0, n: 2 }], ['SPACE', 10]]);
  assert.equal(m.index, 1); assert.deepEqual(m.covered, []);
  assert.deepEqual(startRound([0], 1000, 0, 0).covered, []);
});
