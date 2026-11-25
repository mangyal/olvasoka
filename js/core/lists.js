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
// egy (a vessző itt is elválaszt). Az üres cellák nem számítanak. Ha a második sorban igaz/hamis
// érték áll (TRUE/FALSE, IGAZ/HAMIS, pl. jelölőnégyzet), az nem tétel, hanem azt mondja meg, hogy a
// lista első betöltéskor ki legyen-e jelölve (F-L1d).
//
// A tételek tisztítása és a listanevek ellenőrzése mindkét forrásnál ugyanaz (F-L3–F-L5).
// A nagybetű jelölése (`{m}i-ki`, docs/megjelenes-specifikacio.md NB-1–NB-5) itt válik le: a lista
// tétele a zárójelek nélküli alak, a jelölés a lista `marks` térképébe kerül (csak ha van jelölés).
// A listák névsorban (magyar ábécé, számok számként) kerülnek vissza, nem a forrás sorrendjében.

import { cleanItem, maxLenOf, nameKey, art } from './items.js';
import { parseCsv, colName } from './csv.js';
import { parseMarks } from './marks.js';

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
  const lists = [], problems = [];
  const names = new Set();
  let cur = null;

  return {
    lists, problems,
    /** Új lista. A hibás fejlécű lista (üres vagy ismétlődő név) a tételeivel együtt kimarad. */
    header(name, at, emptyMsg) {
      cur = null;
      if (!name) { problems.push(`${at}: ${emptyMsg}`); return; }
      const k = nameKey(name);
      if (names.has(k)) { problems.push(`${at}: a „${name}” csomag már szerepel, a második kimaradt.`); return; }
      names.add(k);
      cur = /** @type {{name:string, items:string[], marks?:Map<string,{start:number,end:number}[]>}} */ ({ name, items: [] });
      lists.push(cur);
    },
    get open() { return cur !== null; },
    /**
     * Egy forrásegység (sor vagy cella) tételei: vessző választja el őket. Az ismétlődő tétel a helyén
     * marad (2.14, S-1): ahányszor szerepel, annyiszor nagyobb eséllyel kerül a Felolvasás körébe.
     */
    items(text, at) {
      if (!cur) return;
      for (const part of text.split(',')) {
        const clean = cleanItem(part);          // M-6: a belső szóközök egyre vonva
        if (!clean) continue;
        const { text: item, marks } = parseMarks(clean);   // NB-5: a zárójelek leválnak
        if (item === null || marks === null) {               // NB-3
          problems.push(`${at}: a „${clean}” jelölése hibás (a kapcsos zárójelbe egy szó első betűje kerülhet, kisbetűvel), kimaradt.`);
          continue;
        }
        if (item.startsWith('#')) {             // F-L5: #-tel kezdődő tétel nem lehet
          problems.push(`${at}: a „${item}” #-tel kezdődik, ezért kimaradt.`);
          continue;
        }
        const len = [...item].length, max = maxLenOf(item);   // M-5: mondatra 40, másra 20
        if (len > max) {
          problems.push(`${at}: a „${item}” túl hosszú (${len}/${max} karakter), kimaradt.`);
          continue;
        }
        cur.items.push(item);
        if (marks.length) {                     // NB-5a: a lista első jelölt előfordulása
          cur.marks ??= new Map();
          if (!cur.marks.has(item)) cur.marks.set(item, marks);
        }
      }
    },
    done(preset = []) {
      lists.sort((a, b) => byName(a.name, b.name));
      return { lists, problems, preset };
    },
  };
}

/**
 * @param {string} text  a lists.txt tartalma
 * @returns {{
 *   lists: {name:string, items:string[], marks?:Map<string,{start:number,end:number}[]>}[],  // items: sorok ismétlésekkel, jelölés nélkül; marks: tételkulcs → nagybetű-jelölés (ha van)
 *   problems: string[],                      // a szülői felületen figyelmeztetésként jelenik meg
 *   preset: string[],                        // az alapból kijelölt listák neve (a lists.txt-ben mindig üres)
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
      b.header(t.replace(/^#+/, '').trim(), lineAt(line), 'a # után hiányzik a csomag neve, a csomag kimaradt.');
      return;
    }
    if (!b.open) { if (!started) orphans.push(line); return; }
    b.items(t, lineAt(line));
  });

  if (orphans.length) {
    const r = orphans.length === 1 ? lineAt(orphans[0]) : `${cap(art(orphans[0]))} ${orphans[0]}–${orphans.at(-1)}. sor`;
    b.problems.unshift(`${r} az első csomag neve előtt áll, ezért kimaradt. Írj elé egy # kezdetű sort a csomag nevével.`);
  }
  if (!b.lists.length) b.problems.push('A lists.txt-ben nincs csomag. Egy csomag egy # kezdetű sorral indul, pl.: # Magánhangzók');
  return b.done();
}

/**
 * A második sor cellája mint jelölő (F-L1d): true / false, ha igaz/hamis érték (kis- és nagybetűtől
 * függetlenül; a Google jelölőnégyzete TRUE/FALSE), különben null, és a cella rendes tétel.
 */
export function presetFlag(cell) {
  const v = String(cell ?? '').trim().toLocaleUpperCase('hu');
  if (v === 'TRUE' || v === 'IGAZ') return true;
  if (v === 'FALSE' || v === 'HAMIS') return false;
  return null;
}

/**
 * A Google táblázat CSV-je: oszloponként egy lista, az első sor a név.
 * A második sorban állhat igaz/hamis jelölő: igaz esetén a lista alapból kijelölt (preset); a jelölő
 * cellája nem tétel. Ha ott bármi más áll, az rendes tétel, és a lista nem alapból kijelölt.
 * A teljesen üres oszlop (név és tétel nélkül) csendben kimarad; név nélküli, de tételes oszlop
 * figyelmeztetéssel. A név elején álló # jel(ek) elhagyhatók, mint a lists.txt-ben.
 * @param {string} csv
 * @returns {{ lists:{name:string, items:string[], marks?:Map<string,{start:number,end:number}[]>}[], problems:string[], preset:string[] }}
 */
export function parseSheetCsv(csv) {
  const rows = parseCsv(csv).map((r) => r.map((c) => c.normalize('NFC').trim()));
  const b = createBuilder();
  const preset = [];
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0);

  for (let c = 0; c < width; c++) {
    const name = (rows[0]?.[c] || '').replace(/^#+/, '').trim();
    const flag = presetFlag(rows[1]?.[c]);
    const cells = [];
    for (let r = flag === null ? 1 : 2; r < rows.length; r++) if (rows[r][c]) cells.push(r);
    if (!name && !cells.length) continue;
    b.header(name, cellAt(c, 0), 'üres, ezért az oszlop kimaradt. Írd be ide a csomag nevét.');
    if (flag && b.open) preset.push(name);
    for (const r of cells) b.items(rows[r][c], cellAt(c, r));
  }

  if (!b.lists.length) b.problems.push('A táblázatban nincs csomag. Az első sorba kerül a csomag neve, alá a tételek, oszloponként.');
  return b.done(preset);
}
