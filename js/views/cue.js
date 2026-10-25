// Screens for the cue sports: scoreboards, the rack of tappable balls and the snooker pad.

import { snookerOn, snookerRemaining } from '../engine/cue.js';
import { esc, nf } from '../util.js';
import { icon, avatar, colorVar, sheetFrame, pips } from './common.js';

const firstName = (name) => String(name).split(' ')[0];

// A pool ball: solids 1–8 in their colour, stripes 9–15 as a band on white.
export const ball = (n, cls = '') =>
  `<span class="ball ${n > 8 ? 'stripe' : ''} ${cls}" style="--ball:var(--ball-${n > 8 ? n - 8 : n})"><i>${n}</i></span>`;

const SNOOKER_BALLS = [
  [1, 'Czerwona'],
  [2, 'Żółta'],
  [3, 'Zielona'],
  [4, 'Brązowa'],
  [5, 'Niebieska'],
  [6, 'Różowa'],
  [7, 'Czarna'],
];

const snookerBall = (v, cls = '') => `<span class="ball sn ${cls}" style="--ball:var(--sn-${v})"><i>${v}</i></span>`;

// ---------- scoreboards ----------

function card(m, R, i, { score, top = '', meta = '' }) {
  const p = m.players[i];
  const on = R.leg.cur === i;
  return `<div class="pc ${on ? 'on' : ''}" data-key="${p.id}" style="--pc:${colorVar(p.color)}">
    <div class="pc-top"><span class="pc-flag"></span><span class="pc-name">${esc(p.name)}</span>${top}</div>
    <div class="pc-score">${score}</div>
    <div class="pc-meta">${meta}</div>
  </div>`;
}

function groupLabel(st, i) {
  if (!st.groups) return '<span>Stół otwarty</span>';
  const solids = st.groups[i] === 'solids';
  const left = st.on.filter((b) => (solids ? b < 8 : b > 8)).length;
  return `<span>${solids ? 'Pełne' : 'Połówki'}: <b>${left || 'ósemka'}</b></span>`;
}

function poolBoard(m, R) {
  const st = R.leg.st;
  const cards = [0, 1]
    .map((i) => {
      const fouls = R.leg.fouls[i];
      const left =
        m.mode === 'pool8'
          ? groupLabel(st, i)
          : `<span class="${fouls >= 2 && R.rules.threeFoul ? 'warn' : ''}">${fouls ? `${nf(fouls, 'faul', 'faule', 'fauli')} z rzędu` : 'Bez fauli'}</span>`;
      return card(m, R, i, {
        score: R.legsInSet[i],
        top: pips(R.legsInSet[i], R.rules.legs),
        meta: `${left}<span>B&amp;R <b>${R.stats[i].breakRuns}</b></span>`,
      });
    })
    .join('');
  return `<div class="duel">${cards}</div>`;
}

function snookerBoard(m, R) {
  const st = R.leg.st;
  const cards = [0, 1]
    .map((i) => {
      const on = R.leg.cur === i;
      return card(m, R, i, {
        score: st.pts[i],
        top: pips(R.legsInSet[i], R.rules.legs),
        meta: on
          ? `<span>Brejk <b>${R.leg.turn.pts}</b></span><span>Najw. <b>${Math.max(R.stats[i].hb, R.leg.turn.pts)}</b></span>`
          : `<span>Najw. brejk <b>${R.stats[i].hb}</b></span>`,
      });
    })
    .join('');
  const rem = snookerRemaining(st);
  const diff = Math.abs(st.pts[0] - st.pts[1]);
  const behind = st.pts[0] === st.pts[1] ? null : st.pts[0] < st.pts[1] ? 0 : 1;
  const needs = behind !== null && diff > rem ? `<span class="warn">${esc(firstName(m.players[behind].name))} potrzebuje snookerów</span>` : '';
  const phase = st.respot ? 'Czarna wraca na stół' : st.phase === 'reds' ? `Czerwone <b>${st.reds}</b>` : 'Kolory po kolei';
  return `<div class="duel">${cards}</div>
    <div class="table-info"><span>Na stole <b>${rem}</b></span><span>Różnica <b>${diff}</b></span><span>${phase}</span>${needs}</div>`;
}

export function cueScoreboard(m, R) {
  return m.mode === 'snooker' ? snookerBoard(m, R) : poolBoard(m, R);
}

// ---------- turn strip ----------

export function cueTurnStrip(m, R) {
  const t = R.leg.turn;
  const sn = m.mode === 'snooker';
  const potted = sn
    ? t.balls.map((v) => snookerBall(v, 'mini')).join('')
    : t.balls.map((n) => ball(n, 'mini')).join('');
  return `<div class="turn">
    <div class="cue-visit"><span class="eyebrow">Przy stole</span><b>${esc(m.players[t.p].name)}</b></div>
    <div class="mini-balls">${potted}</div>
    <div class="turn-sum"><small>${sn ? 'Brejk' : 'Seria'}</small>${sn ? t.pts : t.balls.length}</div>
    <button class="icon-btn" data-act="undo" aria-label="Cofnij ostatnie zagranie" ${m.events.length ? '' : 'disabled'}>${icon.undo}</button>
  </div>`;
}

