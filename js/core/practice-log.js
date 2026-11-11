// A Felolvasás kör naplóeseményei a core/round.js reducer átmeneteiből (docs/haladas-specifikacio.md, 5.1).
// Tiszta modul: a reducer érintetlen marad, ez csak összehasonlítja az előtte-utána állapotot.
//
// Eseménytípusok (a nyers napló `type` mezője):
//   show    a tétel megjelent (i: a kör pozíciója)
//   next    továbblépés a látható tételről (auto: true, ha az idő járt le)
//   prev    visszalépés (fromGap: true, ha a tételek közti szünetből jött)
//   pause / resume   a szülő vagy a gyerek megállította / folytatta (P, ▶)
//   blur    az ablak elvesztette a fókuszt, a kör magától megállt; nem segítség
//   cover / uncover  takarás kezdete (nem volt letakart szótag → van) és vége (→ nincs)
//   hidden / visible az oldal nem látszik / újra látszik (a UI rétegből, nem a reducerből)
//   end     a kör végigért (jutalom jön)
//   exit    kilépés a kör közben (Esc, ✕)

import { anyCovered } from './cover.js';

const count = (covered) => covered.filter(Boolean).length;
const isShowing = (s) => !s.done && s.phase === 'showing';

/**
 * Az átmenet naplóeseményei, időrendben.
 * @param {object} a   állapot a lépés előtt
 * @param {string} ev  a reducer eseménye (TICK, SPACE, NEXT, PREV, PAUSE, BLUR, COVER, COVER_DOWN)
 * @param {object} b   állapot a lépés után
 * @returns {{ type: string, i: number, auto?: boolean, fromGap?: boolean, coveredCount?: number }[]}
 */
export function transitionEvents(a, ev, b) {
  if (a === b || a.done) return [];
  const out = [];
  const moved = b.done || b.index !== a.index || b.phase !== a.phase;

  if (ev === 'PAUSE' && !moved && a.paused !== b.paused) out.push({ type: b.paused ? 'pause' : 'resume', i: a.index });
  if (ev === 'BLUR' && !a.paused && b.paused) out.push({ type: 'blur', i: a.index });

  if ((ev === 'COVER' || ev === 'COVER_DOWN') && a.covered !== b.covered) {
    const was = anyCovered(a.covered), is = anyCovered(b.covered);
    if (!was && is) out.push({ type: 'cover', i: a.index, coveredCount: count(b.covered) });
    if (was && !is) out.push({ type: 'uncover', i: a.index, coveredCount: 0 });
  }

  if (!moved) return out;
  if (isShowing(a)) {
    if (ev === 'PREV') out.push({ type: 'prev', i: a.index });
    else out.push({ type: 'next', i: a.index, auto: ev === 'TICK' });
  } else if (ev === 'PREV') {
    out.push({ type: 'prev', i: a.index, fromGap: true });
  }
  if (isShowing(b)) out.push({ type: 'show', i: b.index });
  if (b.done) out.push({ type: 'end', i: a.index });
  return out;
}
