// Felhasználónak látszó szövegek (docs/kartyacsomagok-specifikacio.md, 2. és 6.): „lista” helyett csomag,
// új meta leírás és üdvözlő ablak. A kódbeli nevek, tárolt kulcsok és statisztikai értékek szándékosan maradnak.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const LISTA = /(?<!Event)[Ll]ist[aáàeé]/;    // az addEventListener nem szöveg
const DESC = 'Olvasásgyakorló elsősöknek és szüleiknek. Betűk, szótagok és szavak, regisztráció nélkül.';

/** Az index.html látható szövegei és a felolvasónak szóló attribútumai (megjegyzések nélkül). */
function htmlTexts(html) {
  const h = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
  const texts = [...h.matchAll(/>([^<]+)</g)].map((m) => m[1].trim()).filter(Boolean);
  const attrs = [...h.matchAll(/\s(?:aria-label|title|alt|content|placeholder)="([^"]*)"/g)].map((m) => m[1]);
  return [...texts, ...attrs];
}

/** Egy JS-fájl szöveg-literáljai (megjegyzések nélkül). */
function jsStrings(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/[^'`"\n]*$/gm, '');
  return [...code.matchAll(/'([^'\n]*)'|`([^`]*)`/g)].map((m) => m[1] ?? m[2]);
}

test('szövegek: az index.html-ben nem maradt „lista”', () => {
  const bad = htmlTexts(read('index.html')).filter((t) => LISTA.test(t));
  assert.deepEqual(bad, []);
});

test('szövegek: a felület szövegeiben nem maradt „lista”', () => {
  for (const f of ['js/ui/admin.js', 'js/core/tour.js', 'js/core/haladas-texts.js', 'js/core/lists.js', 'js/core/source.js', 'js/ui/haladas.js', 'js/ui/tour.js']) {
    const bad = jsStrings(read(f)).filter((t) => LISTA.test(t));
    assert.deepEqual(bad, [], f);
  }
});

test('szövegek: a statisztika értéke szándékosan marad, hogy a régi és új adat összevethető legyen', () => {
  assert.match(read('js/main.js'), /'\(összes lista\)'/);
});

test('szövegek: meta leírás mindhárom helyen, „Hangtalan” nélkül', () => {
  const html = read('index.html');
  assert.match(html, new RegExp(`<meta name="description" content="${DESC.replace(/\./g, '\\.')}">`));
  assert.equal(JSON.parse(read('manifest.webmanifest')).description, DESC);
  assert.equal(JSON.parse(read('package.json')).description, DESC);
  for (const f of ['index.html', 'manifest.webmanifest', 'package.json']) {
    const meta = f === 'index.html' ? /<meta name="description"[^>]*>/.exec(read(f))[0] : read(f);
    assert.doesNotMatch(meta, /Hangtalan/, f);
  }
  assert.doesNotMatch(html, /Hangtalan/, 'a Súgó bevezetőjében sincs');
});

test('szövegek: üdvözlő ablak és Adatvédelem (6.)', () => {
  const html = read('index.html');
  assert.match(html, /<p id="welcomeText">Olvasásgyakorlás elsősöknek, együtt a szülővel, ahol ti választjátok ki, mit gyakoroltok\. A gyerek olvas, te figyelsz\.<\/p>/);
  assert.match(html, />Mutasd meg 30 mp-ben<\/button>/);
  assert.match(html, /melyik játékkal, melyik csomagokból, és mennyi idő után indul az első kör\. Sütit nem használ/);
});

test('szövegek: az új szövegekben nincs gondolatjel', () => {
  const html = read('index.html');
  for (const id of ['welcomeText', 'navHint']) {
    const m = new RegExp(`id="${id}"[^>]*>([^<]*)<`).exec(html);
    assert.ok(m, id);
    assert.doesNotMatch(m[1], /[–—]/, id);
  }
});
