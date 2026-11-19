// Lapozás húzással a Felolvasásban (F-P16a). Tiszta modul: egy érintéses mozdulatból mit kell tenni.
//
// Balra húzás = következő tétel (mint a ▶), jobbra húzás = előző (mint a ◀). A mozdulat a felemeléskor dönt;
// a tétel nem követi az ujjat (F-P2: a tételváltás soha nem animált).

/** Ennél kisebb elmozdulás koppintás (F-P16, F-P19). */
export const TAP_MAX = 12;
/** Ennyi vízszintes elmozdulás lapoz. */
export const SWIPE_MIN = 48;
/** Gyors pöccintésnél ennyi is elég, ha legfeljebb FLICK_MS alatt történt. */
export const FLICK_MIN = 24;
export const FLICK_MS = 250;
/** Vízszintesnek számít, ha a vízszintes elmozdulás legalább ennyiszerese a függőlegesnek. */
export const RATIO = 1.5;

/**
 * @param {{ dx: number, dy: number, dt: number }} m  elmozdulás px-ben (jobbra, lefelé pozitív) és időtartam ms-ben
 * @returns {'TAP'|'NEXT'|'PREV'|null}  null: se nem koppintás, se nem lapozás (pl. függőleges vagy átlós húzás)
 */
export function gesture({ dx, dy, dt }) {
  if (Math.hypot(dx, dy) <= TAP_MAX) return 'TAP';
  const ax = Math.abs(dx), ay = Math.abs(dy);
  if (ax < RATIO * ay) return null;
  if (ax >= SWIPE_MIN || (ax >= FLICK_MIN && dt <= FLICK_MS)) return dx < 0 ? 'NEXT' : 'PREV';
  return null;
}
