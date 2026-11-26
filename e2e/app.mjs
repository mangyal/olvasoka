// Funkcionális E2E a helyben kiszolgált programon (headless Chromium). A test workflow minden
// push-ra és PR-re futtatja; ha bukik, a PR nem olvasztható be. Helyben: npm run e2e
//
// Determinisztikus: a Google táblázat kérését a teszt fix CSV-vel válaszolja meg (FIXTURE), a service
// worker ki van kapcsolva, a súgó nem ugrik fel. Ellenőrzi:
//   - kártyacsomagok kiválasztása: kattintás vált, végighúzás, Shift-tartomány, Összes csomag → a tételek frissülnek
//   - felvillanási idő: 0 (kézi), 25 mp és köztes érték; a kijelzés, a becslés és a megmaradás
//   - időzítős kör: az időjelző látszik és fogy
//   - kézi kör (0): nincs időjelző, és a tétel magától nem vált
//   - léptetés: közép → elejére vissza → utolsó előtti; a haladásjelző és a tétel közben változik
//   - Esc: gyakorlásból, a jutalomválasztóból és a jutalomból is a szülői nézetbe
//   - jutalomválasztó: nincs kiemelés, 600 ms bemenetzár, ← → / egér kiemel, Space/Enter/↑ indít,
//     kattintás indít, ?jutalom= esetén kimarad (F-R14, ellenőrzés 36.)
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
const navBtn = (name, p = page) => p.locator('#listNav .nav-item', { hasText: name });
const chips = () => page.locator('#listBody .chip').allTextContents();
const pressed = () => page.locator('#listNav .nav-item').evaluateAll((bs) => bs.map((b) => b.getAttribute('aria-checked')));
/** Csak ez az egy csomag legyen kijelölve: Kijelölt csomagok, Egyik sem, majd kattintás a csomagra (3.1). */
async function only(name, p = page) {
  await p.locator('#sidebar input[value="list"]').check();
  if (await p.locator('#navNone').isVisible()) await p.locator('#navNone').click();
  await navBtn(name, p).click();
}
const srcAll = (p = page) => p.locator('#sidebar input[value="all"]');
const srcList = (p = page) => p.locator('#sidebar input[value="list"]');
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
  await only(list);
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
/** A kör vége: a jutalomválasztó (F-R14). */
const toChooser = (p = page, timeout) => p.waitForFunction(() => document.getElementById('stage').dataset.mode === 'choose', null, timeout ? { timeout } : {});
/** A haladásjelző állása: { n, of, dot } – a felirat („3. tétel a 10-ből”) és az aktuális pötty sorszáma (1-től). */
const progress = () => page.evaluate(() => {
  const p = document.getElementById('progress');
  const m = (p.getAttribute('aria-label') || '').match(/^(\d+)\. kártya a (\d+)/);
  const dots = [...p.querySelectorAll('.dot')];
  return { n: m ? +m[1] : 0, of: m ? +m[2] : 0, dot: dots.findIndex((d) => d.classList.contains('is-current')) + 1 };
});
const at = async (n, of) => assert.deepEqual(await progress(), { n, of, dot: n }, `nem a(z) ${n}/${of}. kártyán áll`);

/* ---------- kártyacsomagok (docs/kartyacsomagok-specifikacio.md, 3.1) ---------- */
test('csomag: egy csomag kijelölése az ő tételeit mutatja', async () => {
  for (const name of NAMES) {
    await only(name);
    assert.equal(await text('#previewH'), 'Kártyák');
    assert.equal(await text('#listCount'), `${LISTS[name].length} kártya · 1 csomag`);
    assert.deepEqual(await chips(), LISTS[name]);
    assert.deepEqual(await pressed(), NAMES.map((n) => String(n === name)));
    assert.equal(await text('#navSum'), '1 csomag kijelölve');
    assert.equal(await srcList().isChecked(), true);
  }
});

test('csomag: kattintás csak a kattintott csomagot váltja; a tételek uniója csomagonként', async () => {
  await only('Betűk');
  await navBtn('Szótagok').click();
  assert.equal(await text('#navSum'), '2 csomag kijelölve');
  const u = union(['Betűk', 'Szótagok']);
  assert.equal(await text('#listCount'), `${u.length} kártya · 2 csomag`);
  assert.deepEqual(await chips(), [...LISTS['Betűk'], ...LISTS['Szótagok']]); // csomagonként csoportosítva
  assert.deepEqual(await page.locator('#listBody h3').allTextContents(), ['Betűk', 'Szótagok']);
  // újabb kattintás kiveszi
  await navBtn('Betűk').click();
  assert.deepEqual(await chips(), LISTS['Szótagok']);
  assert.deepEqual(await pressed(), NAMES.map((n) => String(n === 'Szótagok')));
});

test('csomag: az utolsó is kivehető: üres állapot, az Indítás tiltva, Egyik sem eltűnik', async () => {
  await only('Szavak');
  await navBtn('Szavak').click();
  assert.deepEqual(await pressed(), NAMES.map(() => 'false'));
  assert.equal(await page.locator('#listEmpty').isVisible(), true);
  assert.equal(await text('#listEmptyText'), 'Jelölj ki legalább egy csomagot bal oldalt.');
  assert.equal(await page.locator('#startBtn').isDisabled(), true);
  assert.equal(await text('#startMsg'), 'Jelölj ki legalább egy csomagot.');
  assert.equal(await page.locator('#navNone').isVisible(), false);
  assert.equal(await text('#navSum'), '0 csomag kijelölve');
  // Egyik sem: mindent kivesz
  await navBtn('Betűk').click(); await navBtn('Szavak').click();
  await page.locator('#navNone').click();
  assert.deepEqual(await pressed(), NAMES.map(() => 'false'));
});

test('csomag: üresen mentett kijelölés újratöltéskor a táblázat jelölőit kapja (döntés 2026-11-18)', async () => {
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: 'Betűk,Szótagok,Szavak\r\nFALSE,TRUE,FALSE\r\na,ma,alma' }));
  await page.reload();
  await page.locator('#listNav .nav-item[aria-checked="true"]').first().waitFor();
  await page.locator('#navNone').click();
  assert.deepEqual(await pressed(), ['false', 'false', 'false']);
  // a frissítés (Frissítés gomb) a munkamenetben nem írja felül
  await page.locator('#refreshBtn').click();
  await page.waitForFunction(() => !document.getElementById('refreshBtn').disabled);
  assert.deepEqual(await pressed(), ['false', 'false', 'false']);
  await page.reload();
  await page.locator('#listNav .nav-item[aria-checked="true"]').first().waitFor();
  assert.deepEqual(await pressed(), ['false', 'false', 'true'], 'Betűk, Szavak, Szótagok: a jelölő a Szótagokon');
});

test('csomag: egérrel végighúzva több csomagot jelöl ki, majd vesz ki (3.1)', async () => {
  await only('Betűk');
  const box = async (name) => { const b = await navBtn(name).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
  const [a, b, c] = [await box(NAMES[0]), await box(NAMES[1]), await box(NAMES[2])];
  // a 2. sorról indulva (nincs kijelölve) a 3.-ig: mindkettő be
  await page.mouse.move(b.x, b.y); await page.mouse.down();
  await page.mouse.move(c.x, c.y, { steps: 4 }); await page.mouse.up();
  assert.deepEqual(await pressed(), ['true', 'true', 'true']);
  // az 1. sorról indulva (ki van jelölve) a 3.-ig: mind ki
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(c.x, c.y, { steps: 6 }); await page.mouse.up();
  assert.deepEqual(await pressed(), ['false', 'false', 'false']);
  // felengedés után a mozgatás már nem jelöl
  await page.mouse.move(a.x, a.y, { steps: 4 });
  assert.deepEqual(await pressed(), ['false', 'false', 'false']);
});

test('csomag: Shift + kattintás tartomány az előző kattintott sortól, a kattintott sor új állapotával', async () => {
  await only(NAMES[0]);
  await navBtn(NAMES[2]).click({ modifiers: ['Shift'] });
  assert.deepEqual(await pressed(), ['true', 'true', 'true']);
  await navBtn(NAMES[1]).click();                       // ki
  await navBtn(NAMES[0]).click({ modifiers: ['Shift'] });   // az 1. kivétele: 1–2 ki
  assert.deepEqual(await pressed(), ['false', 'false', 'true']);
});

test('csomag: a táblázat második sorának jelölője adja az induló kijelölést, amíg a szülő nem választ (F-L1d)', async () => {
  const sheet = (flags) => 'Betűk,Szótagok,Szavak\r\n' + flags + '\r\na,ma,alma\r\ne,me,körte';
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: sheet('FALSE,TRUE,TRUE') }));
  await page.reload();
  await page.locator('#listNav .nav-item[aria-checked="true"]').nth(1).waitFor();
  assert.deepEqual(await pressed(), ['false', 'true', 'true']);
  assert.deepEqual(await chips(), ['alma', 'körte', 'ma', 'me'], 'a jelölő nem kártya (névsorban: Szavak, Szótagok)');
  // a szülő még nem választott: a táblázat változását követi
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: sheet('TRUE,FALSE,FALSE') }));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#listNav .nav-item')?.getAttribute('aria-checked') === 'true'
    && document.querySelectorAll('#listNav .nav-item[aria-checked="true"]').length === 1);
  assert.deepEqual(await pressed(), ['true', 'false', 'false']);
  // a szülő választása után már az övé marad
  await only('Szavak');
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  await page.waitForTimeout(300);
  assert.deepEqual(await pressed(), ['false', 'true', 'false'], 'Betűk, Szavak, Szótagok');
});

test('csomag: a mentett „Összes csomag” csomagnevek nélkül is választás, nem a táblázat jelölője dönt (F-L1d)', async () => {
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: 'Betűk,Szótagok,Szavak\r\nTRUE,FALSE,FALSE\r\na,ma,alma' }));
  await page.evaluate(() => localStorage.setItem('olvasoka-dev', JSON.stringify({ v: 4, hideHelp: true, settings: { source: 'all' } })));
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#listNav .nav-item[aria-checked="true"]').length === 3);
  assert.deepEqual(await pressed(), ['true', 'true', 'true']);
  assert.equal(await srcAll().isChecked(), true);
});

test('csomag: Összes csomag mindet mutatja; egy kivétele Kijelöltre vált, a többi kijelölve marad (3.1)', async () => {
  await only('Betűk');
  await srcAll().check();
  assert.deepEqual(await pressed(), NAMES.map(() => 'true'));
  assert.equal(await text('#navSum'), `Mind a ${NAMES.length} csomag`);
  assert.equal(await page.locator('#navNone').isVisible(), false);
  assert.equal(await text('#listCount'), `${union(NAMES).length} kártya · ${NAMES.length} csomag`);
  assert.deepEqual(await chips(), NAMES.flatMap((n) => LISTS[n]));
  assert.equal(await page.locator('#sidebar.all').count(), 1, 'Összesnél szürke');
  await navBtn('Szavak').click();
  assert.equal(await srcList().isChecked(), true);
  assert.deepEqual(await pressed(), NAMES.map((n) => String(n !== 'Szavak')));
  assert.equal(await page.locator('#sidebar.all').count(), 0);
});

test('csomag: Kijelöltre visszaváltva a legutóbbi saját kijelölés jön vissza, újratöltés után is', async () => {
  await only('Szótagok');
  await srcAll().check();
  await page.reload();
  await page.waitForFunction(() => document.querySelectorAll('#listNav .nav-item[aria-checked="true"]').length === 3);
  await srcList().check();
  assert.deepEqual(await pressed(), NAMES.map((n) => String(n === 'Szótagok')));
  assert.deepEqual(await chips(), LISTS['Szótagok']);
});

test('csomag: a kör az Összes csomagból húz, a kijelöléstől függetlenül', async () => {
  await only('Szavak');
  await srcAll().check();
  await page.locator('#gap0').check();
  await setFlash(0);
  await setCount(50);
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 10000 });
  await page.locator('#startBtn').click();
  await page.locator('#stage').waitFor({ state: 'visible' });
  const seen = new Set();
  for (let i = 0; i < 14; i++) { seen.add(await item()); await page.keyboard.press('Space'); await page.waitForTimeout(30); }
  assert.ok([...seen].some((t) => !LISTS['Szavak'].includes(t)), `más csomag kártyái is jön: ${[...seen]}`);
});

