// Service worker (spec N8): a program offline is induljon.
//
// Stratégia: hálózat először, 3 mp után vagy hálózat nélkül a tárolt példány. Így online mindig
// a friss verzió fut (nem kell verziót léptetni), offline pedig a legutóbbi. Csak a saját
// fájlokat kezeli; a külső címek (a Google táblázat is) érintetlenül mennek a hálózatra.
// A lists.txt-t sem kezeli: annak offline állapotát a program maga jelzi (F-L8, F-L9).
//
// Egy oldalbetöltés egy forrásból: a 3 mp-es döntés az oldalon (navigáción) születik, és az oldal
// többi fájlja ugyanonnan jön. Hálózatról jött oldalhoz a fájlok is a hálózatról jönnek (időkorlát
// nélkül; tárolt példány csak hálózati hiba esetén), tárolt oldalhoz a tárolt fájlok. Így egy kiadás
// után nem keveredik a régi és az új verzió (pl. új index.html régi js-sel).
// A tárolóba csak az ASSETS fájljai kerülnek, query nélkül, és csak a ténylegesen kiszolgált
// hálózati válasz: egy időtúllépés után későn megérkező oldal nem írja felül a tárolt példányt.
//
// Az ASSETS listát a test/pwa.test.js egyezteti a repó fájljaival.
//
// Környezetek (js/core/env.js): az éles a gyökérben, a dev a /dev/ almappában fut, ugyanazon az
// originon, így a Cache Storage közös. Ezért a dev saját tárolót használ, az éles pedig a /dev/
// alatti kéréseket nem kezeli (azokat a dev saját service workere szolgálja ki).

const IS_DEV = /\/dev\//.test(self.location.pathname) || ['localhost', '127.0.0.1'].includes(self.location.hostname);
const CACHE = IS_DEV ? 'olvasoka-dev' : 'olvasoka';
const DEV_PATH = new URL('dev/', self.location).pathname;           // …/olvasoka/dev/
const isDevPath = (p) => p.startsWith(DEV_PATH) || p === DEV_PATH.slice(0, -1); // perjel nélkül is
const TIMEOUT_MS = 3000;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'parok.json',
  'css/tokens.css',
  'css/admin.css',
  'css/stage.css',
  'fonts/arimo-latin-400-normal.woff2',
  'fonts/arimo-latin-ext-400-normal.woff2',
  'img/hoslegfuvo.svg',
  'img/icons/icon.svg',
  'img/icons/icon-192.png',
  'js/main.js',
  'js/font.js',
  'js/version.js',
  'js/core/config.js',
  'js/core/cover.js',
  'js/core/csv.js',
  'js/core/drift.js',
  'js/core/env.js',
  'js/core/find.js',
  'js/core/hop.js',
  'js/core/grid.js',
  'js/core/items.js',
  'js/core/progress.js',
  'js/core/rewards.js',
  'js/core/lists.js',
  'js/core/round.js',
  'js/core/selection.js',
  'js/core/sequence.js',
  'js/core/settings.js',
  'js/core/source.js',
  'js/data/remote.js',
  'js/data/store.js',
  'js/ui/admin.js',
  'js/ui/confetti.js',
  'js/ui/find.js',
  'js/ui/panda.js',
  'js/ui/practice.js',
  'js/ui/reward.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});

// A tárolóban csak az ASSETS fájljai maradnak, query nélkül (a régi változatok query-s és már nem
// létező fájljai is törlődnek).
const ASSET_PATHS = new Set(ASSETS.map((a) => new URL(a, self.location).pathname));
const cacheKey = (req) => { const u = new URL(req.url); return u.origin + u.pathname; };

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const req of await c.keys()) {
      const u = new URL(req.url);
      if (u.search || !ASSET_PATHS.has(u.pathname)) await c.delete(req);
    }
    await self.clients.claim();
  })());
});

// Oldalanként (kliensenként) a betöltés forrása: 'network' | 'cache'. Ha a service worker közben
// leállt és a bejegyzés elveszett, 'network' (a korábbi viselkedés).
const pageSource = new Map();

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('/lists.txt')) return;
  if (!IS_DEV && isDevPath(url.pathname)) return;
  if (req.mode === 'navigate') e.respondWith(navigate(e));
  else if (pageSource.get(e.clientId) === 'cache') e.respondWith(cacheFirst(e));
  else e.respondWith(networkFirst(e));
});

/** Az oldal: hálózat 3 mp-ig, utána (vagy hálózati hibánál) a tárolt példány. A döntés az oldal minden fájljára érvényes. */
async function navigate(e) {
  const net = fetchNet(e.request);
  net.catch(() => {});                        // időtúllépés után későn bukó kérés: nem kezeletlen hiba
  e.waitUntil(forgetClosedPages());
  const mark = (src) => { if (e.resultingClientId) pageSource.set(e.resultingClientId, src); };
  let res;
  try { res = await withTimeout(net, TIMEOUT_MS); } catch { res = null; }
  if (res && (res.ok || res.type === 'opaqueredirect')) { mark('network'); return store(e, res); }
  const cached = await fromCache(e.request);
  if (cached) { mark('cache'); return cached; }
  // nincs tárolt példány: a hálózat még dönthet (lassú első betöltés), vagy a hálózati válasz megy át
  try { res = res || await net; } catch { return Response.error(); }
  mark('network');
  return res.ok ? store(e, res) : res;
}

/** Hálózatról jött oldal fájlja: a hálózatról, időkorlát nélkül; a tárolt példány csak hálózati hibánál. */
async function networkFirst(e) {
  let res = null;
  try { res = await fetchNet(e.request); } catch { /* hálózati hiba */ }
  if (res && (res.ok || res.type === 'opaqueredirect')) return store(e, res);
  return (await fromCache(e.request)) || res || Response.error();
}

/** Tárolt oldal fájlja: a tárolt példány; ha nincs, a hálózat (a tárolót nem írja, hogy ne keveredjen). */
async function cacheFirst(e) {
  const cached = await fromCache(e.request);
  if (cached) return cached;
  try { return await fetchNet(e.request); } catch { return Response.error(); }
}

// átirányítás (pl. perjel nélküli mappa): a böngésző kövesse, ne a tárolt példány jöjjön
const fetchNet = (req) => fetch(req, { cache: 'no-cache' });

function withTimeout(p, ms) {
  let t;
  return Promise.race([p, new Promise((_, reject) => { t = setTimeout(() => reject(new Error('timeout')), ms); })])
    .finally(() => clearTimeout(t));
}

/** A kiszolgált hálózati válasz a tárolóba (csak az ASSETS fájljai); a service worker megvárja az írást. */
function store(e, res) {
  if (res.ok && res.type !== 'opaqueredirect' && ASSET_PATHS.has(new URL(e.request.url).pathname)) {
    const copy = res.clone();
    e.waitUntil(caches.open(CACHE).then((c) => c.put(cacheKey(e.request), copy)).catch(() => {}));
  }
  return res;
}

async function fromCache(req) {
  const c = await caches.open(CACHE);
  return (await c.match(req, { ignoreSearch: true }))
    || (req.mode === 'navigate' ? await c.match('index.html') : undefined)
    || null;
}

async function forgetClosedPages() {
  if (pageSource.size < 20) return;
  const open = new Set((await self.clients.matchAll({ includeUncontrolled: true })).map((c) => c.id));
  for (const id of pageSource.keys()) if (!open.has(id)) pageSource.delete(id);
}
