// Haladás: kitalált, de a valós formátumú napló a böngészős tesztekhez (e2e/layout.mjs, e2e/app.mjs).
// A napi összesítők a mai naphoz képest készülnek, így a tesztek bármelyik napon ugyanazt mutatják.

/** k nappal ezelőtti helyi nap (YYYY-MM-DD). */
export function ago(k, now = Date.now()) {
  const d = new Date(now);
  d.setDate(d.getDate() - k);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function rec(item, day, help, dwell = []) {
  const sup = [...help].filter((c) => c === '1').length;
  return {
    id: `r-seed|default|${item}|${day}`, child: 'default', item, day,
    exposures: help.length, manualExposures: dwell.length, dwellMs: dwell, medianDwellMs: null,
    covers: sup, pauses: 0, prevs: 0, supportedExposures: sup, unsupportedFastFlash: 0, help,
  };
}

/** Már megy: 3 nap, gyorsuló, segítség nélkül. */
const fluent = (item, now) => [rec(item, ago(6, now), '0', [3000]), rec(item, ago(4, now), '0', [3000]), rec(item, ago(2, now), '0', [3000]),
  rec(item, ago(1, now), '00', [1500, 1500]), rec(item, ago(0, now), '0', [1500])];
/** Egyre jobban megy: kezdetben segítséggel, mostanra kevesebbel. */
const improving = (item, now) => [rec(item, ago(5, now), '111'), rec(item, ago(3, now), '1'), rec(item, ago(1, now), '100')];
/** Gyakoroljuk még: 18 napja, szinte mindig segítséggel, nem gyorsult. */
const practice = (item, now) => [18, 14, 11, 8, 5, 2, 0].map((k) => rec(item, ago(k, now), '1', [4000]));

/**
 * Tárolt Haladás-gyökér.
 * @param {{ fluent?: string[], improving?: string[], practice?: string[], seenOnce?: string[], days?: number }} o
 *   days: ha meg van adva, csak ennyi különböző napon volt gyakorlás (üres állapothoz)
 */
export function seedRoot(o, now = Date.now()) {
  let daily = [
    ...(o.fluent || []).flatMap((x) => fluent(x, now)),
    ...(o.improving || []).flatMap((x) => improving(x, now)),
    ...(o.practice || []).flatMap((x) => practice(x, now)),
    ...(o.seenOnce || []).map((x) => rec(x, ago(0, now), '0')),
  ];
  if (o.days != null) daily = daily.filter((d) => d.day > ago(o.days, now));
  return { v: 1, deviceId: 'r-seed', child: 'default', events: [], daily, rounds: [], lists: {} };
}