test('csomag: az ismétlődő tétel a felületen egyszer látszik, a számok a különböző tételeké (2.14, S-3)', async () => {
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: 'Ismétlő,Másik\r\na,a\r\ne,ma\r\na,\r\ne,\r\no,' }));
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  await only('Ismétlő');
  assert.equal(await text('#listCount'), '3 kártya · 1 csomag');
  assert.deepEqual(await chips(), ['a', 'e', 'o']);
  assert.equal(await navBtn('Ismétlő').locator('.nav-count').textContent(), '3');
  // két csomag: csomagonként a különböző tételek; a fejléc a kijelölés különböző tételeit számolja
  await navBtn('Másik').click();
  assert.equal(await text('#listCount'), '4 kártya · 2 csomag');
  assert.deepEqual(await chips(), ['a', 'e', 'o', 'a', 'ma']);
  assert.equal(await page.locator('#pickSum').textContent(), '2 csomag · 4 kártya');
});

/* ---------- időzítő ---------- */
test('felvillanás: 0 (kézi), 25 mp és köztes érték; újratöltés után megmarad', async () => {
  await only('Betűk');
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
    assert.equal(await text('#estimate'), `10 kártya · ${est}`);
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
  assert.ok(pos.bar > pos.baseline && pos.bar > pos.vh / 2, `az időjelző nem a kártya alatt van: ${JSON.stringify(pos)}`);
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
      assert.notEqual(await item(), before, `${key} után ugyanaz a kártya`);
    }
    await at(wantIdx, N);
  };
  await at(1, N);
  assert.equal(await page.locator('#cPrev').isDisabled(), true, 'az első kártyán a ← nem lehet aktív');
  await go('ArrowRight', N / 2 - 1, N / 2);            // közép: 5/10
  seen.push(await item());
  await go('ArrowLeft', N / 2 - 1, 1);                // vissza az elejére
  assert.equal(await item(), seen[0], 'visszalépve nem az első kártya jött');
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
  assert.deepEqual(await pressed(), NAMES.map((n) => String(n === 'Szavak')));
  assert.equal(await page.locator('#startBtn').isEnabled(), true);
});

test('Esc a jutalomválasztóból játék nélkül a szülői nézetbe visz', async () => {
  await startRound({ flash: 0, count: 2 });
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await toChooser();
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#stage').isHidden(), true);
  assert.equal(await page.locator('#chooser').isHidden(), true);
  assert.equal(await page.evaluate(() => document.getElementById('stage').dataset.reward), undefined, 'nem indult játék');
});

test('Esc a jutalomból is a szülői nézetbe visz', async () => {
  await startRound({ flash: 0, count: 2 });
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await toChooser();
  await armed();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('stage').dataset.mode === 'reward');
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#stage').isHidden(), true);
});

/* ---------- Jutalomválasztó (spec F-R14, 12.5b, ellenőrzés 36.) ---------- */
const chooser = () => page.evaluate(() => {
  const cs = [...document.querySelectorAll('#chooser .choice')];
  return {
    mode: document.getElementById('stage').dataset.mode,
    reward: document.getElementById('stage').dataset.reward ?? null,
    labels: cs.map((c) => c.getAttribute('aria-label')),
    hi: cs.filter((c) => c.classList.contains('is-hi')).map((c) => c.dataset.game),
    focus: document.activeElement?.closest?.('.choice')?.dataset.game ?? null,
  };
});
const ARM_MS = 600;
/** Az első 600 ms a bemenetzár; utána a választó kész. */
const armed = () => page.waitForTimeout(ARM_MS + 100);

test('jutalomválasztó: két kártya, kiemelés nélkül; 600 ms-ig semmi; ← → kiemel (fókusz), Space indít (36.)', async () => {
  await startRound({ flash: 0, count: 2 });
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  // a kör végi lendület: → és Space rögtön a választó megjelenése után
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  let c = await chooser();
  assert.equal(c.mode, 'choose', 'a kör végén a választó jön, nem a játék');
  assert.deepEqual(c.labels, ['Lufipukkasztás', 'Panda-ugrálás'], 'rögzített sorrend: Lufi, Panda');
  assert.deepEqual(c.hi, [], 'a bemenetzár alatt nincs kiemelés');
  assert.equal(await page.getAttribute('#chooser', 'role'), 'group');
  assert.equal(await page.getAttribute('#chooser', 'aria-label'), 'Válassz játékot');
  assert.equal((await page.textContent('#chooser')).trim(), '', 'nincs szöveg a gyerek nézetben (U-E4)');
  assert.equal(await page.isVisible('#progress'), false, 'nincs haladásjelző');
  assert.equal(await page.isVisible('.navbar'), false, 'nincs vezérlősáv');

  await armed();
  for (const k of ['Space', 'Enter', 'ArrowUp']) {
    await page.keyboard.press(k);
    assert.equal((await chooser()).mode, 'choose', `${k}: kiemelés nélkül nem indít`);
  }
  await page.keyboard.press('ArrowRight');
  c = await chooser();
  assert.deepEqual(c.hi, ['panda']); assert.equal(c.focus, 'panda', 'a kiemelés a fókusz');
  await page.keyboard.press('ArrowLeft');
  c = await chooser();
  assert.deepEqual(c.hi, ['lufi']); assert.equal(c.focus, 'lufi');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Space');
  assert.deepEqual((await chooser()).hi, [], 'választás után nincs „kiemelés”, csak a választott keret');
  assert.equal(await page.$eval('#chooser .choice[data-game=panda]', (e) => e.classList.contains('is-picked')), true);
  await page.waitForFunction(() => document.getElementById('stage').dataset.reward === 'panda');
  assert.equal(await page.isHidden('#chooser'), true);
  assert.equal(await page.$eval('#stage', (e) => e.classList.contains('sky')), true, 'az ég marad');
  // az ég már kész: a panda nem vár újabb 1,8 mp-et (a padok rögtön beúsznak)
  await page.waitForFunction(() => document.getElementById('rewardCount').textContent.startsWith('0/'), null, { timeout: 1500 });
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
});

test('jutalomválasztó: Enter és ↑ is a kiemeltet indítja', async () => {
  for (const [arrow, start, game] of [['ArrowLeft', 'Enter', 'lufi'], ['ArrowRight', 'ArrowUp', 'panda']]) {
    await startRound({ flash: 0, count: 1 });
    await page.keyboard.press('Space');
    await toChooser();
    await armed();
    await page.keyboard.press(arrow);
    await page.keyboard.press(start);
    await page.waitForFunction((g) => document.getElementById('stage').dataset.reward === g, game);
    await page.keyboard.press('Escape');
    await page.locator('#admin').waitFor({ state: 'visible' });
  }
});

test('jutalomválasztó: kattintás a Lufira a lufikat indítja; az ég már kész', async () => {
  await startRound({ flash: 0, count: 1 });
  await page.keyboard.press('Space');
  await toChooser();
  await page.locator('#chooser .choice[data-game=lufi]').click();   // a bemenetzár alatt: nem számít
  assert.equal((await chooser()).mode, 'choose');
  await armed();
  await page.locator('#chooser .choice[data-game=lufi]').click();
  await page.waitForFunction(() => document.getElementById('stage').dataset.reward === 'lufi');
  // a lufik nem várnak újabb 1,8 mp-et
  await page.waitForFunction(() => document.querySelectorAll('#balloons .balloon').length > 0, null, { timeout: 1200 });
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
});

test('jutalomválasztó: egér fölé állva kiemel; az utolsó bemenet (egér vagy nyíl) nyer', async () => {
  await startRound({ flash: 0, count: 1 });
  await page.keyboard.press('Space');
  await toChooser();
  await armed();
  const center = async (g) => {
    const b = await page.locator(`#chooser .choice[data-game=${g}]`).boundingBox();
    return [b.x + b.width / 2, b.y + b.height / 2];
  };
  await page.mouse.move(5, 400);
  await page.mouse.move(...await center('panda'), { steps: 4 });
  let c = await chooser();
  assert.deepEqual(c.hi, ['panda'], 'egérrel kiemel'); assert.equal(c.focus, 'panda');
  await page.keyboard.press('ArrowLeft');
  c = await chooser();
  assert.deepEqual(c.hi, ['lufi'], 'a nyíl felülírja, egyszerre csak egy kiemelt');
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('stage').dataset.reward === 'lufi');
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
});

/** A fúvó és a lufik: van-e fúvó, és a lufik rétege alatta van-e (a DOM-sorrend dönt, z-index nincs). */
const blowerState = (p = page) => p.evaluate(() => {
  const b = document.querySelector('#stage .blower'), l = document.getElementById('balloons');
  return { present: !!b, aboveBalloons: !!b && !!(l.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) };
});

test('lufik mozgással: a fúvó látszik, a lufik mögötte szállnak el (F-R8)', async () => {
  await page.goto(base + '?jutalom=lufi');
  await page.locator('#listNav .nav-item').first().waitFor();
  await startRound({ flash: 0, count: 1 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelectorAll('#balloons .balloon.free').length > 0, null, { timeout: 5000 });
  const st = await blowerState();
  assert.equal(st.present, true, 'van fúvó');
  assert.equal(st.aboveBalloons, true, 'a fúvó a lufik fölött (a lufik mögötte)');
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
});

test('lufik csökkentett mozgással: helyben lebegnek, nincs fúvó és szélcsík (F-R11)', async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base + '?jutalom=lufi');
  await page.locator('#listNav .nav-item').first().waitFor();
  await startRound({ flash: 0, count: 1 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.querySelectorAll('#balloons .balloon').length > 0, null, { timeout: 3000 });
  assert.equal((await blowerState()).present, false, 'nincs fúvó');
  assert.equal(await page.locator('#stage canvas.wind').count(), 0, 'nincs szélcsík');
  assert.equal(await page.locator('#balloons .balloon.free').count(), 0, 'nem szállnak');
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
});

test('?jutalom=lufi: a választó kimarad, a lufik jönnek', async () => {
  await page.goto(base + '?jutalom=lufi');
  await page.locator('#listNav .nav-item').first().waitFor();
  await startRound({ flash: 0, count: 1 });
  await page.keyboard.press('Space');
  await page.waitForFunction(() => document.getElementById('stage').dataset.reward === 'lufi');
  assert.equal(await page.isHidden('#chooser'), true);
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
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
  await only(list);
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
  assert.equal(await text('#levelOut'), '1 · nagyon eltérő');
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
  await only('Szótagok');
  await page.locator('#tabFind').click();
  await page.waitForSelector('#sample .sample-card');
  const s = await page.locator('#sample .sample-card').allTextContents();
  assert.equal(s.length, 4);
  for (const t of s) assert.ok(LISTS['Szótagok'].includes(t), t);
});

test('Keresd meg!: nincs legalább 2 tételes csoport → Indítás inaktív (K-5); Ma ≠ ma', async () => {
  // minden csoport 1 tételes (ismétléssel is): magánhangzó, mássalhangzó, CV, 2 szótagú szó
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: 'Egy\r\nma\r\nma\r\na\r\nk\r\nka-pu' }));
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  await page.locator('#tabFind').click();
  await page.waitForFunction(() => document.getElementById('startMsg').textContent);
  assert.equal(await text('#startMsg'), 'A Keresd meg!-hez legalább két különböző kártya kell.');
  assert.equal(await page.locator('#startBtn').isDisabled(), true);
});

