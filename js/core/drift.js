// A jutalom lufijainak mozgása (spec F-R8–F-R11). Tiszta modul, a DOM-ról nem tud.
//
// Egyszerű, ütközés nélküli modell: a lufi sebessége a felhajtóerő és a szél által
// diktált „célsebesség” felé közelít (légellenállás), ehhez jön egy kis lengés.
// A szél a hőlégfúvótól távolodva gyengül.

export const RISE_S = [8, 12];       // ennyi mp alatt ér fel alulról a tetejére
export const DRIFT = [20, 40];       // oldalirányú sodródás, px/s (átlagos szélben)
const DRAG = 1.6;                    // 1/s: milyen gyorsan veszi fel a célsebességet

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Egy lufi kiinduló adatai.
 * Mindig a képernyő alja alól indul: az első beúszáskor és amikor kiment (F-R10).
 * @param {{W:number, H:number, bw:number, bh:number, rng?:()=>number}} o
 */
export function launch({ W, H, bw, bh, rng = Math.random }) {
  const m = bw / 2 + 8;
  const rise = H / lerp(RISE_S[0], RISE_S[1], rng()); // px/s
  return {
    x: m + rng() * Math.max(0, W - 2 * m),          // középpont
    y: H + bh / 2 + rng() * H * 0.15,               // a képernyő alja alatt
    vx: 0, vy: -rise,                               // már emelkedve jön be
    rise,
    drift: lerp(DRIFT[0], DRIFT[1], rng()),         // px/s
    phase: rng() * Math.PI * 2,
    sway: 6 + rng() * 8,                            // lengés, px/s
  };
}

/**
 * A szél erőssége a fúvótól mért távolság szerint: a fúvó mellett ~1,4×, a túloldalon ~0,7×
 * az átlagos sodródásnak. dir: +1 jobbra fúj (fúvó bal oldalt), −1 balra (fúvó jobb oldalt).
 */
export function windAt(x, y, { W, H, dir, blowerY }) {
  const fromBlower = dir > 0 ? x : W - x;           // vízszintes távolság a fúvótól
  const dy = Math.abs(y - blowerY) / H;
  const near = Math.exp(-fromBlower / (0.45 * W)) * Math.exp(-dy * 1.5);
  return dir * (0.7 + 0.9 * near);
}

/** Egy lépés dt másodperccel, t: eltelt idő mp-ben. Új állapotot ad, a régit nem módosítja. */
export function stepBalloon(b, dt, t, env) {
  const tx = b.drift * windAt(b.x, b.y, env) + b.sway * Math.sin(t * 0.9 + b.phase);
  const ty = -b.rise;
  const k = 1 - Math.exp(-DRAG * dt);
  const vx = b.vx + (tx - b.vx) * k, vy = b.vy + (ty - b.vy) * k;
  return { ...b, vx, vy, x: b.x + vx * dt, y: b.y + vy * dt };
}

/** Kiment-e a képernyőről (felül, vagy a szél kifújta oldalt). Ilyenkor alul visszajön (F-R10). */
export function isOut(b, { W, bw, bh }) {
  return b.y < -bh * 1.2 || b.x < -bw || b.x > W + bw;
}
