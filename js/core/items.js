// Tételek tisztítása (spec F-A2, F-A3). Tiszta modul.

export const MAXLEN = 20;
const SUSPECT = /[ôõûũÔÕÛŨ]/g;

/** Listanév-kulcs: levágva, kis-/nagybetűre nem érzékenyen. */
export const nameKey = (s) => String(s).normalize('NFC').trim().toLocaleLowerCase('hu');

/** Magyar névelő számmal kezdődő szó elé: az 1., az 5., az 50., az 1000.… */
export const art = (n) => {
  const d = String(n);
  return d === '1' || d[0] === '5' || (d.length === 4 && d[0] === '1') ? 'az' : 'a';
};

/**
 * Szövegből tételek: új sor vagy vessző választja el őket.
 * NFC → levágás → üres eldobva → `#`-es eldobva → ismétlődő eldobva → hosszkorlát.
 * @returns {{ entries: {text:string,status:'ok'|'excl'|'dup'|'long',len?:number,warn?:string[]}[], items: string[], invalid: boolean }}
 */
export function analyzeItems(text) {
  const entries = [], items = [], seen = new Set();
  let invalid = false;
  for (const raw of String(text).split(/\r?\n|,/)) {
    const t = raw.normalize('NFC').trim();
    if (!t) continue;
    if (t.startsWith('#')) { entries.push({ text: t, status: 'excl' }); continue; }
    if (seen.has(t)) { entries.push({ text: t, status: 'dup' }); continue; }
    seen.add(t);
    const len = [...t].length;
    const warn = [...new Set(t.match(SUSPECT) || [])];
    if (len > MAXLEN) { invalid = true; entries.push({ text: t, status: 'long', len, warn }); continue; }
    entries.push({ text: t, status: 'ok', warn });
    items.push(t);
  }
  return { entries, items, invalid };
}
