// Funkcionális E2E a helyben kiszolgált programon (headless Chromium). A test workflow minden
// push-ra és PR-re futtatja; ha bukik, a PR nem olvasztható be. Helyben: npm run e2e
//
// Determinisztikus: a Google táblázat kérését a teszt fix CSV-vel válaszolja meg (FIXTURE), a service
// worker ki van kapcsolva, a súgó nem ugrik fel. Ellenőrzi:
//   - listák kiválasztása: 1 lista, N lista (Ctrl+kattintás), összes lista → a tételek frissülnek
//   - felvillanási idő: 0 (kézi), 25 mp és köztes érték; a kijelzés, a becslés és a megmaradás
//   - időzítős kör: az időjelző látszik és fogy
//   - kézi kör (0): nincs időjelző, és a tétel magától nem vált
//   - léptetés: közép → elejére vissza → utolsó előtti; a haladásjelző és a tétel közben változik
//   - Esc: gyakorlásból és jutalomból is a szülői nézetbe
//
// Az elrendezést (képernyőméretek, panelek, pöttysor/sáv váltása) az e2e/layout.mjs teszteli; ez a
// fájl a felhasználói folyamatokat.

import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// három lista; az „a” két listában is szerepel (a „különböző tétel” számláláshoz)
const LISTS = {
  'Betűk': ['a', 'e', 'i', 'o', 'u'],
  'Szótagok': ['ma', 'me', 'mi', 'mo', 'mu', 'a'],
  'Szavak': ['alma', 'körte', 'szilva'],
};
const NAMES = Object.keys(LISTS).sort((a, b) => a.localeCompare(b, 'hu')); // a program névsorban mutatja
const FIXTURE = (() => {
  const cols = Object.entries(LISTS).map(([n, items]) => [n, ...items]);
  const h = Math.max(...cols.map((c) => c.length));
  return Array.from({ length: h }, (_, r) => cols.map((c) => c[r] ?? '').join(',')).join('\r\n');
})();
const union = (names) => [...new Set(names.flatMap((n) => LISTS[n]))];

/* ---------- statikus szerver a repó gyökeréből ---------- */
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
};
let server, base, browser, ctx, page;

before(async () => {
  server = createServer(async (req, res) => {
    let p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (p.endsWith('/')) p += 'index.html';
    try {
      const body = await readFile(join(ROOT, p));
      res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch({
    ...(process.env.CHROME && { executablePath: process.env.CHROME }),
  });
});
after(async () => { await browser?.close(); server?.close(); });

beforeEach(async () => {
  ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  // a súgó ne ugorjon fel; a tárolt állapot csak az első betöltéskor kerül be (a reload megtartja a programét)
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('e2e')) {
      sessionStorage.setItem('e2e', '1');
      localStorage.setItem('olvasoka-dev', JSON.stringify({ v: 3, hideHelp: true }));
    }
  });
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: FIXTURE }));
  page = await ctx.newPage();
  await page.goto(base);
  await page.locator('#listNav .nav-item').first().waitFor();
});
afterEach(async () => { await ctx?.close(); });

/* ---------- segédek ---------- */
const navBtn = (name) => page.locator('#listNav .nav-item', { hasText: name });
const chips = () => page.locator('#listBody .chip').allTextContents();
const pressed = () => page.locator('#listNav .nav-item').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-pressed')));
const text = (id) => page.locator(id).textContent();
const barState = () => page.evaluate(() => ({
  visible: document.getElementById('bar').getAttribute('visibility') === 'visible',
  width: +document.getElementById('barFill').getAttribute('width') || 0,
}));

