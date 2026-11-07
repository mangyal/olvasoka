// A gyakorlókör állapotgépe (spec 4.2). Tiszta reducer: az órát (`now`) kívülről kapja,
// ezért időzítés, pause és navigáció valódi várakozás nélkül tesztelhető.
//
// Állapot: { seq, flash, gap, index, phase: 'showing'|'gap', paused, deadline, remaining, done }
// flash = 0 → kézi léptetés (a határidő végtelen).

function show(s, i, now) {
  return { ...s, index: i, phase: 'showing', paused: false, remaining: 0,
    deadline: s.flash > 0 ? now + s.flash : Infinity };
}
function advance(s, now) {
  return s.index < s.seq.length - 1 ? show(s, s.index + 1, now) : { ...s, paused: false, done: true };
}

export function startRound(seq, flash, gap, now) {
  return show({ seq, flash, gap, index: 0, phase: 'showing', paused: false, deadline: 0, remaining: 0, done: false }, 0, now);
}

export const isLast = (s) => s.index >= s.seq.length - 1;
export const canPrev = (s) => s.phase === 'gap' || s.index > 0;
export const remainingMs = (s, now) => (s.paused ? s.remaining : Math.max(0, s.deadline - now));

/**
 * @param {object} s
 * @param {'TICK'|'SPACE'|'NEXT'|'PREV'|'PAUSE'|'BLUR'} ev
 * @param {number} now  performance.now() vagy tesztben tetszőleges szám
 */
export function step(s, ev, now) {
  if (s.done) return s;
  switch (ev) {
    case 'TICK':
      if (s.paused || now < s.deadline) return s;
      if (s.phase === 'showing' && s.gap > 0) return { ...s, phase: 'gap', deadline: now + s.gap };
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
    default:
      return s;
  }
}
