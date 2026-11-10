// A deploy-kalibráló szkript (.github/scripts/calibrate.mjs): görbe kártyaszámonként, tartalék lists.txt,
// hibás konfigurációnál megáll. Ideiglenes fa-másolaton fut, hálózat nélkül (a táblázat címe elérhetetlen).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateConfig } from '../js/core/grid.js';

const ROOT = new URL('..', import.meta.url).pathname;
const SCRIPT = join(ROOT, '.github/scripts/calibrate.mjs');
const env = { ...process.env, CALIBRATE_SHEET_URL: 'http://127.0.0.1:9/nincs.csv' };

function tree() {
  const d = mkdtempSync(join(tmpdir(), 'olvasoka-cal-'));
  for (const p of ['js', 'parok.json', 'lists.txt']) cpSync(join(ROOT, p), join(d, p), { recursive: true });
  return d;
}

test('kalibrálás: kártyaszámonkénti görbe a lists.txt tartalékból; érvényes marad', () => {
  const d = tree();
  try {
    const out = execFileSync(process.execPath, [SCRIPT, d, 'dev'], { env, encoding: 'utf8' });
    assert.match(out, /tartalék: lists\.txt/);
    const cfg = JSON.parse(readFileSync(join(d, 'parok.json'), 'utf8'));
    assert.deepEqual(Object.keys(cfg.racs.csuszka_gorbe), ['4', '6', '8']);
    assert.deepEqual(validateConfig(cfg), []);
    // a repó parok.json-ja nem változik
    assert.ok(Array.isArray(JSON.parse(readFileSync(join(ROOT, 'parok.json'), 'utf8')).racs.csuszka_gorbe));
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('kalibrálás: hibás parok.json → kilépési kód 1 (a deploy megáll)', () => {
  const d = tree();
  try {
    const cfg = JSON.parse(readFileSync(join(d, 'parok.json'), 'utf8'));
    cfg.racs.csuszka_gorbe = [0, 0.9, 0.5, 0.7, 1];
    writeFileSync(join(d, 'parok.json'), JSON.stringify(cfg));
    const r = spawnSync(process.execPath, [SCRIPT, d, 'prod'], { env, encoding: 'utf8' });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /parok\.json hibás/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});

test('kalibrálás: parok.json nélkül (Keresd meg! előtti fa) nem csinál semmit', () => {
  const d = tree();
  try {
    rmSync(join(d, 'parok.json'));
    const r = spawnSync(process.execPath, [SCRIPT, d, 'prod'], { env, encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /kimarad/);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
