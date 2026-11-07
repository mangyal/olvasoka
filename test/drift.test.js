import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, stepBalloon, windAt, isOut, RISE_S } from '../js/core/drift.js';

const W = 1366, H = 768, bw = 110, bh = bw / 0.82;
const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const run = (b, secs, env) => { for (let t = 0; t < secs; t += 1 / 60) b = stepBalloon(b, 1 / 60, t, env); return b; };

test('drift: alulról, a képernyő alól indul', () => {
  const rng = seeded(7);
  for (let i = 0; i < 50; i++) {
    const b = launch({ W, H, bw, bh, rng });
    assert.ok(b.y > H, 'a képernyő alatt');
    assert.ok(b.x >= bw / 2 && b.x <= W - bw / 2, 'vízszintesen a képen belül');
    assert.ok(b.vy < 0, 'emelkedve');
  }
});

test('drift: felszáll, 8–12 mp alatt ér fel', () => {
  const env = { W, H, dir: -1, blowerY: H * 5 / 6 };
  for (const seed of [1, 2, 3, 4, 5]) {
    let b = { ...launch({ W, H, bw, bh, rng: seeded(seed) }), y: H };
    const rise = b.rise;
    let t = 0;
    while (b.y > 0 && t < 30) { b = stepBalloon(b, 1 / 60, t, env); t += 1 / 60; }
    assert.ok(t >= RISE_S[0] - 0.5 && t <= RISE_S[1] + 0.5, `felérés ideje: ${t.toFixed(1)} mp (rise ${rise.toFixed(0)} px/s)`);
  }
});

test('drift: a szél irányába sodródik', () => {
  const start = { ...launch({ W, H, bw, bh, rng: seeded(3) }), x: W / 2, y: H / 2, vy: 0 };
  const toLeft = run(start, 3, { W, H, dir: -1, blowerY: H * 5 / 6 });
  const toRight = run(start, 3, { W, H, dir: 1, blowerY: H * 5 / 6 });
  assert.ok(toLeft.x < start.x - 30, `balra: ${(toLeft.x - start.x).toFixed(0)} px`);
  assert.ok(toRight.x > start.x + 30, `jobbra: ${(toRight.x - start.x).toFixed(0)} px`);
});

test('drift: a szél a fúvótól távolodva gyengül', () => {
  const env = { W, H, dir: -1, blowerY: H * 5 / 6 };        // fúvó jobb oldalt, balra fúj
  const near = windAt(W - 100, env.blowerY, env), far = windAt(100, env.blowerY, env);
  assert.ok(near < 0 && far < 0, 'balra fúj');
  assert.ok(Math.abs(near) > Math.abs(far) * 1.5, `közel ${near.toFixed(2)}, távol ${far.toFixed(2)}`);
  const mirrored = windAt(100, env.blowerY, { ...env, dir: 1 });
  assert.ok(Math.abs(mirrored + near) < 1e-9, 'tükrözve ugyanaz, ellentétes irányban');
});

test('drift: kimenetel felül és oldalt', () => {
  const b = launch({ W, H, bw, bh, rng: seeded(9) });
  assert.equal(isOut({ ...b, y: H / 2 }, { W, bw, bh }), false);
  assert.equal(isOut({ ...b, y: -bh * 1.3 }, { W, bw, bh }), true, 'felül');
  assert.equal(isOut({ ...b, y: H / 2, x: -bw - 1 }, { W, bw, bh }), true, 'balra ki');
  assert.equal(isOut({ ...b, y: H / 2, x: W + bw + 1 }, { W, bw, bh }), true, 'jobbra ki');
  assert.equal(isOut({ ...b, y: H + 50 }, { W, bw, bh }), false, 'alul, még beúszik');
});
