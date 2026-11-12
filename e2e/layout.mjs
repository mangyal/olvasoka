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
import { seedRoot, repoLists } from './haladas-seed.mjs';

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
async function open(opts, state = {}, { font } = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts });
  // a felület betűje system-ui: géppenként más (helyben pl. Inter, a CI Ubuntun DejaVu Sans); a tesztek ezzel rögzíthetik
  if (font) await ctx.addInitScript((f) => document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = `:root{--f-ui:${f}!important}`; document.head.append(st);
  }), font);
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

test('desktop 1280×800: nincs alsó sor, jobb panel két füllel, fülváltás', async () => {
  const { page, ctx, errors } = await open(DESKTOP);
  assert.equal(await page.$('footer.roundbar'), null, 'nincs alsó beállítósáv');
  assert.ok(await page.isVisible('aside.panel'));
  assert.equal(await page.getAttribute('#tabRead', 'aria-selected'), 'true');
  assert.equal(await page.getAttribute('#tabFind', 'aria-disabled'), null);
  await page.click('#tabFind');
  assert.equal(await page.getAttribute('#tabFind', 'aria-selected'), 'true', 'kattintásra vált');
  assert.ok(await page.isVisible('#panelFind'));
  assert.equal(await page.isVisible('#panelRead'), false);
  // U-A8: ha a panel nem fér ki, csak a beállítások görgetnek, az Indítás látszik
  assert.ok(await inViewport(page, '#startBtn'), 'Keresd meg!: az Indítás látszik');
  assert.ok(await page.isVisible('#sample .sample-card'), 'a minta látszik');
  await page.click('#tabRead');
  assert.equal(await page.getAttribute('#tabRead', 'aria-selected'), 'true');
  assert.equal(await page.$$eval('#startBtn, .btn-primary', (b) => b.filter((x) => /Indítás/.test(x.textContent)).length), 1, 'egy Indítás gomb');
  assert.ok(await inViewport(page, '#startBtn'));
  assert.ok(await page.$eval('#panelScroll', (e) => e.scrollHeight <= e.clientHeight + 1), '1280×800-on a panel nem görget');
  assert.equal(await page.textContent('#startMsg'), '', 'a gomb alatt nincs információs üzenet');
  assert.ok(await page.isVisible('.start-keys'), 'desktopon látszik a Ctrl+Enter hint');
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

test('tárolt mode: "find" esetén a Keresd meg! nyílik', async () => {
  const { page, ctx } = await open(DESKTOP, { v: 4, mode: 'find' });
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
  assert.equal(await page.getAttribute('#tabFind', 'aria-selected'), 'true');
  assert.equal((await stored(page)).mode, 'find');
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
  assert.equal(await page.isVisible('.start-keys'), false, 'mobil nézetben nincs Ctrl+Enter hint');
  assert.ok(await inViewport(page, '#startBtn'));
  await page.tap('#listsBtn');
  assert.equal(await page.$eval('#dlgLists', (d) => d.matches(':modal')), true);
  await page.tap('#listsNone');
  assert.equal(await page.isDisabled('#startBtn'), true);
  assert.match(await page.textContent('#listsSum'), /Nincs kijelölt lista/);
  assert.equal(await page.isEnabled('#listsDone'), true, 'üres kijelölésnél a Kész aktív');
  await page.tap('#listsRows label:nth-child(1)');
  await page.tap('#listsRows label:nth-child(2)');
  assert.match(await page.textContent('#listsSum'), /^2 lista · \d+ tétel$/);
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

/** Az Indítás a jobb oszlopban, a beállítások alatt (döntés 2026-11-09). */
async function startOnRight(page) {
  const [btn, set, tabs] = await Promise.all(['#startBtn', '#panelRead', '#modeTabs'].map((q) => page.$eval(q, (e) => e.getBoundingClientRect().toJSON())));
  assert.ok(btn.left >= set.left - 1 && btn.right <= set.right + 5, 'a jobb oszlopban');
  assert.ok(btn.top >= set.bottom - 1, 'a beállítások alatt');
  assert.ok(btn.left > tabs.right, 'a fülektől jobbra');
}

test('mobil fekvő (844×390): az Indítás görgetés nélkül látszik, jobb oldalt', async () => {
  const { page, ctx } = await open(PHONE_LAND);
  assert.ok(await inViewport(page, '#startBtn'));
  assert.ok(await page.isVisible('#tabRead'));
  assert.ok(await page.isVisible('#listsBtn'));
  await startOnRight(page);
  assert.equal(await page.isVisible('.start-keys'), false, 'mobil nézetben nincs Ctrl+Enter hint');
  await ctx.close();
});

test('alacsony széles ablak (1270×480): fekvő elrendezés, az Indítás jobb oldalt', async () => {
  const { page, ctx } = await open({ viewport: { width: 1270, height: 480 } });
  assert.ok(await inViewport(page, '#startBtn'));
  await startOnRight(page);
  assert.equal(await page.isVisible('.start-keys'), false, 'mobil nézetben nincs Ctrl+Enter hint');
  await ctx.close();
});

test('nagyon alacsony fekvő (740×320): a becslés az Indítás mellett, nem csúszik a súgógombra', async () => {
  const { page, ctx } = await open({ ...PHONE_LAND, viewport: { width: 740, height: 320 } }, { settings: { flashMs: 5500, gapMs: 500, count: 20 } });
  assert.ok(await inViewport(page, '#startBtn'));
  await startOnRight(page);
  const [est, btn, how] = await Promise.all(['#estimate', '#startBtn', '#howBtn'].map((q) => page.$eval(q, (e) => e.getBoundingClientRect().toJSON())));
  assert.ok(est.left > how.right, 'a becslés a súgógombtól jobbra');
  assert.ok(est.right <= btn.left && btn.left - est.right <= 24, 'a becslés jobbra zárva az Indítás mellett');
  await ctx.close();
});

for (const [w, h] of [[740, 256], [568, 256]]) {
  test(`legalacsonyabb fekvő (${w}×${h}): nincs külön fejlécsor, az Indítás látszik (#40)`, async () => {
    const { page, ctx } = await open({ ...PHONE_LAND, viewport: { width: w, height: h } });
    assert.ok(await inViewport(page, '#startBtn'), 'az Indítás görgetés nélkül látszik');
    await startOnRight(page);
    const [top, set, pick] = await Promise.all(['.top', '#panelRead', '#picker'].map((q) => page.$eval(q, (e) => e.getBoundingClientRect().toJSON())));
    assert.ok(top.right <= set.left, 'a fejléc a bal oszlopban, nem a teljes szélességben');
    assert.ok(top.bottom <= pick.top + 1, 'a fejléc a listaválasztó fölött');
    for (const id of ['#helpBtn', '#fontBtn', '#appVersion']) assert.ok(await inViewport(page, id), `${id} elérhető`);
    assert.equal(await page.getAttribute('#helpBtn', 'title'), 'Súgó');
    assert.equal((await page.textContent('#helpBtn')).trim(), 'Súgó', 'a felolvasó a feliratot kapja');
    await page.tap('#helpBtn');
    assert.equal(await page.$eval('#dlgHelp', (d) => d.open), true, 'a Súgó nyílik');
    await ctx.close();
  });
}

// ---------- keskeny fekvő (< 568 px; nagyítás, összehúzott ablak): egy görgethető oszlop, alul Indítás (#44) ----------
/** A látható, nem rejtett vezérlők közül fedik-e egymást valamelyek (a görgető terület látható részén). */
const overlaps = (page) => page.evaluate(() => {
  const sel = '#helpBtn, #fontBtn, #appVersion, #listsBtn, #tabRead, #tabFind, #howBtn, .seg-opts label, #flashIn, #countDec, #countIn, #countInc, #startBtn, #estimate';
  const rs = [...document.querySelectorAll(sel)].map((e) => [e, e.getBoundingClientRect()]).filter(([, r]) => r.width > 1 && r.height > 1);
  const bar = document.getElementById('panelStart').getBoundingClientRect(), top = document.querySelector('.top').getBoundingClientRect();
  const out = [];
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const [a, ra] = rs[i], [b, rb] = rs[j];
    if (a.contains(b) || b.contains(a)) continue;
    // a görgető tartalom a tapadó sáv és a fejléc alá is becsúszhat: csak a ténylegesen látható részt nézzük
    const vis = (e, r) => e.closest('#panelStart, .top') ? r : { ...r.toJSON(), top: Math.max(r.top, top.bottom), bottom: Math.min(r.bottom, bar.top) };
    const A = vis(a, ra), B = vis(b, rb);
    if (A.bottom <= A.top || B.bottom <= B.top) continue;
    if (A.left < B.right - 0.5 && B.left < A.right - 0.5 && A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5) out.push(`${a.id || a.className} × ${b.id || b.className}`);
  }
  return out;
});

const WIDE_FONT = "'DejaVu Sans',Verdana,sans-serif";   // széles betű: a CI Ubuntun ez a system-ui
for (const [w, touch, font] of [[320, true], [320, false], [480, true], [567, true], [320, true, WIDE_FONT], [320, false, WIDE_FONT], [480, true, WIDE_FONT]]) {
  test(`keskeny fekvő ${w}×256${touch ? ' (érintő)' : ' (desktop, 400% nagyítás)'}${font ? ', széles betűvel' : ''}: egy oszlop, az Indítás látszik, semmi sem fedi egymást (#44)`, async () => {
    const { page, ctx } = await open({ viewport: { width: w, height: 256 }, hasTouch: touch, isMobile: touch }, {}, { font });
    assert.ok(await inViewport(page, '#startBtn'), 'az Indítás görgetés nélkül látszik');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'nincs vízszintes görgetés');
    for (const id of ['#helpBtn', '#fontBtn', '#appVersion', '#estimate']) assert.ok(await inViewport(page, id), `${id} látszik`);
    const [lists, tabs, set] = await Promise.all(['#listsBtn', '#modeTabs', '#panelRead'].map((q) => page.$eval(q, (e) => e.getBoundingClientRect().toJSON())));
    assert.ok(Math.abs(lists.left - tabs.left) < 1 && Math.abs(tabs.left - set.left) < 1, 'egy oszlopban, egymás alatt');
    assert.ok(tabs.top >= lists.bottom && set.top >= tabs.bottom);
    assert.deepEqual(await overlaps(page), [], 'nem fedik egymást');
    // minden beállítás elérhető függőleges görgetéssel, a fejléc és a tapadó sáv között
    for (const q of ['#srcAll', '#flashIn', '#gapOpts', '#countInc', '#howBtn']) {
      await page.$eval(q, (e) => e.scrollIntoView({ block: 'center' }));
      const ok = await page.$eval(q, (e) => {
        const r = (e.type === 'radio' ? e.parentElement : e).getBoundingClientRect();
        const bar = document.getElementById('panelStart').getBoundingClientRect(), top = document.querySelector('.top').getBoundingClientRect();
        return r.top >= top.bottom - 0.5 && r.bottom <= bar.top + 0.5;
      });
      assert.ok(ok, `${q} görgetéssel elérhető`);
    }
    assert.deepEqual(await overlaps(page), [], 'görgetés után sem fedik egymást');
    await ctx.close();
  });
}

for (const [w, h] of [[320, 568], [360, 800]]) {
  test(`álló mobil ${w}×${h} széles betűvel: nincs vízszintes görgetés, a fejléc elfér`, async () => {
    const { page, ctx } = await open({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true }, {}, { font: WIDE_FONT });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'nincs vízszintes görgetés');
    for (const id of ['#helpBtn', '#fontBtn', '#appVersion', '#startBtn']) assert.ok(await inViewport(page, id), `${id} látszik`);
    assert.deepEqual(await overlaps(page), []);
    await ctx.close();
  });
}

test('568×256: marad a két oszlopos fekvő elrendezés (valódi telefon fekve)', async () => {
  const { page, ctx } = await open({ ...PHONE_LAND, viewport: { width: 568, height: 256 } });
  await startOnRight(page);
  assert.ok(await page.$eval('.work', (e) => getComputedStyle(e).display === 'contents'));
  await ctx.close();
});

// ---------- listaválasztó lap: a listák és alattuk a szerkesztő link együtt görgetnek ----------
const sheetState = (page) => page.evaluate(() => {
  const sc = document.getElementById('listsScroll').getBoundingClientRect();
  const rows = [...document.querySelectorAll('#listsRows label')].map((r) => r.getBoundingClientRect());
  const link = document.getElementById('listsEdit').getBoundingClientRect(), done = document.getElementById('listsDone').getBoundingClientRect();
  const dlg = document.getElementById('dlgLists').getBoundingClientRect();
  return {
    rows: rows.length,
    visibleRows: rows.filter((r) => r.top >= sc.top - 0.5 && r.bottom <= sc.bottom + 0.5).length,
    firstRowFirst: rows.length > 0 && rows[0].top >= sc.top - 0.5 && rows[0].bottom <= sc.bottom + 0.5,
    linkBelowRows: link.top >= rows.at(-1).bottom - 0.5,
    linkInScroll: !!document.querySelector('#listsScroll #listsEdit'),
    linkVisible: link.top >= sc.top - 0.5 && link.bottom <= sc.bottom + 0.5,
    overflow: document.getElementById('listsScroll').scrollHeight > document.getElementById('listsScroll').clientHeight + 1,
    doneIn: done.top >= 0 && done.bottom <= innerHeight + 0.5,
    dlgIn: dlg.top >= 0 && dlg.bottom <= innerHeight + 0.5,
  };
});

for (const [w, h, touch, minRows, font] of [[823, 287, false, 2], [568, 256, true, 2], [320, 256, true, 2], [320, 256, true, 2, WIDE_FONT], [844, 390, true, 4], [390, 844, true, 5]]) {
  test(`listalap ${w}×${h}${font ? ' széles betűvel' : ''}: legalább ${minRows} lista látszik, a szerkesztő link alattuk, görgetéssel elérhető`, async () => {
    const { page, ctx } = await open({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch }, {}, { font });
    await page.click('#listsBtn');
    await page.waitForFunction(() => document.getElementById('dlgLists').open);
    const st = await sheetState(page);
    assert.ok(st.dlgIn, 'a lap a képernyőn belül');
    assert.ok(st.doneIn, 'a Kész görgetés nélkül látszik');
    assert.ok(st.firstRowFirst, 'elöl az első lista, nem a link');
    assert.ok(st.visibleRows >= Math.min(minRows, st.rows), `legalább ${minRows} lista látszik (${st.visibleRows})`);
    assert.ok(st.linkInScroll && st.linkBelowRows, 'a link a görgető részben, a listák alatt');
    if (st.overflow) {
      assert.equal(st.linkVisible, false, 'sok listánál a link csak legörgetve látszik');
      await page.$eval('#listsScroll', (e) => { e.scrollTop = e.scrollHeight; });
      assert.equal((await sheetState(page)).linkVisible, true, 'legörgetve a link látszik');
    }
    await ctx.close();
  });
}

// ---------- módfülek: ha a felirat nem fér el, csak az ikon marad, a kerethez méretezve ----------
const tabState = (page) => page.evaluate(() => {
  const inside = (b, r) => r.left >= b.left - 0.5 && r.right <= b.right + 0.5 && r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5;
  return {
    iconOnly: document.getElementById('modeTabs').classList.contains('icon-only'),
    tabs: ['tabRead', 'tabFind'].map((id) => {
      const t = document.getElementById(id), b = t.getBoundingClientRect(), icon = t.querySelector('.mode-icon').getBoundingClientRect();
      const name = t.querySelector('.mode-name');
      return {
        nameShown: name.getBoundingClientRect().width > 1,
        text: t.textContent.replace(/\s+/g, ' ').trim(),
        iconInside: inside(b, icon),
        iconRatio: icon.height / (b.height - 2 * t.clientTop),
        visibleInside: [...t.children].filter((c) => c.getBoundingClientRect().width > 1).every((c) => inside(b, c.getBoundingClientRect())),
      };
    }),
  };
});

// 320 px-en betűfüggő, hogy kifér-e a felirat (null: bármelyik lehet, de semmi sem lóghat ki)
for (const [w, iconOnly] of [[320, null], [568, true], [740, false]]) {
  test(`módfülek ${w}×256: ${iconOnly === null ? 'ikon vagy felirat' : iconOnly ? 'csak ikon, a kerethez méretezve' : 'ikon + felirat'}, semmi sem lóg ki`, async () => {
    const { page, ctx } = await open({ ...PHONE_LAND, viewport: { width: w, height: 256 } });
    const st = await tabState(page);
    if (iconOnly !== null) assert.equal(st.iconOnly, iconOnly);
    for (const t of st.tabs) {
      assert.equal(t.nameShown, !st.iconOnly);
      assert.ok(t.visibleInside, 'a látható tartalom a fül keretén belül');
      assert.ok(t.iconInside, 'az ikon a fül keretén belül');
      if (st.iconOnly) assert.ok(t.iconRatio >= 0.5, `az ikon kitölti a fület (${t.iconRatio.toFixed(2)})`);
    }
    assert.match(st.tabs[0].text, /Felolvasás/, 'a név a felolvasónak megmarad');
    assert.match(st.tabs[1].text, /Keresd meg!/);
    assert.equal(await page.getAttribute('#tabRead', 'title'), 'Felolvasás');
    await ctx.close();
  });
}

test('módfülek: szélesítéskor a felirat visszajön, keskenyítéskor eltűnik', async () => {
  const { page, ctx } = await open({ ...PHONE_LAND, viewport: { width: 568, height: 256 } });
  assert.equal((await tabState(page)).iconOnly, true);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => !document.getElementById('modeTabs').classList.contains('icon-only'));
  await page.setViewportSize({ width: 568, height: 256 });
  await page.waitForFunction(() => document.getElementById('modeTabs').classList.contains('icon-only'));
  await ctx.close();
});

