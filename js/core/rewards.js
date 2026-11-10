// Melyik jutalomjáték jön (spec 5., 5a.). Tiszta modul.

export const REWARDS = ['lufi', 'panda'];

/**
 * A következő jutalom: véletlenszerű, de kétszer egymás után nem ugyanaz (két játéknál: váltakozik).
 * `force`: a cím `?jutalom=lufi|panda` paramétere (kipróbáláshoz és a tesztekhez); érvénytelen érték nem számít.
 */
export function pickReward(last, rng = Math.random, force = null, games = REWARDS) {
  if (games.includes(force)) return force;
  const pool = games.filter((g) => g !== last);
  const from = pool.length ? pool : games;
  return from[Math.floor(rng() * from.length)];
}
