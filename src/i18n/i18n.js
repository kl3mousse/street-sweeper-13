// Street Sweeper 13 - i18n bootstrap
// Centralized translation registry. Keep tiny & dependency-free.
// Add any new UI string keys under STRINGS.
// Flags: coordinates are 1-based (column, row) on 32x32 tile grid in assets/flags.png.
(function(global){
  const LANGS = [
    { code: 'fr', name: 'Français', tile: { c: 6, r: 4 } },
    { code: 'en', name: 'English', tile: { c: 4, r: 8 } },
    { code: 'pt-BR', name: 'Português (BR)', tile: { c: 6, r: 2 } },
    { code: 'es', name: 'Español', tile: { c: 18, r: 3 } },
    { code: 'pl', name: 'Polski', tile: { c: 1, r: 8 } },
    { code: 'no', name: 'Norsk', tile: { c: 11, r: 7 } },
    { code: 'de', name: 'Deutsch', tile: { c: 1, r: 3 } },
  ];

  const STRINGS = {
    start_button: {
      fr: 'JOUER', // uses accent for clearer distinction
      en: 'START',
      'pt-BR': 'INICIAR',
      es: 'INICIAR',
      pl: 'GRAJ',
      no: 'START',
      de: 'STARTEN',
    },
  };

  function getString(key, lang){
    const dict = STRINGS[key];
    if (!dict) return key;
    return dict[lang] || dict['en'] || Object.values(dict)[0] || key;
  }

  global.SS13_I18N = { LANGS, STRINGS, getString };
})(typeof window !== 'undefined' ? window : globalThis);
