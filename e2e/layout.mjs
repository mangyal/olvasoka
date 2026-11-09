// Elrendezés-teszt a szülői felületre és a játékképernyőre (design spec 10. elfogadási kritériumai).
// Headless Chrome-mal, a repó helyi másolatán: saját statikus szerver, a Google táblázat letiltva,
// így a listák mindig a repó lists.txt-jéből jönnek (a teszt nem függ a hálózattól).
//
// CI-ban a Tesztek workflow futtatja minden pushra és PR-ra. Helyben:
//   npm i --no-save playwright && npx playwright install chromium && npm run layout
//   (vagy saját Chrome-mal: CHROME=/usr/bin/google-chrome npm run layout)

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const KEY = 'olvasoka-dev';         // localhoston a dev tárolási kulcs él (js/core/env.js)

let server, base, browser;
before(async () => {
  server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
    try {
      const body = await readFile(join(ROOT, path.endsWith('/') ? `${path}index.html` : path));
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || (path.endsWith('/') ? 'text/html' : 'application/octet-stream') });
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch({ ...(process.env.CHROME && { executablePath: process.env.CHROME }) });
});
after(async () => { await browser?.close(); server?.close(); });

const DESKTOP = { viewport: { width: 1280, height: 800 } };
const SMALL = { viewport: { width: 1024, height: 600 } };
const TABLET = { viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: true };
const IPAD_LAND = { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const PHONE_LAND = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true };

/** Új böngésző-környezet tárolt állapottal; a táblázat letiltva, a súgó nem nyílik magától. */
async function open(opts, state = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts });
  await ctx.route(/docs\.google\.com|googleusercontent\.com/, (r) => r.abort());
  await ctx.addInitScript(([k, s]) => {
    if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); }
  }, [KEY, { v: 3, hideHelp: true, ...state }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 15000 });
  return { page, ctx, errors };
}

/** A gomb teljes egészében a látható ablakban van-e (görgetés nélkül). */
const inViewport = (page, sel) => page.$eval(sel, (e) => {
  const r = e.getBoundingClientRect();
  return r.width > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
});
const stored = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);