test('Keresd meg!: a Ma és a ma két különböző tétel, egy csoportban → indítható (K-1)', async () => {
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: 'Egy\r\nma\r\nMa' }));
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  await page.locator('#tabFind').click();
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 10000 });
  assert.equal(await text('#startMsg'), '');
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
  await toChooser();
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
  assert.equal(await cards().count(), 3, 'a Szavak listában 3 kártya');
  const fs = await cards().evaluateAll((cs) => cs.map((c) => getComputedStyle(c).fontSize));
  assert.equal(new Set(fs).size, 1, 'azonos betűméret');
  const clip = await cards().evaluateAll((cs) => cs.every((c) => {
    const t = c.querySelector('.card-text').getBoundingClientRect(), b = c.getBoundingClientRect();
    return t.left >= b.left && t.right <= b.right && t.top >= b.top && t.bottom <= b.bottom;
  }));
  assert.ok(clip, 'a leghosszabb kártya is levágás nélkül elfér');
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
    assert.equal(r.n, 6, 'telefonon 8 helyett 6 kártya');
    assert.deepEqual(r.fs, ['17px'], 'azonos betűméret');
    assert.deepEqual(r.clipped, [], 'nincs levágott kártya');
    assert.deepEqual(r.out, [], 'nincs kilógó kártya');
    assert.ok(r.oneLine, 'szón belül nincs sortörés');
    assert.equal(r.pageScrollX, false, 'nincs vízszintes görgetés');
    await page.locator('#sampleBtn').click();
  }
});

/* ---------- robusztusság ---------- */
test('akadálymentesség: billentyűzettel (Tab, Szóköz) vált a csomag pipája, a fókusz a gombon marad', async () => {
  await page.locator('#navNone').click();
  const btn = navBtn('Betűk');
  assert.equal(await btn.getAttribute('role'), 'checkbox');
  await btn.focus();
  const before = await btn.elementHandle();
  await page.keyboard.press('Space');
  assert.deepEqual(await pressed(), NAMES.map((n) => String(n === 'Betűk')));
  assert.equal(await before.evaluate((b) => b.isConnected && document.activeElement === b), true, 'a fókusz elveszett');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  const name = await page.evaluate(() => document.activeElement.textContent);
  assert.ok(name.includes(NAMES[1]), `a fókusz nem a következő csomagon van: ${name}`);
  assert.deepEqual(await pressed(), NAMES.map((n, i) => String(i < 2)), 'a második is be, az első marad');
  await page.keyboard.press('Space');
  assert.deepEqual(await pressed(), NAMES.map((n, i) => String(i === 0)), 'újra Szóköz: ki');
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
  assert.ok(!(await warn()).includes('nem mentődnek el'), 'induláskor még működik a tárolás');
  await page.evaluate(() => sessionStorage.setItem('e2e-fail', '1'));
  await page.locator('#countInc').click();
  assert.ok((await warn()).includes('A beállításaid nem mentődnek el'), 'a figyelmeztetés nem jelent meg');
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

/* ---------- Haladás: napló (docs/haladas-specifikacio.md, 5., 11.) ---------- */
const PROGRESS_KEY = 'olvasoka-dev.haladas';   // localhoston a dev kulcs (js/core/env.js)
/** A tárolt napló kibontva (a tárolt alak tömör, js/data/progress-codec.js). */
const progressRoot = () => page.evaluate(async (k) => {
  const { decode } = await import('./js/data/progress-codec.js');
  return decode(JSON.parse(localStorage.getItem(k) || 'null'));
}, PROGRESS_KEY);

/* ---------- Felolvasás: csoportosítás és Kevert sorrend (2.14) ---------- */
test('Kevert sorrend: alapból ki, a magyarázat látszik; újratöltés után megmarad; a Keresd meg!-ben nincs', async () => {
  const box = page.locator('#mixedIn');
  assert.equal(await box.isChecked(), false);
  assert.equal(await page.locator('#mixedInfo').isVisible(), true);
  assert.equal(await text('#mixedInfo p'), 'A Meixner-módszer nem keveri a betűket, szótagokat és szavakat, ezért csoportonként jönnek a játékban. Bekapcsolva ez a sorrend felborul.');
  assert.equal(await box.getAttribute('aria-describedby'), 'mixedInfo');
  await box.check();
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  assert.equal(await page.locator('#mixedIn').isChecked(), true, 'a szülő utolsó választása megmarad');
  await page.locator('#tabFind').click();
  assert.equal(await page.locator('#mixedIn').isVisible(), false, 'a Keresd meg! beállításai között nincs');
});

/** A legutóbbi kör tételsora a naplóból. */
const lastRound = async () => (await progressRoot()).rounds.at(-1);
const groupKey = (x) => (/^[aáeéiíoóöőuúüű]$/.test(x) ? 'V' : x.length === 1 ? 'C' : x.includes('-') ? 'W' : 'CV');

test('Felolvasás: kikapcsolt kapcsolónál a kör csoportonként jön (magánhangzó, mássalhangzó, CV, szó); bekapcsolva keverten', async () => {
  const rows = ['a', 'e', 'o', 'm', 'k', 's', 'ma', 'ke', 'so', 'ka-pu', 'lu-fi'];
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: ['Vegyes', ...rows].join('\r\n') }));
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  await startRound({ flash: 0, count: 11, list: 'Vegyes' });
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
  let r = await lastRound();
  assert.equal(r.order, 'grouped');
  const keys = r.items.map(groupKey);
  assert.deepEqual(keys, ['V', 'V', 'V', 'C', 'C', 'C', 'CV', 'CV', 'CV', 'W', 'W'], r.items.join(' '));

  // bekapcsolva: 5 körből legalább egyben visszavált egy korábbi csoportra
  await page.locator('#mixedIn').check();
  let mixed = 0;
  for (let k = 0; k < 5; k++) {
    await page.locator('#startBtn').click();
    await page.locator('#stage').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.locator('#admin').waitFor({ state: 'visible' });
    r = await lastRound();
    assert.equal(r.order, 'mixed');
    const ks = r.items.map(groupKey);
    if (ks.some((x, i) => i > 0 && x !== ks[i - 1] && ks.slice(0, i - 1).includes(x))) mixed++;
  }
  assert.ok(mixed >= 1, 'a kevert kör nem csoportosított');
});

test('Haladás napló: kézi kör, javított mellényomás; dev kulcson, az éles kulcs érintetlen', async () => {
  await startRound({ flash: 0, count: 3 });
  const first = await item();
  await page.waitForTimeout(700);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.press('ArrowLeft');                 // 2 mp-en belül: javított mellényomás
  assert.equal(await item(), first);
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');                     // az utolsón: jutalom
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });

  const root = await progressRoot();
  assert.equal(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).v, PROGRESS_KEY), 4, 'tárolt verzió');
  assert.match(root.deviceId, /^r-[0-9a-z]{10}$/);
  assert.ok((await page.evaluate((k) => localStorage.getItem(k).length, PROGRESS_KEY)) < 3000, 'tömör tárolt alak');
  const [r] = root.rounds;
  assert.equal(r.mode, 'read'); assert.equal(r.completed, true); assert.equal(r.corrections, 1);
  assert.equal(r.order, 'grouped', 'alapból csoportosított sorrend (H-2)');
  assert.deepEqual(r.listNames, ['Szótagok']); assert.match(r.listHash, /^[0-9a-f]{8}$/);
  const d = root.daily.find((x) => x.item === first);
  assert.equal(d.help[0], '0', 'a javított mellényomás nem segítség');
  assert.ok(d.dwellMs[0] >= 1100, `az idő összeadódik: ${d.dwellMs[0]}`);
  assert.ok(root.daily.every((x) => LISTS.Szótagok.includes(x.item)));
  assert.equal(await page.evaluate(() => localStorage.getItem('olvasoka.haladas')), null, 'az éles kulcs érintetlen');
});

test('Haladás napló: villantásos körben a gombnyomás ideje a flashDwell-be kerül, a lejárté nem', async () => {
  await startRound({ flash: 1, count: 2 });
  const first = await item();
  await page.waitForTimeout(500);
  await page.keyboard.press('ArrowRight');                // a 1 mp-es villantás lejárta előtt
  const second = await item();
  await toChooser(page, 5000);                             // a második lejár
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
  const root = await progressRoot();
  const d = (it) => root.daily.find((x) => x.item === it);
  assert.equal(d(first).flashDwell.length, 1);
  assert.equal(d(first).flashDwell[0].flashMs, 1000);
  assert.ok(d(first).flashDwell[0].ms >= 400 && d(first).flashDwell[0].ms < 1000, `idő: ${d(first).flashDwell[0].ms}`);
  assert.deepEqual(d(first).dwellMs, [], 'a kézi olvasási idő üres');
  if (second !== first) assert.deepEqual(d(second).flashDwell, [], 'lejárt villantás: nincs idő');
  assert.ok(root.rounds.every((r) => r.flashDwellDone));
});

test('Haladás napló: kilépés a kör közben is naplózódik', async () => {
  await startRound({ flash: 0, count: 5 });
  await page.waitForTimeout(600);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(600);
  await page.keyboard.press('Escape');
  const [r] = (await progressRoot()).rounds;
  assert.equal(r.completed, false); assert.equal(r.abandonedAt, 1);
});

test('Haladás: gyors ← után a tétel takarása visszaáll (5.3)', async () => {
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: 'Kötőjeles\r\nma-ma\r\nke-fe\r\nsá-ra' }));
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  await startRound({ flash: 0, count: 3, list: 'Kötőjeles' });
  const first = await item();
  await page.keyboard.press('ArrowDown');                 // csak az 1. szótag látszik
  const rulers = () => page.locator('#stage .ruler').count();
  assert.equal(await rulers(), 1);
  await page.keyboard.press('ArrowRight');
  assert.equal(await rulers(), 0, 'a következő kártya egészben látszik');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await item(), first);
  assert.equal(await rulers(), 1, 'a takarás visszaállt');
  await page.waitForTimeout(2100);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(2100);
  await page.keyboard.press('ArrowLeft');                 // 2 mp után: a régi viselkedés
  assert.equal(await rulers(), 0);
});

test('Haladás: tiltott localStorage mellett a gyakorlás hibátlanul működik', async () => {
  const c = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  await c.addInitScript(() => {
    const deny = () => { throw new DOMException('denied', 'SecurityError'); };
    Storage.prototype.setItem = deny; Storage.prototype.getItem = deny;
  });
  await c.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: FIXTURE }));
  const p = await c.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base);
  // tároló nélkül az üdvözlő ablak minden indításkor megjelenik; az Esc kihagyja
  await p.locator('#dlgWelcome').waitFor({ state: 'visible' });
  await p.keyboard.press('Escape');
  await only('Szótagok', p);
  await p.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 10000 });
  await p.locator('#startBtn').click();
  await p.locator('#stage').waitFor({ state: 'visible' });
  for (let k = 0; k < 12; k++) { await p.waitForTimeout(450); await p.keyboard.press('ArrowRight'); }
  await toChooser(p);
  await p.keyboard.press('Escape');
  await p.locator('#admin').waitFor({ state: 'visible' });
  await p.locator('#progressBtn').click();                // a Haladás tájékoztat (4.1)
  assert.equal(await p.textContent('.hl-notice'), 'Ezen az eszközön nem menthető a haladás, mert a böngésző nem engedi az adatok tárolását.');
  assert.deepEqual(errors, []);
  await c.close();
});

/* ---------- Haladás nézet: navigáció és a napszabály-kapcsoló (docs/haladas-specifikacio.md, 8.1, 10., 11.) ---------- */

/** Saját környezet: a config.js-ben a dev napszabály-kapcsolója (`skip`), opcionálisan előre tárolt napló. */
async function progressPage({ skip = false, seed = null } = {}) {
  const c = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  await c.addInitScript(([s]) => {
    if (sessionStorage.getItem('e2e')) return;
    sessionStorage.setItem('e2e', '1');
    localStorage.setItem('olvasoka-dev', JSON.stringify({ v: 3, hideHelp: true }));
    if (s) localStorage.setItem('olvasoka-dev.haladas', JSON.stringify(s));
  }, [seed]);
  await c.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: FIXTURE }));
  if (skip) {
    const src = await readFile(join(ROOT, 'js/core/config.js'), 'utf8');
    const body = src.replace(/dev: Object\.freeze\(\{ skipDayRules: false \}\)/, 'dev: Object.freeze({ skipDayRules: true })');
    assert.notEqual(body, src, 'a config.js-ben megvan a kapcsoló');
    await c.route('**/js/core/config.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body }));
  }
  const p = await c.newPage();
  await p.goto(base);
  await p.locator('#listNav .nav-item').first().waitFor();
  return { c, p };
}

