// Betöltés-kapu (spec F-F1). A gyakorló betű Arial; ha a gépen nincs Arial (pl. Linux),
// az Ariallal azonos betűalakú Arimo töltődik a Google Fontsról, legfeljebb 5 mp-ig várva.

export const FONT_STACK = "Arial, 'Arimo', Helvetica, sans-serif";

function hasLocalArial() {
  try {
    const c = document.createElement('canvas').getContext('2d');
    const t = 'aáeéőűŐŰ mmmmWWil';
    return ['monospace', 'serif'].every((g) => {
      c.font = `72px ${g}`; const w0 = c.measureText(t).width;
      c.font = `72px Arial, ${g}`; return Math.abs(c.measureText(t).width - w0) > 0.5;
    });
  } catch { return false; }
}

/**
 * @param {(r:{state:'ok'|'failed', name:string}) => void} onLate  ha az időkorlát után mégis megjön
 * @returns {Promise<{state:'ok'|'failed', name:'Arial'|'Arimo'}>}
 */
export function initFont(onLate) {
  if (hasLocalArial()) return Promise.resolve({ state: 'ok', name: 'Arial' });
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
