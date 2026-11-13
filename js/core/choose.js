// Jutalomválasztó (spec F-R14, 12.5b): a kör végén a gyerek választ a két jutalomjáték közül.
// Tiszta reducer; a rajzolás és az időzítés a ui/chooser.js-ben van.

export const CHOICES = ['lufi', 'panda'];   // rögzített sorrend: Lufi balra (fent), Panda jobbra (lent)
export const ARM_MS = 600;                  // az első 600 ms-ban minden bemenet elnyelődik

/** @param {number} now  performance.now() a választó megjelenésekor */
export function startChoose(now) {
  return { hi: null, down: null, picked: null, readyAt: now + ARM_MS };
}

/**
 * Események:
 *  - 'LEFT' / 'RIGHT'  ← / →: kiemeli a Lufit / a Pandát
 *  - 'HOVER' (név)     egér a kártya fölött: ugyanaz a kiemelés (az utolsó bemenet nyer)
 *  - 'START'           Space, Enter, ↑: a kiemelt játék indul; kiemelés nélkül semmi
 *  - 'DOWN' (név)      pointerdown egy kártyán
 *  - 'UP' (név)        pointerup: ha ugyanazon a kártyán kezdődött, az a játék indul
 *  - 'CANCEL'          a mutató elhagyta / megszakadt: a félbehagyott koppintás nem számít
 *  - 'PICK' (név)      közvetlen választás (pl. képernyőolvasó aktiválása)
 * Választás után, és az első ARM_MS alatt az állapot nem változik.
 */
export function chooseStep(s, ev, now, arg) {
  if (s.picked || now < s.readyAt) return s;
  const valid = CHOICES.includes(arg);
  switch (ev) {
    case 'LEFT': return { ...s, hi: CHOICES[0] };
    case 'RIGHT': return { ...s, hi: CHOICES[1] };
    case 'HOVER': return valid && s.hi !== arg ? { ...s, hi: arg } : s;
    case 'START': return s.hi ? { ...s, picked: s.hi } : s;
    case 'DOWN': return valid ? { ...s, down: arg } : s;
    case 'UP': return valid && s.down === arg ? { ...s, down: null, picked: arg } : (s.down ? { ...s, down: null } : s);
    case 'CANCEL': return s.down ? { ...s, down: null } : s;
    case 'PICK': return valid ? { ...s, picked: arg } : s;
    default: return s;
  }
}
