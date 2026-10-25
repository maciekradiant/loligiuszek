// Single app state object plus the few helpers every screen uses to change it.

import { load, save } from './store.js';
import { uid } from './util.js';

export const S = {
  ...load(),
  ui: {
    screen: 'home',
    sheet: null,
    toast: null,
    setup: null,
    board: 0,
    entry: '',
    mult: 1,
    flash: null,
    overlay: null,
    historyTab: 'matches',
  },
};

let renderer = () => {};
export const onRender = (fn) => (renderer = fn);
export const render = () => renderer();

export function persist(...keys) {
  for (const k of keys) {
    if (k === 'session' && S.session) S.session.touched = Date.now();
    save[k](S[k]);
  }
}

export function go(screen) {
  S.ui.screen = screen;
  S.ui.sheet = null;
  render();
  document.querySelector('.scroll')?.scrollTo?.(0, 0);
}

export function openSheet(type, data = {}) {
  S.ui.sheet = { type, ...data, key: uid() };
  render();
}

let closing = 0;
export function closeSheet() {
  if (!S.ui.sheet || S.ui.sheet.closing) return;
  if (!document.querySelector('.sheet-wrap') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    S.ui.sheet = null;
    render();
    return;
  }
  S.ui.sheet.closing = true;
  render();
  clearTimeout(closing);
  const key = S.ui.sheet?.key;
  closing = setTimeout(() => {
    if (S.ui.sheet?.key === key) S.ui.sheet = null;
    render();
  }, 190);
}

let toastTimer = 0;
export function toast(text, kind = '') {
  S.ui.toast = { text, kind, id: uid() };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    S.ui.toast = null;
    render();
  }, 2700);
  render();
}

export const PLAYER_COLORS = ['red', 'green', 'brass', 'blue', 'violet', 'teal', 'orange', 'rose'];

export function addPlayer(name, color) {
  const clean = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!clean) return null;
  const existing = S.players.find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (existing) return existing;
  const used = new Set(S.players.map((p) => p.color));
  const pick = color || PLAYER_COLORS.find((c) => !used.has(c)) || PLAYER_COLORS[S.players.length % PLAYER_COLORS.length];
  const player = { id: uid(), name: clean, color: pick, created: Date.now() };
  S.players.push(player);
  persist('players');
  return player;
}

export const playerById = (id) => S.players.find((p) => p.id === id);

// Confirmation built into the page (native confirm() is unavailable in some viewers).
export function ask({ title, text, confirm, danger = false }) {
  return new Promise((resolve) => {
    openSheet('confirm', { title, text, confirm, danger, resolve });
  });
}
