// Környezet: éles (prod) vagy fejlesztői (dev). Tiszta modul, a hívó adja a címet.
//
// Mindkettő ugyanazon a GitHub Pages címen (originon) fut: az éles a gyökérben, a dev a /dev/
// almappában. Ugyanazon az originon közös a localStorage és a Cache Storage, ezért minden tárolt
// adat neve környezetfüggő; az éles megtartja a régi neveket, így a meglévő felhasználók
// beállításai és listái érintetlenek maradnak.
//
// A listák táblázata környezetenként: core/config.js (kiadáskor GitHub repository variable-ökből).

import { SHEETS } from './config.js';

export { SHEETS };

/** 'dev', ha a cím a /dev/ almappában van, vagy helyi gépen fut; különben 'prod'. */
export function envFrom(loc) {
  const path = loc?.pathname || '/';
  const host = loc?.hostname || '';
  if (/\/dev\//.test(path)) return 'dev';
  if (host === 'localhost' || host === '127.0.0.1') return 'dev';
  return 'prod';
}

/** A környezet tárolt neveinek és forrásának összessége. */
export function envConfig(env) {
  const dev = env === 'dev';
  return Object.freeze({
    env: dev ? 'dev' : 'prod',
    storageKey: dev ? 'olvasoka-dev' : 'olvasoka',
    sheet: dev ? SHEETS.dev : SHEETS.prod,
  });
}

export const ENV = envConfig(envFrom(globalThis.location));