/** Egy kézi Felolvasás kör a Szótagok listán; `pauseOn`: ezeken a pozíciókon a P kétszer (megállítás, folytatás). */
async function readRound(p, { count, pauseOn = [] }) {
  await only('Szótagok', p);
  await p.locator('#gap0').check();
  await p.locator('#flashIn').focus();
  await p.locator('#flashIn').press('Home');
  await p.locator('#countIn').fill(String(count));
  await p.locator('#countIn').press('Enter');
  await p.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 10000 });
  await p.locator('#startBtn').click();
  await p.locator('#stage').waitFor({ state: 'visible' });
  const seen = [];
  for (let k = 0; k < count; k++) {
    seen.push(await p.locator('#itemText').textContent());
    await p.waitForTimeout(450);
    if (pauseOn.includes(k)) { await p.keyboard.press('KeyP'); await p.waitForTimeout(150); await p.keyboard.press('KeyP'); }
    await p.keyboard.press('ArrowRight');
  }
  await toChooser(p);
  await p.keyboard.press('Escape');
  await p.locator('#admin').waitFor({ state: 'visible' });
  return seen;
}

test('Haladás: a fejléc gombjával nyílik; áttekintés → csoport → tétel → vissza a csoporthoz → az áttekintéshez (link, böngésző, Esc)', async () => {
  const { seedRoot } = await import('./haladas-seed.mjs');
  const { c, p } = await progressPage({ seed: seedRoot({ fluent: ['ma', 'me', 'alma'], unsure: ['mi'], practice: ['körte', 'szilva'] }) });
  const hash = () => decodeURIComponent(new URL(p.url()).hash);
  const h1 = () => p.textContent('#haladas h1');
  await p.locator('#progressBtn').click();
  await p.locator('#haladas .hl-cards').waitFor();
  assert.equal(hash(), '#haladas');
  assert.equal(await p.isVisible('#admin'), false);
  assert.match(await p.textContent('.hl-sum'), /^Eddig 6 kártyát olvasott a 13-ból\./, 'összes = minden lista egyedi kártyái (az „a” két listában is)');
  assert.equal(await p.evaluate(() => document.activeElement.tagName), 'H1', 'a fókusz a címen');

  // áttekintés → csoport oldala
  await p.locator('.hl-card[data-group=practice] .hl-all').click();
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  assert.equal(hash(), '#haladas/csoport/practice');
  assert.equal(await h1(), 'Még gyakorolni kell: 2 kártya');
  assert.equal(await p.textContent('.hl-back'), '← Vissza az áttekintéshez');
  assert.equal(await p.evaluate(() => document.activeElement.textContent), 'Még gyakorolni kell: 2 kártya', 'a fókusz a címen');
  // csoport → tétel: a vissza a csoporthoz visz, a link szövege „← Vissza”
  await p.locator('.hl-group .hl-tile', { hasText: 'körte' }).click();
  await p.locator('.hl-big').waitFor();
  assert.equal(hash(), '#haladas/tetel/körte');
  assert.equal(await p.textContent('.hl-back'), '← Vissza');
  assert.equal(await p.getAttribute('.hl-back', 'href'), '#haladas/csoport/practice');
  await p.locator('.hl-back').click();
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  assert.equal(hash(), '#haladas/csoport/practice');
  // böngésző előre: a tétel, Esc-re ismét a csoport, onnan Esc-re az áttekintés
  await p.goForward();
  await p.locator('.hl-big').waitFor();
  assert.equal(await p.textContent('.hl-back'), '← Vissza');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'overview');
  assert.equal(hash(), '#haladas');
  // böngésző vissza a csoport oldaláról
  await p.locator('.hl-card[data-group=fluent] .hl-all').click();
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  await p.goBack();
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'overview');

  // az áttekintésről nyitott tétel az áttekintéshez tér vissza
  await p.locator('.hl-card .hl-tile', { hasText: 'alma' }).click();
  await p.locator('.hl-big').waitFor();
  assert.equal(await p.textContent('.hl-back'), '← Vissza az áttekintéshez');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'overview');
  await p.keyboard.press('Escape');                       // áttekintésből a szülői felületre
  await p.locator('#admin').waitFor({ state: 'visible' });
  assert.equal(await p.isVisible('#haladas'), false);
  assert.equal(new URL(p.url()).hash, '');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'progressBtn', 'a fókusz visszakerül a gombra');
  await p.locator('#progressBtn').click();
  await p.locator('#haladas .hl-cards').waitFor();
  await p.locator('.hl-wrap > .hl-top .hl-back').click();   // ← Vissza
  await p.locator('#admin').waitFor({ state: 'visible' });
  await c.close();
});

test('Haladás: újratöltés után is oda visz vissza, ahonnan a tételt megnyitotta; ismeretlen csoport → áttekintés', async () => {
  const { seedRoot } = await import('./haladas-seed.mjs');
  const { c, p } = await progressPage({ seed: seedRoot({ fluent: ['ma', 'me'], practice: ['körte'] }) });
  await p.evaluate(() => { location.hash = '#haladas/csoport/fluent'; });
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  await p.locator('.hl-group .hl-tile', { hasText: 'me' }).click();
  await p.locator('.hl-big').waitFor();
  await p.reload();
  await p.locator('.hl-big').waitFor();
  assert.equal(await p.textContent('.hl-back'), '← Vissza');
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  assert.equal(new URL(p.url()).hash, '#haladas/csoport/fluent');
  // közvetlen hash-sel nyitott tétel: az áttekintéshez
  await p.evaluate(() => { history.replaceState(null, '', '#haladas/tetel/ma'); dispatchEvent(new HashChangeEvent('hashchange')); });
  await p.locator('.hl-big').waitFor();
  assert.equal(await p.textContent('.hl-back'), '← Vissza az áttekintéshez');
  // üres csoport: az üres kártya; ismeretlen csoport: az áttekintés
  await p.evaluate(() => { location.hash = '#haladas/csoport/unsure'; });
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  assert.equal(await p.textContent('#haladas h1'), 'Még bizonytalan: 0 kártya');
  assert.equal(await p.textContent('.hl-group .hl-none'), 'Még nincs ilyen kártya.');
  assert.equal(await p.$('.hl-group .hl-tile'), null);
  await p.evaluate(() => { location.hash = '#haladas/csoport/improving'; });
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'overview');
  assert.equal(new URL(p.url()).hash, '#haladas');
  await c.close();
});

test('Haladás: gyakorlás közben nem érhető el', async () => {
  const { c, p } = await progressPage();
  await only('Szótagok', p);
  await p.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 10000 });
  await p.locator('#startBtn').click();
  await p.locator('#stage').waitFor({ state: 'visible' });
  await p.evaluate(() => { location.hash = '#haladas'; });
  await p.waitForTimeout(200);
  assert.equal(await p.isVisible('#haladas'), false);
  assert.equal(await p.isVisible('#stage'), true);
  assert.equal(new URL(p.url()).hash, '');
  await c.close();
});

test('napszabály-kapcsoló nélkül: egy gyakorlás után is megnyílik, minden Kevés adat, az információs doboz látszik', async () => {
  const { c, p } = await progressPage();
  const seen = await readRound(p, { count: 6, pauseOn: [0, 1, 2] });
  await p.locator('#progressBtn').click();
  await p.locator('#haladas .hl-cards').waitFor();
  assert.equal(await p.$('.hl-empty'), null, 'a régi üres állapot megszűnt');
  assert.equal(await p.textContent('.hl-sum'), `Eddig ${new Set(seen).size} kártyát olvasott a 13-ból. Még mind a 13 kártyáról kevés az adat.`);
  assert.equal(await p.textContent('.hl-info'), 'Az első kártyák legkorábban a 3. napon kerülnek csoportba.');
  assert.equal(await p.getAttribute('.hl-info', 'role'), 'status');
  assert.deepEqual(await p.$$eval('.hl-card .hl-count', (e) => e.map((x) => x.textContent)), ['0', '0', '0', '13']);
  await c.close();
});

test('DEV_PROGRESS_SKIP_DAY_RULES=true: napvárás nélkül, de csak elég alkalom után sorol be; segítséggel sem hamarabb', async () => {
  const { c, p } = await progressPage({ skip: true });
  const tiles = (g) => p.$$eval(`.hl-card[data-group=${g}] .hl-tile`, (t) => t.map((x) => x.textContent));
  const open = async () => { await p.locator('#progressBtn').click(); await p.locator('#haladas .hl-cards').waitFor(); };
  const back = async () => { await p.keyboard.press('Escape'); await p.locator('#admin').waitFor({ state: 'visible' }); };

  // egy kör után (minden tétel egyszer): még semmi nincs csoportban, a segítséggel olvasott sem
  const reads = new Map();
  const round = async () => {
    const seen = await readRound(p, { count: 6, pauseOn: [0, 1, 2] });
    seen.forEach((it, k) => reads.set(it, (reads.get(it) || '') + (k <= 2 ? '1' : '0')));
  };
  await round();
  await open();
  assert.equal(await p.$('.hl-info'), null, 'kapcsolóval nincs információs doboz');
  assert.ok([...reads.values()].every((h) => h.length === 1), 'a Szótagok lista 6 kártyája egyszer-egyszer');
  assert.deepEqual([...await tiles('fluent'), ...await tiles('unsure'), ...await tiles('practice')], [], 'kevés alkalom: minden Kevés adat');
  assert.equal(await p.textContent('.hl-card[data-group=lowdata] .hl-means'),
    'Egy kártyáról csak akkor tudjuk a haladást megállapítani, ha legalább 3-szor olvasta.', 'nem „legalább 0 napon”');
  await back();

  // még két kör: amit legalább 3-szor olvasott, besorolódik; a Még bizonytalan mind olvasta segítség nélkül is
  await round(); await round();
  await open();
  const grouped = { fluent: await tiles('fluent'), unsure: await tiles('unsure'), practice: await tiles('practice') };
  for (const [g, items] of Object.entries(grouped)) {
    for (const it of items) assert.ok((reads.get(it) || '').length >= 3, `${it} (${reads.get(it)}) → ${g}: kevés alkalom`);
  }
  for (const it of grouped.unsure) assert.ok(reads.get(it).includes('0'), `${it} (${reads.get(it)}) → unsure, de mindig segítséggel`);
  const enough = [...reads].filter(([, h]) => h.length >= 3).map(([it]) => it);
  assert.deepEqual(Object.values(grouped).flat().sort(), [...enough].sort(), 'pontosan a legalább 3-szor olvasottak sorolódtak be');
  await c.close();
});

/* ---------- Első lépések: bemutató (docs/bemutato-specifikacio.md, 4., 7.) ---------- */

const TOUR_KEY = 'olvasoka-dev';
/** Saját környezet a bemutatóhoz: alapból üres tároló; `seed` az első betöltéskor kerül be. */
async function tourPage({ seed = null, hash = '', viewport = { width: 1280, height: 800 }, touch = false } = {}) {
  const c = await browser.newContext({ serviceWorkers: 'block', viewport, hasTouch: touch, isMobile: touch });
  await c.addInitScript(([k, s]) => {
    if (s && !sessionStorage.getItem('seeded')) { localStorage.setItem(k, JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); }
  }, [TOUR_KEY, seed]);
  await c.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: FIXTURE }));
  const p = await c.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base + hash);
  return { c, p, errors };
}
/** Az automatikus indulás az üdvözlő ablakkal kezdődik (10.): „Mutasd meg”, majd az 1. lépés. */
async function viaWelcome(p) {
  await p.locator('#dlgWelcome').waitFor({ state: 'visible' });
  await p.click('#welcomeTour');
  await p.locator('.tour-bubble').waitFor({ state: 'visible' });
}
const bubbleShown = (p) => p.locator('.tour-bubble').isVisible();
const tourStepOf = (p) => p.locator('.tour-eyebrow').textContent();
const storedTour = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null')?.tour ?? null, TOUR_KEY);
/** A bemutató nem indul el magától: a listák betöltése és a 3 mp-es várakozás után sem. */
async function noTour(p) {
  await p.locator('#listNav .nav-item').first().waitFor();
  await p.waitForTimeout(3300);
  assert.equal(await bubbleShown(p), false, 'nincs bemutató');
  assert.equal(await p.locator('#dlgWelcome').isVisible(), false, 'nincs üdvözlő ablak');
}