for (const [name, opts] of [['desktop 1280×800', DESKTOP], ['mobil 390×844', PHONE], ['álló tablet', TABLET]]) {
  test(`módfülek ${name}: a felirat látszik`, async () => {
    const { page, ctx } = await open(opts);
    const st = await tabState(page);
    assert.equal(st.iconOnly, false);
    assert.ok(st.tabs.every((t) => t.nameShown && t.visibleInside));
    await ctx.close();
  });
}

// ---------- túl kicsi képernyő (WCAG 1.4.10 alatt: < 320 px széles vagy < 256 px magas) ----------
const shown = (page, sel) => page.isVisible(sel);
/** Az overlay a teljes ablakot takarja-e (a szülői felület nem kattintható alatta). */
const covers = (page) => page.evaluate(() => {
  const r = document.getElementById('tooSmall').getBoundingClientRect();
  const hit = document.elementFromPoint(innerWidth / 2, innerHeight - 5);
  return r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight && !!hit?.closest('#tooSmall');
});

for (const [name, opts, rotate] of [
  ['álló, 319 px széles', { viewport: { width: 319, height: 640 }, hasTouch: true, isMobile: true }, false],
  ['hajlítható telefon külső kijelzője, 280 px széles', { viewport: { width: 280, height: 653 }, hasTouch: true, isMobile: true }, false],
  ['fekvő telefon, 255 px magas', { viewport: { width: 568, height: 255 }, hasTouch: true, isMobile: true }, true],
  ['desktop ablak, 255 px magas', { viewport: { width: 1270, height: 255 } }, false],
]) {
  test(`túl kicsi képernyő (${name}): teljes képernyős tájékoztató`, async () => {
    const { page, ctx } = await open(opts);
    assert.ok(await shown(page, '#tooSmall'));
    assert.ok(await covers(page), 'a teljes ablakot takarja');
    assert.equal(await page.textContent('.ts-title'), 'Túl kicsi a képernyő');
    assert.equal(await shown(page, '.ts-rotate'), rotate, 'elforgatást csak fekvő érintőképernyőn kér');
    assert.equal(await shown(page, '.ts-other'), !rotate);
    const fit = await page.evaluate(() => {
      const vw = visualViewport.width, vh = visualViewport.height;
      return {
        layout: document.documentElement.scrollWidth <= innerWidth && innerWidth <= vw + 1,
        text: [...document.querySelectorAll('#tooSmall > *')].filter((e) => e.offsetParent)
          .every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= vw + 0.5 && r.top >= 0 && r.bottom <= vh + 0.5; }),
      };
    });
    assert.ok(fit.layout, 'az oldal nem szélesebb a látható ablaknál');
    assert.ok(fit.text, 'a tájékoztató minden sora a látható ablakban van');
    await ctx.close();
  });
}

