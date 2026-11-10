// Keresd meg!: a nehézségi görbe kalibrálása kiadáskor (docs/keresd-meg-heurisztika.md, Kalibrálás deploy-kor).
//
// Használat: node calibrate.mjs <a kiadott fa gyökere> <prod|dev>
//
// - Ellenőrzi a <gyökér>/parok.json-t; hibás konfigurációval a deploy megáll (kilépési kód 1).
// - A teljes listát a környezet Google táblázatából veszi (a write-sheet-config.mjs után fut, így a
//   <gyökér>/js/core/config.js már a repository variable-ök címét tartalmazza). Ha a táblázat nem érhető el
//   vagy nincs benne lista, a <gyökér>/lists.txt a tartalék, figyelmeztetéssel; a deploy nem áll meg.
// - Kártyaszámonként (4, 6, 8) kiszámolja a görbét, és a <gyökér>/parok.json racs.csuszka_gorbe kulcsába írja.
//   Csak a kiadott példány változik, a repó nem.
// - Ha a fában nincs parok.json (pl. az éles még a Keresd meg! előtti), nem csinál semmit.
//
// Teszthez: CALIBRATE_SHEET_URL felülírja a táblázat címét.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [root, env = 'prod'] = process.argv.slice(2);
if (!root || !['prod', 'dev'].includes(env)) {
  console.error('Használat: node calibrate.mjs <gyökér> <prod|dev>');
  process.exit(2);
}
const file = join(root, 'parok.json');
if (!existsSync(file)) {
  console.log(`${env}: nincs parok.json, a kalibrálás kimarad.`);
  process.exit(0);
}

const mod = (p) => import(pathToFileURL(join(root, p)).href);
const { validateConfig, compileConfig, createPool, calibrateCurve } = await mod('js/core/grid.js');
const { parseSheetCsv, parseListsText } = await mod('js/core/lists.js');
const { SHEETS } = await mod('js/core/config.js');

const fail = (msg) => { console.error(`::error::${env}: ${msg}`); process.exit(1); };

let cfg;
try { cfg = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { fail(`a parok.json nem olvasható: ${e.message}`); }
const problems = validateConfig(cfg);
if (problems.length) fail(`a parok.json hibás:\n- ${problems.join('\n- ')}`);

/** A teljes lista a táblázatból, tartalékként a lists.txt-ből. */
async function loadItems() {
  const url = process.env.CALIBRATE_SHEET_URL || SHEETS[env].csv;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (/html/i.test(res.headers.get('content-type') || '') || /^\s*</.test(text)) throw new Error('nem CSV-t adott vissza');
    const { lists } = parseSheetCsv(text);
    if (!lists.length) throw new Error('nincs benne lista');
    return { lists, from: 'táblázat' };
  } catch (e) {
    console.log(`::warning::${env}: a táblázat nem használható a kalibráláshoz (${e.message}); tartalék: lists.txt`);
    const { lists } = parseListsText(readFileSync(join(root, 'lists.txt'), 'utf8'));
    return { lists, from: 'lists.txt' };
  }
}

const { lists, from } = await loadItems();
const items = [...new Set(lists.flatMap((l) => l.items))];
const cc = compileConfig(cfg);
const pool = createPool(items, cc);
if (pool.entries.length < 2) fail(`a kalibráláshoz legalább két különböző tétel kell (${from}: ${pool.entries.length})`);

const curve = {};
for (const n of [4, 6, 8]) {
  curve[n] = calibrateCurve(pool, n);
  console.log(`${env}: N = ${n}: ${curve[n].join(' · ')}`);
}
cfg.racs.csuszka_gorbe = curve;
const after = validateConfig(cfg);
if (after.length) fail(`a kalibrált görbe hibás:\n- ${after.join('\n- ')}`);
writeFileSync(file, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(`${env}: kalibrálva ${from} alapján (${pool.entries.length} egyedi tétel).`);
