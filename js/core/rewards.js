// A jutalomjátékok (spec 5., 5a., F-R14). Tiszta modul.
// A gyerek a kör végén maga választ (core/choose.js); véletlen sorsolás nincs.

export const REWARDS = ['lufi', 'panda'];

/**
 * A cím `?jutalom=lufi|panda` paramétere (kipróbáláshoz és a tesztekhez): rögzíti a játékot, és a
 * választó kimarad. Érvénytelen vagy hiányzó érték: null, azaz a gyerek választ.
 */
export function forcedReward(value, games = REWARDS) {
  return games.includes(value) ? value : null;
}
