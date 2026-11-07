// Sorozat-generátor (spec 4.1, „húzózsák”). Tiszta, DOM-mentes modul.

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

/**
 * L indexből N hosszú sorozat. Minden keverésen belül minden index pontosan egyszer szerepel;
 * a keverések határán nem lehet két azonos index egymás után (ha L > 1).
 */
export function buildSequence(L, N, rng = Math.random) {
  if (!(L >= 1) || !(N >= 1)) return [];
  const seq = [];
  let prevLast = -1;
  while (seq.length < N) {
    const s = shuffledIdx(L, rng);
    if (L > 1 && prevLast >= 0 && s[0] === prevLast) {
      const j = 1 + Math.floor(rng() * (L - 1));
      [s[0], s[j]] = [s[j], s[0]];
    }
    const k = Math.min(L, N - seq.length);
    for (let i = 0; i < k; i++) seq.push(s[i]);
    prevLast = s[L - 1];
  }
  return seq;
}