// ---------- pads ----------

const endRow = (foulAct = 'cue-foul') => `<div class="pad-row" style="grid-template-columns:1fr 1fr 1fr">
  <button class="key tall miss" data-act="cue-miss">Pudło</button>
  <button class="key tall foul" data-act="${foulAct}">Faul</button>
  <button class="key tall ghost" data-act="cue-frame-open">Koniec partii</button>
</div>`;

function poolPad(m, R) {
  const st = R.leg.st;
  const p = R.leg.cur;
  const all = m.mode === 'pool8' ? Array.from({ length: 15 }, (_, i) => i + 1) : Array.from({ length: 9 }, (_, i) => i + 1);
  const target = m.mode === 'pool9' ? Math.min(...st.on) : null;
  const mine = m.mode === 'pool8' && st.groups ? st.groups[p] : null;
  const groupDone = mine && !st.on.some((b) => (mine === 'solids' ? b < 8 : b > 8));
  const keys = all
    .map((n) => {
      const down = n !== 8 && !st.on.includes(n);
      const own = (mine === 'solids' && n < 8) || (mine === 'stripes' && n > 8) || (n === 8 && groupDone);
      const cls = [down ? 'down' : '', n === target ? 'target' : '', own && !down ? 'own' : ''].join(' ');
      return `<button class="ball-key ${cls}" data-act="cue-pot" data-b="${n}" ${down ? 'disabled' : ''} aria-label="Bila ${n}">${ball(n)}${n === target ? '<small>na celu</small>' : ''}</button>`;
    })
    .join('');
  return `<div class="pad">
    <div class="rack ${m.mode}">${keys}</div>
    ${endRow('cue-foul')}
  </div>`;
}

function snookerPad(m, R) {
  const st = R.leg.st;
  const on = snookerOn(st, R.leg.turn);
  const keys = SNOOKER_BALLS.map(([v, label]) => {
    const live = on.includes(v);
    const sub = v === 1 ? `zostało ${st.reds}` : `${v} pkt`;
    return `<button class="key sn-key ${v === 1 ? 'red-key' : ''}" data-act="cue-pot" data-b="${v}" ${live ? '' : 'disabled'}>${snookerBall(v)}<span><b>${label}</b><small>${sub}</small></span></button>`;
  }).join('');
  return `<div class="pad">
    <div class="sn-grid">${keys}</div>
    ${endRow('cue-foul')}
  </div>`;
}

export function cuePad(m, R) {
  return m.mode === 'snooker' ? snookerPad(m, R) : poolPad(m, R);
}

// ---------- sheets ----------

export function cueSheet(sheet, m, R) {
  if (!m || !R) return '';
  if (sheet.type === 'cue-frame') {
    const shooter = R.leg.cur;
    const intro =
      sheet.reason === '8'
        ? `<p class="hint">Ósemka w łuzie. Wbita legalnie po swojej grupie: partia dla ${esc(m.players[shooter].name)}. Wbita za wcześnie albo z faulem: partia dla rywala.</p>`
        : m.mode === 'snooker'
          ? '<p class="hint">Koniec partii przed czasem, np. gdy ktoś ją oddaje. Wybierz zwycięzcę.</p>'
          : '<p class="hint">Wybierz, kto wygrał tę partię.</p>';
    const order = sheet.reason === '8' ? [shooter, 1 - shooter] : [0, 1];
    const buttons = order
      .map((i) => `<button class="btn btn-primary winner-pick" data-act="cue-frame" data-p="${i}">${avatar(m.players[i])}<span>${esc(m.players[i].name)}</span></button>`)
      .join('');
    return sheetFrame('Kto wygrał partię?', `${intro}<div class="stack">${buttons}</div>`);
  }
  if (sheet.type === 'cue-foul') {
    const st = R.leg.st;
    const opp = m.players[1 - R.leg.cur].name;
    const redRow =
      st.reds > 0
        ? `<button class="switch-row" role="switch" aria-checked="${!!sheet.red}" data-act="cue-foul-red"><span class="grow"><b>Wpadła czerwona</b><small>Czerwona zeszła przy faulu i nie wraca na stół.</small></span><span class="switch"></span></button>`
        : '';
    return sheetFrame(
      'Faul',
      `<p class="hint">Ile punktów dostaje ${esc(opp)}? Co najmniej 4, albo wartość bili, której dotyczył faul.</p>
      <div class="choice-grid" style="grid-template-columns:repeat(4,1fr)">${[4, 5, 6, 7]
        .map((v) => `<button class="btn btn-primary" data-act="cue-foul-v" data-v="${v}">${v}</button>`)
        .join('')}</div>
      ${redRow}`,
    );
  }
  return '';
}

export const isCueSheet = (type) => type === 'cue-frame' || type === 'cue-foul';
