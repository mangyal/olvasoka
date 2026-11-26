// Betöltés-kapu (spec F-F1). A gyakorló betű Arial; ha a gépen nincs Arial (pl. Linux),
// az Ariallal azonos betűalakú Arimo töltődik a repóból (fonts/), legfeljebb 5 mp-ig várva.
// Hogy van-e valódi Arial, a betűszélességekből döntjük el (Androidon az „Arial” név a Roboto).

const ARIAL_STACK = "Arial, 'Arimo', Helvetica, sans-serif";
const ARIMO_STACK = "'Arimo', Arial, Helvetica, sans-serif";

/** A gyakorló betű CSS-sora; az initFont átírja Arimo-elsőre, ha a gépen nincs valódi Arial. */
export let FONT_STACK = ARIAL_STACK;

// Az Arial (és a vele metrikusan azonos Arimo) betűszélességei 100 px-en (hmtx / 2048 em).
// Androidon az „Arial” név a Robotóra mutat: az is betűtípus, csak más szélességekkel, ligatúrákkal
// (fi) és egymásra lógó körvonalakkal (m), ezért nem elég azt nézni, hogy van-e ilyen nevű betű.
const ARIAL_W = { m: 83.30, W: 94.38, a: 55.62, i: 22.22 };

function hasLocalArial() {
  try {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '100px Arial, monospace';
    return Object.entries(ARIAL_W).every(([ch, w]) => Math.abs(c.measureText(ch).width - w) < 0.5);
  } catch { return false; }
}

function useArimo() {
  FONT_STACK = ARIMO_STACK;
  document.documentElement.style.setProperty('--f-item', ARIMO_STACK);
}

/**
 * @param {(r:{state:'ok'|'failed', name:string}) => void} onLate  ha az időkorlát után mégis megjön
 * @returns {Promise<{state:'ok'|'failed', name:'Arial'|'Arimo'}>}
 */
export function initFont(onLate) {
  if (hasLocalArial()) return Promise.resolve({ state: 'ok', name: 'Arial' });
  useArimo();
  if (!document.fonts || !document.fonts.load) return Promise.resolve({ state: 'failed', name: 'Arimo' });
  const loader = document.fonts.load('1em Arimo', 'aáeéőűŐŰ').then((f) => (f && f.length ? 'ok' : 'failed'), () => 'failed');
  const timeout = new Promise((r) => setTimeout(() => r('timeout'), 5000));
  return Promise.race([loader, timeout]).then((r) => {
    if (r !== 'ok') loader.then((late) => { if (late === 'ok') onLate?.({ state: 'ok', name: 'Arimo' }); });
    return { state: r === 'ok' ? 'ok' : 'failed', name: 'Arimo' };
  });
}

export function fontLooksRight(font) {
  if (font.state !== 'ok') return false;
  try { return font.name === 'Arial' || document.fonts.check('1em Arimo', 'aőűŐŰ'); } catch { return false; }
}
