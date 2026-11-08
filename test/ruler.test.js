// A szótag-takaró vonalzó geometriája (spec F-P22, elfogadás 22).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rulerGeometry, tickLength } from '../js/core/cover.js';

const EM = 400;                               // betűméret px-ben
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} ≠ ${b}`);
const BOX = { left: 100, right: 400, top: 200, bottom: 520 };

test('a vonások a vonalzón belül, 0,045 em lépésközzel, 0,05 em-től a jobb vég − 0,03 em-ig', () => {
  const r = rulerGeometry(BOX, EM);
  near(r.ticks[0].x - r.x, 0.05 * EM, 'első vonás');
  for (let k = 1; k < r.ticks.length; k++) near(r.ticks[k].x - r.ticks[k - 1].x, 0.045 * EM, `lépésköz ${k}`);
  const end = r.x + r.w - 0.03 * EM;
  assert.ok(r.ticks.at(-1).x <= end + 1e-9, 'az utolsó legalább 0,03 em-re a jobb végtől');
  assert.ok(r.ticks.at(-1).x + 0.045 * EM > end, 'és nincs kihagyott vonás a végén');
  for (const t of r.ticks) assert.ok(t.x > r.x && t.x < r.x + r.w);
});

test('hosszminta 10/5/1: 0,16 / 0,11 / 0,06 em, az első 10-es', () => {
  assert.deepEqual([0, 1, 4, 5, 6, 9, 10, 15, 20].map(tickLength), [0.16, 0.06, 0.06, 0.11, 0.06, 0.06, 0.16, 0.11, 0.16]);
  const r = rulerGeometry(BOX, EM);
  r.ticks.forEach((t, k) => near(t.len, tickLength(k) * EM, `vonás ${k}`));
  near(r.ticks[0].len, 0.16 * EM, 'első = 10-es');
});

test('külső oldalon 0,06 em ráhagyás, a kötőjel felőli oldalon nincs', () => {
  const alone = rulerGeometry(BOX, EM);
  near(alone.x, 100 - 0.06 * EM, 'bal külső'); near(alone.x + alone.w, 400 + 0.06 * EM, 'jobb külső');
  const first = rulerGeometry({ ...BOX, hyphenRight: 420 }, EM);       // ka|-ta: jobbra kötőjel
  near(first.x, 100 - 0.06 * EM, 'bal külső'); near(first.x + first.w, 400, 'jobb: advance-szél');
  const last = rulerGeometry({ ...BOX, hyphenLeft: 80 }, EM);          // ka-|ta: balra kötőjel
  near(last.x, 100, 'bal: advance-szél'); near(last.x + last.w, 400 + 0.06 * EM, 'jobb külső');
});

test('a kötőjel tintáját soha nem éri el', () => {
  const r = rulerGeometry({ ...BOX, hyphenLeft: 103, hyphenRight: 396 }, EM);
  assert.ok(r.x > 103); assert.ok(r.x + r.w < 396);
});

test('függőlegesen a tinta-doboz ± 0,03 em; az alsó él legalább 4 px-re az időjelző fölött', () => {
  const free = rulerGeometry({ ...BOX, barTop: 1000 }, EM);
  near(free.y, 200 - 0.03 * EM, 'fent'); near(free.y + free.h, 520 + 0.03 * EM, 'lent');
  const tight = rulerGeometry({ ...BOX, barTop: 530 }, EM);            // a 12 px-es ráhagyás sértené
  near(tight.y + tight.h, 526, 'lent kisebb ráhagyás'); assert.ok(tight.y + tight.h <= 530 - 4);
  near(tight.y, free.y, 'a teteje nem változik');
  near(free.bevelY - free.y, 0.62 * free.h, 'élvonal a magasság 62%-ánál');
  near(free.rx, 0.03 * EM, 'sarok');
});

test('egy körön belül minden vonalzó azonos magasságú', () => {
  const a = rulerGeometry({ ...BOX, barTop: 600 }, EM), b = rulerGeometry({ ...BOX, left: 500, right: 560, barTop: 600 }, EM);
  assert.equal(a.y, b.y); assert.equal(a.h, b.h);
});

test('nagyon keskeny szótag: rövid vonalzó, legalább az első 10-es vonással, nem szélesedik a kötőjel felé', () => {
  const r = rulerGeometry({ left: 300, right: 310, top: 0, bottom: 100, hyphenRight: 330 }, EM);
  near(r.x + r.w, 310, 'jobb szél'); assert.ok(r.ticks.length >= 1); near(r.ticks[0].len, 0.16 * EM, '10-es');
});
