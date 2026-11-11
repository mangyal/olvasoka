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
//   - panda-ugrálás (?jutalom=panda): nyilakkal a célig, ↑ nem ejt le, rossz irány leejt, koppintás
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

/* ---------- Panda-ugrálás (spec 5a., ellenőrzés 35–37.) ---------- */
/** A panda állása és a következő pad iránya a képernyőn (a teszt „szeme”). */
const hopState = () => page.evaluate(() => {
  const p = document.querySelector('.hop-panda');
  if (!p || p.hidden) return null;
  const pr = p.getBoundingClientRect(), x = pr.left + pr.width / 2;
  const [cur, of] = document.getElementById('rewardCount').textContent.split('/').map(Number);
  const next = document.querySelectorAll('.hop-pad')[cur + 1];
  const nx = next ? next.getBoundingClientRect() : null;
  const dx = nx ? nx.left + nx.width / 2 - x : 0;
  return { cur, of, x, y: pr.top, P: pr.width, dir: dx < -0.6 * pr.width ? -1 : dx > 0.6 * pr.width ? 1 : 0 };
});
async function toPanda() {
  await page.goto(base + '?jutalom=panda');
  await page.locator('#listNav .nav-item').first().waitFor();
  await startRound({ flash: 0, count: 1 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('stage').dataset.reward === 'panda');
  await page.waitForFunction(() => document.getElementById('rewardCount').textContent.startsWith('0/'), null, { timeout: 6000 });
  await standing();                                   // a panda a kiinduló padra pottyant
}
/** Ugrás közben a bemenet nem számít (F-J3): megvárjuk, hogy a panda álljon. */
const standing = () => page.waitForFunction(() => {
  const p = document.querySelector('.hop-panda');
  return p && !p.classList.contains('air') && !p.classList.contains('happy');
});
const KEY = { '-1': 'ArrowLeft', 0: 'ArrowUp', 1: 'ArrowRight' };

test('Panda-ugrálás: nyilakkal a célig, konfetti, majd a szülői nézet (F-J3, F-J7, 37.)', async () => {
  await toPanda();
  let s = await hopState();
  assert.ok(s.of >= 7 && s.of <= 9, `7–9 ugrás (${s.of})`);
  while (s.cur < s.of) {
    const before = s.cur;
    await page.keyboard.press(KEY[s.dir]);
    await page.waitForFunction((b) => +document.getElementById('rewardCount').textContent.split('/')[0] > b, before);
    if (s.cur + 1 < s.of) await standing();
    s = await hopState();
  }
  assert.equal(await page.locator('.confetti').count(), 1, 'konfetti a célon');
  assert.equal(await page.locator('.hop-panda.happy').count(), 1);
  await page.locator('#admin').waitFor({ state: 'visible', timeout: 8000 });
  assert.equal(await page.locator('.hop').count(), 0, 'a játék eltakarítva');
});

test('Panda-ugrálás: ↑ nem ejt le; rossz oldal → leesik, csendben vissza (F-J5, F-J6)', async () => {
  await toPanda();
  let s = await hopState();
  // egy-két jó ugrás, amíg a következő pad oldalt van
  while (s.dir === 0) {
    await page.keyboard.press('ArrowUp');
    await page.waitForFunction((b) => +document.getElementById('rewardCount').textContent.split('/')[0] > b, s.cur);
    await standing(); s = await hopState();
  }
  await page.keyboard.press('ArrowUp');                // nincs fölötte pad: helyben ugrik
  await page.waitForFunction(() => document.querySelector('.hop-panda.air'));
  await standing();
  const after = await hopState();
  assert.equal(after.cur, s.cur, '↑ után ugyanazon a padon');
  assert.ok(Math.abs(after.x - s.x) < 2, 'vízszintesen nem mozdult');
  await page.keyboard.press(KEY[-s.dir]);              // rossz oldalra
  await page.locator('#admin').waitFor({ state: 'visible', timeout: 8000 });
  assert.equal(await page.locator('.confetti').count(), 0, 'leesésnél nincs konfetti');
});

test('Panda-ugrálás: koppintással is ugrik; Esc bármikor kilép (F-J3, F-R6)', async () => {
  await toPanda();
  const s = await hopState();
  await page.mouse.click(s.x + s.dir * s.P * 1.2, s.y + 10);
  await page.waitForFunction(() => document.getElementById('rewardCount').textContent.startsWith('1/'));
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
  assert.equal(await page.locator('.hop').count(), 0);
});

/* ---------- Keresd meg! (spec 4a., ellenőrzés 23–31.) ---------- */
const cards = () => page.locator('#findGrid .card');
const cardTexts = () => cards().allTextContents();
const marked = () => cards().evaluateAll((cs) => cs.map((c) => c.getAttribute('aria-pressed') === 'true'));
const findTask = () => page.evaluate(() => +(document.getElementById('findGrid').getAttribute('aria-label').match(/^(\d+)\./) || [0, 0])[1]);

async function startFind({ list = 'Szótagok', tasks = 3, cards: n = 4, level } = {}) {
  await navBtn(list).click();
  await page.locator('#tabFind').click();
  await page.locator(`label:has(#cards${n})`).click();
  await page.locator('#tasksIn').fill(String(tasks));
  await page.locator('#tasksIn').press('Enter');
  if (level) await page.$eval('#levelIn', (e, v) => { e.value = v; e.dispatchEvent(new Event('change')); }, String(level));
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 10000 });
  await page.locator('#startBtn').click();
  await page.locator('#findGrid .card').first().waitFor();
}

