// ESLint (npm run lint). A CI a Tesztek workflow `test` jobjában futtatja: hibánál a PR nem olvasztható be.
// Szándékosan csak a `recommended` szabálykészlet: hibákat keres, nem stílust.

import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2023, sourceType: 'module' },
    rules: {
      // a core/lists.js a BOM-ot (U+FEFF) reguláris kifejezéssel vágja le; ez szándékos
      'no-irregular-whitespace': ['error', { skipRegExps: true }],
      // `_` előtagú paraméter és a mező elhagyása kibontással (`({ id, ...rest }) => rest`): szándékos
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
    },
  },
  // a böngészőben futó program
  { files: ['js/**/*.js'], languageOptions: { globals: globals.browser } },
  { files: ['sw.js'], languageOptions: { globals: globals.serviceworker } },
  // Node alatt futó tesztek és szkriptek
  {
    files: ['test/**', 'e2e/**', '.github/scripts/**', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