/** Felvillanási idő billentyűzettel, ahogy a szülő is állítja: Home = 0, End = 25, köztük 0,5 mp-es → lépések. */
async function setFlash(sec) {
  const r = page.locator('#flashIn');
  await r.focus();
  if (sec === 25) await r.press('End');
  else {
    await r.press('Home');
    for (let i = 0; i < sec * 2; i++) await r.press('ArrowRight');
  }
}
async function setCount(n) {
  await page.locator('#countIn').fill(String(n));
  await page.locator('#countIn').press('Enter');
}
async function startRound({ flash, count, list = 'Szótagok' }) {
  await navBtn(list).click();
  await page.locator('#gap0').check();
  await setFlash(flash);
  await setCount(count);
  // a betűtípus betöltéséig (legfeljebb 5 mp) az Indítás tiltva
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 10000 });
  await page.locator('#startBtn').click();
  await page.locator('#stage').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.getElementById('itemText').textContent);
}
const item = () => text('#itemText');
/** A haladásjelző állása: { n, of, dot } – a felirat („3. tétel a 10-ből”) és az aktuális pötty sorszáma (1-től). */
const progress = () => page.evaluate(() => {
  const p = document.getElementById('progress');
  const m = (p.getAttribute('aria-label') || '').match(/^(\d+)\. tétel a (\d+)/);
  const dots = [...p.querySelectorAll('.dot')];
  return { n: m ? +m[1] : 0, of: m ? +m[2] : 0, dot: dots.findIndex((d) => d.classList.contains('is-current')) + 1 };
});
const at = async (n, of) => assert.deepEqual(await progress(), { n, of, dot: n }, `nem a(z) ${n}/${of}. tételen áll`);

/* ---------- listák ---------- */
test('lista: egy lista kijelölése az ő tételeit mutatja', async () => {
  for (const name of NAMES) {
    await navBtn(name).click();
    assert.equal(await text('#listName'), name);
    assert.equal(await text('#listCount'), `${LISTS[name].length} tétel`);
    assert.deepEqual(await chips(), LISTS[name]);
    assert.deepEqual(await pressed(), NAMES.map((n) => String(n === name)));
    assert.equal(await page.locator('#srcList').isChecked(), true);
  }
});

test('lista: Ctrl+kattintással N lista, a tételek uniója', async () => {
  await navBtn('Betűk').click();
  await navBtn('Szótagok').click({ modifiers: ['ControlOrMeta'] });
  assert.equal(await text('#listName'), '2 lista kijelölve');
  const u = union(['Betűk', 'Szótagok']);
  assert.equal(await text('#listCount'), `${u.length} különböző tétel`);
  assert.deepEqual(await chips(), [...LISTS['Betűk'], ...LISTS['Szótagok']]); // listánként csoportosítva
  // Ctrl+kattintás ki is vesz
  await navBtn('Betűk').click({ modifiers: ['ControlOrMeta'] });
  assert.equal(await text('#listName'), 'Szótagok');
  assert.deepEqual(await chips(), LISTS['Szótagok']);
});

test('lista: „Összes lista” minden listát kijelöl; egy listára kattintva vissza „Kijelölt listák”', async () => {
  await navBtn('Betűk').click();
  await page.locator('#srcAll').check();
  assert.deepEqual(await pressed(), NAMES.map(() => 'true'));
  assert.equal(await text('#listName'), `${NAMES.length} lista kijelölve`);
  assert.equal(await text('#listCount'), `${union(NAMES).length} különböző tétel`);
  assert.deepEqual(await chips(), NAMES.flatMap((n) => LISTS[n]));
  await navBtn('Szavak').click();
  assert.equal(await page.locator('#srcList').isChecked(), true);
  assert.deepEqual(await chips(), LISTS['Szavak']);
});