test('desktop 1280×800: nincs alsó sor, jobb panel két füllel, a Keresd meg! inaktív', async () => {
  const { page, ctx, errors } = await open(DESKTOP);
  assert.equal(await page.$('footer.roundbar'), null, 'nincs alsó beállítósáv');
  assert.ok(await page.isVisible('aside.panel'));
  assert.equal(await page.getAttribute('#tabRead', 'aria-selected'), 'true');
  assert.equal(await page.getAttribute('#tabFind', 'aria-disabled'), 'true');
  assert.match(await page.textContent('#tabFind'), /Hamarosan érkezik/);
  await page.click('#tabFind', { force: true });
  assert.equal(await page.getAttribute('#tabRead', 'aria-selected'), 'true', 'kattintásra nem vált');
  assert.equal(await page.getAttribute('#tabFind', 'aria-selected'), 'false');
  assert.equal(await page.$$eval('#startBtn, .btn-primary', (b) => b.filter((x) => /Indítás/.test(x.textContent)).length), 1, 'egy Indítás gomb');
  assert.ok(await inViewport(page, '#startBtn'));
  assert.ok(await page.$eval('#panelScroll', (e) => e.scrollHeight <= e.clientHeight + 1), '1280×800-on a panel nem görget');
  assert.equal(await page.textContent('#startMsg'), '', 'a gomb alatt nincs információs üzenet');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('beállítások: ugyanúgy mentődnek és töltődnek vissza; becslés minden változásra', async () => {
  const { page, ctx } = await open(DESKTOP, { settings: { flashMs: 4000, gapMs: 2500, count: 10 } });
  assert.equal(await page.isChecked('#gap2000'), true, 'a régi 2,5 mp → 2 mp');
  assert.deepEqual(await page.$$eval('#gapOpts span', (s) => s.map((x) => x.textContent)), ['0', '0,5', '1', '2', '3']);
  assert.equal(await page.textContent('#estimate'), '10 tétel · kb. 1 perc');
  await page.click('label:has(#gap1000)');
  await page.click('#countInc');
  await page.click('label:has(#srcAll)');
  assert.equal(await page.textContent('#estimate'), '11 tétel · kb. 55 mp');
  await page.$eval('#flashIn', (e) => { e.value = '0'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); });
  assert.equal(await page.textContent('#estimate'), '11 tétel · kézi léptetés');
  const s = await stored(page);
  assert.equal(s.v, 4);
  assert.equal(s.mode, 'read');
  assert.deepEqual(s.settings, { flashMs: 0, gapMs: 1000, count: 11, source: 'all' });
  await page.reload();
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
  assert.equal(await page.isChecked('#gap1000'), true);
  assert.equal(await page.inputValue('#countIn'), '11');
  assert.equal(await page.isChecked('#srcAll'), true);
  assert.equal(await page.textContent('#flashOut'), 'kézi');
  await ctx.close();
});

test('tárolt mode: "find" esetén is a Felolvasás nyílik', async () => {
  const { page, ctx } = await open(DESKTOP, { v: 4, mode: 'find' });
  assert.equal(await page.getAttribute('#tabRead', 'aria-selected'), 'true');
  assert.equal((await stored(page)).mode, 'read');
  await ctx.close();
});

test('Ctrl+Enter indít; pöttysor a számláló helyett, visszalépésre visszamegy; Esc kilép', async () => {
  const { page, ctx } = await open(DESKTOP, { settings: { flashMs: 0, gapMs: 0, count: 10 } });
  await page.keyboard.press('Control+Enter');
  await page.waitForSelector('#stage:not([hidden])');
  assert.equal(await page.$('#counter'), null);
  assert.equal(await page.$$eval('#progress .dot', (d) => d.length), 10);
  await page.keyboard.press('Space'); await page.keyboard.press('Space');
  assert.equal(await page.getAttribute('#progress', 'aria-label'), '3. tétel a 10-ből');
  assert.equal(await page.$$eval('#progress .dot.is-done', (d) => d.length), 2);
  assert.equal(await page.$$eval('#progress .dot.is-current', (d) => d.length), 1);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.getAttribute('#progress', 'aria-label'), '2. tétel a 10-ből');
  await page.keyboard.press('Escape');
  await page.waitForSelector('#admin:not([hidden])');
  await ctx.close();
});

test('20 tétel fölött sáv + „N/M”; a jutalom alatt rejtett', async () => {
  const { page, ctx } = await open(DESKTOP, { settings: { flashMs: 0, gapMs: 0, count: 30 } });
  await page.click('#startBtn');
  await page.waitForSelector('#progress.bar');
  assert.equal(await page.textContent('#progress .ptext'), '1/30');
  assert.equal(await page.$$('#progress .dot').then((d) => d.length), 0);
  for (let i = 0; i < 30; i++) await page.keyboard.press('Space');
  await page.waitForSelector('#stage[data-mode=reward]');
  assert.equal(await page.isVisible('#progress'), false);
  await ctx.close();
});

test('„Így játsszátok” desktopon popover: fókusz a ✕-re, Esc és kívülre kattintás zár, a fókusz visszatér', async () => {
  const { page, ctx } = await open(DESKTOP);
  await page.click('#howBtn');
  assert.equal(await page.getAttribute('#howBtn', 'aria-expanded'), 'true');
  assert.equal(await page.$eval('#howPop', (d) => d.open && !d.matches(':modal')), true, 'nem modális popover');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'howClose');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#howPop', (d) => d.open), false);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'howBtn');
  assert.equal(await page.getAttribute('#howBtn', 'aria-expanded'), 'false');
  await page.click('#howBtn');
  await page.mouse.click(400, 600);
  assert.equal(await page.$eval('#howPop', (d) => d.open), false, 'kívülre kattintás zár');
  await page.click('#howBtn'); await page.click('#howBtn');
  assert.equal(await page.$eval('#howPop', (d) => d.open), false, 'a súgógomb újra megnyomása zár');
  await page.click('#howBtn'); await page.click('#howClose');
  assert.equal(await page.$eval('#howPop', (d) => d.open), false);
  await ctx.close();
});

test('1024×600: csak a beállítások görgetnek, az Indítás látszik', async () => {
  const { page, ctx } = await open(SMALL);
  assert.ok(await inViewport(page, '#startBtn'));
  assert.ok(await page.$eval('#panelScroll', (e) => e.scrollHeight > e.clientHeight), 'a beállítások görgethetők');
  await ctx.close();
});

