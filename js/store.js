// Everything lives in localStorage on the phone. Reads and writes never throw: in a private
// window or with storage blocked the app still runs, it just forgets on reload.

const PREFIX = 'lotka.v1.';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const DEFAULT_SETTINGS = {
  caller: true,
  sounds: true,
  wakeLock: true,
  inputMode: 'total',
  hints: true,
  category: 'dart',
};

export const HISTORY_LIMIT = 500;

export function load() {
  return {
    players: read('players', []),
    history: read('history', []),
    settings: { ...DEFAULT_SETTINGS, ...read('settings', {}) },
    session: read('session', null),
    lastSetup: migrateLastSetup(read('lastSetup', null)),
  };
}

// Version 1.0 kept a single darts setup; now each category remembers its own.
function migrateLastSetup(v) {
  if (!v) return {};
  return v.mode ? { dart: v } : v;
}

export const save = {
  players: (v) => write('players', v),
  history: (v) => write('history', v.slice(0, HISTORY_LIMIT)),
  settings: (v) => write('settings', v),
  session: (v) => write('session', v),
  lastSetup: (v) => write('lastSetup', v),
};

export function exportData(state) {
  return JSON.stringify({ app: 'lotka', version: 1, exported: new Date().toISOString(), players: state.players, history: state.history, settings: state.settings });
}

export function parseImport(text) {
  const data = JSON.parse(text);
  if (!data || data.app !== 'lotka' || !Array.isArray(data.players) || !Array.isArray(data.history)) {
    throw new Error('To nie jest kopia danych Lotki.');
  }
  return data;
}