test('üdvözlő ablak: üres tárolóval megjelenik; szöveg, fókusz a fő gombon; „Mutasd meg” indítja a bemutatót', async () => {
  const { c, p, errors } = await tourPage();
  await p.locator('#dlgWelcome').waitFor({ state: 'visible' });
  assert.equal(await bubbleShown(p), false, 'a bemutató még nem fut');
  assert.equal(await p.textContent('#welcomeH'), 'Szia! Ez az Olvasóka.');
  assert.equal(await p.textContent('#welcomeText'), 'Olvasásgyakorlás elsősöknek a Meixner-módszer alapján, együtt a szülővel. Ti választjátok ki, mit gyakoroltok. A gyerek olvas, te figyelsz.');
  assert.equal(await p.textContent('#welcomeTour'), 'Mutasd meg 30 mp-ben');
  assert.equal(await p.textContent('#welcomeSkip'), 'Kihagyom, kezdjük');
  assert.equal(await p.textContent('.welcome-note'), 'Nincs regisztráció, azonnal kezdhetitek.');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'welcomeTour');
  assert.equal(await p.$eval('#dlgWelcome', (d) => d.matches(':modal')), true);
  await p.click('#welcomeTour');
  await p.locator('.tour-bubble').waitFor({ state: 'visible' });
  assert.equal(await tourStepOf(p), 'Első lépések · 1/4');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'tourTitle');
  assert.equal(await storedTour(p), null, 'a tárolás a bemutató végén');
  assert.deepEqual(errors, []);
  await c.close();
});

test('üdvözlő ablak: „Kihagyom, kezdjük” = kihagyott bemutató, jön az üzenet; újratöltve semmi', async () => {
  const { c, p, errors } = await tourPage();
  await p.locator('#dlgWelcome').waitFor({ state: 'visible' });
  await p.click('#welcomeSkip');
  assert.equal(await p.locator('#dlgWelcome').isVisible(), false);
  await p.waitForFunction((k) => JSON.parse(localStorage.getItem(k) || 'null')?.tour?.how === 'skipped', TOUR_KEY);
  assert.equal(await bubbleShown(p), false);
  assert.ok(await p.locator('#tourToast').isVisible());
  assert.equal(await p.evaluate(() => document.activeElement.id), 'helpBtn');
  await p.reload();
  await noTour(p);
  assert.deepEqual(errors, []);
  await c.close();
});

for (const [how, act] of [
  ['Esc', (p) => p.keyboard.press('Escape')],
  ['a háttérre kattintás', (p) => p.mouse.click(20, 20)],
]) {
  test(`üdvözlő ablak: ${how} = Kihagyom`, async () => {
    const { c, p } = await tourPage();
    await p.locator('#dlgWelcome').waitFor({ state: 'visible' });
    await act(p);
    await p.locator('#dlgWelcome').waitFor({ state: 'hidden' });
    // a dialog close eseménye a bezárás után, külön feladatként jön: megvárjuk a tárolást
    await p.waitForFunction((k) => JSON.parse(localStorage.getItem(k) || 'null')?.tour?.how === 'skipped', TOUR_KEY);
    assert.equal(await bubbleShown(p), false);
    assert.ok(await p.locator('#tourToast').isVisible());
    await c.close();
  });
}

test('bemutató: üres tárolóval az 1. lépés jelenik meg; a kiemelt csomagsor kattintható, a sötétítés nem zár', async () => {
  const { c, p, errors } = await tourPage();
  await viaWelcome(p);
  assert.equal(await tourStepOf(p), 'Első lépések · 1/4');
  assert.equal(await p.textContent('#tourTitle'), 'Válassz kártyacsomagot');
  assert.equal(await p.getAttribute('.tour-bubble', 'role'), 'dialog');
  assert.equal(await p.getAttribute('.tour-dots', 'aria-label'), '1. lépés a 4-ből');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'tourTitle', 'a fókusz a címen');
  assert.match(await p.textContent('#tourText'), /Egérrel végighúzva többet is kijelölhetsz\./);
  // a célelem a bemutató közben is használható
  await navBtn('Szavak', p).click();
  assert.equal(await p.getAttribute('#listNav .nav-item:has-text("Szavak")', 'aria-checked'), 'true');
  assert.equal(await tourStepOf(p), 'Első lépések · 1/4', 'a lépés marad');
  // a sötétítésre kattintás semmit nem csinál
  await p.mouse.click(640, 780);
  assert.ok(await bubbleShown(p));
  assert.equal(await storedTour(p), null);
  assert.deepEqual(errors, []);
  await c.close();
});

test('bemutató: Tovább és Kész; újratöltve nem jelenik meg, üzenet nincs', async () => {
  const { c, p, errors } = await tourPage();
  await viaWelcome(p);
  const titles = ['Válassz játékot', 'Itt látod a haladást', 'Kezdődhet a közös olvasás'];
  for (const [i, t] of titles.entries()) {
    await p.click('#tourNext');
    assert.equal(await tourStepOf(p), `Első lépések · ${i + 2}/4`);
    assert.equal(await p.textContent('#tourTitle'), t);
  }
  assert.match(await p.textContent('#tourText'), /nyomd meg az Indítás gombot/);
  assert.equal(await p.textContent('#tourNext'), 'Kész');
  await p.click('#tourNext');
  assert.equal(await bubbleShown(p), false);
  assert.equal(await p.locator('#tourToast').isVisible(), false, 'Kész után nincs üzenet');
  const t = await storedTour(p);
  assert.equal(t.how, 'done');
  assert.equal(t.v, 1);
  await p.reload();
  await noTour(p);
  assert.equal(await p.locator('#tourToast').isVisible(), false);
  assert.deepEqual(errors, []);
  await c.close();
});

test('bemutató: Kihagyom; az üzenet egyszer látszik, a fókusz a Súgón, újratöltve semmi', async () => {
  const { c, p } = await tourPage();
  await viaWelcome(p);
  await p.click('#tourNext');
  await p.click('#tourSkip');
  assert.equal(await bubbleShown(p), false);
  assert.equal((await storedTour(p)).how, 'skipped');
  const toast = p.locator('#tourToast');
  assert.ok(await toast.isVisible());
  assert.equal(await toast.getAttribute('role'), 'status');
  assert.equal(await p.textContent('.tour-toast-text'), 'A bemutatót a Súgóban bármikor újra elindíthatod.');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'helpBtn');
  const [tb, hb] = await Promise.all(['#tourToast', '#helpBtn'].map((s) => p.$eval(s, (e) => e.getBoundingClientRect().toJSON())));
  assert.ok(tb.top >= hb.bottom, 'a Súgó gomb alatt');
  await p.click('.tour-ok');
  assert.equal(await toast.isVisible(), false, 'Rendben bezárja');
  await p.reload();
  await noTour(p);
  assert.equal(await toast.isVisible(), false, 'újratöltve nincs üzenet');
  await c.close();
});

test('bemutató: az üzenet 8 mp után magától eltűnik', async () => {
  const { c, p } = await tourPage();
  await p.clock.install();
  await p.reload();
  await p.locator('#dlgWelcome').waitFor({ state: 'visible', timeout: 10000 }).catch(async () => { await p.clock.runFor(3100); });
  await viaWelcome(p);
  await p.click('#tourSkip');
  assert.ok(await p.locator('#tourToast').isVisible());
  await p.clock.runFor(7900);
  assert.ok(await p.locator('#tourToast').isVisible(), '8 mp előtt még látszik');
  await p.clock.runFor(200);
  assert.equal(await p.locator('#tourToast').isVisible(), false);
  await c.close();
});

test('bemutató: Esc = Kihagyom', async () => {
  const { c, p } = await tourPage();
  await viaWelcome(p);
  await p.keyboard.press('Escape');
  assert.equal(await bubbleShown(p), false);
  assert.equal((await storedTour(p)).how, 'skipped');
  assert.ok(await p.locator('#tourToast').isVisible());
  await c.close();
});

test('bemutató: a közbeni újratöltés után újra az 1. lépés jön', async () => {
  const { c, p } = await tourPage();
  await viaWelcome(p);
  await p.click('#tourNext');
  await p.click('#tourNext');
  assert.equal(await tourStepOf(p), 'Első lépések · 3/4');
  await p.reload();
  await viaWelcome(p);
  assert.equal(await tourStepOf(p), 'Első lépések · 1/4');
  assert.equal(await storedTour(p), null);
  await c.close();
});

test('bemutató: hideHelp: true állapottal nem jelenik meg', async () => {
  const { c, p } = await tourPage({ seed: { v: 4, hideHelp: true } });
  await noTour(p);
  await c.close();
});

test('bemutató: #haladas címmel indítva nem jelenik meg, visszatérve sem', async () => {
  const { c, p } = await tourPage({ hash: '#haladas' });
  await p.locator('#haladas').waitFor({ state: 'visible' });
  await p.waitForTimeout(3300);
  assert.equal(await bubbleShown(p), false);
  await p.keyboard.press('Escape');
  await noTour(p);
  await c.close();
});

test('bemutató: a Súgó „Bemutató újra” gombja az 1. lépést nyitja, a végén felülírja a tárolt állapotot', async () => {
  const { c, p } = await tourPage({ seed: { v: 4, tour: { v: 1, how: 'skipped', at: 1 } } });
  await noTour(p);
  await p.click('#helpBtn');
  assert.equal(await p.locator('#helpHide').count(), 0, 'nincs „Ne jelenjen meg újra”');
  const [again, ok] = await Promise.all(['#tourAgain', '#dlgHelp [data-close]'].map((s) => p.$eval(s, (e) => e.getBoundingClientRect().left)));
  assert.ok(again < ok, 'a „Bemutató újra” a Kezdjük bal oldalán');
  await p.click('#tourAgain');
  assert.equal(await p.$eval('#dlgHelp', (d) => d.open), false, 'a súgó bezárul');
  await p.locator('.tour-bubble').waitFor({ state: 'visible' });
  assert.equal(await tourStepOf(p), 'Első lépések · 1/4');
  for (let i = 0; i < 4; i++) await p.click('#tourNext');
  const t = await storedTour(p);
  assert.equal(t.how, 'done');
  assert.ok(t.at > 1);
  await c.close();
});

test('bemutató: nyilak a buborékban léptetnek; a játékfülön a nyíl játékot vált (döntés 2026-11-13)', async () => {
  const { c, p } = await tourPage();
  await viaWelcome(p);
  await p.keyboard.press('ArrowRight');
  assert.equal(await tourStepOf(p), 'Első lépések · 2/4');
  await p.keyboard.press('ArrowLeft');
  assert.equal(await tourStepOf(p), 'Első lépések · 1/4');
  await p.keyboard.press('ArrowLeft');
  assert.equal(await tourStepOf(p), 'Első lépések · 1/4', 'az 1. előtt nincs');
  await p.keyboard.press('ArrowRight');
  await p.waitForFunction(() => document.getElementById('tabFind').getAttribute('aria-disabled') !== 'true');
  await p.focus('#tabRead');
  await p.keyboard.press('ArrowRight');
  assert.equal(await p.getAttribute('#tabFind', 'aria-selected'), 'true', 'a fülön a nyíl játékot vált');
  assert.equal(await tourStepOf(p), 'Első lépések · 2/4', 'a bemutató nem lép');
  await p.click('#tabRead');
  assert.equal(await p.getAttribute('#tabRead', 'aria-selected'), 'true', 'kattintással is vált');
  for (let i = 0; i < 2; i++) await p.click('#tourNext');
  await p.focus('#tourTitle');
  await p.keyboard.press('ArrowRight');
  assert.equal(await tourStepOf(p), 'Első lépések · 4/4', 'az utolsó lépésen a → nem fejezi be');
  assert.ok(await bubbleShown(p));
  await c.close();
});

test('bemutató: a Tab a buborék gombjai és a célelem között jár körbe', async () => {
  const { c, p } = await tourPage();
  await viaWelcome(p);
  await p.click('#tourNext');                    // 2. lépés: játékfülek
  await p.focus('#tourTitle');
  const seq = [];
  for (let i = 0; i < 4; i++) { await p.keyboard.press('Tab'); seq.push(await p.evaluate(() => document.activeElement.id)); }
  assert.deepEqual(seq, ['tourSkip', 'tourNext', 'tabRead', 'tourSkip']);
  await p.keyboard.press('Shift+Tab');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'tabRead');
  await c.close();
});

