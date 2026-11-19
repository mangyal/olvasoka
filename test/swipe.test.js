// Lapozás húzással a Felolvasásban (F-P16a): a mozdulat osztályozása.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gesture, TAP_MAX, SWIPE_MIN, FLICK_MIN, FLICK_MS } from '../js/core/swipe.js';

const slow = 600;

test('lapozás: kis elmozdulás koppintás (F-P16)', () => {
  assert.equal(gesture({ dx: 0, dy: 0, dt: 80 }), 'TAP');
  assert.equal(gesture({ dx: TAP_MAX, dy: 0, dt: 80 }), 'TAP');
  assert.equal(gesture({ dx: 8, dy: -8, dt: 80 }), 'TAP');
});

test('lapozás: balra húzás a következő, jobbra az előző', () => {
  assert.equal(gesture({ dx: -SWIPE_MIN, dy: 0, dt: slow }), 'NEXT');
  assert.equal(gesture({ dx: SWIPE_MIN, dy: 0, dt: slow }), 'PREV');
  assert.equal(gesture({ dx: -200, dy: 40, dt: slow }), 'NEXT', 'enyhén ferde is vízszintes');
});

test('lapozás: lassú, rövid húzás nem lapoz; gyors pöccintés igen', () => {
  assert.equal(gesture({ dx: -(SWIPE_MIN - 1), dy: 0, dt: slow }), null);
  assert.equal(gesture({ dx: -FLICK_MIN, dy: 0, dt: FLICK_MS }), 'NEXT');
  assert.equal(gesture({ dx: FLICK_MIN, dy: 0, dt: FLICK_MS }), 'PREV');
  assert.equal(gesture({ dx: -(FLICK_MIN - 1), dy: 0, dt: 50 }), null);
  assert.equal(gesture({ dx: -FLICK_MIN, dy: 0, dt: FLICK_MS + 1 }), null);
});

test('lapozás: függőleges és átlós húzás semmit nem csinál', () => {
  assert.equal(gesture({ dx: 0, dy: 200, dt: slow }), null);
  assert.equal(gesture({ dx: -100, dy: 100, dt: slow }), null, 'átlós');
  assert.equal(gesture({ dx: -60, dy: 41, dt: slow }), null, 'a vízszintes kevesebb, mint a függőleges másfélszerese');
});