test('Keresd meg!: alapértékek, becslés, a beállítások megmaradnak (30.)', async () => {
  await page.locator('#tabFind').click();
  assert.equal(await page.locator('#cards4').isChecked(), true, 'alapból 4 kártya');
  assert.equal(await page.inputValue('#tasksIn'), '10');
  assert.equal(await page.inputValue('#levelIn'), '1');
  assert.equal(await text('#levelOut'), '1 · jól megkülönböztethető');
  assert.equal(await text('#estimate'), '10 feladat · 4 kártya');
  await page.locator('label:has(#cards8)').click();
  await page.$eval('#levelIn', (e) => { e.value = '4'; e.dispatchEvent(new Event('input')); e.dispatchEvent(new Event('change')); });
  await page.locator('#tasksInc').click();
  assert.equal(await text('#levelOut'), '4 · inkább hasonló');
  assert.equal(await text('#estimate'), '11 feladat · 8 kártya');
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  assert.equal(await page.getAttribute('#tabFind', 'aria-selected'), 'true', 'a választott játék megmarad');
  assert.equal(await page.locator('#cards8').isChecked(), true);
  assert.equal(await page.inputValue('#levelIn'), '4');
  assert.equal(await page.inputValue('#tasksIn'), '11');
});

test('Keresd meg!: minta a kör tételeiből, „Másik minta” frissíti', async () => {
  await navBtn('Szótagok').click();
  await page.locator('#tabFind').click();
  await page.waitForSelector('#sample .sample-card');
  const s = await page.locator('#sample .sample-card').allTextContents();
  assert.equal(s.length, 4);
  for (const t of s) assert.ok(LISTS['Szótagok'].includes(t), t);
});

test('Keresd meg!: egyetlen különböző tétel → Indítás inaktív (F-S8)', async () => {
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: 'Egy\r\nma\r\nMa' }));
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  await page.locator('#tabFind').click();
  await page.waitForFunction(() => document.getElementById('startMsg').textContent);
  assert.equal(await text('#startMsg'), 'Legalább két különböző tétel kell.');
  assert.equal(await page.locator('#startBtn').isDisabled(), true);
});