for (const [w, h] of [[320, 256], [320, 568], [568, 256], [1270, 256]]) {
  test(`${w}×${h} (WCAG-határ): nincs tájékoztató`, async () => {
    const touch = w < 900;
    const { page, ctx } = await open({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch });
    assert.equal(await shown(page, '#tooSmall'), false);
    await ctx.close();
  });
}

test('túl kicsi képernyő: a nyitott súgót elrejti, nagyobb ablakban visszajön; játék közben nem jelenik meg', async () => {
  const { page, ctx } = await open(DESKTOP, { settings: { flashMs: 0, gapMs: 0, count: 5 } });
  await page.click('#helpBtn');
  assert.ok(await shown(page, '#dlgHelp'));
  await page.setViewportSize({ width: 1270, height: 240 });
  assert.ok(await shown(page, '#tooSmall'));
  assert.equal(await shown(page, '#dlgHelp'), false, 'a súgó nem takarja ki a tájékoztatót');
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.equal(await shown(page, '#tooSmall'), false);
  assert.ok(await shown(page, '#dlgHelp'), 'a súgó változatlanul nyitva');
  await page.keyboard.press('Escape');
  await page.click('#startBtn');
  await page.waitForSelector('#stage:not([hidden])');
  await page.setViewportSize({ width: 300, height: 240 });
  assert.equal(await shown(page, '#tooSmall'), false, 'kör közben nincs tájékoztató');
  assert.ok(await shown(page, '#stage'));
  await ctx.close();
});

