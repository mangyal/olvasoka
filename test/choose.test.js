// Jutalomválasztó (spec F-R14, 12.5b, ellenőrzés 36.): a gyerek választ; tiszta reducer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHOICES, ARM_MS, startChoose, chooseStep } from '../js/core/choose.js';
import { REWARDS, forcedReward } from '../js/core/rewards.js';

const T0 = 1000, READY = T0 + ARM_MS;
/** Események sorban, mind ugyanabban az időpontban; `[ev, arg]` vagy `ev`. */
const run = (s, now, evs) => evs.reduce((acc, e) => (Array.isArray(e) ? chooseStep(acc, e[0], now, e[1]) : chooseStep(acc, e, now)), s);

test('induláskor egyik sincs kiemelve, nincs választás; a sorrend rögzített: Lufi, Panda', () => {
  const s = startChoose(T0);
  assert.deepEqual(CHOICES, ['lufi', 'panda']);
  assert.deepEqual(CHOICES, REWARDS, 'a választó a két jutalomjátékot kínálja');
  assert.equal(s.hi, null); assert.equal(s.picked, null);
  assert.equal(s.readyAt, READY);
});

test('az első 600 ms-ban minden bemenet elnyelődik (a kör végi lendület nem választ)', () => {
  const s = startChoose(T0);
  for (const e of ['LEFT', 'RIGHT', 'START', ['HOVER', 'panda'], ['DOWN', 'lufi'], ['UP', 'lufi'], ['PICK', 'panda']]) {
    assert.equal(run(s, READY - 1, [e]), s, `${[].concat(e).join(' ')}: nincs hatása`);
  }
  // → és Space a zár alatt, majd a zár után még egy Space: kiemelés nélkül nem indít
  const t = run(run(s, T0 + 50, ['RIGHT', 'START']), READY, ['START']);
  assert.equal(t.picked, null); assert.equal(t.hi, null);
});

test('← a Lufit, → a Pandát emeli ki; Space / Enter / ↑ (START) a kiemeltet indítja', () => {
  const s = startChoose(T0);
  assert.equal(run(s, READY, ['LEFT']).hi, 'lufi');
  assert.equal(run(s, READY, ['RIGHT']).hi, 'panda');
  assert.equal(run(s, READY, ['RIGHT', 'LEFT']).hi, 'lufi', 'az utolsó nyíl nyer');
  assert.equal(run(s, READY, ['RIGHT', 'RIGHT']).hi, 'panda', 'a szélen marad');
  assert.equal(run(s, READY, ['LEFT', 'START']).picked, 'lufi');
  assert.equal(run(s, READY, ['RIGHT', 'START']).picked, 'panda');
});

test('kiemelés nélkül a START nem indít semmit', () => {
  const s = run(startChoose(T0), READY, ['START', 'START']);
  assert.equal(s.picked, null);
});

test('egér fölé állva ugyanaz a kiemelés; egér és nyíl közül az utolsó nyer', () => {
  const s = startChoose(T0);
  assert.equal(run(s, READY, [['HOVER', 'panda']]).hi, 'panda');
  assert.equal(run(s, READY, [['HOVER', 'panda'], 'LEFT']).hi, 'lufi');
  assert.equal(run(s, READY, ['LEFT', ['HOVER', 'panda']]).hi, 'panda');
  assert.equal(run(s, READY, [['HOVER', 'panda'], 'START']).picked, 'panda');
  const same = run(s, READY, [['HOVER', 'lufi']]);
  assert.equal(chooseStep(same, 'HOVER', READY, 'lufi'), same, 'ugyanarra újra: nincs új állapot');
  assert.equal(run(s, READY, [['HOVER', 'xyz']]), s, 'ismeretlen kártya: nincs hatása');
});

test('koppintás: pointerup ugyanazon a kártyán, ahol a lenyomás volt, azonnal indít', () => {
  const s = startChoose(T0);
  assert.equal(run(s, READY, [['DOWN', 'panda'], ['UP', 'panda']]).picked, 'panda');
  assert.equal(run(s, READY, [['DOWN', 'lufi'], ['UP', 'lufi']]).picked, 'lufi');
  assert.equal(run(s, READY, [['DOWN', 'lufi'], ['UP', 'lufi']]).hi, null, 'koppintásnál nincs előzetes kiemelés');
});

test('a lenyomás nélküli felengedés nem számít (a kör végi koppintás folytatása)', () => {
  const s = startChoose(T0);
  assert.equal(run(s, READY, [['UP', 'panda']]).picked, null);
  // a lenyomás a zár alatt történt: elnyelődik, a felengedés utána sem indít
  const t = run(run(s, READY - 100, [['DOWN', 'panda']]), READY + 10, [['UP', 'panda']]);
  assert.equal(t.picked, null);
});

test('elhúzás a másik kártyára, a kártyák mellé vagy megszakítás: nincs választás, és nem marad függőben', () => {
  const s = startChoose(T0);
  const moved = run(s, READY, [['DOWN', 'lufi'], ['UP', 'panda']]);
  assert.equal(moved.picked, null); assert.equal(moved.down, null);
  assert.equal(run(moved, READY, [['UP', 'panda']]).picked, null, 'a következő felengedés sem indít magától');
  const off = run(s, READY, [['DOWN', 'lufi'], ['UP', null]]);
  assert.equal(off.picked, null); assert.equal(off.down, null);
  const cancel = run(s, READY, [['DOWN', 'lufi'], 'CANCEL', ['UP', 'lufi']]);
  assert.equal(cancel.picked, null);
});

test('PICK (képernyőolvasó / natív aktiválás) azonnal választ; ismeretlen név nem', () => {
  const s = startChoose(T0);
  assert.equal(run(s, READY, [['PICK', 'lufi']]).picked, 'lufi');
  assert.equal(run(s, READY, [['PICK', 'xyz']]).picked, null);
});

test('választás után semmi nem változtat rajta (a második bemenet nem vált játékot)', () => {
  const s = run(startChoose(T0), READY, ['LEFT', 'START']);
  for (const e of ['RIGHT', 'START', ['HOVER', 'panda'], ['DOWN', 'panda'], ['UP', 'panda'], ['PICK', 'panda']]) {
    assert.equal(run(s, READY + 500, [e]), s);
  }
  assert.equal(s.picked, 'lufi');
});

test('ismeretlen esemény: nincs hatása', () => {
  const s = run(startChoose(T0), READY, ['LEFT']);
  assert.equal(chooseStep(s, 'NOPE', READY), s);
});

test('?jutalom=: érvényes érték rögzíti a játékot (a választó kimarad), más érték nem számít', () => {
  assert.equal(forcedReward('lufi'), 'lufi');
  assert.equal(forcedReward('panda'), 'panda');
  for (const v of [null, undefined, '', 'xyz', 'Panda', 'lufi ']) assert.equal(forcedReward(v), null, String(v));
});
