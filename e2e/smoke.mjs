// Kiadás utáni füstteszt az élő oldalon (headless Chrome). A deploy workflow futtatja minden kiadás
// után; helyben: BASE_URL=https://mangyal.github.io/olvasoka/ node --test e2e/smoke.mjs
//
// Ellenőrzi:
//   - a / az éles oldal: nincs DEV címke, van verziószám
//   - a /dev és a /dev/ is a dev oldalra visz: DEV címke és verziószám
//   - a /dev akkor is a dev oldalra visz, ha az éles service worker már telepítve van (v1.0.1 hiba)
//   - a dev verziója ≥ az élesé (a +N utótag nélkül; ha kisebb: egy hotfix után a main-t nem
//     olvasztották vissza a dev-be)
//
// EXPECT_PROD / EXPECT_DEV (opcionális): a frissen kiadott verziók. Ha meg vannak adva, a teszt
// addig vár (legfeljebb WAIT_S mp), amíg az oldal ezeket mutatja – a GitHub Pages gyorsítótára
// a kiadás után néhány percig még a régi fájlokat adhatja.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE = new URL(process.env.BASE_URL || 'https://mangyal.github.io/olvasoka/');
const WAIT_MS = Number(process.env.WAIT_S || 300) * 1000;
const EXPECT = { prod: process.env.EXPECT_PROD || '', dev: process.env.EXPECT_DEV || '' };
// a dev címkéjén utótag is lehet: a ki nem adott commitok száma (pl. v1.0.2+5)
const LABEL = /^(DEV · )?v(\d+\.\d+\.\d+(?:\+\d+)?)$/;

const url = (p) => new URL(p, BASE).href;
const DEV_NO_SLASH = BASE.pathname.replace(/\/$/, '') + '/dev'; // /olvasoka/dev

let browser;
// CHROME / CHROME_ARGS: helyi futtatáshoz (saját Chrome, pl. önaláírt tanúsítványú tesztszerver)
before(async () => {
  browser = await chromium.launch({
    ...(process.env.CHROME && { executablePath: process.env.CHROME }),
    args: (process.env.CHROME_ARGS || '').split(' ').filter(Boolean),
  });
});
after(async () => { await browser?.close(); });

/** Megnyitja a címet friss böngészőben (service worker és tároló nélkül), és kiolvassa a fejlécet. */
async function open(path, { page } = {}) {
  const own = !page;
  page ??= await (await browser.newContext()).newPage();
  try {
    await page.goto(url(path), { waitUntil: 'load' });
    await page.waitForFunction(() => document.getElementById('appVersion')?.textContent, null, { timeout: 15000 });
    const label = (await page.textContent('#appVersion')).trim();
    const m = label.match(LABEL);
    return {
      url: new URL(page.url()).pathname,
      label,
      dev: (await page.evaluate(() => document.documentElement.dataset.env)) === 'dev',
      version: m?.[2] || '',
      badge: !!m?.[1],
    };
  } finally {
    if (own) await page.context().close();
  }
}

/** Addig nyitja újra, amíg a várt verzió meg nem jelenik (CDN gyorsítótár), vagy le nem jár az idő. */
async function openExpecting(path, want) {
  const until = Date.now() + (want ? WAIT_MS : 0);
  for (;;) {
    const r = await open(path);
    if (!want || r.version === want || Date.now() > until) return r;
    console.log(`  ${path}: még ${r.version || '?'} látszik, várt ${want} – újrapróbálás 20 mp múlva`);
    await new Promise((res) => setTimeout(res, 20000));
  }
}

const cmp = (a, b) => {
  const num = (v) => v.split('+')[0].split('.').map(Number);
  const x = num(a), y = num(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

const seen = {};

test('éles (/): nincs DEV címke, van verziószám', async () => {
  const r = await openExpecting(BASE.pathname, EXPECT.prod);
  assert.equal(r.url, BASE.pathname, 'nem maradt az éles címen');
  assert.equal(r.dev, false, 'az éles oldal dev-nek jelöli magát');
  assert.equal(r.badge, false, `DEV címke az éles oldalon: „${r.label}”`);
  assert.match(r.label, LABEL, `nincs érvényes verziószám: „${r.label}”`);
  if (EXPECT.prod) assert.equal(r.version, EXPECT.prod, 'az éles nem a most kiadott verziót mutatja');
  seen.prod = r.version;
});

test('dev (/dev/): DEV címke és verziószám', async () => {
  const r = await openExpecting('dev/', EXPECT.dev);
  assert.equal(r.url, DEV_NO_SLASH + '/');
  assert.equal(r.dev, true, 'a /dev/ nem a dev oldal');
  assert.equal(r.badge, true, `nincs DEV címke: „${r.label}”`);
  assert.match(r.label, LABEL, `nincs érvényes verziószám: „${r.label}”`);
  if (EXPECT.dev) assert.equal(r.version, EXPECT.dev, 'a dev nem a most kiadott verziót mutatja');
  seen.dev = r.version;
});

test('dev (/dev, perjel nélkül): a dev oldalra visz', async () => {
  const r = await open(DEV_NO_SLASH);
  assert.equal(r.url, DEV_NO_SLASH + '/', 'nem irányított át a /dev/-re');
  assert.equal(r.dev, true);
  assert.equal(r.badge, true, `nincs DEV címke: „${r.label}”`);
  assert.match(r.label, LABEL);
});

test('dev (/dev, perjel nélkül) telepített éles service workerrel is a dev oldalra visz', async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(url(BASE.pathname));
    // az éles service worker települ és átveszi az oldalt (skipWaiting + clients.claim)
    await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 });
    const r = await open(DEV_NO_SLASH, { page });
    assert.equal(r.url, DEV_NO_SLASH + '/', 'nem irányított át a /dev/-re');
    assert.equal(r.badge, true, `az éles service worker az éles oldalt adta: „${r.label}”`);
  } finally {
    await ctx.close();
  }
});

test('a dev verziója ≥ az élesé', () => {
  assert.ok(seen.prod && seen.dev, 'az előző tesztek nem olvasták ki mindkét verziót');
  assert.ok(cmp(seen.dev, seen.prod) >= 0,
    `a dev (${seen.dev}) régebbi, mint az éles (${seen.prod}): olvaszd vissza a main-t a dev-be`);
});
