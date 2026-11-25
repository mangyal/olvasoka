// Megjelenés: a Minta tételei és a telefonos összegzés (docs/megjelenes-specifikacio.md, MI-1–MI-3, L-4).
// Tiszta modul. A beállítás érvényesítése (clampLook) a settings.js-ben van.

import { groupOf } from './groups.js';
import { letterRuns } from './hangok.js';

/**
 * A Minta (MI-1, MI-2): típusonként legfeljebb egy tétel, mindig a lista szerinti első előfordulás, ebben a
 * sorrendben: magánhangzó, mássalhangzó, többjegyű mássalhangzó, szótag (CV, ha nincs: VC, ha nincs: egyéb),
 * szó, jelölt betűs tétel, mondat. A hiányzó típus kimarad; egy tétel csak egyszer szerepel.
 * Üres bemenetnél üres (MI-3: a Minta sor nem látszik).
 * @param {string[]} items  a különböző tételek a csomagok sorrendjében (szűrés után)
 * @param {Map<string, unknown>} [marks]  tételkulcs → jelölés: a jelölt tételek
 * @returns {string[]}
 */
export function sampleItems(items, marks = new Map()) {
  const key = (x) => groupOf(x).key;
  const single = (x) => letterRuns(x).length === 1 && letterRuns(x)[0].letter.length === 1;
  const picks = [
    (x) => key(x) === 'V',
    (x) => key(x) === 'C' && single(x),
    (x) => key(x) === 'C' && !single(x),
    (x) => key(x) === 'CV',
    (x) => key(x) === 'VC',
    (x) => key(x).startsWith('S:'),
    (x) => key(x).startsWith('W:'),
    (x) => marks.has(x),
    (x) => key(x).startsWith('M:'),
  ];
  const out = [];
  let syllable = false;
  picks.forEach((p, i) => {
    const isSyl = i >= 3 && i <= 5;
    if (isSyl && syllable) return;
    const hit = items.find((x) => p(x) && !out.includes(x));
    if (!hit) return;
    out.push(hit);
    if (isSyl) syllable = true;
  });
  return out;
}

/** A telefonos összecsukott sor mini mintája (L-4): az első jelölt tétel, ha nincs, az első szó, ha az sincs, az első tétel. */
export function miniSample(items, marks = new Map()) {
  return items.find((x) => marks.has(x)) ?? items.find((x) => groupOf(x).key.startsWith('W:')) ?? items[0] ?? '';
}

/** A telefonos összecsukott sor összegzése (L-4): „Hangok szerint · Nagybetű: körvonal”. */
export const lookSummary = (look) =>
  `${look.color === 'sound' ? 'Hangok szerint' : 'Nincs színezés'} · Nagybetű: ${look.mark === 'outline' ? 'körvonal' : 'nincs'}`;
