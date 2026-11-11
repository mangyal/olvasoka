// A PWA fájljai: a service worker tárolólistája egyezzen a repóval, a manifest ikonjai létezzenek.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const walk = (dir) => readdirSync(join(root, dir)).flatMap((f) => {
  const p = `${dir}/${f}`; return statSync(join(root, p)).isDirectory() ? walk(p) : [p];
});

const assets = () => {
  const m = read('sw.js').match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(m, 'sw.js: ASSETS lista');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

test('pwa: a tárolólista minden eleme létezik', () => {
  for (const a of assets()) if (a !== './') assert.ok(existsSync(join(root, a)), `hiányzik: ${a}`);
});

test('pwa: minden program-fájl a tárolólistán van (offline induláshoz)', () => {
  const list = new Set(assets());
  const need = [...walk('js'), ...walk('css'), ...walk('fonts').filter((f) => f.endsWith('.woff2')), 'index.html', 'img/hoslegfuvo.svg', 'parok.json', 'haladas.json'];
  for (const f of need) assert.ok(list.has(f), `nincs az sw.js ASSETS listáján: ${f}`);
});

test('pwa: manifest és ikonok', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.start_url, './'); assert.equal(m.scope, './');
  assert.ok(m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'), 'maskable 512');
  assert.ok(m.icons.some((i) => i.sizes === '192x192'), '192');
  for (const i of m.icons) assert.ok(existsSync(join(root, i.src)), `ikon hiányzik: ${i.src}`);
  const html = read('index.html');
  assert.match(html, /rel="manifest" href="manifest.webmanifest"/);
  assert.ok(existsSync(join(root, 'img/icons/apple-touch-icon.png')));
});