test('túl kicsi képernyő: számbevitel közben (felugró billentyűzet) nem jelenik meg', async () => {
  const { page, ctx } = await open({ ...PHONE_LAND, viewport: { width: 740, height: 320 } });
  await page.focus('#countIn');
  await page.setViewportSize({ width: 740, height: 200 });
  assert.equal(await shown(page, '#tooSmall'), false);
  await page.$eval('#countIn', (e) => e.blur());
  assert.ok(await shown(page, '#tooSmall'));
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

// ---------- Keresd meg! (spec 4a.3, 12.4a; ellenőrzés 27–29.) ----------
const FIND = (cards) => ({ v: 4, mode: 'find', find: { cards, tasks: 3, level: 1 }, settings: { source: 'all' } });
/** Kör indítása, és a rács adatai: kártyák száma, oszlopok/sorok, a nyilak helye. */
async function findGrid(page) {
  await page.click('#startBtn');
  await page.waitForSelector('#findGrid .card');
  return page.evaluate(() => {
    const cs = [...document.querySelectorAll('#findGrid .card')].map((c) => c.getBoundingClientRect());
    const near = (a, b) => Math.abs(a - b) < 2;
    const cols = cs.filter((r) => near(r.top, cs[0].top)).length;
    const rows = new Set(cs.map((r) => Math.round(r.top))).size;
    const g = document.getElementById('findGrid').getBoundingClientRect();
    const [p, n] = ['cPrev', 'cNext'].map((id) => document.getElementById(id).getBoundingClientRect());
    const fs = [...document.querySelectorAll('#findGrid .card')].map((c) => getComputedStyle(c).fontSize);
    const inView = cs.every((r) => r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth);
    return { n: cs.length, cols, rows, w: cs[0].width, h: cs[0].height, grid: g.toJSON(), prev: p.toJSON(), next: n.toJSON(), fs: new Set(fs).size, inView };
  });
}

for (const [name, opts, cards, want] of [
  ['desktop 1280×800, 6 kártya', DESKTOP, 6, { n: 6, cols: 3, rows: 2 }],
  ['desktop 1280×800, 8 kártya', DESKTOP, 8, { n: 8, cols: 4, rows: 2 }],
  ['desktop 1280×800, 4 kártya', DESKTOP, 4, { n: 4, cols: 2, rows: 2 }],
  ['álló tablet, 8 kártya', TABLET, 8, { n: 8, cols: 2, rows: 4 }],
  ['mobil álló, 8 → 6 kártya', PHONE, 8, { n: 6, cols: 2, rows: 3 }],
  ['mobil fekvő, 8 → 6 kártya', PHONE_LAND, 8, { n: 6, cols: 3, rows: 2 }],
]) {
  test(`Keresd meg! ${name}: elrendezés (F-K10, F-K12)`, async () => {
    const { page, ctx, errors } = await open(opts, FIND(cards));
    const g = await findGrid(page);
    assert.deepEqual({ n: g.n, cols: g.cols, rows: g.rows }, want);
    assert.ok(g.inView, 'minden kártya a képernyőn');
    assert.equal(g.fs, 1, 'egy betűméret a feladaton belül');
    if (opts === PHONE_LAND) {
      assert.ok(g.prev.right <= g.grid.left && g.next.left >= g.grid.right, 'a nyilak a rács két oldalán');
      assert.ok(Math.abs((g.prev.top + g.prev.bottom) / 2 - 195) < 12, 'függőlegesen középen');
    } else {
      assert.ok(g.prev.top >= g.grid.bottom - 1, 'a nyilak a rács alatt');
    }
    if (opts === DESKTOP) assert.ok(g.grid.width <= 1040, 'desktopon legfeljebb 1040 px széles');
    if (opts === PHONE || opts === PHONE_LAND) {
      assert.ok(g.w >= 150 && g.h >= 130, `a kártya elég nagy egy 7 évesnek (${g.w}×${g.h})`);
      assert.equal((await stored(page)).find.cards, 8, 'a tárolt beállítás 8 marad');
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

test('Keresd meg! mobil: forgatás kör közben – a kártyaszám marad, az elrendezés vált', async () => {
  const { page, ctx } = await open(PHONE, FIND(6));
  const a = await findGrid(page);
  assert.deepEqual([a.cols, a.rows], [2, 3]);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForFunction(() => {
    const cs = [...document.querySelectorAll('#findGrid .card')];
    return cs.length === 6 && cs[1].getBoundingClientRect().top === cs[0].getBoundingClientRect().top
      && cs[2].getBoundingClientRect().top === cs[0].getBoundingClientRect().top;
  });
  await ctx.close();
});

test('Keresd meg! mobil szülői felület: 8 szürke, a címke figyelmeztet; fekvőben nincs minta', async () => {
  const { page, ctx } = await open(PHONE, FIND(8));
  assert.equal(await page.textContent('#cardsLegend'), 'Kártyák · telefonon max. 6');
  assert.equal(await page.getAttribute('#cards8', 'aria-disabled'), 'true');
  assert.equal(await page.isChecked('#cards6'), true);
  assert.equal(await page.textContent('#estimate'), '3 feladat · 6 kártya');
  await ctx.close();
  const l = await open(PHONE_LAND, FIND(4));
  assert.equal(await l.page.isVisible('#sampleBox'), false, 'mobil fekvőben a minta rejtve');
  assert.ok(await inViewport(l.page, '#startBtn'));
  await l.ctx.close();
});

test('Keresd meg! tablet: nincs telefonos korlát', async () => {
  const { page, ctx } = await open(TABLET, FIND(8));
  assert.equal(await page.textContent('#cardsLegend'), 'Kártyák');
  assert.equal(await page.getAttribute('#cards8', 'aria-disabled'), null);
  assert.equal(await page.isChecked('#cards8'), true);
  await ctx.close();
});

/* ---------- Haladás nézet (docs/haladas-specifikacio.md, 8.) ---------- */
// A listák a repó lists.txt-jéből jönnek; a napló a haladas-seed.mjs kitalált napi összesítőiből.
const PKEY = 'olvasoka-dev.haladas';
const SEED = { fluent: ['ma', 'mi', 'fa', 'fe', 'ló', 'ke-fe', 'pa', 'pi'], unsure: ['fó-ka', 'lu-fi', 'ká'], practice: ['fa-lu', 'fo-ci', 'ki', 'kó', 'pú'], low: ['te', 'me'], seenOnce: ['ce'] };
/** Sok tétel: a repó lists.txt-jének összes tétele (124) csoportokra osztva, 14 még nem olvasott. */
const MANY = (() => { const { items } = repoLists(); return { fluent: items.slice(0, 40), unsure: items.slice(40, 70), practice: items.slice(70, 100), low: items.slice(100, 110) }; })();

async function openProgress(opts, hash = '#haladas', seed = seedRoot(SEED)) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', ...opts });
  await ctx.route(/docs\.google\.com|googleusercontent\.com/, (r) => r.abort());
  await ctx.addInitScript(([k, s, pk, p]) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem(k, JSON.stringify(s)); localStorage.setItem(pk, JSON.stringify(p)); sessionStorage.setItem('seeded', '1');
    }
  }, [KEY, { v: 4, hideHelp: true }, PKEY, seed]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + hash);
  // a nézet kész, és a listák (lists.txt) is betöltődtek
  await page.waitForFunction(() => document.querySelector('#haladas .hl-wrap h1') && document.querySelector('#listNav .nav-item'), null, { timeout: 15000 });
  await page.waitForFunction(() => !/olvasott a 0-ból/.test(document.getElementById('haladas').textContent));
  return { page, ctx, errors };
}

/** Az elemek felső éle, és hogy a nézet vízszintesen nem görget. */
const tops = (page, sel) => page.$$eval(sel, (es) => es.map((e) => Math.round(e.getBoundingClientRect().top)));
const noHScroll = (page) => page.$eval('#haladas', (e) => e.scrollWidth <= e.clientWidth);
/** Minden látható link és gomb legalább 44 px magas. */
const smallTargets = (page) => page.$$eval('#haladas a, #haladas button', (es) => es
  .filter((e) => e.offsetParent).map((e) => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44));
/** A látható szövegek kontrasztja a tényleges háttérrel (WCAG 1.4.3, 4,5:1). */
const lowContrast = (page) => page.$$eval('#haladas *', (es) => {
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bg = (e) => { for (let x = e; x; x = x.parentElement) { const c = rgb(getComputedStyle(x).backgroundColor); if (c.length === 3 || c[3] > 0) return c.slice(0, 3); } return [255, 255, 255]; };
  return es.filter((e) => e.offsetParent && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .map((e) => { const a = lum(rgb(getComputedStyle(e).color)), b = lum(bg(e)); return [e.textContent.trim().slice(0, 30), (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)]; })
    .filter(([, r]) => r < 4.5);
});
const cardTitles = (page) => page.$$eval('.hl-card h2', (h) => h.map((x) => x.textContent));
const tileCounts = (page) => page.$$eval('.hl-card', (cs) => cs.map((c) => c.querySelectorAll('.hl-tile').length));
const rects = (page, sel) => page.$$eval(sel, (es) => es.map((e) => { const r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) }; }));
const view = (page) => page.getAttribute('#haladas', 'data-view');
const noRed = (page) => page.$$eval('#haladas *', (es) => !es.flatMap((e) => { const s = getComputedStyle(e); return [s.color, s.backgroundColor, s.borderTopColor]; })
  .some((c) => { const [r, g, b] = (c.match(/\d+/g) || []).map(Number); return r > 150 && g < 90 && b < 90; }));

test('Haladás asztali 1280×800: sorrend, négy kártya, Kevés adat teljes szélességben, „Mutasd mindet” egy vonalban', async () => {
  const { page, ctx, errors } = await openProgress(DESKTOP);
  assert.equal(await page.isVisible('#admin'), false, 'a szülői felület helyére lép');
  const order = await page.$$eval('.hl-wrap > *', (es) => es.map((e) => e.className || e.tagName));
  assert.deepEqual(order, ['hl-top', 'hl-cards', 'hl-lists', 'hl-how', 'hl-foot'], 'van csoportba sorolt tétel: nincs információs doboz');
  assert.equal(await page.textContent('#haladas h1'), 'Hogy halad az olvasás?');
  assert.equal(await page.textContent('.hl-sum'),
    'Eddig 19 tételt olvasott a 124-ből. 16 már csoportba került: 8 megy, 3 még bizonytalan, 5-öt még gyakorolni kell. A többi 108 tételről még kevés az adat.');
  assert.deepEqual(await page.$$eval('.hl-sum strong', (s) => s.map((x) => x.textContent)), ['19 tételt', '124', '16', '8', '3', '5', '108']);
  assert.equal(await page.isVisible('.hl-stat-btn'), false, 'asztalon a statisztika doboz nem csukható');
  assert.ok(await page.isVisible('.hl-stat >> text=Egy tétel csoportja idővel változhat, ez természetes.'));
  assert.deepEqual(await cardTitles(page), ['Megy', 'Még bizonytalan', 'Még gyakorolni kell', 'Kevés adat']);
  assert.deepEqual(await page.$$eval('.hl-count', (c) => c.map((x) => x.textContent)), ['8', '3', '5', '108']);
  assert.deepEqual(await page.$$eval('.hl-means', (c) => c.map((x) => x.textContent)), [
    'Az utóbbi 3 alkalommal takarás, megállítás és visszalépés nélkül olvasta, és nem akadt el rajta.',
    'Már olvasta segítség nélkül is, de néha még nehezen megy.',
    'Az utóbbi 5 alkalomból legalább 3-szor kellett segítség, vagy sokkal lassabban olvasta, mint a többi tételt.',
    'Egy tételről csak akkor tudjuk a haladást megállapítani, ha legalább 3 különböző napon olvasta.',
  ]);
  assert.deepEqual(await tileCounts(page), [6, 3, 5, 0], 'asztalon legfeljebb 6 csempe; a Kevés adat kártyán nincs');
  const cards = await rects(page, '.hl-card');
  assert.equal(new Set(cards.slice(0, 3).map((r) => r.top)).size, 1, 'az 1–3. kártya egy sorban');
  assert.equal(new Set(cards.slice(0, 3).map((r) => r.height)).size, 1, 'egyforma magasan');
  const [grid] = await rects(page, '.hl-cards');
  assert.ok(cards[3].top > cards[0].bottom, 'a Kevés adat alattuk');
  assert.equal(cards[3].width, grid.width, 'teljes szélességben');
  const all = await rects(page, '.hl-all');
  assert.equal(all.length, 4, 'minden nem üres kártyán „Mutasd mindet”');
  assert.equal(new Set(all.slice(0, 3).map((r) => r.top)).size, 1, 'a linkek egy vonalban');
  const [lowText] = await rects(page, '.hl-low-text');
  assert.ok(all[3].left > lowText.right && Math.abs((all[3].top + all[3].bottom) / 2 - (lowText.top + lowText.bottom) / 2) < 4, 'a Kevés adat linkje jobbra, középen');
  assert.deepEqual(await page.$$eval('.hl-all', (a) => a.map((x) => [x.textContent, x.getAttribute('aria-label'), x.getAttribute('href')])), [
    ['Mutasd mindet', 'Megy: mind a 8 tétel', '#haladas/csoport/fluent'],
    ['Mutasd mindet', 'Még bizonytalan: mind a 3 tétel', '#haladas/csoport/unsure'],
    ['Mutasd mindet', 'Még gyakorolni kell: mind az 5 tétel', '#haladas/csoport/practice'],
    ['Mutasd mindet', 'Kevés adat: mind a 108 tétel', '#haladas/csoport/lowdata'],
  ]);
  assert.deepEqual(await page.$$eval('.hl-card', (cs) => cs.map((c) => getComputedStyle(c).borderTopColor)),
    ['rgb(46, 107, 102)', 'rgb(141, 189, 182)', 'rgb(231, 185, 106)', 'rgb(189, 180, 164)']);
  // listánként: négy rész, 2 px rés, kiadják a sáv szélességét; a címke mind a négy számot tartalmazza
  const bars = await page.$$eval('.hl-bar', (bs) => bs.map((b) => {
    const r = b.getBoundingClientRect(), spans = [...b.children].map((s) => s.getBoundingClientRect());
    return { label: b.getAttribute('aria-label'), parts: [...b.children].map((s) => s.dataset.group), fill: spans.reduce((s, x) => s + x.width, 0) + 2 * (spans.length - 1), width: r.width };
  }));
  for (const b of bars) {
    assert.ok(Math.abs(b.fill - b.width) < 1.5, `${b.label}: ${b.fill} / ${b.width}`);
    assert.match(b.label, /^.+: (\d+ megy, \d+ még bizonytalan, \d+ még gyakorolni kell, \d+ kevés adat, \d+ tételből|\d+ tételből mindegyikről kevés az adat)$/);
  }
  const p45 = bars.find((b) => b.label.startsWith('45. oldal'));
  assert.deepEqual(p45.parts, ['fluent', 'unsure', 'practice', 'lowdata']);
  assert.equal(bars.find((b) => b.label.startsWith('Két szótagú')).label, 'Két szótagú szavak: 19 tételből mindegyikről kevés az adat');
  assert.deepEqual(bars.find((b) => b.label.startsWith('Két szótagú')).parts, ['lowdata'], 'a 0 darabos részek nincsenek');
  assert.equal(await page.textContent('.hl-lists .hl-muted'), 'A szürke rész: erről a tételről még kevés az adat.');
  assert.equal(await page.$$eval('.hl-how p', (p) => p.length), 2);
  assert.match(await page.textContent('.hl-how'), /A tempót mindig a gyereked saját tempójához méri/);
  assert.doesNotMatch(await page.textContent('.hl-how'), /akkor „megy”/);
  assert.equal(await page.textContent('.hl-foot'), 'Az adatok csak ezen az eszközön vannak.');
  const text = await page.textContent('#haladas');
  assert.doesNotMatch(text, /[–—]/, 'gondolatjel');
  assert.doesNotMatch(text, /Egyre jobban|Gyakoroljuk még|Már megy|további tétel|Mi segíthet|Szerepel|Még kevés adat a trendekhez/);
  assert.doesNotMatch(text, /Átvitel|Export|Import|sorozat|pont/i, 'nincs export, sorozat, pontszám');
  assert.ok(await noRed(page), 'nincs piros');
  assert.deepEqual(await smallTargets(page), []);
  assert.deepEqual(await lowContrast(page), []);
  assert.ok(await noHScroll(page));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Haladás első nap: információs doboz; üres kártyák szaggatott kerettel, link nélkül; Kevés adat linkkel', async () => {
  const { page, ctx, errors } = await openProgress(DESKTOP, '#haladas', seedRoot({ seenOnce: ['ma', 'mi', 'fa'], low: ['fe'] }));
  const order = await page.$$eval('.hl-wrap > *', (es) => es.map((e) => e.className || e.tagName));
  assert.deepEqual(order, ['hl-top', 'hl-info', 'hl-cards', 'hl-lists', 'hl-how', 'hl-foot']);
  assert.equal(await page.textContent('.hl-sum'), 'Eddig 4 tételt olvasott a 124-ből. Még mind a 124 tételről kevés az adat.');
  assert.equal(await page.textContent('.hl-info'), 'Az első tételek legkorábban a 3. napon kerülnek csoportba.');
  assert.equal(await page.getAttribute('.hl-info', 'role'), 'status');
  assert.ok(await page.$eval('.hl-info svg', (s) => s.getAttribute('aria-hidden') === 'true'));
  assert.equal(await page.$eval('.hl-info', (e) => getComputedStyle(e).color), await page.$eval('.hl-sum', (e) => getComputedStyle(e).color), 'nem figyelmeztetés-színű');
  const empty = await page.$$eval('.hl-card[data-empty]', (cs) => cs.map((c) => {
    const s = getComputedStyle(c), n = getComputedStyle(c.querySelector('.hl-count'));
    return { g: c.dataset.group, border: s.borderLeftStyle, top: s.borderTopStyle, bg: s.backgroundColor, opacity: s.opacity, weight: n.fontWeight, none: c.querySelector('.hl-none')?.textContent, link: !!c.querySelector('.hl-all') };
  }));
  assert.deepEqual(empty.map((e) => e.g), ['fluent', 'unsure', 'practice']);
  for (const e of empty) {
    assert.deepEqual([e.border, e.top, e.bg, e.opacity, e.weight, e.none, e.link], ['dashed', 'solid', 'rgba(0, 0, 0, 0)', '1', '400', 'Még nincs ilyen tétel.', false], e.g);
  }
  assert.equal(await page.textContent('.hl-low .hl-count'), '124');
  assert.equal(await page.getAttribute('.hl-low .hl-all', 'aria-label'), 'Kevés adat: mind a 124 tétel');
  assert.deepEqual(await smallTargets(page), []);
  assert.deepEqual(await lowContrast(page), []);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Haladás még semmi nincs: a felhívó mondat; az információs doboz is látszik', async () => {
  const { page, ctx } = await openProgress(PHONE, '#haladas', seedRoot({}));
  assert.equal(await page.textContent('.hl-sum'), 'Kezdd el használni a programot, hogy láthasd a haladást!');
  assert.ok(await page.isVisible('.hl-info'));
  assert.ok(await noHScroll(page));
  await ctx.close();
});

test('Haladás álló telefon 390×844: a statisztika doboz csukva, billentyűvel nyitható; 4 csempe; négy kártya egymás alatt', async () => {
  const { page, ctx } = await openProgress(PHONE);
  const btn = page.locator('.hl-stat-btn');
  assert.equal(await btn.getAttribute('aria-expanded'), 'false');
  assert.equal(await btn.getAttribute('aria-controls'), 'hlStatMore');
  assert.equal(await page.isVisible('#hlStatMore'), false);
  assert.match(await btn.textContent(), /Ez csak statisztika.*Bővebben ▾/);
  assert.ok(await page.isVisible('.hl-stat >> text=Többet számít, amit te látsz'), 'az első mondat látszik');
  await btn.focus();
  await page.keyboard.press('Enter');
  assert.equal(await btn.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.isVisible('#hlStatMore'), true);
  assert.match(await page.textContent('#hlStatMore'), /Egy tétel csoportja idővel változhat, ez természetes\.$/);
  assert.deepEqual(await tileCounts(page), [4, 3, 4, 0]);
  const cards = await rects(page, '.hl-card');
  assert.deepEqual(await cardTitles(page), ['Megy', 'Még bizonytalan', 'Még gyakorolni kell', 'Kevés adat']);
  for (let k = 1; k < 4; k++) assert.ok(cards[k].top > cards[k - 1].bottom, 'egymás alatt');
  const all = await page.$$eval('.hl-card', (cs) => cs.map((c) => {
    const a = c.querySelector('.hl-all').getBoundingClientRect(), r = c.getBoundingClientRect(), s = getComputedStyle(c);
    return Math.round(r.width - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight) - 2 - a.width);
  }));
  assert.deepEqual(all, [0, 0, 0, 0], 'a „Mutasd mindet” teljes szélességű');
  assert.deepEqual(await smallTargets(page), []);
  assert.deepEqual(await lowContrast(page), []);
  assert.ok(await noHScroll(page));
  await ctx.close();
});

test('Haladás fekvő telefon 844×390: összefoglaló és statisztika egymás mellett, három kártya egy sorban, alatta a Kevés adat', async () => {
  const { page, ctx } = await openProgress(PHONE_LAND);
  const [head, stat] = await page.$$eval('.hl-top > *', (es) => es.map((e) => e.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), left: r.left, right: r.right })));
  assert.ok(stat.left >= head.right, 'egymás mellett');
  assert.equal(await page.isVisible('.hl-stat-btn'), false, 'fekvőben mindig nyitva');
  const cards = await rects(page, '.hl-card');
  assert.equal(new Set(cards.slice(0, 3).map((r) => r.top)).size, 1);
  assert.ok(cards[3].top > cards[0].bottom);
  assert.equal(cards[3].width, (await rects(page, '.hl-cards'))[0].width);
  assert.deepEqual(await tileCounts(page), [3, 3, 3, 0]);
  const left = await page.$eval('.hl-cards', (e) => e.getBoundingClientRect().left);
  assert.ok(left >= 48, `oldalsó margó: ${left}`);
  assert.deepEqual(await smallTargets(page), []);
  assert.deepEqual(await lowContrast(page), []);
  assert.ok(await noHScroll(page));
  await ctx.close();
});