test('álló tablet: chip-sor összesítővel, a súgó alsó lap, az Indítás tapadó sávban', async () => {
  const { page, ctx } = await open(TABLET, { lastLists: [] });
  assert.ok(await page.isVisible('#listChecks'));
  assert.equal(await page.isVisible('#listsBtn'), false);
  assert.match(await page.textContent('#pickSum'), /^1 lista · \d+ tétel$/);
  await page.tap('#listChecks label:nth-child(2)');
  assert.match(await page.textContent('#pickSum'), /^2 lista · \d+ tétel$/);
  assert.ok(await inViewport(page, '#startBtn'));
  await page.tap('#howBtn');
  assert.equal(await page.$eval('#howPop', (d) => d.matches(':modal')), true, 'alsó lap');
  assert.ok(await page.isVisible('#howOk'));
  await page.tap('#howOk');
  assert.equal(await page.$eval('#howPop', (d) => d.open), false);
  await ctx.close();
});

test('mobil: lenyíló + alsó lap; a pipálás azonnal frissít, üres kijelölésnél az Indítás tilt', async () => {
  const { page, ctx } = await open(PHONE);
  assert.ok(await page.isVisible('#listsBtn'));
  assert.equal(await page.isVisible('#listChecks'), false);
  assert.ok(await inViewport(page, '#startBtn'));
  await page.tap('#listsBtn');
  assert.equal(await page.$eval('#dlgLists', (d) => d.matches(':modal')), true);
  await page.tap('#listsNone');
  assert.equal(await page.isDisabled('#startBtn'), true);
  assert.match(await page.textContent('#listsSum'), /Nincs kijelölt lista/);
  assert.equal(await page.isEnabled('#listsDone'), true, 'üres kijelölésnél a Kész aktív');
  await page.tap('#listsRows label:nth-child(1)');
  await page.tap('#listsRows label:nth-child(2)');
  assert.match(await page.textContent('#listsSum'), /^2 lista \/ \d+ tétel$/);
  assert.equal(await page.isEnabled('#startBtn'), true);
  await page.tap('#listsDone');
  assert.equal(await page.$eval('#dlgLists', (d) => d.open), false);
  assert.match(await page.textContent('#listsBtnLabel'), /^Listák · \d+ tétel$/);
  assert.match(await page.textContent('#listsBtnNames'), / · /);
  await page.tap('#listsBtn'); await page.tap('#listsAll');
  assert.equal(await page.$$eval('#listsRows input', (c) => c.every((x) => x.checked)), true, 'Mind');
  await page.keyboard.press('Escape');
  assert.equal(await page.$eval('#dlgLists', (d) => d.open), false, 'Esc zár');
  await ctx.close();
});

test('mobil fekvő (844×390): az Indítás görgetés nélkül látszik', async () => {
  const { page, ctx } = await open(PHONE_LAND);
  assert.ok(await inViewport(page, '#startBtn'));
  assert.ok(await page.isVisible('#tabRead'));
  assert.ok(await page.isVisible('#listsBtn'));
  await ctx.close();
});

test('érintős oldalsáv (fekvő iPad): koppintás hozzáad és elvesz, Ctrl nélkül', async () => {
  const { page, ctx } = await open(IPAD_LAND, { lastLists: [] });
  const items = page.locator('.nav-item');
  await items.nth(1).tap();
  await items.nth(2).tap();
  assert.equal(await page.locator('.nav-item.sel').count(), 3);
  await items.nth(1).tap();
  assert.equal(await page.locator('.nav-item.sel').count(), 2);
  await ctx.close();
});

test('egérrel az oldalsáv a régi: sima kattintás egyet jelöl, Ctrl/Shift többet', async () => {
  const { page, ctx } = await open(DESKTOP);
  const items = page.locator('.nav-item');
  await items.nth(1).click();
  assert.equal(await page.locator('.nav-item.sel').count(), 1);
  await items.nth(3).click({ modifiers: ['Shift'] });
  assert.equal(await page.locator('.nav-item.sel').count(), 3);
  await items.nth(5).click({ modifiers: ['Control'] });
  assert.equal(await page.locator('.nav-item.sel').count(), 4);
  await ctx.close();
});
