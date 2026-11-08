// A gyakorlókör állapotgépe (spec 4.2). Tiszta reducer: az órát (`now`) kívülről kapja,
// ezért időzítés, pause és navigáció valódi várakozás nélkül tesztelhető.
//
// Állapot: { seq, flash, gap, index, phase: 'showing'|'gap', paused, deadline, remaining, done, covered }
// flash = 0 → kézi léptetés (a határidő végtelen).
// covered: a látható tétel szótagjainak takarása (core/cover.js); [] = egész látszik (F-P21).

import { toggleCover, stepCover, coversMore } from './cover.js';

function show(s, i, now) {
  return { ...s, index: i, phase: 'showing', paused: false, remaining: 0, covered: [],
    deadline: s.flash > 0 ? now + s.flash : Infinity };
}
function advance(s, now) {
  return s.index < s.seq.length - 1 ? show(s, s.index + 1, now) : { ...s, paused: false, done: true };
}

export function startRound(seq, flash, gap, now) {
  return show({ seq, flash, gap, index: 0, phase: 'showing', paused: false, deadline: 0, remaining: 0, done: false, covered: [] }, 0, now);
}

export const isLast = (s) => s.index >= s.seq.length - 1;
export const canPrev = (s) => s.phase === 'gap' || s.index > 0;
const running = (s) => s.phase === 'showing' && !s.paused && Number.isFinite(s.deadline);
export const remainingMs = (s, now) => (s.paused ? s.remaining : Math.max(0, s.deadline - now));

// F-P18, F-P20: takarás csak a látható tételen; az első letakarás futó idő alatt pause-t ad,
// a felfedés nem folytat. Kézi léptetésnél és pause alatt az idő állapota nem változik.
function cover(s, next, now) {
  if (next === s.covered) return s;
  const t = { ...s, covered: next };
  return running(s) && coversMore(s.covered, next) ? step(t, 'PAUSE', now) : t;
}

/**
 * @param {object} s
 * @param {'TICK'|'SPACE'|'NEXT'|'PREV'|'PAUSE'|'BLUR'|'COVER'|'COVER_DOWN'} ev
 * @param {number} now  performance.now() vagy tesztben tetszőleges szám
 * @param {{ n: number, i?: number }} [arg]  takarásnál: a tétel szótagszáma (n), a szótag indexe (i)
 */
export function step(s, ev, now, arg) {
  if (s.done) return s;
  switch (ev) {
    case 'TICK':
      if (s.paused || now < s.deadline) return s;
      if (s.phase === 'showing' && s.gap > 0) return { ...s, phase: 'gap', covered: [], deadline: now + s.gap };
      return advance(s, now);
    case 'SPACE':                     // F-P3: pause alatt nincs hatása
      return s.paused ? s : advance(s, now);
    case 'NEXT':                      // F-P7: pause alatt is lép és folytat; az utolsón jutalom
      return advance(s, now);
    case 'PREV':                      // F-P6: szünetben a most lejárt tétel, teljes idővel
      if (!canPrev(s)) return s;
      return show(s, s.phase === 'gap' ? s.index : s.index - 1, now);
    case 'PAUSE':                     // F-P5: a hátralévő idő megmarad
      return s.paused
        ? { ...s, paused: false, deadline: now + s.remaining, remaining: 0 }
        : { ...s, paused: true, remaining: Math.max(0, s.deadline - now) };
    case 'BLUR':                      // F-P8: automatikus pause, folytatás a szülőé
      return s.paused ? s : step(s, 'PAUSE', now);
    case 'COVER':                     // F-P18: kattintás/koppintás az i. szótagra
      return s.phase === 'showing' && arg ? cover(s, toggleCover(s.covered, arg.i, arg.n), now) : s;
    case 'COVER_DOWN':                // F-P18: ↓ léptetés
      return s.phase === 'showing' && arg ? cover(s, stepCover(s.covered, arg.n), now) : s;
    default:
      return s;
  }
}
