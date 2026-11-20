// Típusellenőrzés „racsnival” (npm run typecheck): a tsc (tsconfig.json) hibáit fájlonként összeveti a
// typecheck-baseline.json-nal. Elbukik, ha egy fájlban több a hiba, mint a rögzített szám (új hiba került
// be); a régi hibák nem buktatják el. Ha egy fájlban kevesebb lett, az új számot a
// `npm run typecheck -- --update` írja be (így a hibák száma csak csökkenhet).

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');
const BASELINE = join(ROOT, 'typecheck-baseline.json');
const update = process.argv.includes('--update');

const r = spawnSync('npx', ['--no-install', 'tsc', '-p', 'tsconfig.json', '--pretty', 'false'], { cwd: ROOT, encoding: 'utf8' });
if (r.error) throw r.error;
const out = (r.stdout || '') + (r.stderr || '');
const lines = out.split('\n').filter((l) => /error TS\d+/.test(l));
// A fájl nélküli hiba (pl. hibás tsconfig) nem hasonlítható össze: mindig bukás.
const global = lines.filter((l) => !/^[^(]+\(\d+,\d+\)/.test(l));
if (global.length) { console.error(global.join('\n')); process.exit(1); }

const now = {};
for (const l of lines) { const f = l.slice(0, l.indexOf('(')); now[f] = (now[f] || 0) + 1; }
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

if (update) {
  writeFileSync(BASELINE, JSON.stringify(sorted(now), null, 2) + '\n');
  console.log(`typecheck-baseline.json frissítve: ${lines.length} hiba, ${Object.keys(now).length} fájlban.`);
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
const worse = Object.keys(now).filter((f) => now[f] > (base[f] || 0));
const better = Object.keys(base).filter((f) => (now[f] || 0) < base[f]);

if (worse.length) {
  for (const f of worse) {
    console.error(`\n${f}: ${now[f]} hiba (a rögzített: ${base[f] || 0})`);
    console.error(lines.filter((l) => l.startsWith(f + '(')).join('\n'));
  }
  console.error('\nÚj típushiba került be. Javítsd (vagy pontosítsd a JSDoc-megjegyzést).');
  process.exit(1);
}
const total = Object.values(base).reduce((a, b) => a + b, 0);
console.log(`Típusellenőrzés rendben: ${lines.length} rögzített hiba (a baseline-ban: ${total}), új hiba nincs.`);
if (better.length) console.log(`Kevesebb hiba: ${better.join(', ')}. Rögzítsd: npm run typecheck -- --update`);
