// A listák táblázatának címei a GitHub repository variable-ökből (a deploy workflow futtatja).
//
// Használat: node write-sheet-config.mjs <js/core/config.js> [további config.js …]
// Változók (mind opcionális): PROD_SHEET_CSV_URL, PROD_SHEET_EDIT_URL, DEV_SHEET_CSV_URL, DEV_SHEET_EDIT_URL.
// Ami nincs beállítva: az éles a repó alapértékét tartja, a dev az éles (végleges) címét kapja.
// Minden kapott fájl ugyanazt a tartalmat kapja; a környezetet a futó oldal címe választja ki.

import { writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const files = process.argv.slice(2);
if (!files.length) { console.error('Hiányzik a config.js útvonala.'); process.exit(1); }

const { SHEETS: base } = await import(pathToFileURL(files[0]).href);
const env = (k) => (process.env[k] || '').trim();

const pick = (name, fallback, from) => {
  const v = env(name);
  if (!v) return { url: fallback, from };
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(v)) {
    console.error(`::error::${name} nem Google táblázat cím: ${v}`);
    process.exit(1);
  }
  return { url: v, from: `változó (${name})` };
};

const prodCsv = pick('PROD_SHEET_CSV_URL', base.prod.csv, 'repó alapérték');
const prodEdit = pick('PROD_SHEET_EDIT_URL', base.prod.edit, 'repó alapérték');
const devCsv = pick('DEV_SHEET_CSV_URL', prodCsv.url, 'éles cím');
const devEdit = pick('DEV_SHEET_EDIT_URL', prodEdit.url, 'éles cím');

if (/pub\?.*output=csv/.test(prodCsv.url) === false || /pub\?.*output=csv/.test(devCsv.url) === false) {
  console.error('::warning::A CSV cím nem „…/pub?output=csv” alakú; ellenőrizd, hogy a táblázat CSV-ként van-e közzétéve.');
}

const out = { prod: { csv: prodCsv.url, edit: prodEdit.url }, dev: { csv: devCsv.url, edit: devEdit.url } };
const text = `// A deploy workflow generálta a GitHub repository variable-ökből; a repóban lévő változat az alapérték.
export const SHEETS = Object.freeze(${JSON.stringify(out, null, 2)});
`;

for (const f of files) {
  if (!existsSync(f)) { console.log(`kihagyva (nincs ilyen fájl): ${f}`); continue; }
  writeFileSync(f, text);
  console.log(`kész: ${f}`);
}
for (const [k, v] of Object.entries({ 'éles CSV': prodCsv, 'éles szerkesztő': prodEdit, 'dev CSV': devCsv, 'dev szerkesztő': devEdit })) {
  console.log(`${k}: ${v.from}`);
}
