// Every game the app knows, grouped into the two categories on the home screen.

import { ENGINES as DART_ENGINES } from './modes.js';
import { CUE_ENGINES } from './cue.js';

export const ENGINES = { ...DART_ENGINES, ...CUE_ENGINES };

export const CATEGORIES = {
  dart: Object.keys(DART_ENGINES),
  bilard: Object.keys(CUE_ENGINES),
};

export const isCue = (mode) => !!CUE_ENGINES[mode];
export const categoryOf = (mode) => (isCue(mode) ? 'bilard' : 'dart');
