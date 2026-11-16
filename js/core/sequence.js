// A Felolvasás körének összeállítása (spec 4.1, 2.14: F-4–F-11). Tiszta, DOM-mentes modul.
//
// Bemenet: a kijelölt listák sorai (ismétlésekkel), a kért tételszám (N), a „Kevert sorrend” kapcsoló
// és egy rng. Kimenet: sorindexek a kör sorrendjében.
//   1. Húzás (F-4): a sorokból visszatevés nélkül, egyenletes véletlennel; a tétel annyiszor nagyobb
//      eséllyel jön, ahány sora van. Ha a sorok elfogytak, új keverés.
//   2. Szomszédsági szabály (F-5): egy sor csak akkor kerül be, ha a tétele a blokkjában utána is
//      legfeljebb ⌈blokkméret / 2⌉-szer szerepel. Blokk: kikapcsolt kapcsolónál a tétel csoportja
//      (groups.js), bekapcsoltnál az egész kör. A blokk csak nő, így a feltétel később nem sérül.
//   3. Kihagyott sor (F-6): ami nem fér be, félrekerül; minden befogadott sor után előbb a félretettek
//      jönnek újra szóba, aztán a még húzatlanok. Újrakeveréskor a félretett sorok eldobódnak (az új
//      keverésben úgyis benne vannak).
//   4. Kör hossza (F-7): N, kivéve ha egyetlen sor sem fér már be.
//   5. Sorrend (F-8–F-10): blokkok a csoportok fix sorrendjében, blokkon belül véletlen elrendezés
//      szomszédos ismétlés nélkül.

import { itemKey } from './items.js';
import { groupOf, compareRank } from './groups.js';

/** Seedelhető PRNG a determinisztikus tesztekhez. */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0…L-1 indexek Fisher–Yates keveréssel. */
export function shuffledIdx(L, rng = Math.random) {
  const a = Array.from({ length: L }, (_, i) => i);
  for (let i = L - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Egy súlyozott húzás: a weights arányában választott index. */
function pick(weights, rng) {
  let sum = 0;
  for (const w of weights) sum += w;
  let r = rng() * sum;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
}

/**
 * Egy blokk sorainak elrendezése úgy, hogy azonos tétel ne kerüljön egymás mellé (F-10). Mohó véletlen
 * építés: minden lépésben az előzőtől eltérő tételek közül húz a hátralévő darabszám arányában; ha egy
 * tétel hátralévő darabszáma eléri a hátralévő helyek felét (felfelé kerekítve), az jön kötelezően.
 * Feltétel (F-5): egyik tétel sem szerepel ⌈méret / 2⌉-nél többször, ekkor mindig elrendezhető.
 * @param {number[]} idx   a blokk sorindexei
 * @param {string[]} keys  sorindex → tételkulcs
 * @returns {number[]}
 */
export function arrangeBlock(idx, keys, rng = Math.random) {
  const byKey = new Map();
  for (const i of idx) {
    if (!byKey.has(keys[i])) byKey.set(keys[i], []);
    byKey.get(keys[i]).push(i);
  }
  const items = [...byKey.values()];
  const out = [];
  let prev = null;
  for (let left = idx.length; left > 0; left--) {
    const half = Math.ceil(left / 2);
    const open = items.filter((rs) => rs.length && rs !== prev);
    const forced = open.filter((rs) => rs.length >= half);
    const from = forced.length ? forced : open;
    const rs = from[pick(from.map((x) => x.length), rng)];
    out.push(rs.pop());
    prev = rs;
  }
  return out;
}

/**
 * A Felolvasás köre (F-4–F-10).
 * @param {string[]} rows  a kijelölt listák sorai, ismétlésekkel
 * @param {number} N       a kért tételszám
 * @param {{ mixed?: boolean }} [o]  mixed: „Kevert sorrend” (nincs csoportosítás)
 * @param {() => number} [rng]
 * @returns {number[]}  sorindexek a kör sorrendjében; legfeljebb N
 */
export function buildReadSequence(rows, N, { mixed = false } = {}, rng = Math.random) {
  const R = rows.length;
  if (!(R >= 1) || !(N >= 1)) return [];
  const keys = rows.map(itemKey);
  const groups = rows.map((r) => groupOf(r));
  const blockOf = (i) => (mixed ? '' : groups[i].key);

  // blokk → { size, counts: tételkulcs → darab, rows }
  const blocks = new Map();
  const blockAt = (i) => {
    const k = blockOf(i);
    if (!blocks.has(k)) blocks.set(k, { size: 0, counts: new Map(), rows: [], rank: mixed ? [] : groups[i].rank });
    return blocks.get(k);
  };
  const fits = (i) => {
    const b = blocks.get(blockOf(i));
    if (!b) return true;
    return (b.counts.get(keys[i]) || 0) + 1 <= Math.ceil((b.size + 1) / 2);
  };
  let picked = 0;
  const accept = (i) => {
    const b = blockAt(i);
    b.size++; b.counts.set(keys[i], (b.counts.get(keys[i]) || 0) + 1); b.rows.push(i);
    picked++;
  };

  let bag = shuffledIdx(R, rng), pos = 0, aside = [];
  /** F-6: befogadás után a félretett sorok, amíg valamelyik befér. */
  const retryAside = () => {
    for (let k = 0; k < aside.length && picked < N;) {
      if (fits(aside[k])) { accept(aside.splice(k, 1)[0]); k = 0; } else k++;
    }
  };
  while (picked < N) {
    if (pos < bag.length) {
      const i = bag[pos++];
      if (fits(i)) { accept(i); retryAside(); } else aside.push(i);
      continue;
    }
    // F-7: ha egyetlen sor sem fér már be, a kör kész; különben új keverés (a félretettek eldobódnak)
    if (!keys.some((_, i) => fits(i))) break;
    bag = shuffledIdx(R, rng); pos = 0; aside = [];
  }

  const ordered = [...blocks.values()].sort((a, b) => compareRank(a.rank, b.rank));
  return ordered.flatMap((b) => arrangeBlock(b.rows, keys, rng));
}
