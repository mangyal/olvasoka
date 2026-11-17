// A listák táblázatának címei a GitHub repository variable-ökből (a deploy workflow futtatja).
//
// Használat: node write-sheet-config.mjs <js/core/config.js> [további config.js …]
// Változók (mind opcionális): PROD_SHEET_CSV_URL, PROD_SHEET_EDIT_URL, DEV_SHEET_CSV_URL, DEV_SHEET_EDIT_URL.
// Ami nincs beállítva: az éles a repó alapértékét tartja, a dev az éles (végleges) címét kapja.
// Haladás nézet (docs/haladas-specifikacio.md, 10.): DEV_PROGRESS_SKIP_DAY_RULES, PROD_PROGRESS_SKIP_DAY_RULES
// („true” vagy üres) – a napszámon alapuló szabályok kihagyása teszteléshez. Ha nincs beállítva: kikapcsolva.
// Statisztika (docs/analitika-specifikacio.md): PROD_UMAMI_WEBSITE_ID, DEV_UMAMI_WEBSITE_ID. Ha nincs beállítva:
// az éles a repó alapértékét tartja, a dev nem küld statisztikát (sosem kapja az élesét).
// Minden kapott fájl ugyanazt a tartalmat kapja; a környezetet a futó oldal címe választja ki.

import { writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const files = process.argv.slice(2);
if (!files.length) { console.error('Hiányzik a config.js útvonala.'); process.exit(1); }

const { SHEETS: base, ANALYTICS: baseStats = { prod: { websiteId: '' } } } = await import(pathToFileURL(files[0]).href);
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

const flag = (name) => {
  const v = env(name);
  if (v && v !== 'true') {
    console.error(`::error::${name} értéke csak „true” vagy üres lehet, most: ${v}`);
    process.exit(1);
  }
  return v === 'true';
};
const skip = { prod: flag('PROD_PROGRESS_SKIP_DAY_RULES'), dev: flag('DEV_PROGRESS_SKIP_DAY_RULES') };
if (skip.prod) console.log('::warning::PROD_PROGRESS_SKIP_DAY_RULES=true: az éles Haladás nézet a napszabályok nélkül számol.');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const statsId = (name, fallback, from) => {
  const v = env(name);
  if (!v) return { id: fallback, from };
  if (!UUID.test(v)) {
    console.error(`::error::${name} nem Umami webhely-azonosító (UUID): ${v}`);
    process.exit(1);
  }
  return { id: v, from: `változó (${name})` };
};
const prodStats = statsId('PROD_UMAMI_WEBSITE_ID', baseStats.prod?.websiteId || '', 'repó alapérték');
const devStats = statsId('DEV_UMAMI_WEBSITE_ID', '', 'nincs: a dev nem küld statisztikát');
if (prodStats.id && prodStats.id === devStats.id) {
  console.error('::error::A PROD_UMAMI_WEBSITE_ID és a DEV_UMAMI_WEBSITE_ID nem lehet azonos (a dev az éles statisztikájába írna).');
  process.exit(1);
}

const out = { prod: { csv: prodCsv.url, edit: prodEdit.url }, dev: { csv: devCsv.url, edit: devEdit.url } };
const progress = { prod: { skipDayRules: skip.prod }, dev: { skipDayRules: skip.dev } };
const text = `// A deploy workflow generálta a GitHub repository variable-ökből; a repóban lévő változat az alapérték.
export const SHEETS = Object.freeze(${JSON.stringify(out, null, 2)});

// Haladás nézet: a napszabályok kihagyása környezetenként (teszteléshez).
export const PROGRESS = Object.freeze(${JSON.stringify(progress, null, 2)});

// Anonim használati statisztika (Umami) webhely-azonosítója környezetenként; üres: nincs statisztika.
export const ANALYTICS = Object.freeze(${JSON.stringify({ prod: { websiteId: prodStats.id }, dev: { websiteId: devStats.id } }, null, 2)});
`;

for (const f of files) {
  if (!existsSync(f)) { console.log(`kihagyva (nincs ilyen fájl): ${f}`); continue; }
  writeFileSync(f, text);
  console.log(`kész: ${f}`);
}
for (const [k, v] of Object.entries({ 'éles CSV': prodCsv, 'éles szerkesztő': prodEdit, 'dev CSV': devCsv, 'dev szerkesztő': devEdit })) {
  console.log(`${k}: ${v.from}`);
}
console.log(`statisztika: éles ${prodStats.id || '-'} (${prodStats.from}), dev ${devStats.id || '-'} (${devStats.from})`);
console.log(`napszabályok kihagyása: éles ${skip.prod ? 'BE' : 'ki'}, dev ${skip.dev ? 'BE' : 'ki'}`);
