import { test } from 'node:test';
import assert from 'node:assert/strict';
import { geometry, makeCourse, placeCourse, needDir, jump, stepJump, landing, cameraFor, fellOut, LEVELS, SIDE_MIN, UP_MAX } from '../js/core/hop.js';
import { pickReward } from '../js/core/rewards.js';

const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const SCREENS = [[1366, 768], [1920, 1080], [1024, 600], [390, 844], [844, 390], [320, 256]];

/** Ugrás végig: az első padig, amire leérkezik, vagy amíg ki nem esik. */
function fly(j, pads, g, camY = 0) {
  for (let i = 0; i < 600; i++) {
    const n = stepJump(j, 1 / 60);
    const k = landing(j, n, pads, g);
    if (k >= 0) return { landed: k };
    if (fellOut(n, camY, g)) return { fell: true };
    j = n;
  }
  return {};
}

test('hop: a pálya a képernyőn belül marad, az ugrások egyértelműek', () => {
  for (const [W, H] of SCREENS) {
    const g = geometry({ W, H }), rng = seeded(W + H);
    for (let r = 0; r < 40; r++) {
      const pads = placeCourse(makeCourse(g, rng), g);
      assert.ok(pads.length - 1 >= LEVELS[0] && pads.length - 1 <= LEVELS[1], 'ugrások száma');
      pads.forEach((p, k) => {
        assert.ok(p.x - p.w / 2 >= 0 && p.x + p.w / 2 <= W, `${W}×${H}: a pad a képen belül`);
        if (!k) return;
        const dx = Math.abs(p.x - pads[k - 1].x);
        assert.ok(dx <= UP_MAX * g.P + 1e-9 || dx >= SIDE_MIN * g.P - 1e-9, `${W}×${H}: egyértelmű irány (${dx})`);
        assert.equal(pads[k - 1].y - p.y, g.S, 'egy emelettel feljebb');
      });
    }
  }
});

test('hop: a jó irány mindig a következő pad közepére visz', () => {
  for (const [W, H] of SCREENS) {
    const g = geometry({ W, H }), pads = placeCourse(makeCourse(g, seeded(3)), g);
    for (let k = 0; k < pads.length - 1; k++) {
      const dir = needDir(pads[k].x, pads[k + 1], g.P);
      const r = fly(jump(pads[k], pads[k + 1], dir, g), pads, g);
      assert.equal(r.landed, k + 1, `${W}×${H}: ${k}. → ${k + 1}.`);
    }
  }
});

test('hop: a ↑ soha nem veszélyes: ha nincs fölötte pad, helyben ugrik', () => {
  const g = geometry({ W: 1366, H: 768 });
  const pads = [{ x: 400, y: 600, w: g.w }, { x: 400 + 1.8 * g.P, y: 600 - g.S, w: g.w }];
  assert.equal(needDir(pads[0].x, pads[1], g.P), 1);
  assert.equal(fly(jump(pads[0], pads[1], 0, g), pads, g).landed, 0);
});

test('hop: rossz oldalra ugorva leesik (ha nincs alatta pad)', () => {
  const g = geometry({ W: 1366, H: 768 });
  const pads = [{ x: 600, y: 600, w: g.w }, { x: 600 + 1.8 * g.P, y: 600 - g.S, w: g.w }];
  assert.deepEqual(fly(jump(pads[0], pads[1], -1, g), pads, g), { fell: true });
});

test('hop: rossz oldalra ugorva egy lejjebb lévő padon megállhat', () => {
  const g = geometry({ W: 1366, H: 768 });
  const D = ((1.2 + 2.2) / 2) * g.P;
  const pads = [{ x: 600 - D, y: 600 + g.S, w: g.w }, { x: 600, y: 600, w: g.w }, { x: 600 + 1.8 * g.P, y: 600 - g.S, w: g.w }];
  assert.equal(fly(jump(pads[1], pads[2], -1, g), pads, g).landed, 0);
});

test('hop: egy ugrás fél mp körül tart', () => {
  const g = geometry({ W: 1366, H: 768 });
  const a = { x: 500, y: 600, w: g.w }, b = { x: 500 + 2 * g.P, y: 600 - g.S, w: g.w };
  let j = jump(a, b, 1, g), t = 0;
  for (;;) { const n = stepJump(j, 1 / 120); t += 1 / 120; if (landing(j, n, [b], g) >= 0) break; j = n; }
  assert.ok(t > 0.35 && t < 0.7, `${t.toFixed(2)} mp`);
});

test('hop: a kamera nem mutat a kiinduló pad alá, és a célon túl sem görget', () => {
  const g = geometry({ W: 1366, H: 768 });
  const goalY = g.bottom - 9 * g.S;
  assert.equal(cameraFor(g.bottom, goalY, g), 0);
  assert.equal(cameraFor(goalY, goalY, g), goalY - g.top);
  const mid = cameraFor(g.bottom - 4 * g.S, goalY, g);
  assert.ok(mid < 0 && mid > goalY - g.top);
  // ha az egész pálya kifér, nincs görgetés
  assert.equal(cameraFor(g.bottom - 2 * g.S, g.bottom - 2 * g.S, geometry({ W: 1366, H: 2000 })), 0);
});

test('jutalom: kétszer egymás után nem ugyanaz; ?jutalom= felülírja', () => {
  const rng = seeded(5);
  let last = null;
  for (let i = 0; i < 20; i++) { const r = pickReward(last, rng); assert.notEqual(r, last); last = r; }
  assert.equal(pickReward('panda', rng, 'panda'), 'panda');
  assert.ok(['lufi', 'panda'].includes(pickReward(null, rng, 'xyz')));
});
