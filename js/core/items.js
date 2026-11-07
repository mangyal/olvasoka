// A tételekhez és listanevekhez közös segédek (spec F-L3, F-L5). Tiszta modul.

export const MAXLEN = 20;

/** Listanév-kulcs: levágva, kis-/nagybetűre nem érzékenyen. */
export const nameKey = (s) => String(s).normalize('NFC').trim().toLocaleLowerCase('hu');

/** Magyar névelő számmal kezdődő szó elé: az 1., az 5., az 50., az 1000.… */
export const art = (n) => {
  const d = String(n);
  return d === '1' || d[0] === '5' || (d.length === 4 && d[0] === '1') ? 'az' : 'a';
};
