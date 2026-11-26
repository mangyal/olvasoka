// Felhasználónak látszó szövegek (docs/kartyacsomagok-specifikacio.md, 2. és 6.): „lista” helyett csomag,
// új meta leírás és üdvözlő ablak. A kódbeli nevek, tárolt kulcsok és statisztikai értékek szándékosan maradnak.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as TX from '../js/core/haladas-texts.js';
import { resolve } from '../js/core/haladas-config.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const LISTA = /(?<!Event)[Ll]ist[aáàeé]/;    // az addEventListener nem szöveg
const DESC = 'Meixner-féle olvasásgyakorló elsősöknek. Betűk, szótagok és szavak, regisztráció nélkül.';

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

test('szövegek: Open Graph linkelőnézet (cím, leírás, abszolút kép-URL)', () => {
  const html = read('index.html');
  const og = (p) => new RegExp(`<meta property="og:${p}" content="([^"]*)">`).exec(html)?.[1];
  assert.equal(og('title'), 'Olvasóka');
  assert.equal(og('description'), DESC);
  assert.match(og('image'), /^https:\/\/mangyal\.github\.io\/olvasoka\/img\/icons\/icon-512\.png$/);
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
  assert.match(html, /<p id="welcomeText">Olvasásgyakorlás elsősöknek a Meixner-módszer alapján, együtt a szülővel\. Ti választjátok ki, mit gyakoroltok\. A gyerek olvas, te figyelsz\.<\/p>/);
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

/* ---------- „tétel” → „kártya” (docs/kartya-szo-specifikacio.md, KE-1–KE-12) ---------- */

const TETEL = /tétel/i;
/** A repó összes felületi js-fájlja (a js/ mappa egésze). */
const jsFiles = (dir = 'js') => readdirSync(new URL(`../${dir}`, import.meta.url), { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? jsFiles(`${dir}/${e.name}`) : e.name.endsWith('.js') ? [`${dir}/${e.name}`] : []));
/** KE-3: a fejlesztői konfiguráció-ellenőrzés üzenete marad, a szülő nem látja. */
const TETEL_OK = { 'js/core/haladas-config.js': [/különben egy tétel egyszerre „Megy” és „Még gyakorolni kell”/] };

test('kártya: az index.html látható szövegeiben és attribútumaiban nincs „tétel” (KE-1)', () => {
  assert.deepEqual(htmlTexts(read('index.html')).filter((t) => TETEL.test(t)), []);
});

test('kártya: a js szöveg-literáljaiban nincs „tétel”, csak a fejlesztői hibaüzenetben (KE-1, KE-3)', () => {
  const files = jsFiles();
  assert.ok(files.includes('js/core/haladas-texts.js') && files.length > 30, 'a fájllista bejárja a js/ mappát');
  for (const f of files) {
    const bad = jsStrings(read(f)).filter((t) => TETEL.test(t) && !(TETEL_OK[f] || []).some((r) => r.test(t)));
    assert.deepEqual(bad, [], f);
  }
});

test('kártya: a haladásnapló és az URL kulcsai nem változnak (KE-2)', () => {
  assert.match(read('js/ui/haladas.js'), /tetel/, 'a #haladas/tetel/<…> útvonal marad');
});

test('kártya: Kártyák oszlop és csomagválasztó szövegei', () => {
  const html = read('index.html');
  assert.match(html, /<h2 class="col-title" id="previewH">Kártyák<\/h2>/);
  assert.match(html, /aria-label="Típusszűrő"/);
  assert.match(html, /<label for="countIn">Kártyák a körben<\/label>/);
  assert.equal((html.match(/Kötőjeles szónál a szótagra koppintva letakarod/g) || []).length, 2);
});

/** A Haladás nézet összes szövegkimenete sok számmal és mindkét konfigurációval (KE-11). */
function haladasOutputs() {
  const out = [];
  const flat = (v) => (Array.isArray(v) ? v.flat(Infinity).filter((x) => typeof x === 'string').join('') : v);
  const push = (v) => out.push(flat(v));
  for (const v of Object.values(TX.T)) (Array.isArray(v) ? v : [v]).forEach(push);
  const NS = [0, 1, 2, 3, 5, 6, 8, 10, 12, 20, 40, 100, 124, 140];
  for (const a of [resolve(null), resolve(null, { skipDayRules: true })]) {
    for (const k of TX.CARD_ORDER) {
      push(TX.cardText(k, a)); push(TX.groupTitle(k, 5));
      for (const n of NS) push(TX.showAllAria(k, n));
      for (const reason of ['slow', 'help', null]) {
        for (const type of ['betű', 'szótag', 'szó', 'mondat']) {
          push(TX.reasonSentence({ group: k, reason, need: null, type, helpN: 5, helpK: 3 }, a));
        }
      }
    }
    for (const need of [null, 'days', 'count']) push(TX.lowdataText(a, need));
    push(TX.partRead(a));
  }
  for (const n of NS) {
    push(TX.infoText(n)); push(TX.groupTitle('fluent', n)); push(TX.listText(1, n));
    push(TX.listAria({ name: 'Csomag', total: n, fluent: 0, unsure: 0, practice: 0, lowdata: n }));
    push(TX.listAria({ name: 'Csomag', total: n + 4, fluent: 1, unsure: 1, practice: 1, lowdata: n + 1 }));
    push(TX.summary({ seen: n, total: n + 10, grouped: 0, counts: { fluent: 0, unsure: 0, practice: 0, lowdata: n + 10 } }));
    push(TX.summary({ seen: n + 3, total: n + 10, grouped: 3, counts: { fluent: 1, unsure: 1, practice: 1, lowdata: n + 7 } }));
  }
  return out;
}

test('kártya: a Haladás szövegeiben helyes a ragozás, nincs ragasztott toldalék (KE-4, KE-11)', () => {
  const all = haladasOutputs().join('\n');
  for (const bad of ['kártyanél', 'kártyaból', 'kártyat', 'kártyaról', 'kártyanál', 'tétel']) assert.ok(!all.includes(bad), bad);
  // általánosan: a „kártya” tő után csak „k” (többes szám) jöhet, a „kártyacsomag” kivételével
  assert.deepEqual([...all.matchAll(/kártya(?!csomag)\p{L}/giu)].map((m) => m[0]).filter((w) => !/k$/i.test(w)), []);
  for (const ok of ['egy-egy kártyánál', 'A hosszabb kártyáknál', 'ennél a kártyánál', 'Egy kártyáról csak akkor',
    'Eddig 12 kártyát olvasott a 22-ből', 'Megy: 5 kártya', 'Még nincs ilyen kártya.', 'Az első kártyák legkorábban',
    'mind a 8 kártya', 'mind az 5 kártya', 'kártyából mindegyikről kevés az adat', 'mint a többi kártyát']) {
    assert.ok(all.includes(ok), ok);
  }
});

test('kártya: a TERM szókészlet (KE-6)', () => {
  assert.deepEqual({ ...TX.TERM }, { nom: 'kártya', acc: 'kártyát', from: 'kártyából', about: 'kártyáról', at: 'kártyánál', pl: 'kártyák', plAt: 'kártyáknál' });
});
