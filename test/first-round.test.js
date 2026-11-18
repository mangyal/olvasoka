// Idő az első körig (docs/kartyacsomagok-specifikacio.md, 7.): mikor és mivel megy ki a first-round esemény.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firstRoundKey, normalizeFirstRound, initFirstRound, firstRoundData } from '../js/core/first-round.js';

const NOW = 1_763_460_000_000;

test('első kör: a kulcs a meglévő elnevezési rendhez igazodik', () => {
  assert.equal(firstRoundKey('olvasoka'), 'olvasoka_elsokor');
  assert.equal(firstRoundKey('olvasoka-dev'), 'olvasoka-dev_elsokor');
});

test('első kör: új készülék: első látogatás, elküldendő, a jelző mentődik', () => {
  assert.deepEqual(initFirstRound({ stored: null, legacy: false, storageOK: true, now: NOW }),
    { save: { seen: NOW, sent: false }, firstVisit: true, pending: true });
});

test('első kör: második betöltés kör nélkül: még elküldendő, de nem első látogatás', () => {
  assert.deepEqual(initFirstRound({ stored: { seen: NOW - 1000, sent: false }, legacy: true, storageOK: true, now: NOW }),
    { save: null, firstVisit: false, pending: true });
});

test('első kör: legfeljebb egyszer megy el', () => {
  assert.deepEqual(initFirstRound({ stored: { seen: NOW - 1000, sent: true }, legacy: true, storageOK: true, now: NOW }),
    { save: null, firstVisit: false, pending: false });
});

test('első kör: régi adatú készüléken küldés nélkül lezárul', () => {
  assert.deepEqual(initFirstRound({ stored: null, legacy: true, storageOK: true, now: NOW }),
    { save: { seen: NOW, sent: true }, firstVisit: false, pending: false });
});

test('első kör: tárolás nélkül (pl. privát böngészés) nincs esemény és nincs mentés', () => {
  for (const legacy of [false, true]) {
    assert.deepEqual(initFirstRound({ stored: null, legacy, storageOK: false, now: NOW }), { save: null, firstVisit: false, pending: false });
  }
});

test('első kör: sérült tárolt jelző újnak számít', () => {
  for (const stored of ['x', [], { sent: true }, { seen: 'tegnap' }]) assert.equal(normalizeFirstRound(stored), null);
  assert.deepEqual(normalizeFirstRound({ seen: NOW, sent: 'igen' }), { seen: NOW, sent: false });
});

test('első kör: az adatok egész másodperc, és csak a megengedett mezők (tétel nincs)', () => {
  const d = firstRoundData({ ms: 41_600.4, firstVisit: true, welcome: 'tour', tour: 'done', game: 'read' });
  assert.deepEqual(d, { sec: 42, firstVisit: true, welcome: 'tour', tour: 'done', game: 'read' });
  assert.equal(firstRoundData({ ms: -5, firstVisit: false, welcome: 'none', tour: 'none', game: 'find' }).sec, 0);
});

test('első kör: a főprogram a round-start előtt küldi, mindkét játékban', () => {
  const main = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  for (const game of ['read', 'find']) {
    const i = main.indexOf(`trackFirstRound('${game}')`), j = main.indexOf(`trackRoundStart('${game}'`);
    assert.ok(i > 0 && j > i, `${game}: first-round a round-start előtt`);
  }
  // a jelzők még az első mentés (persist) előtt dőlnek el
  assert.ok(main.indexOf('initFirstRound(') < main.indexOf('function persist('));
});
