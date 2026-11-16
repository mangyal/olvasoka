// Tételcsoportok (spec 2.14, C-1–C-4): a tétel betűszerkezetéből számolt osztály. Tiszta modul.
//
// A betűket a Keresd meg! tokenize()-a adja (kisbetű, kötőjel nélkül, a többjegyű betű egy betű).
// Csoportok és fix sorrendjük:
//   1 V       magánhangzó (1 betű)
//   2 C       mássalhangzó (1 betű)
//   3 VC      szótag: magánhangzó + mássalhangzó
//   4 CV      szótag: mássalhangzó + magánhangzó
//   5 S:<sz>  egyéb szótag (pontosan 1 magánhangzó); szerkezetenként külön (CVC, CCV …)
//   6 W:<n>   szó (legalább 2 magánhangzó); szótagszámonként külön
// Az 5. csoporton belül a kevesebb betű előbb, azonos hossznál a szerkezet ábécérendje (C < V);
// a 6.-ban növekvő szótagszám. Magánhangzó nélküli többbetűs tétel a listákban nem fordul elő
// (minden szótagban van magánhangzó); ha mégis, egyéb szerkezetként kezeljük, hogy ne dobjon hibát.

import { tokenize, isVowel } from './grid.js';

/** A tétel szerkezete betűnként: C (mássalhangzó) vagy V (magánhangzó), pl. ka-pu → CVCV. */
export const shapeOf = (item) => tokenize(item).map((l) => (isVowel(l) ? 'V' : 'C')).join('');

/**
 * @param {string} item
 * @returns {{ key: string, rank: (number|string)[] }}  rank: a C-2/C-3 szerinti teljes sorrend (compareRank)
 */
export function groupOf(item) {
  const shape = shapeOf(item);
  const vowels = [...shape].filter((c) => c === 'V').length;
  if (shape === 'V') return { key: 'V', rank: [1] };
  if (shape === 'C') return { key: 'C', rank: [2] };
  if (shape === 'VC') return { key: 'VC', rank: [3] };
  if (shape === 'CV') return { key: 'CV', rank: [4] };
  if (vowels >= 2) return { key: `W:${vowels}`, rank: [6, vowels] };
  return { key: `S:${shape}`, rank: [5, shape.length, shape] };
}

/** Két rang összevetése (rendezéshez): negatív, ha a előbb jön. */
export function compareRank(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i], y = b[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
