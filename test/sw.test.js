// A service worker (sw.js) kiszolgálási stratégiája (N8): egy oldalbetöltés egy forrásból, a tárolóba
// csak az ASSETS fájljai kerülnek. A sw.js egy vm-homokozóban fut, hamis caches/fetch/időzítővel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const BASE = 'https://example.org/olvasoka/';
const TIMEOUT_SCALE = 100;   // a 3 mp-es időkorlát a tesztben 30 ms

function fakeCaches() {
  const stores = new Map();
  const keyOf = (r, ignoreSearch) => { const u = new URL(typeof r === 'string' ? r : r.url, BASE + 'sw.js'); return ignoreSearch ? u.origin + u.pathname : u.href; };
  const open = (name) => {
    if (!stores.has(name)) {
      const m = new Map();
      stores.set(name, {
        m,
        async match(r, o = {}) {
          const k = keyOf(r, o.ignoreSearch);
          for (const [key, v] of m) if ((o.ignoreSearch ? keyOf(key, true) : key) === k) return v.clone();
          return undefined;
        },
        async put(r, res) { m.set(keyOf(r), res); },
        async keys() { return [...m.keys()].map((url) => ({ url })); },
        async delete(r) { return m.delete(keyOf(r)); },
        async addAll() {},
      });
    }
    return stores.get(name);
  };
  return { open: async (n) => open(n), _get: (n) => open(n) };
}

/** A sw.js betöltése; `net(url)` adja a hálózati választ: { body, status?, delay? } vagy 'fail'. */
function loadSw(net) {
  const handlers = {};
  const caches = fakeCaches();
  const self = {
    location: new URL(BASE + 'sw.js'),
    addEventListener: (t, f) => { handlers[t] = f; },
    skipWaiting: async () => {},
    clients: { claim: async () => {}, matchAll: async () => [] },
  };
  const fetches = [];
  const fetch = (req) => {
    fetches.push(req.url);
    const r = net(req.url);
    return new Promise((resolve, reject) => setTimeout(() => (r === 'fail'
      ? reject(new TypeError('network'))
      : resolve(new Response(r.body, { status: r.status || 200 }))), r.delay || 0));
  };
  const ctx = {
    self, caches, fetch, URL, Request: class { constructor(u) { this.url = new URL(u, BASE + 'sw.js').href; } },
    Response, Promise, Map, Set, Error, TypeError, console,
    setTimeout: (f, ms) => setTimeout(f, ms / TIMEOUT_SCALE), clearTimeout,
  };
  vm.runInNewContext(SRC, ctx, { filename: 'sw.js' });
  const store = caches._get('olvasoka');

  async function request(path, { navigate = false, client = 'c1' } = {}) {
    const waits = [];
    let p;
    const e = {
      request: { url: new URL(path, BASE).href, method: 'GET', mode: navigate ? 'navigate' : 'cors' },
      clientId: navigate ? '' : client, resultingClientId: navigate ? client : '',
      respondWith: (x) => { p = x; }, waitUntil: (x) => { waits.push(x); },
    };
    handlers.fetch(e);
    if (!p) return null;
    const res = await p;
    await Promise.all(waits);
    return res.type === 'error' ? 'error' : res.text();
  }
  async function activate() {
    let p; handlers.activate({ waitUntil: (x) => { p = x; } }); await p;
  }
  return { request, activate, store, fetches };
}

const put = (store, path, body) => store.put(BASE + path, new Response(body));
const keys = async (store) => (await store.keys()).map((k) => k.url.replace(BASE, '')).sort();

test('sw: gyors hálózat → friss oldal és friss fájlok, a tárolóba kerülnek', async () => {
  const sw = loadSw((u) => ({ body: `new:${u.replace(BASE, '')}` }));
  assert.equal(await sw.request('', { navigate: true }), 'new:');
  assert.equal(await sw.request('js/main.js'), 'new:js/main.js');
  assert.deepEqual(await keys(sw.store), ['', 'js/main.js']);
});

test('sw: lassú oldal (> 3 mp) → a tárolt oldal, és a fájljai is a tárolóból (nem keveredik)', async () => {
  const sw = loadSw((u) => (u === BASE ? { body: 'new-html', delay: 5000 } : { body: 'new-js' }));
  await put(sw.store, '', 'old-html'); await put(sw.store, 'js/main.js', 'old-js');
  assert.equal(await sw.request('', { navigate: true }), 'old-html');
  assert.equal(await sw.request('js/main.js'), 'old-js', 'a gyors hálózat ellenére a tárolt js');
  await new Promise((r) => setTimeout(r, 80));                       // a késve megjövő oldal
  assert.equal(await (await sw.store.match(BASE)).text(), 'old-html', 'a késői válasz nem írja felül');
});

test('sw: friss oldal lassú fájlja nem vált át a tárolt (régi) példányra', async () => {
  const sw = loadSw((u) => (u.endsWith('main.js') ? { body: 'new-js', delay: 5000 } : { body: 'new' }));
  await put(sw.store, 'js/main.js', 'old-js');
  await sw.request('', { navigate: true });
  assert.equal(await sw.request('js/main.js'), 'new-js');
});

test('sw: friss oldal fájlja hálózati hibánál a tárolóból', async () => {
  const sw = loadSw((u) => (u.endsWith('main.js') ? 'fail' : { body: 'new' }));
  await put(sw.store, 'js/main.js', 'old-js');
  await sw.request('', { navigate: true });
  assert.equal(await sw.request('js/main.js'), 'old-js');
});

test('sw: lassú első betöltés tárolt példány nélkül → megvárja a hálózatot', async () => {
  const sw = loadSw(() => ({ body: 'slow', delay: 5000 }));
  assert.equal(await sw.request('', { navigate: true }), 'slow');
});

test('sw: hálózat nélkül, tárolt oldal nélkül → hiba (mint eddig)', async () => {
  const sw = loadSw(() => 'fail');
  assert.equal(await sw.request('', { navigate: true }), 'error');
});

test('sw: csak az ASSETS fájljai kerülnek a tárolóba, query nélkül', async () => {
  const sw = loadSw(() => ({ body: 'x' }));
  await sw.request('?jutalom=panda', { navigate: true });
  await sw.request('img/icons/icon-512.png');
  await sw.request('valami.json');
  assert.deepEqual(await keys(sw.store), ['']);
});

test('sw: aktiváláskor a query-s és a nem ASSETS bejegyzések törlődnek', async () => {
  const sw = loadSw(() => ({ body: 'x' }));
  await put(sw.store, '', 'a'); await put(sw.store, '?jutalom=lufi', 'b');
  await put(sw.store, 'js/regi.js', 'c'); await put(sw.store, 'js/main.js', 'd');
  await sw.activate();
  assert.deepEqual(await keys(sw.store), ['', 'js/main.js']);
});

test('sw: a lists.txt-t és a külső címeket nem kezeli', async () => {
  const sw = loadSw(() => ({ body: 'x' }));
  assert.equal(await sw.request('lists.txt'), null);
  assert.equal(await sw.request('https://docs.google.com/x'), null);
});
