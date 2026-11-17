// Anonim használati statisztika (docs/analitika-specifikacio.md): mi töltődik be, és mi mehet ki.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAnalytics, clean, SCRIPT_SRC, MAX_TEXT } from '../js/data/analytics.js';
import { envConfig, envFrom } from '../js/core/env.js';
import { ANALYTICS } from '../js/core/config.js';

const ID = 'dfd4a0f2-55e0-4d83-9667-91c91302ca27';

function fakeDoc() {
  const head = { children: [], append(n) { this.children.push(n); } };
  return {
    head,
    createElement: () => ({ attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } }),
  };
}

test('statisztika: azonosítóval betölti a szkriptet, a #hash és a ?keresés kimarad', () => {
  const doc = fakeDoc();
  const a = createAnalytics({ websiteId: ID, doc, win: {} });
  assert.equal(a.enabled, true);
  const [s] = doc.head.children;
  assert.equal(s.src, SCRIPT_SRC);
  assert.equal(s.attrs['data-website-id'], ID);
  assert.equal(s.attrs['data-exclude-hash'], 'true');     // #haladas/tetel/<tétel> nem mehet ki
  assert.equal(s.attrs['data-exclude-search'], 'true');
});

test('statisztika: azonosító nélkül (vagy hibással) semmi nem töltődik be és nem megy ki', () => {
  for (const websiteId of ['', undefined, 'nem-uuid']) {
    const doc = fakeDoc();
    const sent = [];
    const a = createAnalytics({ websiteId, doc, win: { umami: { track: (...x) => sent.push(x) } } });
    a.track('round-start', { game: 'read' });
    assert.equal(a.enabled, false);
    assert.equal(doc.head.children.length, 0);
    assert.equal(sent.length, 0);
  }
});

test('statisztika: az esemény továbbmegy; betöltés előtt, vagy ha az Umami hibát dob, csendben elvész', () => {
  const sent = [];
  const win = {};
  const a = createAnalytics({ websiteId: ID, doc: fakeDoc(), win });
  a.track('round-start', { game: 'read' });                // még nincs window.umami
  win.umami = { track: (...x) => sent.push(x) };
  a.track('round-end', { game: 'find', round: 2, completed: false });
  assert.deepEqual(sent, [['round-end', { game: 'find', round: 2, completed: false }]]);
  win.umami = { track: () => { throw new Error('blokkolva'); } };
  assert.doesNotThrow(() => a.track('reward-pick', { reward: 'panda' }));
});

test('statisztika: csak szám, logikai érték és vágott szöveg marad', () => {
  const long = 'x'.repeat(MAX_TEXT + 50);
  const c = clean({ n: 3, b: false, s: 'a', empty: '', nul: null, und: undefined, nan: NaN, obj: { a: 1 }, arr: [1], long });
  assert.deepEqual(Object.keys(c), ['n', 'b', 's', 'long']);
  assert.equal(c.long.length, MAX_TEXT);
});

test('statisztika: a dev és a helyi futtatás nem kapja az éles azonosítót', () => {
  assert.equal(ANALYTICS.prod.websiteId, ID);
  assert.equal(ANALYTICS.dev.websiteId, '');
  assert.equal(envConfig('prod').analyticsId, ID);
  assert.equal(envConfig('dev').analyticsId, '');
  assert.equal(envFrom(new URL('http://localhost:8000/')), 'dev');
});

test('statisztika: a főprogram tételt nem küld (csak a megengedett eseményadatok)', () => {
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const calls = [...main.matchAll(/stats\.track\('([^']+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(calls, ['progress-open', 'reward-pick', 'round-end', 'round-start', 'tour-end']);
  assert.doesNotMatch(main, /stats\.track\([^)]*(roundItems|items|seq|progress\.root)/);
});
