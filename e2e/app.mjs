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
/** A kör vége: a jutalomválasztó (F-R14). */
const toChooser = (p = page, timeout) => p.waitForFunction(() => document.getElementById('stage').dataset.mode === 'choose', null, timeout ? { timeout } : {});
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
  assert.equal(await text('#startMsg'), 'A Keresd meg!-hez legalább két különböző tétel kell.');
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
  assert.equal(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).v, PROGRESS_KEY), 3, 'tárolt verzió');
  assert.match(root.deviceId, /^r-[0-9a-z]{10}$/);
  assert.ok((await page.evaluate((k) => localStorage.getItem(k).length, PROGRESS_KEY)) < 3000, 'tömör tárolt alak');
  const [r] = root.rounds;
  assert.equal(r.mode, 'read'); assert.equal(r.completed, true); assert.equal(r.corrections, 1);
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
  assert.equal(await rulers(), 0, 'a következő tétel egészben látszik');
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
  if (await p.locator('#dlgHelp').isVisible()) await p.keyboard.press('Escape');
  await p.locator('#listNav .nav-item', { hasText: 'Szótagok' }).click();
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
  await p.locator('#listNav .nav-item', { hasText: 'Szótagok' }).click();
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
  assert.match(await p.textContent('.hl-sum'), /^Eddig 6 tételt olvasott a 13-ból\./, 'összes = minden lista egyedi tételei (az „a” két listában is)');
  assert.equal(await p.evaluate(() => document.activeElement.tagName), 'H1', 'a fókusz a címen');

  // áttekintés → csoport oldala
  await p.locator('.hl-card[data-group=practice] .hl-all').click();
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'group');
  assert.equal(hash(), '#haladas/csoport/practice');
  assert.equal(await h1(), 'Még gyakorolni kell: 2 tétel');
  assert.equal(await p.textContent('.hl-back'), '← Vissza az áttekintéshez');
  assert.equal(await p.evaluate(() => document.activeElement.textContent), 'Még gyakorolni kell: 2 tétel', 'a fókusz a címen');
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
  assert.equal(await p.textContent('#haladas h1'), 'Még bizonytalan: 0 tétel');
  assert.equal(await p.textContent('.hl-group .hl-none'), 'Még nincs ilyen tétel.');
  assert.equal(await p.$('.hl-group .hl-tile'), null);
  await p.evaluate(() => { location.hash = '#haladas/csoport/improving'; });
  await p.waitForFunction(() => document.getElementById('haladas').dataset.view === 'overview');
  assert.equal(new URL(p.url()).hash, '#haladas');
  await c.close();
});

test('Haladás: gyakorlás közben nem érhető el', async () => {
  const { c, p } = await progressPage();
  await p.locator('#listNav .nav-item', { hasText: 'Szótagok' }).click();
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
  assert.equal(await p.textContent('.hl-sum'), `Eddig ${new Set(seen).size} tételt olvasott a 13-ból. Még mind a 13 tételről kevés az adat.`);
  assert.equal(await p.textContent('.hl-info'), 'Az első tételek legkorábban a 3. napon kerülnek csoportba.');
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
  assert.ok([...reads.values()].every((h) => h.length === 1), 'a Szótagok lista 6 tétele egyszer-egyszer');
  assert.deepEqual([...await tiles('fluent'), ...await tiles('unsure'), ...await tiles('practice')], [], 'kevés alkalom: minden Kevés adat');
  assert.equal(await p.textContent('.hl-card[data-group=lowdata] .hl-means'),
    'Egy tételről csak akkor tudjuk a haladást megállapítani, ha legalább 3-szor olvasta.', 'nem „legalább 0 napon”');
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
