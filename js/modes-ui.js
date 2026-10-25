// How each mode is presented: names, home-screen glyphs, descriptions and rule pickers.

import { ENGINES, isCue } from './engine/registry.js';
import { plural } from './util.js';

export const CATEGORY_INFO = {
  dart: {
    label: 'Dart',
    tagline: 'Licznik do darta',
    board: 'Tarcza',
    boardShort: 'T',
    boards: (n) => plural(n, 'tarcza', 'tarcze', 'tarcz'),
    frame: 'Leg',
  },
  bilard: {
    label: 'Bilard',
    tagline: 'Licznik do bilarda',
    board: 'Stół',
    boardShort: 'S',
    boards: (n) => plural(n, 'stół', 'stoły', 'stołów'),
    frame: 'Partia',
  },
};

export const categoryInfo = (mode) => CATEGORY_INFO[isCue(mode) ? 'bilard' : 'dart'];

export const MODE_INFO = {
  x01: {
    name: 'X01',
    glyph: '501',
    pick: '501',
    short: 'Zejdź do zera, zakończ na podwójnym.',
    desc: 'Klasyka. Zejdź do zera, ostatnia lotka w podwójne pole. Podpowiedzi zamknięć w zestawie.',
  },
  cricket: {
    name: 'Cricket',
    glyph: '15–20',
    pick: 'CR',
    short: 'Zamknij pola 15–20 i bulla.',
    desc: 'Zamknij 15–20 i bulla trzema trafieniami. Na otwartych polach zbierasz punkty.',
  },
  clock: {
    name: 'Zegar',
    glyph: '1→20',
    pick: '1→20',
    short: 'Po kolei od 1 do 20 i bull.',
    desc: 'Dookoła zegara: trafiaj po kolei od 1 do 20, na końcu bull. Kto pierwszy?',
  },
  shanghai: {
    name: 'Shanghai',
    glyph: 'SDT',
    pick: 'SH',
    short: 'Runda wyznacza cel, S+D+T wygrywa.',
    desc: 'Runda wyznacza cel. Single, double i treble w jednej turze to natychmiastowa wygrana.',
  },
  killer: {
    name: 'Killer',
    glyph: '×3',
    pick: 'KL',
    short: 'Zostań killerem i odbieraj życia.',
    desc: 'Każdy losuje swój numer. Trafiając w jego podwójne zostajesz killerem i odbierasz życia.',
  },
  pool8: {
    name: 'Ósemka',
    glyph: '8',
    pick: '8',
    short: 'Pełne albo połówki, na końcu ósemka.',
    desc: 'Wbij swoją grupę, pełne albo połówki, a na końcu czarną ósemkę. Gra się do ustalonej liczby wygranych partii.',
  },
  pool9: {
    name: 'Dziewiątka',
    glyph: '9',
    pick: '9',
    short: 'Bile po kolei, wygrywa dziewiątka.',
    desc: 'Zawsze celujesz w najniższą bilę na stole. Kto wbije dziewiątkę, wygrywa partię. Trzy faule z rzędu przegrywają.',
  },
  bieda: {
    name: 'Bieda wersja',
    glyph: '3+',
    pick: '3+',
    joke: true,
    short: 'Gra dla więcej niż dwóch osób na jednym stole',
    desc: 'Jeden stół, cała ekipa. Losuję grupy, w grupie gracie na zmianę, a przy trzech i więcej grupach zwycięzcy zostają przy stole, przegrani idą na koniec kolejki.',
  },
  snooker: {
    name: 'Snooker',
    glyph: '147',
    pick: 'SN',
    short: 'Czerwone i kolory, liczy się brejk.',
    desc: 'Czerwona, kolor, czerwona… a potem kolory po kolei. Liczę punkty, brejki, faule i to, ile zostało na stole.',
  },
};

// [key, label, options[[value, label]]]
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
  pool8: [['breakRule', 'Rozbija', [['alternate', 'Na zmianę'], ['winner', 'Zwycięzca partii']]]],
  pool9: [
    ['breakRule', 'Rozbija', [['alternate', 'Na zmianę'], ['winner', 'Zwycięzca partii']]],
    ['threeFoul', 'Trzy faule z rzędu', [[true, 'Przegrana partia'], [false, 'Bez kary']]],
  ],
  snooker: [['reds', 'Czerwone bile', [[15, '15'], [10, '10'], [6, '6']]]],
  bieda: [
    ['game', 'Gra', [['pool8', 'Ósemka'], ['pool9', 'Dziewiątka']]],
    ['groupSize', 'W grupie', [[1, 'Po 1'], [2, 'Po 2'], [3, 'Po 3']]],
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
  pool8: () => 'Grupy przypisują się same po pierwszej bili wbitej po rozbiciu. Ósemkę wbija się na końcu.',
  pool9: () => 'Wbicie dziewiątki kończy partię. Najniższa bila na stole jest podświetlona.',
  bieda: () => 'Na wygranego: kto wygra partię, zostaje przy stole. Przegrani ustawiają się na końcu kolejki.',
  snooker: (r) => (r.reds === 15 ? 'Pełny stół: maksymalny brejk to 147.' : `Krótszy snooker z ${r.reds} czerwonymi, dobry na szybki mecz.`),
};

export const modeName = (id) => MODE_INFO[id]?.name || id;
export const describe = (mode, rules) => ENGINES[mode].describe(rules);
