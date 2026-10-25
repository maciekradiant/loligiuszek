import { S, onRender, render, go, closeSheet } from './state.js';
import { morph } from './dom.js';
import { unlock } from './audio.js';
import { drawBoard, confetti } from './fx.js';
import { esc } from './util.js';
import { sheetFrame } from './views/common.js';
import { homeView, homeActions } from './views/home.js';
import { setupView, setupActions, initDrag, newSetup } from './views/setup.js';
import { gameView, gameActions, gameSheet } from './views/game.js';
import { playersView, playerActions, playerSheet } from './views/players.js';
import { historyView, historyActions, historySheet } from './views/history.js';
import { settingsView, settingsActions, settingsSheet } from './views/settings.js';

const app = document.getElementById('app');

function resolveConfirm(answer) {
  const sheet = S.ui.sheet;
  S.ui.sheet = null;
  render();
  sheet?.resolve?.(answer);
}

const actions = {
  ...homeActions,
  ...setupActions,
  ...gameActions,
  ...playerActions,
  ...historyActions,
  ...settingsActions,
  go: (el) => {
    const to = el.dataset.to;
    if (to === 'game' && !S.session) return go('home');
    if (to === 'setup' && !S.ui.setup) S.ui.setup = newSetup();
    go(to);
  },
  'close-sheet': () => {
    if (S.ui.sheet?.type === 'confirm') return resolveConfirm(false);
    closeSheet();
  },
  'confirm-yes': () => resolveConfirm(true),
  'confirm-no': () => resolveConfirm(false),
};

// ---------- rendering ----------

function screenView() {
  switch (S.ui.screen) {
    case 'setup':
      return S.ui.setup ? setupView() : homeView();
    case 'game':
      return S.session ? gameView() : homeView();
    case 'players':
      return playersView();
    case 'history':
      return historyView();
    case 'settings':
      return settingsView();
    default:
      return homeView();
  }
}

function sheetView() {
  const sheet = S.ui.sheet;
  if (!sheet) return '';
  if (sheet.type === 'confirm') {
    return sheetFrame(
      esc(sheet.title),
      `<p class="hint">${esc(sheet.text)}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button class="btn" data-act="confirm-no">Anuluj</button>
        <button class="btn ${sheet.danger ? 'btn-line btn-danger' : 'btn-primary'}" data-act="confirm-yes">${esc(sheet.confirm)}</button>
      </div>`,
    );
  }
  const html = gameSheet(sheet) || playerSheet(sheet) || historySheet(sheet) || settingsSheet(sheet);
  return sheet.closing ? html.replace('class="sheet-wrap"', 'class="sheet-wrap closing"') : html;
}

function toastView() {
  const t = S.ui.toast;
  return t ? `<div class="toast ${t.kind}" role="status" data-key="${t.id}">${esc(t.text)}</div>` : '';
}

function renderApp() {
  morph(app, screenView() + sheetView() + toastView());
  afterRender();
}

let boardFontsReady = false;
let lastActive = null;

function afterRender() {
  const hero = document.getElementById('hero-board');
  if (hero && (!hero._drawn || hero._drawnWithFonts !== boardFontsReady)) {
    drawBoard(hero);
    hero._drawn = true;
    hero._drawnWithFonts = boardFontsReady;
  }
  const active = document.querySelector('.scoreboard .on');
  if (active && active.dataset.key !== lastActive) {
    lastActive = active.dataset.key;
    active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  if (S.ui.confetti) {
    S.ui.confetti = false;
    requestAnimationFrame(() => confetti(document.getElementById('fx')));
  }
  syncWakeLock();
}

onRender(renderApp);

// ---------- events ----------

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el, e);
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  actions[form.dataset.form]?.(form, e);
});

// Hardware keyboard on iPad / desktop: digits, Enter, Backspace, U to undo.
document.addEventListener('keydown', (e) => {
  if (S.ui.screen !== 'game' || S.ui.sheet || e.target.closest?.('input, textarea')) return;
  const click = (sel) => {
    const el = document.querySelector(sel);
    if (el && !el.disabled) {
      e.preventDefault();
      el.click();
    }
  };
  if (/^[0-9]$/.test(e.key)) click(`[data-act="key"][data-v="${e.key}"]`);
  else if (e.key === 'Enter') click('[data-act="submit"]');
  else if (e.key === 'Backspace') click(S.ui.entry ? '[data-act="back"]' : '[data-act="undo"]');
  else if (e.key.toLowerCase() === 'u' || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z')) click('[data-act="undo"]');
  else if (e.key === 'Escape' && S.ui.overlay) click('[data-act="dismiss-overlay"]');
});

for (const type of ['touchend', 'pointerdown', 'keydown']) document.addEventListener(type, unlock, { once: true, passive: true });

initDrag(app);

// ---------- screen wake lock ----------

let lock = null;
let lockPending = false;

async function syncWakeLock() {
  const want = S.ui.screen === 'game' && S.settings.wakeLock && document.visibilityState === 'visible';
  if (lockPending || !('wakeLock' in navigator)) return;
  try {
    if (want && !lock) {
      lockPending = true;
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => (lock = null));
    } else if (!want && lock) {
      lockPending = true;
      await lock.release();
      lock = null;
    }
  } catch {
    lock = null;
  } finally {
    lockPending = false;
  }
}

document.addEventListener('visibilitychange', syncWakeLock);

// ---------- boot ----------

const recent = S.session?.touched && Date.now() - S.session.touched < 3 * 3600e3;
S.ui.screen = recent ? 'game' : 'home';
render();

document.fonts?.ready.then(() => {
  boardFontsReady = true;
  render();
});

if ('serviceWorker' in navigator && window.isSecureContext && window.top === window.self) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
