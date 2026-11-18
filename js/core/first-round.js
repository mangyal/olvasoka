// Idő az első körig: a `first-round` statisztikai esemény (docs/kartyacsomagok-specifikacio.md, 7.).
// Tiszta modul: a tárolást és a küldést a main.js végzi.
//
// Két helyi jelző egy kulcsban (`<storageKey>_elsokor`): `seen` az első oldalbetöltés ideje, `sent` hogy az
// esemény már elment (vagy régi felhasználónál küldés nélkül lezárult). Tárolás nélkül nincs esemény,
// különben minden betöltés elsőnek számítana.

/** A jelzők kulcsa, a meglévő elnevezési rend szerint (pl. 'olvasoka_elsokor', devben 'olvasoka-dev_elsokor'). */
export const firstRoundKey = (storageKey) => `${storageKey}_elsokor`;

/** Tárolt jelzők: { seen: number, sent: boolean } vagy null. */
export function normalizeFirstRound(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || !Number.isFinite(o.seen)) return null;
  return { seen: o.seen, sent: o.sent === true };
}

/**
 * Az oldal betöltésekor.
 * @param {{ stored: unknown, legacy: boolean, storageOK: boolean, now: number }} o
 *   stored: a tárolt jelzők; legacy: a készüléken már van Olvasóka adat (beállítás, haladás), és jelzők még nincsenek
 * @returns {{ save: object|null, firstVisit: boolean, pending: boolean }}
 *   save: a mentendő jelzők (null: nincs mit menteni); firstVisit: ez az első oldalbetöltés a készüléken;
 *   pending: az első kör még elküldendő
 */
export function initFirstRound({ stored, legacy, storageOK, now }) {
  if (!storageOK) return { save: null, firstVisit: false, pending: false };
  const s = normalizeFirstRound(stored);
  if (s) return { save: null, firstVisit: false, pending: !s.sent };
  // régi felhasználó: az esemény küldés nélkül lezárul (tőle nem kérünk első kört)
  return { save: { seen: now, sent: legacy }, firstVisit: !legacy, pending: !legacy };
}

/**
 * Az esemény adatai. Tétel, csomagnév és haladás nincs benne.
 * @param {{ ms: number, firstVisit: boolean, welcome: 'tour'|'skip'|'none', tour: 'done'|'skipped'|'none', game: 'read'|'find' }} o
 *   ms: az oldal betöltésétől (performance.now()) az Indításig
 */
export function firstRoundData({ ms, firstVisit, welcome, tour, game }) {
  return { sec: Math.max(0, Math.round(ms / 1000)), firstVisit: firstVisit === true, welcome, tour, game };
}
