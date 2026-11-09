// Környezetek: az éles és a dev ne írja felül egymás tárolt adatait.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { envFrom, envConfig, SHEETS } from '../js/core/env.js';

const at = (href) => new URL(href);

test('env: a cím alapján', () => {
  assert.equal(envFrom(at('https://mangyal.github.io/olvasoka/')), 'prod');
  assert.equal(envFrom(at('https://mangyal.github.io/olvasoka/index.html')), 'prod');
  assert.equal(envFrom(at('https://mangyal.github.io/olvasoka/dev/')), 'dev');
  assert.equal(envFrom(at('https://mangyal.github.io/olvasoka/dev/index.html')), 'dev');
  assert.equal(envFrom(at('http://localhost:8000/')), 'dev');
  assert.equal(envFrom(undefined), 'prod');
});

test('env: az éles megtartja a régi tárolási nevet, a dev külön nevet kap', () => {
  assert.equal(envConfig('prod').storageKey, 'olvasoka');
  assert.equal(envConfig('dev').storageKey, 'olvasoka-dev');
  assert.equal(envConfig('prod').sheet, SHEETS.prod);
  assert.equal(envConfig('dev').sheet, SHEETS.dev);
});

test('env: a service worker tárolója környezetenként külön, és az éles nem kezeli a /dev/-et', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(sw, /const CACHE = IS_DEV \? 'olvasoka-dev' : 'olvasoka';/);
  assert.match(sw, /if \(!IS_DEV && isDevPath\(url\.pathname\)\) return;/);
});

test('verzió: X.Y.Z alakú', () => {
  const v = readFileSync(new URL('../js/version.js', import.meta.url), 'utf8').match(/VERSION = '([^']+)'/);
  assert.ok(v, 'js/version.js: VERSION');
  assert.match(v[1], /^\d+\.\d+\.\d+$/);
});