test('Keresd meg!: kör a forrás tételeiből; jelölés, ←, →, jutalom; nincs szöveg és szám (24–26., 31.)', async () => {
  await startFind({ tasks: 3, cards: 4 });
  assert.equal(await page.getAttribute('#stage', 'data-mode'), 'find');
  const first = await cardTexts();
  assert.equal(first.length, 4);
  for (const t of first) assert.ok(LISTS['Szótagok'].includes(t), `forrásból: ${t}`);
  assert.equal(await findTask(), 1);
  assert.equal(await page.getAttribute('#findGrid', 'aria-label'), '1. feladat a 3-ból');
  assert.equal(await page.locator('#cPrev').isDisabled(), true, 'az elsőn a ◀ inaktív');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await findTask(), 1, '← az elsőn nincs hatással');

  await cards().nth(2).click();
  assert.deepEqual(await marked(), [false, false, true, false]);
  await cards().nth(2).click();
  assert.deepEqual(await marked(), [false, false, false, false], 'újra kattintva lekerül');
  await cards().nth(1).click();
  await cards().nth(3).click();
  assert.deepEqual(await marked(), [false, false, false, true], 'egyszerre egy jelölt');
  assert.equal(await findTask(), 1, 'a jelölés nem léptet');
  // a jelölt kártya: --sky háttér, --accent keret, nincs piros/zöld
  const bg = await cards().nth(3).evaluate((c) => getComputedStyle(c).backgroundColor);
  assert.equal(bg, 'rgb(220, 233, 239)');
  // a nézetben nincs szöveg, szám, idő- vagy pontjelző (31.)
  assert.equal(await page.evaluate(() => document.getElementById('bar').getAttribute('visibility')), 'hidden');
  assert.equal(await page.isVisible('#cPlay'), false, 'nincs szünet gomb');
  assert.equal(await page.isVisible('#rewardCount'), false);

  await page.keyboard.press('Space');
  assert.equal(await findTask(), 2);
  assert.deepEqual(await marked(), [false, false, false, false], 'új feladat jelölés nélkül');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await findTask(), 1);
  assert.deepEqual(await cardTexts(), first, '← után ugyanaz a rács, ugyanabban a sorrendben');
  assert.deepEqual(await marked(), [false, false, false, false], 'a jelölés törlődött');

  for (const k of ['KeyP', 'ArrowDown']) { await page.keyboard.press(k); assert.equal(await findTask(), 1, `${k}: nincs hatása`); }
  await page.locator('#cNext').click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await findTask(), 3);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(() => document.getElementById('stage').dataset.mode === 'reward');
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
  assert.equal(await page.getAttribute('#tabFind', 'aria-selected'), 'true');
});

test('Keresd meg!: Tab és Enter a kártyák között jelöl (akadálymentesség); Esc azonnal kilép', async () => {
  await startFind({ tasks: 2, cards: 4 });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  const m = await marked();
  assert.equal(m.filter(Boolean).length, 1, 'Enterrel pontosan egy jelölt');
  await page.keyboard.press('Space');
  assert.equal(await findTask(), 2, 'a Space a következő feladat, nem a fókuszált kártya');
  assert.equal((await marked()).filter(Boolean).length, 0);
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
  assert.equal(await page.isHidden('#stage'), true, 'jutalom nélkül vissza');
});

test('Keresd meg!: kevesebb tétel, mint a kártyaszám → kevesebb kártya, azonos betűméret (F-K3, 29.)', async () => {
  await startFind({ list: 'Szavak', tasks: 2, cards: 6 });
  assert.equal(await cards().count(), 3, 'a Szavak listában 3 tétel');
  const fs = await cards().evaluateAll((cs) => cs.map((c) => getComputedStyle(c).fontSize));
  assert.equal(new Set(fs).size, 1, 'azonos betűméret');
  const clip = await cards().evaluateAll((cs) => cs.every((c) => {
    const t = c.querySelector('.card-text').getBoundingClientRect(), b = c.getBoundingClientRect();
    return t.left >= b.left && t.right <= b.right && t.top >= b.top && t.bottom <= b.bottom;
  }));
  assert.ok(clip, 'a leghosszabb tétel is levágás nélkül elfér');
});

test('Keresd meg!: koppintás a kártyák közé nem léptet (F-K8)', async () => {
  await startFind({ tasks: 3, cards: 4 });
  const box = await page.locator('#findGrid').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);   // a rés közepén
  await page.mouse.click(8, 400);                                           // a rács mellett
  assert.equal(await findTask(), 1);
});