test('bemutató: a játék indítása bármelyik lépésben = Kész, és a játék indul', async () => {
  const { c, p } = await tourPage();
  await viaWelcome(p);
  await navBtn('Szótagok', p).click();           // a kiemelt csomagsor kattintható (hozzáad)
  await p.click('#tourNext');                    // 2. lépés
  await p.keyboard.press('Control+Enter');
  await p.locator('#stage').waitFor({ state: 'visible' });
  assert.equal(await bubbleShown(p), false);
  assert.equal((await storedTour(p)).how, 'done');
  assert.equal(await p.locator('#tourToast').isVisible(), false);
  await c.close();
});

test('bemutató: a 4. lépésben az Indítás gombra kattintás = Kész', async () => {
  const { c, p } = await tourPage();
  await viaWelcome(p);
  await navBtn('Szótagok', p).click();
  for (let i = 0; i < 3; i++) await p.click('#tourNext');
  await p.click('#startBtn');
  await p.locator('#stage').waitFor({ state: 'visible' });
  assert.equal((await storedTour(p)).how, 'done');
  await c.close();
});

test('bemutató: a 3. lépésből a Haladás nézet, visszatérve a 4. lépés', async () => {
  const { c, p } = await tourPage();
  await viaWelcome(p);
  await p.click('#tourNext');
  await p.click('#tourNext');
  assert.match(await p.textContent('#tourText'), /legalább 3 különböző napon olvasta\./);
  await p.click('#progressBtn');
  await p.locator('#haladas').waitFor({ state: 'visible' });
  assert.equal(await bubbleShown(p), false, 'a Haladás nézet alatt rejtve');
  assert.equal(await p.locator('.tour-scrim').isVisible(), false);
  await p.goBack();
  await p.locator('#admin').waitFor({ state: 'visible' });
  await p.locator('.tour-bubble').waitFor({ state: 'visible' });
  assert.equal(await tourStepOf(p), 'Első lépések · 4/4');
  assert.equal(await p.evaluate(() => document.activeElement.id), 'tourTitle');
  await c.close();
});

test('bemutató telefonon: a csomaglap alatt rejtve, az Esc csak a lapot zárja, utána ugyanaz a lépés', async () => {
  const { c, p } = await tourPage({ viewport: { width: 390, height: 844 }, touch: true });
  await viaWelcome(p);
  assert.match(await p.textContent('#tourText'), /^Koppints ide, és pipáld be a csomagokat\./);
  await p.tap('#listsBtn');
  await p.locator('#dlgLists').waitFor({ state: 'visible' });
  await p.locator('.tour-bubble').waitFor({ state: 'hidden', timeout: 2000 });   // a következő képkockán rejtőzik
  assert.equal(await p.locator('.tour-scrim').isVisible(), false, 'nyitott lapnál a sötétítés is rejtve');
  await p.keyboard.press('Escape');
  await p.locator('#dlgLists').waitFor({ state: 'hidden' });
  await p.locator('.tour-bubble').waitFor({ state: 'visible' });
  assert.equal(await tourStepOf(p), 'Első lépések · 1/4');
  assert.equal(await storedTour(p), null, 'az Esc nem hagyta ki a bemutatót');
  await c.close();
});

test('bemutató: az 1. lépésben nincs módosító billentyű (Macen sem), csak a végighúzás', async () => {
  const c = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  await c.addInitScript(() => Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'MacIntel' }));
  await c.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: FIXTURE }));
  const p = await c.newPage();
  await p.goto(base);
  await viaWelcome(p);
  assert.equal(await p.locator('#tourText kbd').count(), 0);
  assert.equal(await p.textContent('#tourText'), 'Válaszd ki a kártyacsomagokat, amelyekkel játszotok. Egérrel végighúzva többet is kijelölhetsz. Középen látod, mely kártyák jöhetnek elő a játékban.');
  await c.close();
});

test('bemutató: nem írható localStorage mellett a munkameneten belül nem jön újra', async () => {
  const c = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1280, height: 800 } });
  await c.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = function (k, v) { if (this === window.localStorage) throw new DOMException('denied', 'SecurityError'); return orig.call(this, k, v); };
  });
  await c.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: FIXTURE }));
  const p = await c.newPage();
  await p.goto(base);
  await viaWelcome(p);
  await p.click('#tourSkip');
  assert.equal(JSON.parse(await p.evaluate(() => sessionStorage.getItem('olvasoka-dev_tour'))).how, 'skipped');
  await p.reload();
  await noTour(p);
  await c.close();
});

/* ---------- mondatok (docs/mondatok-specifikacio.md) ---------- */

/** A mondatos lista a táblázatból; kézi léptetés, csoportosított sorrend. */
async function sentenceRound(rows, count) {
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: ['Mondatok', ...rows].join('\r\n') }));
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  await startRound({ flash: 0, count, list: 'Mondatok' });
}
const fontSize = () => page.getAttribute('#itemText', 'font-size').then(Number);
/** A látható vonalzók és a szavak tintájának vízszintes kiterjedése. */
const coverBoxes = () => page.evaluate(() => {
  const t = document.getElementById('itemText'), s = t.textContent;
  const words = [...s.matchAll(/\S+/g)].map((m) => ({
    text: m[0], l: t.getStartPositionOfChar(m.index).x, r: t.getEndPositionOfChar(m.index + m[0].length - 1).x,
  }));
  const rulers = [...document.querySelectorAll('#stage .ruler-body')].map((b) => ({ l: +b.getAttribute('x'), r: +b.getAttribute('x') + +b.getAttribute('width') }));
  return { words, rulers };
});

test('mondat (M-7, elfogadás 4): saját betűméret; a szótag mérete nem változik tőle', async () => {
  await sentenceRound(['ma', 'a há-zi-kó pi-ci.'], 2);
  assert.equal(await item(), 'ma', 'a mondat a kör végén');
  const withSentence = await fontSize();
  await page.keyboard.press('ArrowRight');
  assert.equal(await item(), 'a há-zi-kó pi-ci.');
  const sentenceSize = await fontSize();
  assert.ok(sentenceSize < withSentence, `mondat: ${sentenceSize}, szótag: ${withSentence}`);
  await page.keyboard.press('Escape');
  await sentenceRound(['ma'], 1);
  assert.equal(await fontSize(), withSentence, 'mondat nélkül ugyanaz a méret');
});

test('mondat (M-8, elfogadás 5): ↓ szavanként takar, négy lépés után egész; a vonalzó a szót fedi', async () => {
  await sentenceRound(['a fi-ú fát hoz.'], 1);
  const shownWord = [];
  for (let k = 0; k < 4; k++) {
    await page.keyboard.press('ArrowDown');
    const { words, rulers } = await coverBoxes();
    assert.equal(rulers.length, 3, `${k + 1}. lépés: három szó letakarva`);
    const visible = words.filter((w) => !rulers.some((r) => r.l <= w.l && r.r >= w.r));
    assert.equal(visible.length, 1, `${k + 1}. lépés: egy szó látszik`);
    shownWord.push(visible[0].text);
    // a vonalzók nem érnek egymásba (a szóközön belül maradnak)
    const sorted = [...rulers].sort((a, b) => a.l - b.l);
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].l > sorted[i - 1].r, 'két vonalzó nem fedi egymást');
  }
  assert.deepEqual(shownWord, ['a', 'fi-ú', 'fát', 'hoz.']);
  await page.keyboard.press('ArrowDown');
  assert.equal((await coverBoxes()).rulers.length, 0, 'ötödikre egész');
});

test('mondat (M-8): kattintás egy szóra annak a takarását váltja, a szón belüli kötőjel nem határ', async () => {
  await sentenceRound(['a fi-ú fát hoz.'], 1);
  const { words } = await coverBoxes();
  const fiu = words.find((w) => w.text === 'fi-ú');
  const y = await page.evaluate(() => { const b = document.getElementById('itemText').getBBox(); return b.y + b.height / 2; });
  await page.mouse.click(fiu.l + 3, y);            // a „fi” részre
  let { rulers } = await coverBoxes();
  assert.equal(rulers.length, 1);
  assert.ok(rulers[0].l <= fiu.l && rulers[0].r >= fiu.r, 'az egész „fi-ú” letakarva');
  await page.mouse.click(fiu.r - 3, y);            // az „ú” részre: ugyanaz a szó
  ({ rulers } = await coverBoxes());
  assert.equal(rulers.length, 0, 'újra kattintva a szó előjön');
});

test('mondat (M-9): csak mondatos listánál a Keresd meg! saját üzenetet mutat', async () => {
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: 'Mondatok\r\na ló húz.\r\na fa nő.\r\na ló fut.' }));
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  await only('Mondatok');
  await page.locator('#tabFind').click();
  await page.waitForFunction(() => document.getElementById('startMsg').textContent);
  assert.equal(await text('#startMsg'), 'A Keresd meg!-ben mondatok nem szerepelnek. Válassz betűt, szótagot vagy szót is.');
  assert.equal(await page.locator('#startBtn').isDisabled(), true);
});

/* ---------- lapozás húzással a Felolvasásban (F-P16a) ---------- */
const SWIPE_CSV = 'Kötőjeles\r\nma-ma\r\nke-fe\r\nsá-ra\r\npi-pa\r\nli-la';
/** Telefon érintéssel, kézi léptetésű (vagy megadott felvillanású) Felolvasás-kör a Kötőjeles csomagból. */
async function swipePage({ flashMs = 0, count = 5 } = {}) {
  const c = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await c.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: SWIPE_CSV }));
  await c.addInitScript((s) => {
    if (!sessionStorage.getItem('seeded')) { localStorage.setItem('olvasoka-dev', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); }
  }, { v: 4, hideHelp: true, lastLists: ['Kötőjeles'], settings: { mode: 'read', flashMs, gapMs: 0, count } });
  const p = await c.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base);
  await p.waitForFunction(() => !document.getElementById('startBtn').disabled, null, { timeout: 10000 });
  await p.tap('#startBtn');
  await p.locator('#stage').waitFor({ state: 'visible' });
  await p.waitForFunction(() => document.getElementById('itemText').textContent);
  const cdp = await c.newCDPSession(p);
  /** Ujjal húzás (x0, y0) → (x1, y1), egyenletes lépésekben. */
  const drag = async (x0, y0, x1, y1, steps = 6) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let k = 1; k <= steps; k++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * k / steps, y: y0 + (y1 - y0) * k / steps }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await p.waitForTimeout(80);
  };
  const at = () => p.evaluate(() => +((document.getElementById('progress').getAttribute('aria-label') || '').match(/^(\d+)\./) || [0, 0])[1]);
  const rulers = () => p.locator('#stage .ruler').count();
  /** A tétel közepe (a szótag-takarás területe) és egy pont alatta, a tételen kívül. */
  const spots = () => p.evaluate(() => {
    const r = document.getElementById('itemText').getBoundingClientRect();
    return { on: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, off: { x: innerWidth / 2, y: Math.min(innerHeight - 140, r.bottom + 90) } };
  });
  return { c, p, errors, drag, at, rulers, spots };
}

test('lapozás húzással (F-P16a): balra a következő, jobbra az előző; az elsőn jobbra nincs hatása', async () => {
  const { c, p, errors, drag, at, spots } = await swipePage();
  const { off } = await spots();
  assert.equal(await at(), 1);
  await drag(off.x - 80, off.y, off.x + 80, off.y);       // jobbra az elsőn
  assert.equal(await at(), 1, 'az elsőn nincs előző');
  await drag(off.x + 80, off.y, off.x - 80, off.y);       // balra
  assert.equal(await at(), 2);
  await drag(off.x + 80, off.y, off.x - 80, off.y);
  assert.equal(await at(), 3);
  await drag(off.x - 80, off.y, off.x + 80, off.y);       // jobbra
  assert.equal(await at(), 2);
  // függőleges és rövid, lassú húzás: semmi
  await drag(off.x, off.y - 100, off.x, off.y + 100);
  await drag(off.x + 15, off.y, off.x - 15, off.y, 10);
  assert.equal(await at(), 2);
  assert.equal(await p.locator('#dlgLists[open], #dlgHelp[open]').count(), 0);
  assert.deepEqual(errors, []);
  await c.close();
});

