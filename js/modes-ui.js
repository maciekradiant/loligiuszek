// How each mode is presented: names, home-screen glyphs, descriptions and rule pickers.

import { ENGINES } from './engine/modes.js';

export const MODE_INFO = {
  x01: {
    name: 'X01',
    glyph: '501',
    pick: '501',
    desc: 'Klasyka. Zejdź do zera, ostatnia lotka w podwójne pole. Podpowiedzi zamknięć w zestawie.',
  },
  cricket: {
    name: 'Cricket',
    glyph: '15–20',
    pick: 'CR',
    desc: 'Zamknij 15–20 i bulla trzema trafieniami. Na otwartych polach zbierasz punkty.',
  },
  clock: {
    name: 'Zegar',
    glyph: '1→20',
    pick: '1→20',
    desc: 'Dookoła zegara: trafiaj po kolei od 1 do 20, na końcu bull. Kto pierwszy?',
  },
  shanghai: {
    name: 'Shanghai',
    glyph: 'S·D·T',
    pick: 'SH',
    desc: 'Runda wyznacza cel. Single, double i treble w jednej turze to natychmiastowa wygrana.',
  },
  killer: {
    name: 'Killer',
    glyph: '×3',
    pick: 'KL',
    desc: 'Każdy losuje swój numer. Trafiając w jego podwójne zostajesz killerem i odbierasz życia.',
  },
};

// [key, label, options[[value, label]], hint?]
export const RULE_FIELDS = {
  x01: [
    ['start', 'Start', [[101, '101'], [301, '301'], [501, '501'], [701, '701']]],
    ['out', 'Zamknięcie', [['double', 'Double'], ['single', 'Single'], ['master', 'Master']]],
    ['in', 'Otwarcie', [['straight', 'Dowolne'], ['double', 'Double In']]],
  ],
  cricket: [['variant', 'Wariant', [['standard', 'Klasyczny'], ['cut', 'Cut-throat']]]],
  clock: [
    ['multi', 'Postęp', [[false, 'Po kolei'], [true, 'Double/treble przeskakują']]],
    ['bull', 'Na koniec', [[true, 'Bull'], [false, 'Bez bulla']]],
  ],
  shanghai: [['rounds', 'Rundy', [[7, '7'], [10, '10'], [20, '20']]]],
  killer: [
    ['lives', 'Życia', [[1, '1'], [3, '3'], [5, '5']]],
    ['zone', 'Liczy się', [['double', 'Podwójne pole'], ['any', 'Całe pole']]],
    ['selfHit', 'Własny numer', [[true, 'Zabiera życie'], [false, 'Bez kary']]],
  ],
};

export const RULE_HINTS = {
  cricket: (r) =>
    r.variant === 'cut'
      ? 'Cut-throat: punkty z otwartych pól trafiają do rywali. Wygrywa ten, kto zamknie wszystko z najmniejszym wynikiem.'
      : 'Wygrywa ten, kto zamknie wszystkie pola i ma co najmniej tyle punktów, co rywale.',
  x01: (r) =>
    r.out === 'double'
      ? 'Ostatnia lotka musi trafić w podwójne pole lub bulla.'
      : r.out === 'master'
        ? 'Zamknięcie podwójnym albo potrójnym polem.'
        : 'Zamknąć można dowolnym polem.',
};

export const modeName = (id) => MODE_INFO[id]?.name || id;
export const describe = (mode, rules) => ENGINES[mode].describe(rules);
