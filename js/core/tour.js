// Első lépések (bemutató): a DOM nélküli rész. Spec: docs/bemutato-specifikacio.md.
// A felület (rétegek, buborék, billentyűk) a js/ui/tour.js-ben van; ez a modul Node-ban tesztelhető.

/** A bemutató tartalmának verziója. Csak lényeges tartalmi változáskor emeljük: aki régebbit látott, újra megkapja (5.). */
export const TOUR_VERSION = 1;
export const TOUR_STEPS = 4;
/** Magától csak ennél nagyobb ablakban indul (a „túl kicsi képernyő” határa, WCAG 1.4.10; döntés 2026-11-13). */
export const TOUR_MIN = Object.freeze({ w: 320, h: 256 });
/** Az 1. lépés célelemei, ebben a sorrendben: az első látható nyer (2.1). */
export const LIST_TARGETS = Object.freeze(['listNav', 'listChecks', 'listsBtn']);
/** A 2–4. lépés célelemei. */
export const STEP_TARGETS = Object.freeze({ 2: 'modeTabs', 3: 'progressBtn', 4: 'startBtn' });

/** Tárolt állapot: null | { v, how: 'done' | 'skipped', at }. Bármi más null (5.). */
export function normalizeTour(t) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
  if (!Number.isInteger(t.v) || t.v < 1) return null;
  if (t.how !== 'done' && t.how !== 'skipped') return null;
  if (!Number.isFinite(t.at)) return null;
  return { v: t.v, how: t.how, at: t.at };
}

/** Az ablak elég nagy-e az induláshoz. */
export const fitsViewport = (w, h) => w >= TOUR_MIN.w && h >= TOUR_MIN.h;

/**
 * Induljon-e magától (4.1), a tárolt adatok és a cím alapján. Az ablakméretet (fitsViewport) és a listák
 * betöltését a hívó várja meg.
 */
