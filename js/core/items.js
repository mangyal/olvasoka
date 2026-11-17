// A tételekhez és listanevekhez közös segédek (spec F-L3, F-L5). Tiszta modul.

export const MAXLEN = 20;
/** Mondat hosszkorlátja (M-5). */
export const MAXLEN_SENTENCE = 40;

/**
 * A tétel tisztított alakja (M-6): NFC, levágva, a belső szóközök (a nem törő szóköz is) egy
 * szóközzé vonva. A lista és a tételkulcs is ezt használja.
 */
export const cleanItem = (s) => String(s).normalize('NFC').replace(/\s+/g, ' ').trim();

/** Mondat-e a tétel (M-1): levágás után van benne szóköz. „Ami több szóból áll, az mondat.” */
export const isSentence = (s) => cleanItem(s).includes(' ');

/** A tételre vonatkozó hosszkorlát (M-5): mondatra 40, minden másra 20 karakter. */
export const maxLenOf = (s) => (isSentence(s) ? MAXLEN_SENTENCE : MAXLEN);

/** Listanév-kulcs: levágva, kis-/nagybetűre nem érzékenyen. */
export const nameKey = (s) => String(s).normalize('NFC').trim().toLocaleLowerCase('hu');

/**
 * Tételkulcs a Haladás nézethez (docs/haladas-specifikacio.md, 3.): NFC, levágva, a belső szóközök
 * egyre vonva (M-6). A kis- és nagybetű különbözik (`ház` ≠ `Ház`), a kötőjel és az írásjel megmarad
 * (`ma`, `ma-ma`, `mama` három tétel; `a ló húz.` ≠ `a ló húz`).
 */
export const itemKey = cleanItem;

/**
 * A különböző tételek (tételkulcs szerint) első előfordulásuk sorrendjében, az első alakjukkal (S-3).
 * A szülői felület ezt mutatja; a kör összeállítása a sorokkal (ismétlésekkel) dolgozik.
 * @param {string[]} rows
 */
export function distinctItems(rows) {
  const seen = new Set(), out = [];
  for (const r of rows) {
    const k = itemKey(r);
    if (!seen.has(k)) { seen.add(k); out.push(r); }
  }
  return out;
}

/** Magyar névelő számmal kezdődő szó elé: az 1., az 5., az 50., az 1000.… */
export const art = (n) => {
  const d = String(n);
  return d === '1' || d[0] === '5' || (d.length === 4 && d[0] === '1') ? 'az' : 'a';
};