/* ---------- időzítő ---------- */
test('felvillanás: 0 (kézi), 25 mp és köztes érték; újratöltés után megmarad', async () => {
  await navBtn('Betűk').click();
  await page.locator('#gap0').check();
  await setCount(10);
  // 10 tétel, 0 szünet: a becslés = 10 × felvillanás
  for (const [sec, label, est] of [
    [0, 'kézi', 'kézi léptetés'],
    [25, '25 mp', 'kb. 4 perc 10 mp'],
    [7.5, '7,5 mp', 'kb. 1 perc 15 mp'],
  ]) {
    await setFlash(sec);
    assert.equal(await page.locator('#flashIn').inputValue(), String(sec));
    assert.equal(await text('#flashOut'), label);
    assert.equal(await text('#estimate'), `10 tétel · ${est}`);
  }
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  assert.equal(await page.locator('#flashIn').inputValue(), '7.5');
  assert.equal(await text('#flashOut'), '7,5 mp');
});

/* ---------- kör ---------- */
test('időzítős kör: alul időjelző, és fogy', async () => {
  await startRound({ flash: 25, count: 5 });
  await page.waitForFunction(() => document.getElementById('bar').getAttribute('visibility') === 'visible');
  const a = await barState();
  await page.waitForTimeout(1200);
  const b = await barState();
  assert.ok(a.visible && b.visible, 'az időjelző nem látszik');
  assert.ok(b.width < a.width - 10, `az időjelző nem fogy: ${a.width} → ${b.width}`);
  // az időjelző a tétel alapvonala alatt, a képernyő alsó felében van
  const pos = await page.evaluate(() => ({
    bar: +document.getElementById('barTrack').getAttribute('y'),
    baseline: +document.getElementById('itemText').getAttribute('y'),
    vh: innerHeight,
  }));
  assert.ok(pos.bar > pos.baseline && pos.bar > pos.vh / 2, `az időjelző nem a tétel alatt van: ${JSON.stringify(pos)}`);
});

test('kézi kör (0): nincs időjelző, a tétel magától nem vált', async () => {
  await startRound({ flash: 0, count: 5 });
  const first = await item();
  await page.waitForTimeout(1500);
  assert.equal((await barState()).visible, false, 'kézi léptetésnél is látszik az időjelző');
  assert.equal(await item(), first);
  await at(1, 5);
});

test('léptetés: közép → elejére vissza → utolsó előtti; a haladásjelző és a tétel változik', async () => {
  const N = 10;
  await startRound({ flash: 0, count: N });
  const seen = [await item()];
  const go = async (key, times, wantIdx) => {
    for (let i = 0; i < times; i++) {
      const before = await item();
      await page.keyboard.press(key);
      assert.notEqual(await item(), before, `${key} után ugyanaz a tétel`);
    }
    await at(wantIdx, N);
  };
  await at(1, N);
  assert.equal(await page.locator('#cPrev').isDisabled(), true, 'az első tételen a ← nem lehet aktív');
  await go('ArrowRight', N / 2 - 1, N / 2);            // közép: 5/10
  seen.push(await item());
  await go('ArrowLeft', N / 2 - 1, 1);                // vissza az elejére
  assert.equal(await item(), seen[0], 'visszalépve nem az első tétel jött');
  await page.keyboard.press('ArrowLeft');             // az elején a ← nem lép
  await at(1, N);
  await go('ArrowRight', N - 2, N - 1);               // utolsó előtti: 9/10
  await page.keyboard.press('Space');
  await at(N, N);
  assert.equal(await page.locator('#stage').getAttribute('data-mode'), 'practice', 'az utolsó előttin már jutalom jött');
});

/* ---------- kilépés ---------- */
test('Esc gyakorlásból a szülői nézetbe visz, a kijelölés megmarad', async () => {
  await startRound({ flash: 25, count: 5, list: 'Szavak' });
  assert.equal(await page.locator('#admin').isHidden(), true);
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#stage').isHidden(), true);
  assert.equal(await text('#listName'), 'Szavak');
  assert.equal(await page.locator('#startBtn').isEnabled(), true);
});

test('Esc a jutalomból is a szülői nézetbe visz', async () => {
  await startRound({ flash: 0, count: 2 });
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('stage').dataset.mode === 'reward');
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#stage').isHidden(), true);
});