export function shouldAutoStart({ tour = null, hideHelp = false, hash = '', version = TOUR_VERSION } = {}) {
  if (hideHelp === true) return false;                      // aki eddig kikapcsolta a súgót
  if (/^#haladas(\/|$)/.test(hash || '')) return false;     // a Haladás nézettel nyílt
  const t = normalizeTour(tour);
  return !t || t.v < version;
}

/** Az 1. lépés célelemének azonosítója: az első látható a sorból, vagy null. */
export const pickTarget = (visible) => LIST_TARGETS.find((id) => visible(id)) || null;

/** A lépés célelemének azonosítója. */
export const targetFor = (step, visible) => (step === 1 ? pickTarget(visible) : STEP_TARGETS[step] || null);

/**
 * A buborék tartalma. A szöveg sorok tömbje, egy sor darabok tömbje:
 * { t: 'szöveg' } | { b: 'félkövér' } | { kbd: 'Ctrl' }. Így a felület szövegként építi fel (nincs innerHTML).
 * target: az 1. lépés célelemének azonosítója; touch: érintéses eszköz; mod: '⌘' vagy 'Ctrl';
 * minDays: a haladas.json min_nap értéke (a napszabály-kapcsolótól függetlenül; döntés 2026-11-13).
 */
export function stepContent(step, { target = 'listNav', touch = false, mod = 'Ctrl', minDays = 3 } = {}) {
  const t = (s) => ({ t: s });
  const common = 'A játékban csak a kijelölt listák tételei jönnek elő.';
  let title, lines;
  if (step === 1) {
    title = 'Válassz listát';
    if (target === 'listChecks') lines = [[t(`Pipáld be a listákat, amelyekből gyakoroltok. ${common}`)]];
    else if (target === 'listsBtn') lines = [[t(`Koppints ide, és pipáld be a listákat. ${common}`)]];
    else if (touch) lines = [[t(`Koppints egy listára. ${common}`)]];
    else lines = [[t(`Kattints egy listára. ${common} Többet is kijelölhetsz `), { kbd: mod }, t(' + kattintással.')]];
  } else if (step === 2) {
    title = 'Válassz játékot';
    lines = [
      [{ b: 'Felolvasás' }, t(': a gyerek felolvassa a felvillanó tételt, te pedig ellenőrzöd.')],
      [{ b: 'Keresd meg!' }, t(': te mondasz egy tételt, ő megkeresi.')],
      [t('Alatta beállíthatod a körök számát.')],
    ];
  } else if (step === 3) {
    title = 'Itt látod a haladást';
    lines = [[t('Az Olvasóka megjegyzi, mit olvasott a gyerek, és megmutatja, mi megy már és mit érdemes még gyakorolni. '
      + `Egy tételről akkor tud mondani valamit, ha legalább ${minDays} különböző napon olvasta.`)]];
  } else if (step === 4) {
    title = 'Kezdődhet a közös olvasás';
    lines = [[t(touch
      ? 'Üljetek le együtt, és koppints az Indítás gombra. A kör végén jutalomjáték vár a gyerekre.'
      : 'Üljetek le együtt, és nyomd meg az Indítás gombot. A kör végén jutalomjáték vár a gyerekre.')]];
  } else {
    throw new RangeError(`Nincs ilyen lépés: ${step}`);
  }
  return {
    eyebrow: `Első lépések · ${step}/${TOUR_STEPS}`,
    title,
    lines,
    primary: step === TOUR_STEPS ? 'Kész' : 'Tovább',
    progressLabel: `${step}. lépés a ${TOUR_STEPS}-ből`,
  };
}

/** A szöveg sima szövegként (tesztekhez, felolvasóhoz). */
export const plainText = (lines) => lines.map((l) => l.map((p) => p.t ?? p.b ?? p.kbd ?? '').join('')).join('\n');

/** Elsődleges oldal lépésenként (3.2): széles és telefonos elrendezés. */
export const SIDES = Object.freeze({
  wide: Object.freeze({ 1: 'right', 2: 'left', 3: 'below', 4: 'left' }),
  phone: Object.freeze({ 1: 'below', 2: 'above', 3: 'below', 4: 'above' }),
});
const OPPOSITE = { right: 'left', left: 'right', below: 'above', above: 'below' };

/** A buborék és a célelem (a kiemelés lyuka) közti távolság: a gyűrű 7 px + a nyíl kilógó fele. */
export const GAP = 16;
/** A buborék legalább ennyire marad az ablak szélétől. */
export const MARGIN = 8;
/** A nyíl legalább ennyire a buborék szélétől (3.2). */
export const ARROW_MIN = 20;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * A buborék helye (3.2). hole: a kiemelt téglalap { left, top, right, bottom } (ablakkoordinátákban);
 * size: a buborék { w, h }; view: az ablak { w, h }; side: az elsődleges oldal.
 * Ha az elsődleges oldalon nem fér el, a szemközti oldalra fordul, ha ott sem, akkor alá vagy fölé
 * (vízszintes elsődleges oldalnál), végső esetben oda, ahol a legtöbb hely van. A buborék mindig az
 * ablakon belül marad, a nyíl a célelem közepére mutat, de legalább ARROW_MIN-re a buborék szélétől.
 * Eredmény: { left, top, side, arrow, fits } – arrow: a nyíl helye a buborék megfelelő éle mentén.
 */
export function place(hole, size, view, side, { gap = GAP, margin = MARGIN } = {}) {
  const room = {
    right: view.w - margin - hole.right - gap,
    left: hole.left - gap - margin,
    below: view.h - margin - hole.bottom - gap,
    above: hole.top - gap - margin,
  };
  const need = (s) => (s === 'right' || s === 'left' ? size.w : size.h);
  const horizontal = (s) => s === 'right' || s === 'left';
  const order = [side, OPPOSITE[side], ...(horizontal(side) ? ['below', 'above'] : [])];
  let chosen = order.find((s) => room[s] >= need(s));
  const fits = Boolean(chosen);
  if (!chosen) chosen = ['below', 'above', 'right', 'left'].reduce((a, b) => (room[b] - need(b) > room[a] - need(a) ? b : a));

  const cx = (hole.left + hole.right) / 2, cy = (hole.top + hole.bottom) / 2;
  const maxL = Math.max(margin, view.w - margin - size.w), maxT = Math.max(margin, view.h - margin - size.h);
  let left, top, arrow;
  if (horizontal(chosen)) {
    left = chosen === 'right' ? hole.right + gap : hole.left - gap - size.w;
    left = clamp(left, margin, maxL);
    top = clamp(cy - size.h / 2, margin, maxT);
    arrow = clamp(cy - top, ARROW_MIN, size.h - ARROW_MIN);
  } else {
    top = chosen === 'below' ? hole.bottom + gap : hole.top - gap - size.h;
    top = clamp(top, margin, maxT);
    left = clamp(cx - size.w / 2, margin, maxL);
    arrow = clamp(cx - left, ARROW_MIN, size.w - ARROW_MIN);
  }
  return { left: Math.round(left), top: Math.round(top), side: chosen, arrow: Math.round(arrow), fits };
}

/** A célelem téglalapja minden irányban `pad` px-szel nagyobban (3.1). */
export const grow = (r, pad = 6) => ({ left: r.left - pad, top: r.top - pad, right: r.right + pad, bottom: r.bottom + pad });

/** A sötétítés `clip-path` útvonala: a teljes ablak, benne egy lekerekített téglalap alakú lyuk (evenodd). */
export function holePath(view, h, radius) {
  const w = h.right - h.left, ht = h.bottom - h.top;
  const r = Math.max(0, Math.min(radius, w / 2, ht / 2));
  const n = (x) => Math.round(x * 10) / 10;
  return `path(evenodd, "M0 0H${n(view.w)}V${n(view.h)}H0Z`
    + `M${n(h.left + r)} ${n(h.top)}H${n(h.right - r)}A${n(r)} ${n(r)} 0 0 1 ${n(h.right)} ${n(h.top + r)}`
    + `V${n(h.bottom - r)}A${n(r)} ${n(r)} 0 0 1 ${n(h.right - r)} ${n(h.bottom)}`
    + `H${n(h.left + r)}A${n(r)} ${n(r)} 0 0 1 ${n(h.left)} ${n(h.bottom - r)}`
    + `V${n(h.top + r)}A${n(r)} ${n(r)} 0 0 1 ${n(h.left + r)} ${n(h.top)}Z")`;
}
