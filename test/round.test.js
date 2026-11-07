// A kör állapotgépe kitalált idővonalon (ms), valódi várakozás nélkül.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startRound, step, remainingMs, canPrev } from '../js/core/round.js';

const run = (s, events) => events.reduce((acc, [ev, t]) => step(acc, ev, t), s);

test('magától vált a felvillanási idő után (F-P1)', () => {
  let s = startRound([0, 1, 2], 3000, 0, 0);
  s = step(s, 'TICK', 2999); assert.equal(s.index, 0);
  s = step(s, 'TICK', 3000); assert.equal(s.index, 1); assert.equal(s.deadline, 6000);
});

test('szünet a tételek között, ← a szünetben a most lejártat hozza (F-P2, F-P6)', () => {
  let s = startRound([0, 1], 1000, 500, 0);
  s = step(s, 'TICK', 1000); assert.equal(s.phase, 'gap'); assert.equal(s.deadline, 1500);
  s = step(s, 'PREV', 1200); assert.equal(s.phase, 'showing'); assert.equal(s.index, 0); assert.equal(s.deadline, 2200);
  s = run(s, [['TICK', 2200], ['TICK', 2700]]); assert.equal(s.index, 1);
});

test('pause megállítja az időt, folytatáskor a maradék fut le (F-P5)', () => {
  let s = startRound([0, 1], 3000, 0, 0);
  s = step(s, 'PAUSE', 1200); assert.ok(s.paused); assert.equal(remainingMs(s, 9999), 1800);
  s = step(s, 'TICK', 10000); assert.equal(s.index, 0, 'pause alatt nem vált');
  s = step(s, 'SPACE', 10000); assert.equal(s.index, 0, 'pause alatt a Space nem lép');
  s = step(s, 'PAUSE', 20000); assert.equal(s.deadline, 21800);
  s = step(s, 'TICK', 21800); assert.equal(s.index, 1);
});

test('navigáció pause alatt lép és folytat (F-P7a)', () => {
  let s = startRound([0, 1, 2], 3000, 0, 0);
  s = run(s, [['PAUSE', 500], ['NEXT', 800]]);
  assert.equal(s.index, 1); assert.equal(s.paused, false); assert.equal(s.deadline, 3800);
  s = run(s, [['PAUSE', 900], ['PREV', 1000]]);
  assert.equal(s.index, 0); assert.equal(s.paused, false);
  s = run(s, [['PAUSE', 1100], ['PREV', 1200]]);
  assert.equal(s.paused, true, '← az első tételen: a pause megmarad');
  assert.equal(canPrev(s), false);
});

test('az utolsó tételen Space, → és lejárat is jutalomra vált', () => {
  const last = () => run(startRound([0, 1], 1000, 0, 0), [['NEXT', 10]]);
  assert.ok(step(last(), 'SPACE', 20).done);
  assert.ok(step(last(), 'NEXT', 20).done);
  assert.ok(step(step(last(), 'PAUSE', 20), 'NEXT', 30).done, '→ pause alatt is');
  assert.ok(step(last(), 'TICK', 1010).done);
  const g = run(startRound([0], 1000, 500, 0), [['TICK', 1000]]);
  assert.equal(g.phase, 'gap'); assert.ok(step(g, 'TICK', 1500).done, 'az utolsó utáni szünet végén');
});

test('kézi léptetés: felvillanás = 0', () => {
  let s = startRound([0, 1], 0, 0, 0);
  assert.equal(s.deadline, Infinity);
  s = step(s, 'TICK', 1e9); assert.equal(s.index, 0);
  s = run(s, [['PAUSE', 5], ['PAUSE', 10]]); assert.equal(s.deadline, Infinity);
  s = step(s, 'SPACE', 20); assert.equal(s.index, 1);
});

test('fókuszvesztés automatikusan megállít, de nem folytat (F-P8)', () => {
  let s = startRound([0, 1], 3000, 0, 0);
  s = step(s, 'BLUR', 1000); assert.ok(s.paused);
  s = step(s, 'BLUR', 2000); assert.ok(s.paused, 'második blur nem indítja újra');
});
