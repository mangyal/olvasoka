// A gyakorlókör állapotgépe (spec 4.2). Tiszta reducer: az órát (`now`) kívülről kapja,
// ezért időzítés, pause és navigáció valódi várakozás nélkül tesztelhető.
//
// Állapot: { seq, flash, gap, index, phase: 'showing'|'gap', paused, deadline, remaining, done, covered }
// flash = 0 → kézi léptetés (a határidő végtelen).
// covered: a látható tétel szótagjainak takarása (core/cover.js); [] = egész látszik (F-P21).
// left: a kézzel (Space, →) elhagyott tétel pillanatképe a visszavonás-barát visszalépéshez
// (docs/haladas-specifikacio.md, 5.3); undoMs: ennyi ideig érvényes.

import { toggleCover, stepCover, coversMore } from './cover.js';

function show(s, i, now) {
  return { ...s, index: i, phase: 'showing', paused: false, remaining: 0, covered: [], left: null,
    deadline: s.flash > 0 ? now + s.flash : Infinity };
}

/** A látható tétel állapota elhagyáskor: takarás, megállítás, hátralévő idő. */
const snapshot = (s, now) => ({
  index: s.index, covered: s.covered, paused: s.paused, at: now,
  remaining: s.paused ? s.remaining : Number.isFinite(s.deadline) ? Math.max(0, s.deadline - now) : 0,
});

/** Kézi továbblépés a látható tételről: a pillanatkép megmarad a gyors visszalépéshez. */
function leaveByHand(s, now) {
  const t = advance(s, now);
  return t.done || s.phase !== 'showing' ? t : { ...t, left: snapshot(s, now) };
}

/** 5.3: a gyors visszalépés pontosan úgy hozza vissza a tételt, ahogy elhagyta. */
function canUndo(s, now) {
  const l = s.left;
  return Boolean(l) && s.phase === 'showing' && l.index === s.index - 1 && now - l.at <= s.undoMs;
}
function undo(s, now) {
  const l = s.left;
  return { ...s, index: l.index, phase: 'showing', covered: l.covered, paused: l.paused, left: null,
    remaining: l.paused ? l.remaining : 0,
    deadline: s.flash > 0 ? now + l.remaining : Infinity };
}
function advance(s, now) {
  return s.index < s.seq.length - 1 ? show(s, s.index + 1, now) : { ...s, paused: false, done: true };
}

/** @param {{ undoMs?: number }} [opt]  undoMs: a visszavonás-barát visszalépés ablaka (haladas.json) */
export function startRound(seq, flash, gap, now, { undoMs = 2000 } = {}) {
  return show({ seq, flash, gap, undoMs, index: 0, phase: 'showing', paused: false, deadline: 0, remaining: 0, done: false, covered: [], left: null }, 0, now);
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
      if (s.phase === 'showing' && s.gap > 0) return { ...s, phase: 'gap', covered: [], left: null, deadline: now + s.gap };
      return advance(s, now);
    case 'SPACE':                     // F-P3: pause alatt nincs hatása
      return s.paused ? s : leaveByHand(s, now);
    case 'NEXT':                      // F-P7: pause alatt is lép és folytat; az utolsón jutalom
      return leaveByHand(s, now);
    case 'PREV':                      // F-P6: szünetben a most lejárt tétel, teljes idővel
      if (!canPrev(s)) return s;
      if (canUndo(s, now)) return undo(s, now);
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
