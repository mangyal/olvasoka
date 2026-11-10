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
  assert.equal(await page.$eval('#findSoon', (e) => e.scrollWidth <= e.clientWidth + 1), true, 'a „Hamarosan érkezik” nem vágódik le');
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
    assert.match(st.tabs[1].text, /Keresd meg!.*Hamarosan érkezik/);
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