test('lapozás húzással: a tételen indulva sem takar, a koppintás viszont takar (F-P18)', async () => {
  const { c, p, drag, at, rulers, spots } = await swipePage();
  const { on } = await spots();
  await p.touchscreen.tap(on.x, on.y);                      // koppintás a szótagra: takar, nem lép
  assert.equal(await at(), 1);
  assert.equal(await rulers(), 1);
  await drag(on.x + 60, on.y, on.x - 60, on.y);             // húzás a kártyán: lép, nem takar újabbat
  assert.equal(await at(), 2);
  assert.equal(await rulers(), 0);
  await drag(on.x - 60, on.y, on.x + 60, on.y);             // vissza: a korábbi takarás visszaáll (5.3), új nem jön
  assert.equal(await at(), 1);
  assert.equal(await rulers(), 1);
  await c.close();
});

test('lapozás húzással: szünetben is lapoz és folytat (F-P7a); az utolsón balra a jutalom jön', async () => {
  const { c, p, drag, at, spots } = await swipePage({ flashMs: 10000, count: 3 });
  const { off } = await spots();
  await p.tap('#cPlay');
  assert.equal(await p.locator('#pauseInd.on').count(), 1, 'szünet');
  await drag(off.x + 80, off.y, off.x - 80, off.y);
  assert.equal(await at(), 2);
  assert.equal(await p.locator('#pauseInd.on').count(), 0, 'a kör folytatódik');
  await drag(off.x + 80, off.y, off.x - 80, off.y);
  assert.equal(await at(), 3);
  await drag(off.x + 80, off.y, off.x - 80, off.y);
  await toChooser(p, 3000);
  await c.close();
});

test('lapozás húzással: egérrel húzva nem lapoz', async () => {
  await startRound({ flash: 0, count: 5 });
  const first = await item();
  await page.mouse.move(800, 600); await page.mouse.down();
  await page.mouse.move(500, 600, { steps: 6 }); await page.mouse.up();
  await page.mouse.move(500, 600); await page.mouse.down();
  await page.mouse.move(800, 600, { steps: 6 }); await page.mouse.up();
  assert.equal(await item(), first);
  await at(1, 5);
});

/* ---------- Megjelenés (docs/megjelenes-specifikacio.md) ---------- */
const MARKED = [
  'Jelölt,Más,Miki,Széke,Szavak2',
  '{m}i-ki,mi-ki,{m}i-ki,{sz}é-ke,{m}i-ki',
  '{sz}é-ke,a,,,{sz}é-ke',
  'ma-ma,,,,ma-ma',
  'tó,,,,',
  'Ma,,,,',
].join('\r\n');
const RGB = { ink: 'rgb(30, 42, 50)', v: 'rgb(30, 79, 163)', d: 'rgb(198, 40, 40)', u: 'rgb(27, 94, 32)' };

async function markedLists(p = page, c = ctx) {
  await c.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: MARKED }));
  await p.reload();
  await p.locator('#listNav .nav-item').first().waitFor();
}
/** Megjelenés a szülői felületen: color 'none' | 'sound', mark 'none' | 'outline'. A sor csukva indul (kartyak-oszlop
 *  ÖM-3), ezért ha kell, előbb kinyitja; nyitva hagyja. */
async function setLook(color, mark) {
  if (await page.getAttribute('#lookRow', 'aria-expanded') !== 'true') await page.click('#lookRow');
  await page.locator(`#look input[name=lookColor][value=${color}]`).check();
  await page.locator(`#look input[name=lookMark][value=${mark}]`).check();
}
/** A Felolvasás tételének darabjai: szöveg, kitöltés, körvonal, vastagság. */
const glyphs = () => page.$$eval('#itemText tspan', (ts) => ts.map((t) => {
  const c = getComputedStyle(t);
  return { t: t.textContent, fill: c.fill, stroke: c.stroke, sw: parseFloat(c.strokeWidth) };
}));
/** Egy HTML-tétel darabjai: szöveg, szín, kitöltés, körvonal-vastagság (a span nélküli karakter a szülőé). */
/** sel: CSS-választó; text: ha megvan, az első olyan elem, amelynek a teljes szövege ez. */
const htmlGlyphs = (sel, text) => page.$$eval(sel, (els, t) => {
  const found = t == null ? els[0] : els.find((x) => x.textContent === t);
  const el = found.querySelector(':scope > .g-w') || found;   // chip, minta: a darabok a belső .g-w-ben
  return [...el.childNodes].map((n) => {
    const e = n.nodeType === 1 ? n : el, c = getComputedStyle(e);
    return { t: n.textContent, color: c.color, fill: c.webkitTextFillColor, sw: parseFloat(c.webkitTextStrokeWidth) || 0 };
  });
}, text);

test('Megjelenés: alapból Nincs / Nincs; a választás megmarad újratöltés után is (MJ-1–MJ-3, elfogadás 10)', async () => {
  assert.equal(await page.locator('#look input[name=lookColor][value=none]').isChecked(), true);
  assert.equal(await page.locator('#look input[name=lookMark][value=none]').isChecked(), true);
  assert.deepEqual(await page.evaluate(() => [...document.documentElement.classList].filter((c) => c.startsWith('look-'))), []);
  await setLook('sound', 'outline');
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  assert.equal(await page.locator('#look input[name=lookColor][value=sound]').isChecked(), true);
  assert.equal(await page.locator('#look input[name=lookMark][value=outline]').isChecked(), true);
  assert.deepEqual(await page.evaluate(() => [...document.documentElement.classList].filter((c) => c.startsWith('look-')).sort()), ['look-color', 'look-mark']);
});

test('Megjelenés: {m}i-ki a Felolvasásban, a négy kombináció; {sz}é-ke egészben (elfogadás 1, 3; J-1, NB-7, NB-8)', async () => {
  await markedLists();
  const round = async (list) => {
    await startRound({ flash: 0, count: 1, list });
    const g = await glyphs();
    const size = +(await page.getAttribute('#itemText', 'font-size'));
    await page.keyboard.press('Escape');
    await page.locator('#admin').waitFor({ state: 'visible' });
    return { g, w: Math.max(0.8, size * 0.025) };
  };
  // Nincs / Nincs: sima szöveg, tspan nélkül (a betűköz nem változik)
  let r = await round('Miki');
  assert.deepEqual(r.g, []);
  assert.equal(await page.$eval('#itemText', (t) => getComputedStyle(t).fill), RGB.ink);

  await setLook('sound', 'none');
  r = await round('Miki');
  assert.deepEqual(r.g.map((x) => [x.t, x.fill]), [['m', RGB.d], ['i', RGB.v], ['-', RGB.ink], ['k', RGB.u], ['i', RGB.v]]);
  assert.ok(r.g.every((x) => x.stroke === 'none'), 'körvonal nincs');

  await setLook('none', 'outline');
  r = await round('Miki');
  assert.deepEqual(r.g.map((x) => [x.t, x.fill, x.stroke]), [['m', 'none', RGB.ink], ['i', RGB.ink, 'none'], ['-', RGB.ink, 'none'], ['k', RGB.ink, 'none'], ['i', RGB.ink, 'none']]);
  assert.ok(Math.abs(r.g[0].sw - r.w) < 0.05, `vonalvastagság ${r.g[0].sw} ≈ ${r.w}`);

  await setLook('sound', 'outline');
  r = await round('Miki');
  assert.deepEqual(r.g.map((x) => [x.t, x.fill, x.stroke]), [['m', 'none', RGB.d], ['i', RGB.v, 'none'], ['-', RGB.ink, 'none'], ['k', RGB.u, 'none'], ['i', RGB.v, 'none']]);
  r = await round('Széke');
  assert.deepEqual(r.g.slice(0, 2).map((x) => [x.t, x.fill, x.stroke]), [['sz', 'none', RGB.u], ['é', RGB.v, 'none']], 'a teljes sz körvonalas, zöld');
});

test('Megjelenés: takarás színezett, jelölt tételen is a szótagra kerül (F-P22, J-1)', async () => {
  await markedLists();
  await setLook('sound', 'outline');
  await startRound({ flash: 0, count: 1, list: 'Miki' });
  await page.keyboard.press('ArrowDown');
  // ↓: csak az 1. szótag látszik, a vonalzó a „ki”-t takarja: a kötőjel után kezdődik, a k-nál nem később
  const { ruler, hy, k } = await page.evaluate(() => {
    const t = document.getElementById('itemText');
    const r = document.querySelector('#stage .ruler-body').getBBox();
    return { ruler: r.x, hy: t.getStartPositionOfChar(2).x, k: t.getStartPositionOfChar(3).x };
  });
  assert.equal(await page.locator('#stage .ruler').count(), 1);
  assert.ok(ruler > hy && ruler <= k + 0.5, `a vonalzó a második szótagon: ${hy} < ${ruler} ≤ ${k}`);
});

test('Megjelenés: előnézet – ma-ma, tó, Ma színei; {m}i-ki és mi-ki egy tétel, mindenhol jelölt alakban (elfogadás 2, 5; NB-5a)', async () => {
  await markedLists();
  await only('Jelölt');
  await navBtn('Más').click();
  assert.equal(await text('#listCount'), '6 kártya · 2 csomag', 'a {m}i-ki és a mi-ki egy kártya');
  assert.deepEqual(await chips(), ['mi-ki', 'szé-ke', 'ma-ma', 'tó', 'Ma', 'mi-ki', 'a']);
  assert.equal(await page.locator('#listBody .chip .g-mark').count(), 3, 'a Más csomag mi-ki-je is jelölt (NB-5a)');
  await setLook('sound', 'outline');
    const chip = (t) => htmlGlyphs('#listBody .chip', t);
  assert.deepEqual((await chip('ma-ma')).map((x) => [x.t, x.color]), [['m', RGB.d], ['a', RGB.v], ['-', RGB.ink], ['m', RGB.d], ['a', RGB.v]]);
  assert.deepEqual((await chip('tó')).map((x) => [x.t, x.color]), [['t', RGB.u], ['ó', RGB.v]]);
  assert.deepEqual((await chip('Ma')).map((x) => [x.t, x.color]), [['M', RGB.d], ['a', RGB.v]]);
  const m = (await chip('mi-ki'))[0];
  assert.deepEqual([m.t, m.color, m.fill], ['m', RGB.d, 'rgba(0, 0, 0, 0)'], 'körvonalas, piros');
  assert.ok(m.sw >= 0.8, `körvonal ${m.sw}`);
  // színezés nélkül a körvonal tintaszínű (NB-8), a többi betű teli
  await setLook('none', 'outline');
  const g = await chip('mi-ki');
  assert.deepEqual([g[0].color, g[0].fill], [RGB.ink, 'rgba(0, 0, 0, 0)']);
  assert.equal(g[1].fill, RGB.ink);
  await setLook('none', 'none');
  assert.equal((await chip('mi-ki'))[0].sw, 0, 'Nincs: sima kisbetű (NB-6)');
});

test('Megjelenés: jelmagyarázat csak színezésnél, a tipp csak színezés + Körvonal esetén (L-1)', async () => {
  const vis = () => Promise.all(['#lookLegend', '#lookTip'].map((s) => page.locator(s).isVisible()));
  await setLook('none', 'none'); assert.deepEqual(await vis(), [false, false]);
  await setLook('sound', 'none'); assert.deepEqual(await vis(), [true, false]);
  await setLook('none', 'outline'); assert.deepEqual(await vis(), [false, false]);
  await setLook('sound', 'outline'); assert.deepEqual(await vis(), [true, true]);
  assert.equal((await text('#lookLegend')).replace(/\s+/g, ' ').trim(), 'a magánhangzó m zöngés t zöngétlen');
  assert.equal(await text('#lookTip'), 'Színezésnél a körvonal a betű színét kapja.');
});

