// A lists.txt értelmezése. Tiszta modul: hibás részeknél nem dob, hanem kihagy és jelez.
//
// Formátum:
//   # Lista neve
//   tétel
//   tétel
//
//   # Másik lista
//   tétel
//
// Egy sor egy tétel (a vessző is elválaszt). Az üres sorok nem számítanak.

import { MAXLEN, nameKey, art } from './items.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const where = (line) => `${cap(art(line))} ${line}. sor`;

/**
 * @param {string} text  a lists.txt tartalma
 * @returns {{
 *   lists: {name:string, items:string[]}[],
 *   problems: string[],                              // a szülői felületen figyelmeztetésként jelenik meg
 *   duplicates: {list:string, item:string, line:number}[] // csak a teszt jelzi, az app csendben kihagyja
 * }}
 */
export function parseListsText(text) {
  const lists = [], problems = [], duplicates = [];
  const names = new Set();
  const orphans = [];
  let cur = null;        // az éppen töltött lista (null: még nincs fejléc, vagy kihagyott lista)
  let skipping = false;  // a fejléce hibás volt, a tételeit eldobjuk
  let seen = new Set();

  String(text).replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const t = raw.normalize('NFC').trim();
    if (!t) return;

    if (t.startsWith('#')) {
      const name = t.replace(/^#+/, '').trim();
      cur = null; skipping = true; seen = new Set();
      if (!name) { problems.push(`${where(line)}: a # után hiányzik a lista neve, a lista kimaradt.`); return; }
      const k = nameKey(name);
      if (names.has(k)) { problems.push(`${where(line)}: a „${name}” lista már szerepel, a második kimaradt.`); return; }
      names.add(k);
      cur = { name, items: [] }; skipping = false;
      lists.push(cur);
      return;
    }

    if (!cur) { if (!skipping) orphans.push(line); return; }

    for (const part of t.split(',')) {
      const item = part.trim();
      if (!item) continue;
      if (seen.has(item)) { duplicates.push({ list: cur.name, item, line }); continue; }
      seen.add(item);
      const len = [...item].length;
      if (len > MAXLEN) {
        problems.push(`${where(line)}: a „${item}” túl hosszú (${len}/${MAXLEN} karakter), kimaradt.`);
        continue;
      }
      cur.items.push(item);
    }
  });

  if (orphans.length) {
    const r = orphans.length === 1 ? `${where(orphans[0])}` : `${cap(art(orphans[0]))} ${orphans[0]}–${orphans.at(-1)}. sor`;
    problems.unshift(`${r} az első lista neve előtt áll, ezért kimaradt. Írj elé egy # kezdetű sort a lista nevével.`);
  }
  if (!lists.length) problems.push('A lists.txt-ben nincs lista. Egy lista egy # kezdetű sorral indul, pl.: # Magánhangzók');
  return { lists, problems, duplicates };
}
