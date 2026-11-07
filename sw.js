// Service worker (spec 11.3): a program offline is induljon.
//
// Stratégia: hálózat először, 3 mp után vagy hálózat nélkül a tárolt példány. Így online mindig
// a friss verzió fut (nem kell verziót léptetni), offline pedig a legutóbbi. Csak a saját
// fájlokat kezeli; a külső címek (pl. egy Google-táblázat) érintetlenül mennek a hálózatra.
// A lists.txt-t sem kezeli: annak offline állapotát a program maga jelzi (F-L8, F-L9).
//
// Az ASSETS listát a test/pwa.test.js egyezteti a repó fájljaival.

const CACHE = 'olvasoka';
const TIMEOUT_MS = 3000;

const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
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
  'js/core/drift.js',
  'js/core/items.js',
  'js/core/lists.js',
  'js/core/round.js',
  'js/core/selection.js',
  'js/core/sequence.js',
  'js/core/settings.js',
  'js/data/remote.js',
  'js/data/store.js',
  'js/ui/admin.js',
  'js/ui/practice.js',
  'js/ui/reward.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new Request(a, { cache: 'no-cache' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.endsWith('/lists.txt')) return;
  e.respondWith(fromNetwork(req).catch(() => fromCache(req)));
});

function fromNetwork(req) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS);
    fetch(req, { cache: 'no-cache' }).then((res) => {
      clearTimeout(t);
      if (!res.ok) { reject(new Error(String(res.status))); return; }
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      resolve(res);
    }, (err) => { clearTimeout(t); reject(err); });
  });
}

async function fromCache(req) {
  const c = await caches.open(CACHE);
  return (await c.match(req, { ignoreSearch: true }))
    || (req.mode === 'navigate' && await c.match('index.html'))
    || Response.error();
}
