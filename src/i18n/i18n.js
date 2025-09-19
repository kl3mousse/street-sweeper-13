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
    { code: 'de', name: 'Deutsch', tile: { c: 3, r: 1 } },
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
    tutorial_title: {
      fr: 'TUTORIEL',
      en: 'TUTORIAL',
      'pt-BR': 'TUTORIAL',
      es: 'TUTORIAL',
      pl: 'SAMOUCZEK',
      no: 'OPPLÆRING',
      de: 'TUTORIAL',
    },
    tutorial_up: {
      fr: 'Monte',
      en: 'Go Up',
      'pt-BR': 'Sobe',
      es: 'Sube',
      pl: 'W górę',
      no: 'Opp',
      de: 'Hoch',
    },
    tutorial_down: {
      fr: 'Descend',
      en: 'Go Down',
      'pt-BR': 'Desce',
      es: 'Baja',
      pl: 'W dół',
      no: 'Ned',
      de: 'Runter',
    },
    tutorial_collect_letters: {
      fr: 'Ramasse les lettres dans l\'ordre',
      en: 'Collect letters in order',
      'pt-BR': 'Pegue as letras na ordem',
      es: 'Recoge las letras en orden',
      pl: 'Zbieraj litery w kolejności',
      no: 'Samle bokstaver i rekkefølge',
      de: 'Sammle die Buchstaben der Reihe nach',
    },
    tutorial_avoid_obstacles: {
      fr: 'Évite les obstacles !',
      en: 'Avoid obstacles!',
      'pt-BR': 'Evita os obstáculos!', // PT-BR normative would be 'Evite', keep informal style if desired
      es: 'Evita los obstáculos!',
      pl: 'Unikaj przeszkód!',
      no: 'Unngå hindringer!',
      de: 'Weiche Hindernissen aus!',
    },
    tutorial_press_to_play: {
      fr: 'Appuie pour jouer ▶',
      en: 'Press to play ▶',
      'pt-BR': 'Toque para jogar ▶',
      es: 'Pulsa para jugar ▶',
      pl: 'Naciśnij, aby grać ▶',
      no: 'Trykk for å spille ▶',
      de: 'Drücken zum Spielen ▶',
    },
    tutorial_word_label: {
      fr: 'MOT',
      en: 'WORD',
      'pt-BR': 'PALAVRA',
      es: 'PALABRA',
      pl: 'SŁOWO',
      no: 'ORD',
      de: 'WORT',
    },
    game_over_score_label: {
      fr: 'Score',
      en: 'Score',
      'pt-BR': 'Pontuação',
      es: 'Puntuación',
      pl: 'Wynik',
      no: 'Poeng',
      de: 'Punkte',
    },
    game_over_best_label: {
      fr: 'Meilleur',
      en: 'Best',
      'pt-BR': 'Melhor',
      es: 'Mejor',
      pl: 'Rekord',
      no: 'Beste',
      de: 'Best',
    },
    game_over_back_button: {
      fr: 'Retour',
      en: 'Back',
      'pt-BR': 'Voltar',
      es: 'Volver',
      pl: 'Powrót',
      no: 'Tilbake',
      de: 'Zurück',
    },
    settings_easy: {
      fr: 'Facile',
      en: 'Easy',
      'pt-BR': 'Fácil',
      es: 'Fácil',
      pl: 'Łatwy',
      no: 'Lett',
      de: 'Leicht',
    },
    settings_normal: {
      fr: 'Normal',
      en: 'Normal',
      'pt-BR': 'Normal',
      es: 'Normal',
      pl: 'Normalny',
      no: 'Normal',
      de: 'Normal',
    },
    settings_ok: {
      fr: 'OK',
      en: 'OK',
      'pt-BR': 'OK',
      es: 'OK',
      pl: 'OK',
      no: 'OK',
      de: 'OK',
    },
    settings_word_placeholder: {
      fr: 'A-Z • max 12',
      en: 'A-Z • max 12',
      'pt-BR': 'A-Z • máx 12',
      es: 'A-Z • máx 12',
      pl: 'A-Z • max 12',
      no: 'A-Z • maks 12',
      de: 'A-Z • max 12',
    },
    feedback_score_100: {
      fr: '+100',
      en: '+100',
      'pt-BR': '+100',
      es: '+100',
      pl: '+100',
      no: '+100',
      de: '+100',
    },
    feedback_time_plus_2s: {
      fr: '+2s',
      en: '+2s',
      'pt-BR': '+2s',
      es: '+2s',
      pl: '+2s',
      no: '+2s',
      de: '+2s',
    },
    feedback_time_minus_2s: {
      fr: '-2s',
      en: '-2s',
      'pt-BR': '-2s',
      es: '-2s',
      pl: '-2s',
      no: '-2s',
      de: '-2s',
    },
    feedback_life_minus_1: {
      fr: '-1 vie',
      en: '-1 life',
      'pt-BR': '-1 vida',
      es: '-1 vida',
      pl: '-1 życie',
      no: '-1 liv',
      de: '-1 Leben',
    },
    words_remove_button_title: {
      fr: 'Supprimer',
      en: 'Remove',
      'pt-BR': 'Remover',
      es: 'Eliminar',
      pl: 'Usuń',
      no: 'Fjern',
      de: 'Entfernen',
    },
  };

  function getString(key, lang){
    const dict = STRINGS[key];
    if (!dict) return key;
    return dict[lang] || dict['en'] || Object.values(dict)[0] || key;
  }

  global.SS13_I18N = { LANGS, STRINGS, getString };
})(typeof window !== 'undefined' ? window : globalThis);
