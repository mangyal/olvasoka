// A listák értelmezése két forrásból: a repó lists.txt-je és a Google táblázat CSV-je.
// Tiszta modul: hibás részeknél nem dob, hanem kihagy és jelez (F-L7).
//
// lists.txt:
//   # Lista neve
//   tétel
//   tétel
//
//   # Másik lista
//   tétel
//
// Egy sor egy tétel (a vessző is elválaszt). Az üres sorok nem számítanak.
//
// Táblázat: minden oszlop egy lista, az első sor a lista neve, alatta a tételek, cellánként
// egy (a vessző itt is elválaszt). Az üres cellák nem számítanak.
//
// A tételek tisztítása és a listanevek ellenőrzése mindkét forrásnál ugyanaz (F-L3–F-L5).
// A listák névsorban (magyar ábécé, számok számként) kerülnek vissza, nem a forrás sorrendjében.

import { MAXLEN, nameKey, art } from './items.js';
import { parseCsv, colName } from './csv.js';

// Magyar ábécérend, a számokat számként kezeli (2. < 10. oldal).
const byName = new Intl.Collator('hu', { numeric: true, sensitivity: 'base' }).compare;

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const lineAt = (line) => `${cap(art(line))} ${line}. sor`;
const cellAt = (col, row) => `A táblázat ${colName(col)}${row + 1} cellája`;

/**
 * Közös listaépítő: fejléc → tételek, a forrástól független szabályokkal.
 * `at` mindig egy emberi helymegjelölés („Az 5. sor”, „A táblázat B3 cellája”).
 */
function createBuilder() {
  const lists = [], problems = [], duplicates = [];
  const names = new Set();
  let cur = null, seen = new Set();

  return {
    lists, problems, duplicates,
    /** Új lista. A hibás fejlécű lista (üres vagy ismétlődő név) a tételeivel együtt kimarad. */
    header(name, at, emptyMsg) {
      cur = null; seen = new Set();
      if (!name) { problems.push(`${at}: ${emptyMsg}`); return; }
      const k = nameKey(name);
      if (names.has(k)) { problems.push(`${at}: a „${name}” lista már szerepel, a második kimaradt.`); return; }
      names.add(k);
      cur = { name, items: [] };
      lists.push(cur);
    },
    get open() { return cur !== null; },
    /** Egy forrásegység (sor vagy cella) tételei: vessző választja el őket. */
    items(text, at, loc) {
      if (!cur) return;
      for (const part of text.split(',')) {
        const item = part.trim();
        if (!item) continue;
        if (item.startsWith('#')) {             // F-L5: #-tel kezdődő tétel nem lehet
          problems.push(`${at}: a „${item}” #-tel kezdődik, ezért kimaradt.`);
          continue;
        }
        if (seen.has(item)) { duplicates.push({ list: cur.name, item, ...loc }); continue; }
        seen.add(item);
        const len = [...item].length;
        if (len > MAXLEN) {
          problems.push(`${at}: a „${item}” túl hosszú (${len}/${MAXLEN} karakter), kimaradt.`);
          continue;
        }
        cur.items.push(item);
      }
    },
    done() {
      lists.sort((a, b) => byName(a.name, b.name));
      return { lists, problems, duplicates };
    },
  };
}

/**
 * @param {string} text  a lists.txt tartalma
 * @returns {{
 *   lists: {name:string, items:string[]}[],
 *   problems: string[],                                   // a szülői felületen figyelmeztetésként jelenik meg
 *   duplicates: {list:string, item:string, line:number}[] // csak a teszt jelzi, az app csendben kihagyja
 * }}
 */
export function parseListsText(text) {
  const b = createBuilder();
  const orphans = [];
  let started = false;   // volt már fejléc (a hibás fejléc utáni sorok nem árvák, csak kimaradnak)

  String(text).replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    const t = raw.normalize('NFC').trim();
    if (!t) return;
    if (t.startsWith('#')) {
      started = true;
      b.header(t.replace(/^#+/, '').trim(), lineAt(line), 'a # után hiányzik a lista neve, a lista kimaradt.');
      return;
    }
    if (!b.open) { if (!started) orphans.push(line); return; }
    b.items(t, lineAt(line), { line });
  });

  if (orphans.length) {
    const r = orphans.length === 1 ? lineAt(orphans[0]) : `${cap(art(orphans[0]))} ${orphans[0]}–${orphans.at(-1)}. sor`;
    b.problems.unshift(`${r} az első lista neve előtt áll, ezért kimaradt. Írj elé egy # kezdetű sort a lista nevével.`);
  }
  if (!b.lists.length) b.problems.push('A lists.txt-ben nincs lista. Egy lista egy # kezdetű sorral indul, pl.: # Magánhangzók');
  return b.done();
}

/**
 * A Google táblázat CSV-je: oszloponként egy lista, az első sor a név.
 * A teljesen üres oszlop (név és tétel nélkül) csendben kimarad; név nélküli, de tételes oszlop
 * figyelmeztetéssel. A név elején álló # jel(ek) elhagyhatók, mint a lists.txt-ben.
 * @param {string} csv
 * @returns {{ lists:{name:string, items:string[]}[], problems:string[], duplicates:{list:string,item:string,cell:string}[] }}
 */
export function parseSheetCsv(csv) {
  const rows = parseCsv(csv).map((r) => r.map((c) => c.normalize('NFC').trim()));
  const b = createBuilder();
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);

  for (let c = 0; c < width; c++) {
    const name = (rows[0]?.[c] || '').replace(/^#+/, '').trim();
    const cells = [];
    for (let r = 1; r < rows.length; r++) if (rows[r][c]) cells.push(r);
    if (!name && !cells.length) continue;
    b.header(name, cellAt(c, 0), 'üres, ezért az oszlop kimaradt. Írd be ide a lista nevét.');
    for (const r of cells) b.items(rows[r][c], cellAt(c, r), { cell: `${colName(c)}${r + 1}` });
  }

  if (!b.lists.length) b.problems.push('A táblázatban nincs lista. Az első sorba kerül a lista neve, alá a tételek, oszloponként.');
  return b.done();
}
