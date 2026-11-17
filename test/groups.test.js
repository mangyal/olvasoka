// Tételcsoportok (spec 2.14, C-1–C-4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupOf, compareRank, shapeOf } from '../js/core/groups.js';

const key = (x) => groupOf(x).key;
const order = (xs) => [...xs].sort((a, b) => compareRank(groupOf(a).rank, groupOf(b).rank));

test('csoport: az elfogadási kritériumok példái', () => {
  assert.equal(key('a'), 'V');
  assert.equal(key('ő'), 'V');
  assert.equal(key('sz'), 'C');
  assert.equal(key('dzs'), 'C', 'a többjegyű betű egy betű');
  assert.equal(key('ók'), 'VC');
  assert.equal(key('asz'), 'VC');
  assert.equal(key('szó'), 'CV');
  assert.equal(key('kap'), 'S:CVC');
  assert.equal(key('pré'), 'S:CCV');
  assert.equal(key('ke-fe'), 'W:2');
  assert.equal(key('kefe'), 'W:2', 'a kötőjel nem számít');
  assert.equal(key('pi-ló-ta'), 'W:3');
});

test('csoport: kisbetűtől független, a hosszú többjegyű mássalhangzó két betű', () => {
  assert.equal(key('Ma'), key('ma'));
  assert.equal(key('A'), 'V');
  assert.equal(shapeOf('asz-szony'), 'VCCVC');
  assert.equal(shapeOf('ssz'), 'CC');
  assert.doesNotThrow(() => groupOf('ssz'), 'magánhangzó nélküli tétel a listákban nincs, de nem dob hibát');
});

test('csoport: fix sorrend magánhangzó < mássalhangzó < VC < CV < egyéb < szó (2) < szó (3)', () => {
  assert.deepEqual(order(['pi-ló-ta', 'kap', 'ke-fe', 'szó', 'ók', 'sz', 'a']),
    ['a', 'sz', 'ók', 'szó', 'kap', 'ke-fe', 'pi-ló-ta']);
});

test('csoport: egyéb szótagnál kevesebb betű előbb, azonos hossznál CCV < CVC < VCC (C < V)', () => {
  assert.deepEqual(order(['ark', 'kap', 'pré', 'sztár', 'kar-ma']), ['pré', 'kap', 'ark', 'sztár', 'kar-ma']);
  assert.ok(compareRank(groupOf('kap').rank, groupOf('kap').rank) === 0);
});
