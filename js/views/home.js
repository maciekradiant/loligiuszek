import { S, render, go } from '../state.js';
import { MODE_IDS } from '../engine/modes.js';
import { matchState } from '../engine/match.js';
import { boardMatch } from '../session.js';
import { MODE_INFO, describe } from '../modes-ui.js';
import { esc, timeAgo, nf } from '../util.js';
import { icon, avatar, tabbar } from './common.js';
import { newSetup } from './setup.js';

function liveScores(ses) {
  const m = ses.boards.map((_, b) => boardMatch(ses, b)).find((x) => x && !x.finished) || boardMatch(ses, 0);
  if (!m) return '';
  const R = matchState(m);
  const st = R.leg.st;
  const value = (i) => {
    if (m.mode === 'x01') return st.rem[i];
    if (m.mode === 'cricket' || m.mode === 'shanghai') return st.pts[i];
    if (m.mode === 'killer') return `${st.lives[i]}♦`;
    if (m.mode === 'clock') return st.pos[i];
    return '';
  };
  return `<div class="resume-scores">${m.players
    .slice(0, 4)
    .map((p, i) => `<span>${esc(p.name.split(' ')[0])} <b>${value(i)}</b></span>`)
    .join('')}${m.players.length > 4 ? `<span class="faint">+${m.players.length - 4}</span>` : ''}</div>`;
}

function resumeCard() {
  const ses = S.session;
  if (!ses) return '';
  const live = !ses.done && ses.boards.some((_, b) => {
    const m = boardMatch(ses, b);
    return !m || !m.finished;
  });
  const what = ses.format === 'knockout' ? 'Puchar' : ses.format === 'league' ? 'Liga' : live ? 'Trwa gra' : 'Mecz zakończony';
  const boards = ses.boards.length > 1 ? ` · ${nf(ses.boards.length, 'tarcza', 'tarcze', 'tarcz')}` : '';
  return `<button class="resume" data-act="go" data-to="game">
    <span class="row">${live ? '<span class="live-dot"></span>' : ''}<span class="eyebrow" style="color:var(--sisal)">${what}${boards}</span></span>
    <span class="display" style="font-size:30px;text-transform:uppercase">${esc(describe(ses.mode, ses.rules))}</span>
    ${liveScores(ses)}
    <span class="row link">${live ? 'Wróć do gry' : 'Zobacz wynik'} ${icon.next}</span>
  </button>`;
}

function quickAgain() {
  const last = S.lastSetup;
  if (!last || S.session) return '';
  const names = (last.selected || [])
    .map((id) => S.players.find((p) => p.id === id)?.name)
    .filter(Boolean);
  if (!names.length) return '';
  return `<button class="list-card list-row" style="padding:14px" data-act="new-game" data-mode="${last.mode}">
    <span class="grow"><small>Zagraj jeszcze raz</small><b>${esc(describe(last.mode, last.rules[last.mode]))} · ${esc(names.slice(0, 3).join(', '))}${names.length > 3 ? ` +${names.length - 3}` : ''}</b></span>${icon.chev}
  </button>`;
}

function recent() {
  const items = S.history.slice(0, 3);
  if (!items.length) return '';
  return `<section class="section">
    <div class="section-head"><h2 class="section-title">Ostatnie mecze</h2><button class="link" data-act="go" data-to="history">Wszystkie</button></div>
    <div class="list-card">${items
      .map((h) => {
        const w = h.players.find((p) => p.id === h.winnerId);
        const vs = h.players.map((p) => esc(p.name)).join(' · ');
        return `<button class="list-row" data-act="history-detail" data-id="${h.id}">${avatar(w)}<span class="grow"><b>${esc(w?.name || '')} wygrywa</b><small>${esc(h.label)} · ${vs}</small></span><span class="faint" style="font-size:12px">${timeAgo(h.ts)}</span></button>`;
      })
      .join('')}</div>
  </section>`;
}

export function homeView() {
  const tiles = MODE_IDS.map((id, i) => {
    const info = MODE_INFO[id];
    return `<button class="mode-tile ${i === 0 ? 'wide' : ''}" data-act="new-game" data-mode="${id}">
      <span class="mode-glyph" aria-hidden="true">${info.glyph}</span>
      <b>${info.name}</b>
      <span>${info.desc}</span>
    </button>`;
  }).join('');
  return `<div class="screen">
    <div class="scroll" style="padding-left:0;padding-right:0;padding-top:0">
      <header class="hero">
        <canvas id="hero-board" data-keep aria-hidden="true"></canvas>
        <h1 class="wordmark">Lotka<small>Licznik punktów do darta</small></h1>
      </header>
      <div style="padding-left:var(--gut-l);padding-right:var(--gut-r)" class="stack">
        ${resumeCard()}
        <button class="btn btn-primary btn-block" data-act="new-game">${S.session ? 'Nowa gra' : 'Zacznij grę'}</button>
        ${quickAgain()}
        <section class="section">
          <h2 class="section-title">Tryby gry</h2>
          <div class="mode-grid">${tiles}</div>
        </section>
        ${recent()}
      </div>
    </div>
    ${tabbar('home')}
  </div>`;
}

export const homeActions = {
  'new-game': (el) => {
    S.ui.setup = newSetup(el.dataset.mode);
    go('setup');
  },
};
