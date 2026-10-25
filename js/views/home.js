import { S, render, go, persist } from '../state.js';
import { CATEGORIES, isCue } from '../engine/registry.js';
import { matchState } from '../engine/match.js';
import { boardMatch } from '../session.js';
import { MODE_INFO, CATEGORY_INFO, describe } from '../modes-ui.js';
import { esc, nf } from '../util.js';
import { icon, tabbar, categorySwitch } from './common.js';
import { ball } from './cue.js';
import { newSetup } from './setup.js';

function liveScores(ses) {
  const m = ses.boards.map((_, b) => boardMatch(ses, b)).find((x) => x && !x.finished) || boardMatch(ses, 0);
  if (!m) return '';
  const R = matchState(m);
  const st = R.leg.st;
  const value = (i) => {
    if (m.mode === 'x01') return st.rem[i];
    if (m.mode === 'cricket' || m.mode === 'shanghai' || m.mode === 'snooker') return st.pts[i];
    if (m.mode === 'killer') return `${st.lives[i]}♦`;
    if (m.mode === 'clock') return st.pos[i];
    if (isCue(m.mode)) return R.legsInSet[i];
    return '';
  };
  return `<span class="resume-scores">${m.players
    .slice(0, 4)
    .map((p, i) => `<span>${esc(p.name.split(' ')[0])} <b>${value(i)}</b></span>`)
    .join('')}</span>`;
}

function resumeCard() {
  const ses = S.session;
  if (!ses) return '';
  const live = !ses.done && ses.boards.some((_, b) => {
    const m = boardMatch(ses, b);
    return !m || !m.finished;
  });
  const what = ses.format === 'knockout' ? 'Puchar' : ses.format === 'league' ? 'Liga' : live ? 'Trwa gra' : 'Koniec meczu';
  const boards = ses.boards.length > 1 ? ` · ${nf(ses.boards.length, ...boardForms(ses.mode))}` : '';
  return `<button class="resume" data-act="go" data-to="game">
    <span class="grow">
      <span class="row">${live ? '<span class="live-dot"></span>' : ''}<span class="eyebrow">${what}${boards}</span></span>
      <b class="resume-title">${esc(describe(ses.mode, ses.rules))}</b>
      ${liveScores(ses)}
    </span>
    ${icon.chev}
  </button>`;
}

const boardForms = (mode) => (isCue(mode) ? ['stół', 'stoły', 'stołów'] : ['tarcza', 'tarcze', 'tarcz']);

function modeGlyph(id) {
  if (id === 'pool8') return ball(8, 'glyph-ball');
  if (id === 'pool9') return ball(9, 'glyph-ball');
  if (id === 'snooker') return '<span class="ball sn glyph-ball" style="--ball:var(--sn-1)"><i>15</i></span>';
  return `<span class="mode-row-text">${MODE_INFO[id].glyph}</span>`;
}

export function homeView() {
  const cat = S.settings.category;
  const info = CATEGORY_INFO[cat];
  const rows = CATEGORIES[cat]
    .map(
      (id) => `<button class="mode-row" data-act="new-game" data-mode="${id}" data-key="${id}">
        <span class="mode-row-glyph" aria-hidden="true">${modeGlyph(id)}</span>
        <span class="grow"><b>${MODE_INFO[id].name}</b><small>${MODE_INFO[id].short}</small></span>
        ${icon.chev}
      </button>`,
    )
    .join('');
  return `<div class="screen">
    <div class="scroll home-scroll">
      <header class="hero" data-cat="${cat}">
        <canvas id="hero-dart" class="hero-art art-dart" data-keep aria-hidden="true"></canvas>
        <canvas id="hero-cue" class="hero-art art-cue" data-keep aria-hidden="true"></canvas>
        <h1 class="wordmark">Lotka<small>${info.tagline}</small></h1>
      </header>
      <div class="home-body">
        ${categorySwitch(cat)}
        ${resumeCard()}
        <button class="btn btn-primary btn-block" data-act="new-game">Nowa gra</button>
        <div class="list-card mode-list">${rows}</div>
      </div>
      <footer class="credit"><i class="credit-rule" aria-hidden="true"></i><span><b>radiant</b> to zrobił</span></footer>
    </div>
    ${tabbar('home')}
  </div>`;
}

export const homeActions = {
  'new-game': (el) => {
    S.ui.setup = newSetup(el.dataset.mode, S.settings.category);
    go('setup');
  },
  category: (el) => {
    if (S.settings.category === el.dataset.v) return;
    S.settings.category = el.dataset.v;
    persist('settings');
    render();
  },
};