test('Haladás csoport oldala (Megy, 40 tétel): cím, a kártya szövege, minden tétel a sorrendben, lábléc', async () => {
  for (const opts of [DESKTOP, PHONE]) {
    const { page, ctx, errors } = await openProgress(opts, '#haladas/csoport/fluent', seedRoot(MANY));
    assert.equal(await view(page), 'group');
    assert.equal(await page.textContent('.hl-back'), '← Vissza az áttekintéshez');
    assert.equal(await page.textContent('#haladas h1'), 'Megy: 40 tétel');
    assert.equal(await page.$eval('.hl-group', (e) => getComputedStyle(e).borderTopColor), 'rgb(46, 107, 102)');
    assert.equal(await page.textContent('.hl-group .hl-means'), 'Az utóbbi 3 alkalommal takarás, megállítás és visszalépés nélkül olvasta, és nem akadt el rajta.');
    assert.deepEqual(await page.$$eval('.hl-group .hl-tile', (t) => t.map((x) => x.textContent)), MANY.fluent, 'mind, a listák sorrendjében (azonos utolsó nap)');
    assert.equal(await page.$('.hl-sub'), null, 'listánkénti csoportosítás nincs');
    assert.equal(await page.textContent('.hl-foot'), 'Ez csak statisztika. Többet számít, amit te látsz, és amit a gyereked érez.');
    assert.deepEqual(await smallTargets(page), []);
    assert.deepEqual(await lowContrast(page), []);
    assert.ok(await noHScroll(page));
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Haladás csoport oldala (Kevés adat): két alcím a számokkal; üres résznek nincs alcíme', async () => {
  const { page, ctx } = await openProgress(DESKTOP, '#haladas/csoport/lowdata', seedRoot(MANY));
  assert.equal(await page.textContent('#haladas h1'), 'Kevés adat: 24 tétel');
  assert.deepEqual(await page.$$eval('.hl-sub h2', (h) => h.map((x) => x.textContent)), ['Olvasta, még kevés napon (10)', 'Még nem olvasta (14)']);
  assert.deepEqual(await page.$$eval('.hl-sub', (s) => s.map((x) => x.querySelectorAll('.hl-tile').length)), [10, 14]);
  await ctx.close();
  const { page: p2, ctx: c2 } = await openProgress(DESKTOP, '#haladas/csoport/lowdata', seedRoot({ low: ['ma'], fluent: repoLists().items.filter((x) => x !== 'ma') }));
  assert.deepEqual(await p2.$$eval('.hl-sub h2', (h) => h.map((x) => x.textContent)), ['Olvasta, még kevés napon (1)']);
  await c2.close();
});

test('Haladás: a tétel részleteiből visszalépve az előző görgetési pozíció áll vissza; előre lépve a tetejére', async () => {
  const { page, ctx } = await openProgress({ ...PHONE, viewport: { width: 390, height: 520 } }, '#haladas', seedRoot(MANY));
  const scroll = () => page.$eval('#haladas', (e) => Math.round(e.scrollTop));
  await page.locator('.hl-card[data-group=fluent] .hl-all').scrollIntoViewIfNeeded();
  const ov = await scroll();
  assert.ok(ov > 0, 'az áttekintés is le van görgetve');
  await page.click('.hl-card[data-group=fluent] .hl-all');
  await page.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  assert.equal(await scroll(), 0, 'előre lépve a tetején');
  const last = page.locator('.hl-group .hl-tile').last();
  await last.scrollIntoViewIfNeeded();
  const before = await scroll();
  assert.ok(before > 100, `legörgetve: ${before}`);
  const name = await last.textContent();
  await last.click();
  await page.locator('.hl-big').waitFor();
  assert.equal(await page.textContent('.hl-big'), name);
  assert.equal(await scroll(), 0, 'a részletek a tetején');
  await page.click('.hl-back');                            // ← Vissza: a csoporthoz, ugyanoda
  await page.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  assert.equal(await scroll(), before);
  await last.click();
  await page.locator('.hl-big').waitFor();
  await page.keyboard.press('Escape');                     // Esc: ugyanígy
  await page.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  assert.equal(await scroll(), before);
  await page.goForward();                                 // böngésző előre, majd vissza
  await page.locator('.hl-big').waitFor();
  await page.goBack();
  await page.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  assert.equal(await scroll(), before);
  await page.click('.hl-back');                            // az áttekintéshez: ott is visszaáll
  await page.waitForFunction(() => document.getElementById('haladas').dataset.view === 'overview');
  assert.equal(await scroll(), ov);
  await page.click('.hl-card[data-group=fluent] .hl-all');   // újra megnyitva (előre): a tetején
  await page.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  assert.equal(await scroll(), 0);
  await ctx.close();
});

test('Haladás tétel részletei: fő mondat, tények, pöttyök alkalomszámmal; asztalon egymás alatt, fekvőben két oszlop', async () => {
  const { page, ctx, errors } = await openProgress(DESKTOP, '#haladas/tetel/fa-lu');
  assert.equal(await view(page), 'item');
  assert.equal(await page.textContent('.hl-back'), '← Vissza az áttekintéshez');
  assert.equal(await page.textContent('.hl-big'), 'fa-lu');
  assert.match(await page.$eval('.hl-big', (e) => getComputedStyle(e).fontFamily), /^Arial/);
  assert.equal(await page.textContent('.hl-main h1'), 'Még gyakorolni kell');
  assert.equal(await page.textContent('.hl-reason'), 'Az utóbbi 5 alkalomból 4-szer kellett segítség.');
  assert.match(await page.textContent('.hl-facts'), /^Eddig 7 alkalommal olvasta, 7 különböző napon\. Először: [a-zá-ú]+\. \d+\.$/);
  assert.deepEqual(await page.$$eval('.hl-facts strong', (s) => s.map((x) => x.textContent)), ['7', '7']);
  assert.equal(await page.$eval('.hl-facts', (e) => getComputedStyle(e).borderTopStyle), 'solid', 'vékony vonal választja el');
  assert.equal(await page.$$eval('.hl-dots li', (l) => l.length), 7);
  assert.equal(await page.$$eval('.hl-dots .hl-dot.helped', (l) => l.length), 6);
  assert.match(await page.getAttribute('.hl-dots li', 'aria-label'), /^[a-zá-ú]+\. \d+\., 1 alkalom, segítséggel$/);
  assert.equal(await page.textContent('.hl-foot'), 'Ez csak statisztika. Többet számít, amit te látsz, és amit a gyereked érez ennél a tételnél.');
  assert.doesNotMatch(await page.textContent('#haladas'), /Szerepel|Mi segíthet|Még \d+ napon/);
  const [main, side] = await page.$$eval('.hl-main, .hl-side', (es) => es.map((e) => e.getBoundingClientRect().top));
  assert.ok(side > main, 'asztalon egymás alatt');
  assert.deepEqual(await smallTargets(page), []);
  assert.deepEqual(await lowContrast(page), []);
  await page.setViewportSize(PHONE_LAND.viewport);
  await page.waitForFunction(() => document.getElementById('haladas').dataset.layout === 'land');
  const [m2, s2] = await page.$$eval('.hl-main, .hl-side', (es) => es.map((e) => e.getBoundingClientRect()));
  assert.ok(s2.left >= m2.right && Math.abs(s2.top - m2.top) < 2, 'fekvőben két oszlop');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Haladás tétel részletei: segítséggel és anélkül is olvasott nap félig sárga, félig fehér pötty; jelmagyarázat', async () => {
  const { page, ctx, errors } = await openProgress(DESKTOP, '#haladas/tetel/ma');   // napok: '01', '00', '0', '0'
  assert.deepEqual(await page.$$eval('.hl-dots .hl-dot', (d) => d.map((x) => x.className)), ['hl-dot mixed', 'hl-dot', 'hl-dot', 'hl-dot']);
  assert.match(await page.getAttribute('.hl-dots li', 'aria-label'), /^[a-zá-ú]+\. \d+\., 2 alkalom, segítséggel és anélkül is$/);
  const half = await page.$eval('.hl-dots .hl-dot.mixed', (e) => {
    const b = getComputedStyle(e, '::before'), s = getComputedStyle(e);
    return { inner: e.clientWidth, before: parseFloat(b.width), left: parseFloat(b.left), top: parseFloat(b.top), color: b.backgroundColor, bg: s.backgroundColor,
      border: [s.borderTopColor, s.borderRightColor, s.borderBottomColor, s.borderLeftColor], bw: s.borderLeftWidth };
  });
  assert.equal(half.before, half.inner / 2, 'a kereten belül középen elfelezve');
  assert.deepEqual([half.left, half.top], [0, 0], 'a sárga fél a kereten belül van');
  assert.deepEqual([half.color, half.bg], ['rgb(231, 185, 106)', 'rgb(255, 255, 255)'], 'bal fele sárga, jobb fele fehér');
  assert.deepEqual(half.border, Array(4).fill('rgb(46, 107, 102)'), 'körben zöld keret, a bal felén is');
  assert.equal(half.bw, '2px');
  assert.deepEqual(await page.$$eval('.hl-legend > span', (s) => s.map((x) => `${x.querySelector('.hl-dot').className}: ${x.innerText.trim()}`)),
    ['hl-dot helped: segítséggel olvasta', 'hl-dot: segítség nélkül', 'hl-dot mixed: segítséggel és anélkül is']);
  await page.setViewportSize(PHONE_LAND.viewport);
  await page.waitForFunction(() => document.getElementById('haladas').dataset.layout === 'land');
  assert.deepEqual(await page.$$eval('.hl-legend > span', (s) => s.map((x) => x.innerText.trim())), ['segítséggel', 'segítség nélkül', 'vegyesen']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Haladás tétel részletei: Még bizonytalan és Kevés adat; még nem olvasott tétel', async () => {
  const cases = [
    ['fó-ka', 'Még bizonytalan', 'Már olvasta segítség nélkül is, de néha még kell hozzá segítség.', /^Eddig 4 alkalommal olvasta, 3 különböző napon\./],
    ['te', 'Kevés adat', 'Egy tételről csak akkor tudjuk a haladást megállapítani, ha legalább 3 különböző napon olvasta.', /^Eddig 3 alkalommal olvasta, 2 különböző napon\./],
    ['ma', 'Megy', 'Az utóbbi 3 alkalommal takarás, megállítás és visszalépés nélkül olvasta, és nem akadt el rajta.', /^Eddig 6 alkalommal olvasta, 4 különböző napon\./],
  ];
  for (const [item, title, reason, fact] of cases) {
    const { page, ctx } = await openProgress(PHONE, `#haladas/tetel/${encodeURIComponent(item)}`);
    assert.equal(await page.textContent('.hl-main h1'), title, item);
    assert.equal(await page.textContent('.hl-reason'), reason, item);
    assert.match(await page.textContent('.hl-facts'), fact, item);
    assert.deepEqual(await lowContrast(page), [], item);
    await ctx.close();
  }
  const { page, ctx } = await openProgress(DESKTOP, '#haladas/tetel/t%C3%B3');
  assert.equal(await page.textContent('.hl-main h1'), 'Kevés adat');
  assert.equal(await page.textContent('.hl-unread'), 'Még nem olvasta.');
  assert.equal(await page.$('.hl-facts'), null);
  assert.equal(await page.$('.hl-days'), null);
  assert.equal(await page.$eval('.hl-main', (e) => getComputedStyle(e).borderTopColor), 'rgb(189, 180, 164)');
  await ctx.close();
});

for (const [w, h] of [[320, 256], [320, 568], [568, 256]]) {
  test(`Haladás ${w}×${h} (a legkisebb támogatott méret körül): nem lóg ki, minden elérhető`, async () => {
    for (const hash of ['#haladas', '#haladas/csoport/practice', '#haladas/csoport/lowdata', '#haladas/tetel/fa-lu']) {
      const { page, ctx } = await openProgress({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true }, hash);
      assert.ok(await noHScroll(page), `${hash}: vízszintes görgetés`);
      assert.deepEqual(await smallTargets(page), [], hash);
      await ctx.close();
    }
  });
}

test('fejléc: a Haladás gomb minden méretben látszik, legalább 44 px; telefonon csak ikon', async () => {
  for (const opts of [DESKTOP, PHONE, PHONE_LAND]) {
    const { page, ctx } = await open(opts);
    const r = await page.$eval('#progressBtn', (b) => { const x = b.getBoundingClientRect(); return { w: x.width, h: x.height, right: x.right, vw: innerWidth }; });
    assert.ok(r.w > 0 && r.right <= r.vw, JSON.stringify(r));
    if (opts !== DESKTOP) assert.ok(r.h >= 44, `${r.h}`);
    assert.equal(await page.getAttribute('#progressBtn', 'title'), 'Haladás');
    await ctx.close();
  }
});
