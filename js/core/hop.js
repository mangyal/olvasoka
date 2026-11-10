// A panda-ugrálás jutalomjáték pályája és mozgása (spec 5a.). Tiszta modul, a DOM-ról nem tud.
//
// A pálya egy lánc: a 0. bambuszpad a kiinduló, az utolsó a cél. Minden pad egy „emelettel” (S)
// feljebb van az előzőnél, és vagy jól láthatóan balra/jobbra (≥ 1,2 panda), vagy majdnem pontosan
// fölötte (≤ 0,3 panda). Így a három nyíl közül mindig egyértelmű, melyik a jó.
//
// Segített ugrás: ha a lenyomott irányban ott a következő pad, a panda pontosan a közepére érkezik.
// A ↑ soha nem veszélyes: ha nincs fölötte pad, helyben ugrik egyet. Rossz oldalra ugorva a panda
// egy szokásos ívet ír le, és ha nem esik lejjebb lévő padra, leesik: vége a játéknak.
// A koordináták „világ”-koordináták px-ben, y lefelé nő; a kamera csak eltolja őket.

export const LEVELS = [7, 9];          // ennyi ugrás a célig
export const SIDE_MIN = 1.2, SIDE_MAX = 2.2;   // oldalugrás vízszintes távolsága, panda-méretben
export const UP_MAX = 0.3;             // „fölötte” eltérés, panda-méretben
const P_UP = 0.2;                      // ekkora eséllyel jön egyenesen fölötte pad
const JUMP_T = 0.32;                   // mp: ennyi idő alatt ér a csúcsra

/**
 * Méretek a képernyőhöz.
 * P: a panda szélessége; S: egy emelet; w, h: a pad mérete; m: oldalsó margó (a pad közepéig);
 * top: a cél legalább ennyire legyen a képernyő tetejétől; bottom: a kiinduló pad teteje.
 */
export function geometry({ W, H }) {
  const P = Math.round(Math.min(110, Math.max(56, Math.min(W, H) * 0.13)));
  const S = Math.round(Math.min(P * 2, Math.max(P * 1.5, H * 0.21)));
  const w = Math.round(P * 1.6), h = Math.round(P * 0.3);
  return { W, H, P, S, w, h, m: w / 2 + 12, top: Math.max(96, P * 1.6), bottom: H - Math.max(40, H * 0.1) };
}

/**
 * Véletlen pálya. A padok vízszintes helye a margók közti sáv arányában (fx: 0…1), hogy
 * elforgatás után is a képernyőn maradjon; a távolságok a megadott méretekkel teljesülnek.
 * @returns {{fx:number}[]} n+1 pad: a 0. a kiinduló, az n. a cél
 */
export function makeCourse(g, rng = Math.random, n = LEVELS[0] + Math.floor(rng() * (LEVELS[1] - LEVELS[0] + 1))) {
  const span = Math.max(1, g.W - 2 * g.m);
  const P = g.P;
  const xs = [g.m + span * (0.3 + rng() * 0.4)];
  let last = 0;
  for (let k = 1; k <= n; k++) {
    const x0 = xs[k - 1];
    let dir = rng() < P_UP ? 0 : rng() < 0.5 ? -1 : 1;
    if (dir && dir === last && rng() < 0.5) dir = -dir;           // inkább cikcakk
    let x;
    if (dir === 0) x = x0 + (rng() * 2 - 1) * UP_MAX * P;
    else {
      const d = (SIDE_MIN + rng() * (SIDE_MAX - SIDE_MIN)) * P;
      x = x0 + dir * d;
      if (x < g.m || x > g.W - g.m) {                              // kilógna: a másik oldalra
        x = x0 - dir * d;
        if (x < g.m || x > g.W - g.m) { dir = 0; x = x0 + (rng() * 2 - 1) * UP_MAX * P; }
        else dir = -dir;
      }
    }
    x = Math.min(g.W - g.m, Math.max(g.m, x));
    xs.push(x); last = dir;
  }
  return xs.map((x) => ({ fx: (x - g.m) / span }));
}

/** A pálya padjai világ-koordinátában: x a közép, y a pad teteje. */
export function placeCourse(course, g) {
  const span = Math.max(1, g.W - 2 * g.m);
  return course.map((c, k) => ({ x: g.m + c.fx * span, y: g.bottom - k * g.S, w: g.w }));
}

/** Melyik nyíl visz a következő padra: −1 bal, 0 fel, +1 jobb. */
export function needDir(x, target, P) {
  const dx = target.x - x;
  return dx < -0.6 * P ? -1 : dx > 0.6 * P ? 1 : 0;
}

/** Gravitáció a mérethez: a csúcs ~JUMP_T mp alatt. */
const gravity = (g) => (2 * 1.45 * g.S) / (JUMP_T * JUMP_T);

/**
 * Egy ugrás kezdőállapota.
 * from: a pad, amin áll; next: a lánc következő padja (vagy null a célon); dir: a lenyomott irány.
 * Ha a lenyomott irány a következő pad felé mutat, oda; ↑-ra, ha nincs fölötte pad, helyben;
 * egyébként rossz irány: szokásos ív egy emelettel feljebb, `dir`-irányban (és onnan esés).
 * @returns {{x:number, y:number, vx:number, vy:number, g:number, to:object|null}}
 */
export function jump(from, next, dir, g) {
  const G = gravity(g);
  let to = null;
  if (next && needDir(from.x, next, g.P) === dir) to = next;
  else if (dir === 0) to = from;
  const rise = to ? from.y - to.y : g.S;                          // ennyivel feljebb ér földet
  const apex = rise + (rise > 0 ? 0.45 : 0.6) * g.S;
  const vy = -Math.sqrt(2 * G * apex);
  const t = (-vy + Math.sqrt(vy * vy - 2 * G * rise)) / G;       // leszálló ágon éri el a magasságot
  const dx = to ? to.x - from.x : dir * ((SIDE_MIN + SIDE_MAX) / 2) * g.P;
  return { x: from.x, y: from.y, vx: dx / t, vy, g: G, to };
}

/** Egy lépés dt másodperccel; új állapotot ad. */
export function stepJump(j, dt) {
  const vy = j.vy + j.g * dt;
  return { ...j, x: j.x + j.vx * dt, y: j.y + (j.vy + vy) / 2 * dt, vy };
}

/**
 * Földet ért-e a lépésben (a talp a `prev.y`→`next.y` úton átlépte egy pad tetejét lefelé menet).
 * @returns {number} a pad indexe, vagy −1
 */
export function landing(prev, next, pads, g) {
  if (next.vy <= 0) return -1;
  const tol = g.P * 0.15;
  let best = -1;
  pads.forEach((p, i) => {
    if (prev.y <= p.y + 0.5 && next.y >= p.y && Math.abs(next.x - p.x) <= p.w / 2 + tol) {
      if (best < 0 || p.y < pads[best].y) best = i;                // ha egyszerre több, a felső
    }
  });
  return best;
}

/**
 * Kamera: mennyivel tolódik fel a világ (≤ 0). Az álló panda a képernyő ~70%-ánál van,
 * a cél sosem kerül a `top` margó alá, és a kiinduló pad alatt sincs üres rész.
 */
export function cameraFor(standY, goalY, g) {
  return Math.min(0, Math.max(goalY - g.top, standY - g.H * 0.7));
}

/** Kiesett-e a képből (a kamera alsó széle alá). */
export const fellOut = (j, camY, g) => j.y - camY > g.H + g.P * 1.5;