test('Keresd meg! minta: 320 px-en, 8 kártyás beállítással, háromszótagú tételekkel sincs levágás (34.)', async () => {
  const LONG = ['ka-la-pács', 'te-le-fon', 'ba-ná-nok', 'vi-rá-gok', 'pa-pu-csok', 'ma-ka-ró-ni', 'ka-ka-dú', 'cse-re-sznye'];
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: ['Hosszú', ...LONG].join('\r\n') }));
  // a 8 kártyás beállítás desktopon választható; telefonon a 8 inaktív, a tárolt érték marad (F-K10)
  await page.reload();
  await page.locator('#tabFind').click();
  await page.locator('label:has(#cards8)').click();
  await page.setViewportSize({ width: 320, height: 640 });
  await page.reload();
  await page.locator('#sample .sample-card').first().waitFor();
  assert.equal(await page.getAttribute('#cards8', 'aria-disabled'), 'true');
  for (let k = 0; k < 5; k++) {
    const r = await page.evaluate(() => {
      const box = document.getElementById('sample').getBoundingClientRect();
      const cs = [...document.querySelectorAll('#sample .sample-card')];
      return {
        n: cs.length,
        fs: [...new Set(cs.map((c) => getComputedStyle(c).fontSize))],
        clipped: cs.filter((c) => c.scrollWidth > c.clientWidth).map((c) => c.textContent),
        out: cs.filter((c) => { const b = c.getBoundingClientRect(); return b.left < box.left - 0.5 || b.right > box.right + 0.5 || b.right > innerWidth; }).map((c) => c.textContent),
        oneLine: cs.every((c) => c.getBoundingClientRect().height < 40),
        pageScrollX: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert.equal(r.n, 6, 'telefonon 8 helyett 6 tétel');
    assert.deepEqual(r.fs, ['17px'], 'azonos betűméret');
    assert.deepEqual(r.clipped, [], 'nincs levágott tétel');
    assert.deepEqual(r.out, [], 'nincs kilógó tétel');
    assert.ok(r.oneLine, 'szón belül nincs sortörés');
    assert.equal(r.pageScrollX, false, 'nincs vízszintes görgetés');
    await page.locator('#sampleBtn').click();
  }
});

/* ---------- robusztusság ---------- */
test('akadálymentesség: billentyűzettel kijelölt lista gombján marad a fókusz (az elem nem cserélődik)', async () => {
  const btn = navBtn('Betűk');
  await btn.focus();
  const before = await btn.elementHandle();
  await page.keyboard.press('Enter');
  assert.deepEqual(await pressed(), NAMES.map((n) => String(n === 'Betűk')));
  assert.equal(await before.evaluate((b) => b.isConnected && document.activeElement === b), true, 'a fókusz elveszett');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  const name = await page.evaluate(() => document.activeElement.textContent);
  assert.ok(name.startsWith(NAMES[1]), `a fókusz nem a következő listán van: ${name}`);
  assert.deepEqual(await pressed(), NAMES.map((n, i) => String(i === 1)));
});

test('tárolás: ha egy későbbi mentés bukik (betelt tárhely), a figyelmeztetés megjelenik (F-S4)', async () => {
  await ctx.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) {
      if (k === 'olvasoka-dev' && sessionStorage.getItem('e2e-fail') === '1') throw new DOMException('tele', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
  });
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  const warn = () => page.locator('#warnings').textContent();
  assert.ok(!(await warn()).includes('nem maradnak meg'), 'induláskor még működik a tárolás');
  await page.evaluate(() => sessionStorage.setItem('e2e-fail', '1'));
  await page.locator('#countInc').click();
  assert.ok((await warn()).includes('A beállítások nem maradnak meg'), 'a figyelmeztetés nem jelent meg');
});

/** Hamis Screen Wake Lock: a kérés 400 ms múlva teljesül; window.__wl.held a fogva tartott zárak száma. */
async function fakeWakeLock() {
  await ctx.addInitScript(() => {
    window.__wl = { held: 0, requests: 0 };
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request: () => {
      window.__wl.requests++;
      return new Promise((resolve) => setTimeout(() => {
        const lock = new EventTarget(); let released = false;
        lock.release = async () => { if (!released) { released = true; window.__wl.held--; lock.dispatchEvent(new Event('release')); } };
        window.__wl.held++; resolve(lock);
      }, 400));
    } } });
  });
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
}
const wl = () => page.evaluate(() => window.__wl);

test('képernyőzár: kör alatt fogva, kilépéskor elengedve (N9)', async () => {
  await fakeWakeLock();
  await startRound({ flash: 0, count: 3 });
  await page.waitForFunction(() => window.__wl.held === 1);
  await page.keyboard.press('Escape');
  assert.equal((await wl()).held, 0);
});

test('képernyőzár: ha a kör a kérés teljesülése előtt ér véget, a zár nem marad fogva (N9)', async () => {
  await fakeWakeLock();
  await startRound({ flash: 0, count: 3 });
  await page.keyboard.press('Escape');            // a kérés még folyamatban
  await page.locator('#admin').waitFor({ state: 'visible' });
  await page.waitForTimeout(700);
  const s = await wl();
  assert.equal(s.requests, 1);
  assert.equal(s.held, 0, 'a szülői felületen is ébren tartja a képernyőt');
});