test('Megjelenés: a Minta a kijelölt csomagokból, típusonként az első; csomag nélkül nem látszik (MI-1–MI-3)', async () => {
  await markedLists();
  await only('Jelölt');
  await navBtn('Más').click();
  const sample = () => page.locator('#lookSample .look-card').allTextContents();
  assert.deepEqual(await sample(), ['a', 'tó', 'mi-ki', 'szé-ke']);
  assert.equal(await page.locator('#lookSample .look-card .g-mark').count(), 2);
  await navBtn('Más').click();
  assert.deepEqual(await sample(), ['tó', 'mi-ki', 'szé-ke'], 'a hiányzó típus kimarad');
  await page.locator('#navNone').click();
  assert.equal(await page.locator('#lookSample').isVisible(), false);
  assert.equal(await page.locator('#lookSampleL').isVisible(), false);
});

test('Megjelenés: a Keresd meg! kártyái és mintája a Megjelenés szerint (MJ-4, J-2)', async () => {
  await markedLists();
  await only('Szavak2');
  await setLook('sound', 'outline');
  await page.locator('#tabFind').click();
  await page.waitForSelector('#sample .sample-card');
  assert.equal(await page.locator('#sample .sample-card .g-mark').count(), 2, 'a panel mintája is');
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
  await page.locator('#startBtn').click();
  await page.waitForSelector('#findGrid .card');
  const card = page.locator('#findGrid .card[aria-label="mi-ki"] .card-text');
  const m = (await htmlGlyphs('#findGrid .card[aria-label="mi-ki"] .card-text'))[0];
  assert.deepEqual([m.t, m.color, m.fill], ['m', RGB.d, 'rgba(0, 0, 0, 0)']);
  assert.equal(await card.textContent(), 'mi-ki');
  // a megjelölt kártya stílusa változatlan, a betűk színe marad
  await page.locator('#findGrid .card[aria-label="mi-ki"]').click();
  assert.equal(await page.getAttribute('#findGrid .card[aria-label="mi-ki"]', 'aria-pressed'), 'true');
  assert.equal((await htmlGlyphs('#findGrid .card[aria-label="mi-ki"] .card-text'))[1].color, RGB.v);
});

test('Megjelenés: hibás vagy elérhetetlen hangok.json mellett a beépített besorolással színez (D-5)', async () => {
  await ctx.route(/hangok\.json/, (r) => r.abort());
  await markedLists();
  await only('Jelölt');
  await setLook('sound', 'none');
  assert.deepEqual((await htmlGlyphs('#listBody .chip', 'tó')).map((x) => x.color), [RGB.u, RGB.v]);
});

/* ---------- Tételszűrő (docs/megjelenes-specifikacio.md, SZR) ---------- */
const chipNames = () => page.locator('#tfRow .tf-main .tf-label').allTextContents();
const chip = (name) => page.locator('#tfRow .tf-chip', { has: page.locator('.tf-label', { hasText: name }) });
const MIXED = [
  'Betűk,Szótagok,Szavak,Mondatok,CVk,VCk',
  'a,ma,ka-pu,a ló.,ma,am',
  'm,am,lu-fi,a fa.,me,',
  'e,kap,,,,',
].join('\r\n');
async function mixedLists() {
  await ctx.route(/docs\.google\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/csv', body: MIXED }));
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
}

test('szűrő: a négy chip a jelen lévő típusokkal; számláló, csomagszámok és előnézet a szűrés utáni tételekkel (SZR-1, SZR-8, D-3)', async () => {
  await mixedLists();
  await only('Betűk');
  for (const n of ['Szótagok', 'Szavak']) await navBtn(n).click();
  assert.deepEqual(await chipNames(), ['Betűk', 'Szótagok', 'Szavak'], 'mondat nélkül nincs Mondatok chip (elfogadás 8)');
  assert.equal(await text('#listCount'), '8 kártya · 3 csomag');
  await chip('Szavak').locator('.tf-main').click();
  assert.equal(await text('#listCount'), '6 / 8 kártya · 3 csomag');
  assert.equal(await chip('Szavak').locator('.tf-main').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(await page.locator('#listBody h3').allTextContents(), ['Betűk', 'Szótagok'], 'a szűrés után üres csomag nem látszik');
  assert.equal(await navBtn('Szavak').locator('.nav-count').textContent(), '0', 'a csomag számlálója is szűrt (D-3)');
  assert.equal(await navBtn('Szótagok').locator('.nav-count').textContent(), '3');
  await navBtn('Mondatok').click();
  assert.deepEqual(await chipNames(), ['Betűk', 'Szótagok', 'Szavak', 'Mondatok'], 'mondatos csomaggal megjelenik (elfogadás 8)');
});

test('szűrő: altípusok a ▾ listában; részben bekapcsolt chip; kívülre kattintás és Esc zár (SZR-2, SZR-4)', async () => {
  await mixedLists();
  await only('Betűk');
  await chip('Betűk').locator('.tf-caret').click();
  assert.equal(await page.isVisible('#tfPop'), true);
  assert.deepEqual(await page.locator('#tfPop .tf-sub-label').allTextContents(), ['Magánhangzók', 'Mássalhangzók']);
  assert.deepEqual(await page.locator('#tfPop .tf-n').allTextContents(), ['2', '1']);
  await page.locator('#tfPop .tf-sub', { hasText: 'Mássalhangzók' }).locator('input').uncheck();
  assert.equal(await chip('Betűk').locator('.tf-label').textContent(), 'Betűk · 1/2');
  assert.equal(await chip('Betűk').locator('.tf-main').getAttribute('aria-pressed'), 'mixed');
  assert.equal(await chip('Betűk').locator('.tf-n').textContent(), '2');
  assert.deepEqual(await chips(), ['a', 'e']);
  await page.keyboard.press('Escape');
  assert.equal(await page.isVisible('#tfPop'), false, 'Esc zár');
  assert.equal(await page.evaluate(() => document.activeElement?.classList.contains('tf-caret')), true, 'a fókusz a ▾-ra kerül');
  await chip('Betűk').locator('.tf-caret').click();
  await page.mouse.click(5, 790);
  assert.equal(await page.isVisible('#tfPop'), false, 'kívülre kattintás zár');
  // részben bekapcsolt chipre koppintás: mind ki; újra: mind be
  await chip('Betűk').locator('.tf-main').click();
  assert.equal(await chip('Betűk').locator('.tf-main').getAttribute('aria-pressed'), 'false');
  await chip('Betűk').locator('.tf-main').click();
  assert.equal(await chip('Betűk').locator('.tf-label').textContent(), 'Betűk');
  assert.deepEqual(await chips(), ['a', 'm', 'e']);
});

test('szűrő: egy altípusnál nincs ▾; VC-vel megjelenik (SZR-3, elfogadás 9)', async () => {
  await mixedLists();
  await only('CVk');
  assert.deepEqual(await chipNames(), ['Szótagok']);
  assert.equal(await chip('Szótagok').locator('.tf-caret').count(), 0);
  await navBtn('VCk').click();
  assert.equal(await chip('Szótagok').locator('.tf-caret').count(), 1);
});

test('szűrő: csak magánhangzók → a Felolvasás köre csak V, a hossza a beállított (elfogadás 6, SZR-5)', async () => {
  await mixedLists();
  await only('Betűk');
  for (const n of ['Szótagok', 'Szavak', 'Mondatok']) await navBtn(n).click();
  for (const n of ['Szótagok', 'Szavak', 'Mondatok']) await chip(n).locator('.tf-main').click();
  await chip('Betűk').locator('.tf-caret').click();
  await page.locator('#tfPop .tf-sub', { hasText: 'Mássalhangzók' }).locator('input').uncheck();
  await page.keyboard.press('Escape');
  await setFlash(0);
  await setCount(7);
  await page.locator('#startBtn').click();
  await page.locator('#stage').waitFor({ state: 'visible' });
  await page.keyboard.press('Escape');
  await page.locator('#admin').waitFor({ state: 'visible' });
  const r = await lastRound();
  assert.equal(r.items.length, 7);
  assert.ok(r.items.every((x) => ['a', 'e'].includes(x)), r.items.join(' '));
});

test('szűrő: minden típus ki → Indítás inaktív, az üres szűrő szövege és a becslés (elfogadás 7, SZR-7)', async () => {
  await mixedLists();
  await only('Betűk');
  await navBtn('Szavak').click();
  for (const n of ['Betűk', 'Szavak']) await chip(n).locator('.tf-main').click();
  assert.equal(await page.isEnabled('#startBtn'), false);
  assert.equal(await text('#listEmptyText'), 'A szűrő minden kártyát kizárt. Kapcsolj be legalább egy típust.');
  assert.equal(await page.isVisible('#listEmpty'), true);
  assert.equal(await text('#estCount'), 'Nincs kártya a szűrőben');
  assert.equal(await text('#listCount'), '0 / 5 kártya · 2 csomag');
  assert.equal(await page.locator('#lookSample').isVisible(), false, 'a Minta a szűrés utáni kártyákból (MI-1, MI-3)');
  await page.locator('#tabFind').click();
  assert.equal(await page.isEnabled('#startBtn'), false, 'a Keresd meg!-ben is');
  assert.equal(await text('#estCount'), 'Nincs kártya a szűrőben');
  await chip('Szavak').locator('.tf-main').click();
  assert.equal(await page.isEnabled('#startBtn'), true);
});

test('szűrő: a Keresd meg! is a szűrt tételekből; újratöltés után a szűrő megmarad (SZR-5, SZR-6, elfogadás 10)', async () => {
  await mixedLists();
  await only('Betűk');
  await navBtn('Szavak').click();
  await chip('Betűk').locator('.tf-main').click();
  await page.reload();
  await page.locator('#listNav .nav-item').first().waitFor();
  assert.equal(await chip('Betűk').locator('.tf-main').getAttribute('aria-pressed'), 'false', 'megmaradt');
  await page.locator('#tabFind').click();
  await page.waitForFunction(() => !document.getElementById('startBtn').disabled);
  await page.locator('#startBtn').click();
  await page.waitForSelector('#findGrid .card');
  assert.deepEqual((await page.locator('#findGrid .card').evaluateAll((cs) => cs.map((c) => c.getAttribute('aria-label')))).sort(), ['ka-pu', 'lu-fi']);
});

test('szűrő: a tárolt, most nem látszó altípus állapota megmarad (SZR-6)', async () => {
  await mixedLists();
  await only('Betűk');
  await chip('Betűk').locator('.tf-caret').click();
  await page.locator('#tfPop .tf-sub', { hasText: 'Mássalhangzók' }).locator('input').uncheck();
  await page.keyboard.press('Escape');
  await only('Szavak');
  assert.deepEqual(await chipNames(), ['Szavak']);
  await only('Betűk');
  assert.equal(await chip('Betűk').locator('.tf-label').textContent(), 'Betűk · 1/2');
});

test('Súgó: a 2. lépés a Megjelenés és a szűrő mondata (S-1, elfogadás 11)', async () => {
  const steps = await page.locator('#dlgHelp .help-steps > li').allTextContents();
  assert.equal(steps[1], 'A Megjelenés résznél színezheted a betűket és jelölheted a nagybetűket, a Betűk, Szótagok, Szavak, Mondatok gombokkal pedig kiválaszthatod, mit gyakoroljatok.');
});

test('szűrő: a ▾ lista újranyitva is tartalmazza az altípusokat; Egyik sem után újra kijelölve is (hiba 2026-11-25)', async () => {
  await mixedLists();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await only('Betűk');
  const subs = () => page.locator('#tfPop .tf-sub-label').allTextContents();
  await chip('Betűk').locator('.tf-caret').click();
  assert.deepEqual(await subs(), ['Magánhangzók', 'Mássalhangzók']);
  await page.keyboard.press('Escape');
  await chip('Betűk').locator('.tf-caret').click();
  assert.deepEqual(await subs(), ['Magánhangzók', 'Mássalhangzók'], 'újranyitva');
  await page.keyboard.press('Escape');
  // minden csomag ki, majd az első vissza: a chip újraépül, a lista nem üres
  await page.locator('#navNone').click();
  await navBtn('Betűk').click();
  await chip('Betűk').locator('.tf-caret').click();
  assert.deepEqual(await subs(), ['Magánhangzók', 'Mássalhangzók'], 'Egyik sem után');
  assert.equal(await text('#listCount'), '3 kártya · 1 csomag', 'a felület többi része is frissül');
  assert.deepEqual(errors, []);
});
