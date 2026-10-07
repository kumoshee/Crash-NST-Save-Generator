/* Create an empty save from the binary scaffolds, without network requests. */
(function(root, factory) {
  const commonJS = typeof module === 'object' && module.exports;
  const scaffolds = commonJS ? require('./format-scaffolds.js') : root.NST_FORMAT_SCAFFOLDS;
  const saveFormat = commonJS ? require('./nst-save.js') : root.NSTSave;
  const api = factory(scaffolds, saveFormat);
  if (commonJS) module.exports = api;
  else { root.NSTSaveFactory = api; root.NST_SAVE_TEMPLATES = scaffolds; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function(scaffolds, saveFormat) {
  'use strict';
  function create(game) {
    if (![1, 2, 3].includes(game)) throw new Error('Choose Crash 1, 2 or 3');
    // Encoded bytes preserve type definitions, object references and table layout.
    // Save.create() resets progress and applies the readable defaults in nst-save.js.
    const bytes = typeof Buffer !== 'undefined'
      ? Uint8Array.from(Buffer.from(scaffolds[game], 'base64'))
      : Uint8Array.from(atob(scaffolds[game]), character => character.charCodeAt(0));
    return saveFormat.Save.create(game, bytes);
  }
  // Numeric keys keep existing CLI/template consumers compatible.
  return { ...scaffolds, create };
});
