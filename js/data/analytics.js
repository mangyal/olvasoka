// Anonim használati statisztika (Umami), docs/analitika-specifikacio.md.
//
// Alapelv: a gyerekről, a tételekről és a haladásról semmi nem megy ki. Csak a játék és a beállítások
// (játék, kör sorszáma, listák, kártyaszám stb.) kerülnek az eseményekbe. A cím #hash része (Haladás
// nézet, benne tételkulcsok) és a ?keresés része sosem kerül a statisztikába.
//
// Ha nincs webhely-azonosító (helyi futtatás, tesztek, beállítatlan dev), semmi nem töltődik be.
// Hibát soha nem dob: a statisztika nem akaszthatja meg a gyakorlást.

export const SCRIPT_SRC = 'https://cloud.umami.is/script.js';
export const MAX_TEXT = 500;      // az Umami eseményadatának szöveghatára

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isWebsiteId = (v) => typeof v === 'string' && UUID.test(v);

/** Csak szám, logikai érték és (vágott) szöveg marad; az üres értékek kimaradnak. */
export function clean(data) {
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string' && v) out[k] = v.length > MAX_TEXT ? v.slice(0, MAX_TEXT - 1) + '…' : v;
  }
  return out;
}

/**
 * @param {{ websiteId?: string, doc?: Document, win?: object }} [o]
 * @returns {{ enabled: boolean, track: (name: string, data?: object) => void }}
 */
export function createAnalytics({ websiteId, doc = globalThis.document, win = globalThis } = {}) {
  let enabled = false;
  if (isWebsiteId(websiteId) && doc?.head) {
    try {
      const s = doc.createElement('script');
      s.defer = true;
      s.src = SCRIPT_SRC;
      s.setAttribute('data-website-id', websiteId);
      s.setAttribute('data-exclude-hash', 'true');     // #haladas/tetel/<tétel>: tételadat, nem mehet ki
      s.setAttribute('data-exclude-search', 'true');
      doc.head.append(s);
      enabled = true;
    } catch { /* statisztika nélkül fut */ }
  }
  return {
    enabled,
    // a betöltés előtt (vagy reklámblokkoló mellett) érkező esemény elvész; ez elfogadott
    track(name, data) {
      if (!enabled) return;
      try { win.umami?.track(name, clean(data)); } catch { /* nem akaszt meg semmit */ }
    },
  };
}
