// A Haladás nézet küszöbeinek ellenőrzése kiadáskor (docs/haladas-specifikacio.md, 7.1).
//
// Használat: node check-haladas.mjs <a kiadott fa gyökere>
// A <gyökér>/haladas.json-t a fa saját js/core/haladas-config.js-ével ellenőrzi. Hiányzó, nem olvasható
// vagy hibás fájl: a kiadás megáll (kilépési kód 1), a hibák a futás naplójában.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const [root] = process.argv.slice(2);
if (!root) { console.error('Használat: node check-haladas.mjs <gyökér>'); process.exit(2); }

const fail = (msg) => { console.error(`::error::haladas.json (${root}): ${msg}`); process.exit(1); };

let cfg;
try { cfg = JSON.parse(readFileSync(join(root, 'haladas.json'), 'utf8')); }
catch (e) { fail(e.code === 'ENOENT' ? 'hiányzik' : `nem érvényes JSON: ${e.message}`); }

const { validate } = await import(pathToFileURL(join(root, 'js/core/haladas-config.js')).href);
const problems = validate(cfg);
if (problems.length) fail(problems.join('; '));
console.log(`haladas.json (${root}): rendben`);
