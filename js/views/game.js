import { S, render, persist, go, openSheet, closeSheet, toast, ask } from '../state.js';
import { CRICKET_TARGETS, clockSequence } from '../engine/modes.js';
import { matchState, pushEvent, undoEvent, checkVisit } from '../engine/match.js';
import { checkoutRoute, dartLabel } from '../engine/darts.js';
import { avg3, pct, statRows, fmt } from '../engine/stats.js';
import { roundName, knockoutRounds, standings, nextTie } from '../engine/tournament.js';
import { boardMatch, boardStatus, startNextOnBoard, completeMatch, reopenMatch, canReopen, rematch, busyPlayers } from '../session.js';
import { say, thud, chime, clack } from '../audio.js';
import { esc, plural, uid, clamp } from '../util.js';
import { icon, avatar, colorVar, pips, markSvg, sheetFrame } from './common.js';
import { describe, categoryInfo } from '../modes-ui.js';
import { isCue } from '../engine/registry.js';
import { cueScoreboard, cueTurnStrip, cuePad, cueSheet, isCueSheet } from './cue.js';

const firstName = (name) => String(name).split(' ')[0];
const boardIdx = () => clamp(S.ui.board, 0, S.session.boards.length - 1);
const currentMatch = () => (S.session ? boardMatch(S.session, boardIdx()) : null);

export function formatLabel(rules, mode) {
  const { legs = 1, sets = 1 } = rules;
  if (isCue(mode)) return legs > 1 ? `do ${legs} wygranych partii` : 'jedna partia';
  if (sets > 1) return `do ${sets} setów · set do ${legs} ${plural(legs, 'lega', 'legów', 'legów')}`;
  if (legs > 1) return `do ${legs} wygranych legów`;
  return 'jeden leg';
}

function tieOf(ses, m) {
  return m?.tie && ses.ties ? ses.ties.find((t) => t.key === m.tie) : null;
}

function tieLabel(ses, tie) {
  if (!tie) return '';
  const rounds = ses.format === 'knockout' ? knockoutRounds(ses.ties) : 0;
  return roundName(tie.round, rounds, ses.format);
}

// ---------- screen ----------

export function gameView() {
  const ses = S.session;
  const b = boardIdx();
  const m = boardMatch(ses, b);
  const R = m ? matchState(m) : null;
  let body;
  if (!m) body = idleView(ses, b);
  else if (R.winner !== null) body = resultView(ses, m, R);
  else if (isCue(m.mode)) body = `<div class="scoreboard">${cueScoreboard(m, R)}</div>${cueTurnStrip(m, R)}${cuePad(m, R)}`;
  else body = `<div class="scoreboard">${scoreboard(m, R)}</div>${turnStrip(m, R)}${pad(m, R)}`;
  return `<div class="screen game">${head(ses, m, R)}${boardTabs(ses, b)}${body}${flashView()}${overlayView()}<canvas class="fx-canvas" id="fx" data-keep></canvas></div>`;
}

function head(ses, m, R) {
  const parts = [];
  const tie = tieOf(ses, m);
  if (tie) parts.push(tieLabel(ses, tie));
  if (R && R.winner === null && isCue(m.mode)) {
    parts.push(`Partia ${R.legNo + 1}`, `rozbija ${firstName(m.players[R.leg.starter].name)}`);
  } else if (R && R.winner === null) {
    if (ses.rules.sets > 1) parts.push(`Set ${R.setNo}`);
    if (ses.rules.legs > 1 || ses.rules.sets > 1) parts.push(`Leg ${R.legNo + 1}`);
    if (m.mode !== 'x01' && m.mode !== 'shanghai') parts.push(`Runda ${R.leg.round}`);
  }
  parts.push(formatLabel(ses.rules, ses.mode));
  return `<header class="bar-head">
    <button class="icon-btn" data-act="go" data-to="home" aria-label="Menu główne">${icon.back}</button>
    <div class="bar-title"><strong>${esc(describe(ses.mode, ses.rules))}</strong><span>${esc(parts.join(' · '))}</span></div>
    <button class="icon-btn" data-act="game-menu" aria-label="Opcje gry">${icon.more}</button>
  </header>`;
}

function boardTabs(ses, cur) {
  if (ses.format === 'single' && ses.boards.length < 2) return '';
  const tabs = ses.boards.map((_, b) => {
    const m = boardMatch(ses, b);
    const st = boardStatus(ses, b);
    const cue = isCue(ses.mode);
    let label = st === 'waiting' ? (cue ? 'wolny' : 'wolna') : st === 'done' ? 'koniec' : '';
    if (m) label = m.players.slice(0, 2).map((p) => esc(firstName(p.name))).join(' · ') + (m.players.length > 2 ? ` +${m.players.length - 2}` : '');
    return `<button class="board-tab" data-act="board" data-b="${b}" aria-pressed="${b === cur}"><span class="status-dot ${st}"></span><b>${categoryInfo(ses.mode).boardShort}${b + 1}</b>${label}</button>`;
  });
  if (ses.format !== 'single') tabs.push(`<button class="board-tab" data-act="bracket">${ses.format === 'knockout' ? 'Drabinka' : 'Tabela'}</button>`);
  return `<div class="board-tabs">${tabs.join('')}</div>`;
}

// ---------- scoreboards ----------

function scoreboard(m, R) {
  switch (m.mode) {
    case 'x01':
      return x01Board(m, R);
    case 'cricket':
      return cricketBoard(m, R);
    case 'clock':
      return clockBoard(m, R);
    case 'shanghai':
      return shanghaiBoard(m, R);
    case 'killer':
      return killerBoard(m, R);
    default:
      return '';
  }
}

function legsBadge(R, i) {
  const sets = R.rules.sets > 1 ? `<span class="set-badge">S ${R.sets[i]}</span>` : '';
  return `${sets}${pips(R.legsInSet[i], R.rules.legs)}`;
}

const lastVisit = (R, i) => [...R.leg.visits].reverse().find((v) => v.p === i);

function hintChips(R, i) {
  const st = R.leg.st;
  if (!S.settings.hints || !st.open[i] || st.rem[i] > 170) return '<div class="checkout"></div>';
  const route = checkoutRoute(st.rem[i], 3 - R.leg.turn.n, R.rules.out);
  return `<div class="checkout">${route ? route.map((d) => `<span>${dartLabel(d)}</span>`).join('') : ''}</div>`;
}

function recentVisits(R, i) {
  const list = R.leg.visits.filter((v) => v.p === i).slice(-5);
  return `<div class="visits">${list
    .map((v) => `<span class="${v.bust ? 'bust' : v.score >= 100 ? 'ton' : ''}">${v.bust ? '✕' : v.score}</span>`)
    .join('')}</div>`;
}

function x01Meta(R, i) {
  const right = R.leg.st.open[i] ? `Lotki <b>${R.leg.darts[i]}</b>` : '<b>czeka na double</b>';
  return `<div class="pc-meta"><span>Śr. <b>${fmt.f1(avg3(R.stats[i]))}</b></span><span>${right}</span></div>`;
}

function x01Board(m, R) {
  const n = m.players.length;
  if (n <= 2) return `<div class="${n === 2 ? 'duel' : 'duel solo-wrap'}" style="${n === 1 ? 'grid-template-columns:1fr' : ''}">${m.players.map((_, i) => x01Card(m, R, i, n === 1 ? 'solo' : '')).join('')}</div>`;
  return `<div class="plist">${m.players.map((_, i) => x01Row(m, R, i)).join('')}</div>`;
}

function x01Card(m, R, i, cls) {
  const p = m.players[i];
  const on = R.leg.cur === i;
  return `<div class="pc ${on ? 'on' : ''} ${cls}" data-key="${p.id}" style="--pc:${colorVar(p.color)}">
    <div class="pc-top"><span class="pc-flag"></span><span class="pc-name">${esc(p.name)}</span>${legsBadge(R, i)}</div>
    <div class="pc-score">${R.leg.st.rem[i]}</div>
    ${on ? hintChips(R, i) : '<div class="checkout"></div>'}
    ${x01Meta(R, i)}
    ${recentVisits(R, i)}
  </div>`;
}

function x01Row(m, R, i) {
  const p = m.players[i];
  const on = R.leg.cur === i;
  const last = lastVisit(R, i);
  return `<div class="prow ${on ? 'on' : ''}" data-key="${p.id}" style="--pc:${colorVar(p.color)}">
    <span class="pc-flag"></span>
    <div class="pc-name">${esc(p.name)}<small>Śr. ${fmt.f1(avg3(R.stats[i]))}${last ? ` · ost. ${last.bust ? 'BUST' : last.score}` : ''}</small></div>
    <div class="row">${legsBadge(R, i)}<div class="prow-score">${R.leg.st.rem[i]}</div></div>
    ${on ? hintChips(R, i) : ''}
  </div>`;
}

function cricketBoard(m, R) {
  const n = m.players.length;
  const st = R.leg.st;
  const duel = n === 2;
  const cols = duel ? '1fr 54px 1fr' : `44px repeat(${n}, minmax(0, 1fr))`;
  const headCell = (i) =>
    `<div class="cr-cell ${R.leg.cur === i ? 'on' : ''}"><span class="pc-name">${esc(firstName(m.players[i].name))}</span><div class="cr-pts">${st.pts[i]}</div>${legsBadge(R, i)}</div>`;
  const header = duel ? `${headCell(0)}<div></div>${headCell(1)}` : `<div></div>${m.players.map((_, i) => headCell(i)).join('')}`;
  const rows = CRICKET_TARGETS.map((t) => {
    const dead = m.players.every((_, i) => st.marks[i][t] >= 3);
    const mark = (i) => {
      const k = st.marks[i][t];
      return `<div class="cr-mark ${R.leg.cur === i ? 'on' : ''} ${k >= 3 ? 'closed' : ''}">${markSvg(Math.min(3, k))}</div>`;
    };
    const num = `<div class="cr-num">${t === 25 ? 'B' : t}</div>`;
    const cells = duel ? mark(0) + num + mark(1) : num + m.players.map((_, i) => mark(i)).join('');
    return `<div class="cr-row ${dead ? 'dead' : ''}" style="grid-template-columns:${cols}">${cells}</div>`;
  }).join('');
  return `<div class="cr"><div class="cr-row cr-head" style="grid-template-columns:${cols}">${header}</div>${rows}</div>`;
}

function clockBoard(m, R) {
  const seq = clockSequence(R.rules);
  const st = R.leg.st;
  return `<div class="plist">${m.players
    .map((p, i) => {
      const on = R.leg.cur === i;
      const target = seq[st.pos[i]];
      const s = R.stats[i];
      const track = seq.map((_, k) => `<i class="${k < st.pos[i] ? 'done' : k === st.pos[i] ? 'next' : ''}"></i>`).join('');
      return `<div class="prow ${on ? 'on' : ''}" data-key="${p.id}" style="--pc:${colorVar(p.color)}">
        <span class="pc-flag"></span>
        <div class="pc-name">${esc(p.name)}<small>Trafienia ${s.hits}/${s.darts} · ${pct(s.hits, s.darts)}%</small></div>
        <div class="row">${legsBadge(R, i)}<div class="prow-score">${target === 25 ? 'B' : target ?? '✓'}</div></div>
        <div class="track" style="grid-template-columns:repeat(${seq.length},1fr)">${track}</div>
      </div>`;
    })
    .join('')}</div>`;
}

function shanghaiBoard(m, R) {
  const st = R.leg.st;
  const round = R.leg.round;
  const tiebreak = round > R.rules.rounds;
  const target = tiebreak ? 'Bull' : round;
  const info = `<div class="round-info"><div class="target-big"><span class="display">${target}</span><span><span class="eyebrow" style="display:block">Cel</span>${tiebreak ? 'Dogrywka remisu' : `Runda ${round} z ${R.rules.rounds}`}</span></div></div>`;
  const rows = m.players
    .map((p, i) => {
      const on = R.leg.cur === i;
      const out = !(st.tie ? st.tie.includes(i) : true);
      const turnPts = on ? R.leg.turn.pts : lastVisit(R, i)?.score;
      return `<div class="prow ${on ? 'on' : ''} ${out ? 'out' : ''}" data-key="${p.id}" style="--pc:${colorVar(p.color)}">
        <span class="pc-flag"></span>
        <div class="pc-name">${esc(p.name)}<small>${on ? 'Ta tura' : 'Ostatnio'}: ${turnPts ?? 0} pkt</small></div>
        <div class="row">${legsBadge(R, i)}<div class="prow-score">${st.pts[i]}</div></div>
      </div>`;
    })
    .join('');
  return `${info}<div class="plist">${rows}</div>`;
}

function killerBoard(m, R) {
  const st = R.leg.st;
  return `<div class="plist">${m.players
    .map((p, i) => {
      const on = R.leg.cur === i;
      const dead = st.lives[i] <= 0;
      const lives = Array.from({ length: R.rules.lives }, (_, k) => `<i class="${k < st.lives[i] ? '' : 'lost'}"></i>`).join('');
      return `<div class="prow ${on ? 'on' : ''} ${dead ? 'out' : ''}" data-key="${p.id}" style="--pc:${colorVar(p.color)}">
        <span class="kl-num ${st.killer[i] ? 'killer' : ''}">${st.nums[i]}</span>
        <div class="pc-name">${esc(p.name)}${st.killer[i] && !dead ? '<span class="tag">Killer</span>' : ''}<small>${dead ? 'Odpada' : st.killer[i] ? `Celuj w ${R.rules.zone === 'double' ? 'podwójne ' : ''}pola rywali` : `Traf ${R.rules.zone === 'double' ? 'D' : ''}${st.nums[i]}, aby zostać killerem`}</small></div>
        <div class="lives">${lives}</div>
      </div>`;
    })
    .join('')}</div>`;
}

// ---------- turn strip ----------

function turnStrip(m, R) {
  const t = R.leg.turn;
  const p = m.players[t.p];
  const totalMode = m.mode === 'x01' && S.settings.inputMode === 'total' && t.n === 0;
  let left;
  if (totalMode) {
    left = `<div class="entry" id="entry"><span class="display">${S.ui.entry || '0'}</span><span class="faint">${esc(p.name)} · wynik tury</span></div>`;
  } else {
    const slots = [0, 1, 2]
      .map((k) => {
        const d = t.darts[k];
        if (d) return `<span class="slot ${d.s === 0 ? 'miss' : ''}">${dartLabel(d)}</span>`;
        return `<span class="slot ${k === t.n ? 'cur' : ''}"></span>`;
      })
      .join('');
    left = `<div class="slots">${slots}</div><div class="turn-sum">${turnSum(m, R)}</div>`;
  }
  return `<div class="turn">${left}<button class="icon-btn" data-act="undo" aria-label="Cofnij ostatni rzut" ${m.events.length ? '' : 'disabled'}>${icon.undo}</button></div>`;
}

function turnSum(m, R) {
  const t = R.leg.turn;
  if (t.n === 0) {
    const prev = R.leg.visits.at(-1);
    if (!prev) return `<small>Zaczyna</small>${esc(firstName(m.players[t.p].name))}`;
    const label = m.mode === 'x01' ? (prev.bust ? 'BUST' : prev.score) : m.mode === 'killer' ? '–' : prev.score;
    return `<small>${esc(firstName(m.players[prev.p].name))} · ostatnio</small>${label}`;
  }
  switch (m.mode) {
    case 'x01': {
      const st = R.leg.st;
      return `<small>Ta tura</small>${st.startRem - st.rem[t.p]}`;
    }
    case 'cricket':
      return `<small>Znaczniki</small>${t.marks}`;
    case 'clock':
      return `<small>Trafienia</small>${t.hits}`;
    case 'shanghai':
      return `<small>Punkty</small>${t.pts}`;
    default:
      return `<small>Lotki</small>${t.n}/3`;
  }
}

// ---------- pads ----------

function pad(m, R) {
  const t = R.leg.turn;
  if (m.mode === 'x01') return S.settings.inputMode === 'total' && t.n === 0 ? padTotal(R) : padBoard(t.n > 0);
  if (m.mode === 'cricket') return padCricket();
  if (m.mode === 'clock' || m.mode === 'shanghai') return padTarget(m, R);
  if (m.mode === 'killer') return padKiller(m, R);
  return '';
}

const k = (attrs, label, cls = '', sub = '') => `<button class="key ${cls}" ${attrs}>${label}${sub ? `<small>${sub}</small>` : ''}</button>`;

function padTotal(R) {
  const st = R.leg.st;
  const p = R.leg.cur;
  const rem = st.rem[p];
  const quick = [26, 41, 45, 60, 81, 85, 100, 140, 180];
  const finish = st.open[p] && rem <= 170 && checkoutRoute(rem, 3, R.rules.out);
  const chips = [
    k('data-act="input-mode" data-v="darts"', 'Lotki', 'ghost', ''),
    finish ? k(`data-act="quick" data-v="${rem}"`, `✓ ${rem}`, 'hot') : '',
    ...quick.filter((v) => !finish || v !== rem).map((v) => k(`data-act="quick" data-v="${v}"`, v)),
  ].join('');
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => k(`data-act="key" data-v="${d}"`, d, 'tall')).join('');
  return `<div class="pad">
    <div class="quick">${chips}</div>
    <div class="pad-row" style="grid-template-columns:repeat(3,1fr)">${digits}
      ${k(`data-act="back" aria-label="Usuń cyfrę" ${S.ui.entry ? '' : 'disabled'}`, icon.backspace, 'tall')}
      ${k('data-act="key" data-v="0"', '0', 'tall')}
      ${k('data-act="submit"', 'OK', 'tall ok')}
    </div>
  </div>`;
}

function modKeys() {
  return `${k(`data-act="mult" data-v="2" aria-pressed="${S.ui.mult === 2}"`, 'Double', 'mod mod-d')}${k(`data-act="mult" data-v="3" aria-pressed="${S.ui.mult === 3}"`, 'Treble', 'mod mod-t')}`;
}

const prefix = () => (S.ui.mult === 3 ? 'T' : S.ui.mult === 2 ? 'D' : '');

function padBoard(midTurn) {
  const nums = Array.from({ length: 20 }, (_, i) => k(`data-act="num" data-s="${i + 1}"`, prefix() + (i + 1))).join('');
  return `<div class="pad">
    <div class="pad-row" style="grid-template-columns:repeat(5,1fr)">
      ${modKeys()}
      ${k(`data-act="dart" data-s="25" data-m="1" ${S.ui.mult === 3 ? 'disabled' : ''}`, '25', 'bull')}
      ${k(`data-act="dart" data-s="25" data-m="2" ${S.ui.mult === 3 ? 'disabled' : ''}`, 'Bull', 'bull mod')}
      ${k('data-act="dart" data-s="0" data-m="1"', 'Pudło', 'miss')}
    </div>
    <div class="pad-row" style="grid-template-columns:repeat(5,1fr)">${nums}</div>
    <div class="pad-row" style="grid-template-columns:1fr 1fr">
      ${k(`data-act="input-mode" data-v="total" ${midTurn ? 'disabled' : ''}`, 'Wpisz sumę', 'ghost')}
      ${k('data-act="end-turn"', 'Koniec tury', 'ghost')}
    </div>
  </div>`;
}

function padCricket() {
  const nums = [20, 19, 18, 17, 16, 15].map((s) => k(`data-act="num" data-s="${s}"`, prefix() + s, 'tall')).join('');
  return `<div class="pad">
    <div class="pad-row" style="grid-template-columns:repeat(3,1fr)">${modKeys()}${k('data-act="dart" data-s="0" data-m="1"', 'Pudło', 'miss')}</div>
    <div class="pad-row" style="grid-template-columns:repeat(3,1fr)">${nums}</div>
    <div class="pad-row" style="grid-template-columns:repeat(3,1fr)">
      ${k(`data-act="dart" data-s="25" data-m="1" ${S.ui.mult === 3 ? 'disabled' : ''}`, '25', 'bull tall')}
      ${k(`data-act="dart" data-s="25" data-m="2" ${S.ui.mult === 3 ? 'disabled' : ''}`, 'Bull', 'bull mod tall')}
      ${k('data-act="end-turn"', 'Koniec tury', 'ghost tall')}
    </div>
  </div>`;
}

function padTarget(m, R) {
  const target = R.eng.target(R.leg.st, R.leg.cur, R);
  const end = k('data-act="end-turn"', 'Koniec tury', 'ghost');
  if (target === 25) {
    return `<div class="pad">
      <div class="pad-row" style="grid-template-columns:repeat(3,1fr)">
        ${k('data-act="dart" data-s="0" data-m="1"', 'Pudło', 'miss xl')}
        ${k('data-act="dart" data-s="25" data-m="1"', '25', 'xl bull', 'zewnętrzny')}
        ${k('data-act="dart" data-s="25" data-m="2"', 'Bull', 'xl bull', 'środek')}
      </div>
      <div class="pad-row">${end}</div>
    </div>`;
  }
  const simple = m.mode === 'clock' && !R.rules.multi;
  if (simple) {
    return `<div class="pad">
      <div class="pad-row" style="grid-template-columns:1fr 1.4fr">
        ${k('data-act="dart" data-s="0" data-m="1"', 'Pudło', 'miss xl')}
        ${k(`data-act="dart" data-s="${target}" data-m="1"`, `Trafione ${target}`, 'xl ok')}
      </div>
      <div class="pad-row">${end}</div>
    </div>`;
  }
  return `<div class="pad">
    <div class="pad-row" style="grid-template-columns:1fr 1fr">
      ${k('data-act="dart" data-s="0" data-m="1"', 'Pudło', 'miss xl')}
      ${k(`data-act="dart" data-s="${target}" data-m="1"`, target, 'xl', 'pojedyncze')}
      ${k(`data-act="dart" data-s="${target}" data-m="2"`, `D${target}`, 'xl', 'podwójne')}
      ${k(`data-act="dart" data-s="${target}" data-m="3"`, `T${target}`, 'xl', 'potrójne')}
    </div>
    <div class="pad-row">${end}</div>
  </div>`;
}

function padKiller(m, R) {
  const st = R.leg.st;
  const zoneD = R.rules.zone === 'double';
  const cur = R.leg.cur;
  const keys = m.players
    .map((p, i) => (st.lives[i] > 0 ? k(`data-act="dart" data-s="${st.nums[i]}" data-m="${zoneD ? 2 : 1}"`, `${zoneD ? 'D' : ''}${st.nums[i]}`, `tall ${i === cur ? 'hot' : ''}`, i === cur ? 'twój numer' : esc(firstName(p.name))) : ''))
    .join('');
  return `<div class="pad">
    <div class="pad-row" style="grid-template-columns:repeat(3,1fr)">${keys}</div>
    <div class="pad-row" style="grid-template-columns:1fr 1fr">
      ${k('data-act="dart" data-s="0" data-m="1"', 'Pudło', 'miss tall')}
      ${k('data-act="end-turn"', 'Koniec tury', 'ghost tall')}
    </div>
  </div>`;
}

// ---------- finished match, idle boards ----------

function rankPlayers(m, R) {
  const st = R.leg.st;
  const score = (i) => {
    switch (m.mode) {
      case 'x01':
        return -st.rem[i];
      case 'cricket':
        return R.rules.variant === 'cut' ? -st.pts[i] : st.pts[i];
      case 'clock':
        return st.pos[i];
      case 'shanghai':
        return st.pts[i];
      case 'killer':
        return st.lives[i];
      default:
        return 0;
    }
  };
  return m.players
    .map((_, i) => i)
    .sort((a, b) => (b === R.winner) - (a === R.winner) || R.sets[b] - R.sets[a] || R.stats[b].legs - R.stats[a].legs || score(b) - score(a));
}

function statsTable(m, R) {
  const cols = m.players.map((p) => `<th>${esc(firstName(p.name))}</th>`).join('');
  const rows = statRows(m.mode, R.stats[0]).map((_, r) => {
    const cells = m.players.map((_, i) => `<td>${statRows(m.mode, R.stats[i])[r][1]}</td>`).join('');
    return `<tr><td>${statRows(m.mode, R.stats[0])[r][0]}</td>${cells}</tr>`;
  });
  const legs = `<tr><td>Wygrane ${isCue(m.mode) ? 'partie' : 'legi'}</td>${m.players.map((_, i) => `<td>${R.stats[i].legs}</td>`).join('')}</tr>`;
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Statystyka</th>${cols}</tr></thead><tbody>${legs}${rows.join('')}</tbody></table></div>`;
}

function resultView(ses, m, R) {
  const w = m.players[R.winner];
  const n = m.players.length;
  const useSets = R.rules.sets > 1;
  const val = (i) => (useSets ? R.sets[i] : R.stats[i].legs);
  const score = n === 2 && (R.rules.legs > 1 || useSets) ? `<div class="final-score"><b>${val(0)}</b><span>:</span><b>${val(1)}</b></div>` : '';
  const order = rankPlayers(m, R);
  const ranking =
    n > 2
      ? `<div class="list-card">${order
          .map((i, pos) => `<div class="list-row ${pos === 0 ? 'rank-1' : ''}"><span class="rank-pos">${pos + 1}</span>${avatar(m.players[i])}<span class="grow"><b>${esc(m.players[i].name)}</b></span></div>`)
          .join('')}</div>`
      : '';
  const tour = ses.format !== 'single';
  const champId = ses.done ? ses.champion : null;
  const champ = champId ? S.players.find((p) => p.id === champId)?.name || '' : '';
  const banner =
    champ && champId !== w.id
      ? `<div class="card" style="text-align:center"><div class="eyebrow" style="color:var(--brass)">Mistrz turnieju</div><div class="winner-name" style="font-size:52px">${esc(champ)}</div></div>`
      : '';
  const title = champId === w.id ? 'Mistrz turnieju' : n === 1 ? 'Ukończone' : 'Zwycięzca';
  const actions = tour
    ? ses.done
      ? `<button class="btn btn-primary" data-act="end-session">Zakończ turniej</button>
         <button class="btn" data-act="bracket">${ses.format === 'knockout' ? 'Drabinka' : 'Tabela'}</button>
         <button class="btn" data-act="undo">${icon.undo} Cofnij rzut</button>`
      : `<button class="btn btn-primary" data-act="next-match">Następny mecz</button>
         <button class="btn" data-act="bracket">${ses.format === 'knockout' ? 'Drabinka' : 'Tabela'}</button>
         <button class="btn" data-act="undo">${icon.undo} Cofnij rzut</button>`
    : `<button class="btn btn-primary" data-act="rematch">Rewanż</button>
       <button class="btn" data-act="undo">${icon.undo} Cofnij rzut</button>
       <button class="btn" data-act="end-session">Zakończ grę</button>`;
  return `<div class="result">
    <div class="winner">
      <span class="eyebrow">${title}</span>
      ${avatar(w, 'av-lg')}
      <div class="winner-name">${esc(w.name)}</div>
      ${score}
    </div>
    ${banner}
    ${ranking}
    ${statsTable(m, R)}
    <div class="actions">${actions}</div>
  </div>`;
}

function idleView(ses, b) {
  const byId = (id) => S.players.find((p) => p.id === id) || { name: '?', color: 'brass' };
  if (ses.done) {
    const champ = byId(ses.champion);
    return `<div class="idle"><div>
      <div class="eyebrow">Turniej zakończony</div>
      <div class="display">${esc(champ.name)}</div>
      <p>Mistrz turnieju. Pełne wyniki znajdziesz w ${ses.format === 'knockout' ? 'drabince' : 'tabeli'}.</p>
      <div class="actions"><button class="btn btn-primary" data-act="end-session">Zakończ turniej</button><button class="btn" data-act="bracket">Wyniki</button><button class="btn" data-act="go" data-to="home">Menu</button></div>
    </div></div>`;
  }
  const tie = nextTie(ses.ties || [], busyPlayers(ses));
  if (tie) {
    const [a, c] = tie.players.map(byId);
    return `<div class="idle"><div>
      <div class="eyebrow">${categoryInfo(ses.mode).board} ${b + 1} · ${esc(tieLabel(ses, tie))}</div>
      <div class="display">${isCue(ses.mode) ? 'Wolny stół' : 'Wolna tarcza'}</div>
      <div class="vs">${avatar(a)}<span>${esc(a.name)}</span><i>vs</i><span>${esc(c.name)}</span>${avatar(c)}</div>
      <button class="btn btn-primary btn-block" data-act="next-match">Rozpocznij mecz</button>
    </div></div>`;
  }
  return `<div class="idle"><div>
    <div class="eyebrow">${categoryInfo(ses.mode).board} ${b + 1}</div>
    <div class="display">Chwila przerwy</div>
    <p>Kolejny mecz zacznie się, gdy skończą się trwające mecze na ${isCue(ses.mode) ? 'innych stołach' : 'innych tarczach'}.</p>
    <button class="btn" data-act="bracket">${ses.format === 'knockout' ? 'Zobacz drabinkę' : 'Zobacz tabelę'}</button>
  </div></div>`;
}

// ---------- flashes & overlays ----------

function flashView() {
  const f = S.ui.flash;
  if (!f) return '';
  const fit = Math.round(190 / Math.max(4, f.text.length));
  return `<div class="flash ${f.kind}" data-key="${f.id}" style="--fs:${fit}vw"><span>${esc(f.text)}</span></div>`;
}

function overlayView() {
  const o = S.ui.overlay;
  if (!o) return '';
  return `<div class="overlay" data-act="dismiss-overlay" data-key="${o.id}"><div class="overlay-card">
    <span class="eyebrow">${esc(o.eyebrow)}</span>
    <span class="display">${esc(o.title)}</span>
    <span class="muted">${esc(o.sub)}</span>
  </div></div>`;
}

let flashTimer = 0;
function flash(text, kind = '') {
  S.ui.flash = { text, kind, id: uid() };
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    S.ui.flash = null;
    render();
  }, 1350);
}

let overlayTimer = 0;
function overlay(o) {
  S.ui.overlay = { ...o, id: uid() };
  clearTimeout(overlayTimer);
  overlayTimer = setTimeout(() => {
    S.ui.overlay = null;
    render();
  }, 2600);
}

// ---------- input & feedback ----------

function push(ev) {
  const m = currentMatch();
  if (!m) return;
  const before = matchState(m);
  if (before.winner !== null) return;
  const notesBefore = before.leg.turn.notes?.length || 0;
  const R = pushEvent(m, ev);
  S.ui.mult = 1;
  S.ui.entry = '';
  if (isCue(m.mode)) cueFeedback(m, R, ev, before);
  else feedback(m, R, ev, notesBefore);
  if (R.winner !== null) finishMatch(m, R);
  persist('session');
  render();
}

function speak(text, opts) {
  if (S.settings.caller) say(text, opts);
}

function cueFeedback(m, R, ev, before) {
  const sounds = S.settings.sounds;
  const last = R.last;
  if (!last) return;
  const name = (i) => m.players[i].name;
  if (ev.k === 'pot' && sounds) clack();
  if (m.mode === 'snooker' && last.type === 'pot') {
    const was = before.leg.turn.pts;
    const now = last.turn.pts;
    if (was < 100 && now >= 100) flash('Setka');
    else if (was < 50 && now >= 50) flash('50+', 'good');
    if (R.leg.st.respot && !before.leg.st.respot) {
      flash('Remis', 'good');
      speak('Remis. Czarna wraca na stół.');
    } else speak(String(now));
  }
  if (last.type === 'foul' || (last.turn?.foul && (last.type === 'leg' || last.type === 'match'))) {
    flash('Faul', 'bust');
    if (sounds) chime('bust');
    const p = last.type === 'foul' ? last.p : last.turn.p;
    if (m.mode === 'snooker') speak(`Faul. ${ev.v} dla ${name(1 - p)}`);
    else speak('Faul');
    if (m.mode === 'pool9' && R.rules.threeFoul && last.type === 'foul' && R.leg.fouls[p] === 2) {
      toast(`${name(p)}: dwa faule z rzędu. Trzeci oznacza przegraną partię.`, 'warn');
    }
  }
  if (last.type === 'leg' || last.type === 'match') {
    if (last.threeFoul) flash('3 faule', 'bust');
    else if (last.runOut) flash('Break & run');
    if (sounds) chime(last.type === 'match' ? 'win' : 'big');
    const [a, b] = R.legsInSet;
    if (last.type === 'leg') {
      const pts = m.mode === 'snooker' ? ` · ${last.leg.st.pts[0]}:${last.leg.st.pts[1]}` : '';
      overlay({ eyebrow: `Partia ${last.leg.no + 1}${pts}`, title: name(last.p), sub: `wygrywa partię · ${a} : ${b}` });
      speak(`Partia dla ${name(last.p)}. ${a} do ${b}.`, { interrupt: false });
    } else {
      speak(`Mecz wygrywa ${name(last.p)}!`, { interrupt: false });
      S.ui.confetti = true;
    }
  }
}

function feedback(m, R, ev, notesBefore) {
  const sounds = S.settings.sounds;
  if (ev.k === 'd' && sounds) thud(ev.s ? 1 : 0.4);
  const last = R.last;
  if (!last) return;
  const turn = last.type === 'dart' ? R.leg.turn : last.turn;

  if (m.mode === 'killer' && turn?.notes) {
    for (const note of turn.notes.slice(notesBefore)) {
      if (note.type === 'killer') {
        flash('Killer', 'bust');
        speak(`${m.players[note.p].name} jest killerem`);
      } else if (note.type === 'hit' && R.leg.st.lives[note.q] === 0 && last.type !== 'match') {
        flash('Out', 'bust');
        speak(`${m.players[note.q].name} odpada`);
      }
    }
  }

  if (last.type === 'dart') return;

  if (turn) {
    const name = m.players[turn.p].name;
    if (m.mode === 'x01') {
      if (turn.bust) {
        flash('Bust', 'bust');
        if (sounds) chime('bust');
        speak('Bust');
      } else if (turn.score === 180) {
        flash('180');
        if (sounds) chime('big');
        speak('Sto osiemdziesiąt!', { rate: 0.9, pitch: 1.1 });
      } else if (last.type === 'turn') {
        if (turn.score >= 100) flash(String(turn.score), 'good');
        speak(turn.score === 0 ? 'Bez punktów' : String(turn.score));
      }
    } else if (m.mode === 'cricket' && last.type === 'turn') {
      if (turn.score >= 6) flash(`${turn.score} ×`, 'good');
      speak(turn.score ? `${turn.score} ${plural(turn.score, 'znacznik', 'znaczniki', 'znaczników')}` : 'Bez trafień');
    } else if (m.mode === 'shanghai') {
      if (turn.shanghai) {
        flash('Shanghai');
        if (sounds) chime('big');
        speak('Shanghai!');
      } else if (last.type === 'turn') speak(`${turn.score} ${plural(turn.score, 'punkt', 'punkty', 'punktów')}`);
    }
    if (last.type === 'turn' && m.mode === 'x01') {
      const next = R.leg.cur;
      const rem = R.leg.st.rem[next];
      if (rem <= 170 && checkoutRoute(rem, 3, R.rules.out)) speak(`${m.players[next].name}, zostało ${rem}`, { interrupt: false });
    }
    if (last.type === 'turn' && m.mode === 'clock') {
      speak(`${name}, ${turn.score} ${plural(turn.score, 'trafienie', 'trafienia', 'trafień')}`);
    }
  }

  if (last.type === 'leg' || last.type === 'set') {
    const w = m.players[last.p];
    const legDarts = last.leg.darts[last.p];
    const co = m.mode === 'x01' && last.turn ? ` · zamknięcie ${last.turn.score}` : '';
    const isSet = last.type === 'set';
    const vals = isSet ? R.sets : R.legsInSet;
    overlay({
      eyebrow: `${isSet ? `Set ${R.setNo - 1}` : `Leg ${last.leg.no + 1}`}${co}`,
      title: w.name,
      sub: `wygrywa ${isSet ? 'seta' : 'lega'} w ${legDarts} lotkach${m.players.length === 2 ? ` · ${vals[0]} : ${vals[1]}` : ''}`,
    });
    if (sounds) chime('big');
    speak(`${last.type === 'set' ? 'Set' : 'Leg'} wygrywa ${w.name}`, { interrupt: false });
  }

  if (last.type === 'match') {
    if (sounds) chime('win');
    speak(m.players.length === 1 ? 'Gotowe!' : `Mecz wygrywa ${m.players[last.p].name}!`, { interrupt: false });
    S.ui.confetti = true;
  }
}

function finishMatch(m, R) {
  const ses = S.session;
  if (m.historyId) return;
  completeMatch(ses, m);
  const tie = tieOf(ses, m);
  const entry = {
    id: uid(),
    ts: m.finished,
    started: m.created,
    mode: m.mode,
    rules: m.rules,
    label: describe(m.mode, m.rules),
    players: m.players.map(({ id, name, color }) => ({ id, name, color })),
    winnerId: m.players[R.winner].id,
    legs: R.stats.map((s) => s.legs),
    sets: R.stats.map((s) => s.sets),
    stats: Object.fromEntries(m.players.map((p, i) => [p.id, R.stats[i]])),
    context: tie ? `${ses.format === 'knockout' ? 'Puchar' : 'Liga'} · ${tieLabel(ses, tie)}` : ses.boards.length > 1 ? `${categoryInfo(ses.mode).board} ${boardIdx() + 1}` : '',
  };
  S.history.unshift(entry);
  m.historyId = entry.id;
  if (ses.done && ses.champion) {
    const champ = S.players.find((p) => p.id === ses.champion);
    if (champ) {
      speak(`Turniej wygrywa ${champ.name}!`, { interrupt: false });
      S.history[0].champion = champ.id;
    }
  }
  persist('history');
}

function throwDart(s, m) {
  if (s === 25 && m === 3) return;
  push({ k: 'd', s, m: s === 0 ? 1 : m });
}

function shakeEntry() {
  const el = document.getElementById('entry');
  if (!el) return;
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function submitTotal(v) {
  const m = currentMatch();
  if (!m) return;
  const R = matchState(m);
  if (R.winner !== null) return;
  const chk = checkVisit(R, v);
  if (chk.error) {
    S.ui.entry = '';
    render();
    shakeEntry();
    toast(chk.error, 'warn');
    return;
  }
  if (chk.finish && chk.minDarts < 3) {
    openSheet('checkout-darts', { v, min: chk.minDarts });
    return;
  }
  push({ k: 'v', v, n: 3 });
}

function undo() {
  const ses = S.session;
  const m = currentMatch();
  if (!m || !m.events.length) return;
  const R = matchState(m);
  if (R.winner !== null) {
    if (!canReopen(ses, m)) {
      toast('Następna runda już się zaczęła, tego meczu nie da się cofnąć.', 'warn');
      return;
    }
    reopenMatch(ses, m);
    if (m.historyId) {
      S.history = S.history.filter((h) => h.id !== m.historyId);
      m.historyId = null;
      persist('history');
    }
  }
  undoEvent(m);
  S.ui.entry = '';
  S.ui.mult = 1;
  S.ui.overlay = null;
  S.ui.flash = null;
  if (S.settings.sounds) thud(0.3);
  persist('session');
  render();
}

export const gameActions = {
  'cue-pot': (el) => {
    const b = +el.dataset.b;
    const m = currentMatch();
    if (m?.mode === 'pool8' && b === 8) return openSheet('cue-frame', { reason: '8' });
    push({ k: 'pot', b });
  },
  'cue-miss': () => push({ k: 'miss' }),
  'cue-foul': () => {
    const m = currentMatch();
    if (m?.mode === 'snooker') return openSheet('cue-foul', { red: false });
    push({ k: 'foul' });
  },
  'cue-foul-red': () => {
    S.ui.sheet.red = !S.ui.sheet.red;
    render();
  },
  'cue-foul-v': (el) => {
    const red = !!S.ui.sheet?.red;
    S.ui.sheet = null;
    push({ k: 'foul', v: +el.dataset.v, red });
  },
  'cue-frame-open': () => openSheet('cue-frame', {}),
  'cue-frame': (el) => {
    S.ui.sheet = null;
    push({ k: 'frame', p: +el.dataset.p });
  },
  board: (el) => {
    S.ui.board = +el.dataset.b;
    S.ui.entry = '';
    S.ui.mult = 1;
    render();
  },
  num: (el) => throwDart(+el.dataset.s, S.ui.mult),
  dart: (el) => throwDart(+el.dataset.s, +el.dataset.m),
  mult: (el) => {
    const v = +el.dataset.v;
    S.ui.mult = S.ui.mult === v ? 1 : v;
    render();
  },
  'end-turn': () => push({ k: 'x' }),
  key: (el) => {
    const next = (S.ui.entry === '0' ? '' : S.ui.entry) + el.dataset.v;
    if (next.length > 3) return;
    S.ui.entry = next;
    render();
  },
  back: () => {
    S.ui.entry = S.ui.entry.slice(0, -1);
    render();
  },
  quick: (el) => submitTotal(+el.dataset.v),
  submit: () => submitTotal(S.ui.entry === '' ? 0 : +S.ui.entry),
  undo,
  'input-mode': (el) => {
    S.settings.inputMode = el.dataset.v;
    S.ui.entry = '';
    S.ui.mult = 1;
    persist('settings');
    render();
  },
  'checkout-darts': (el) => {
    const { v } = S.ui.sheet;
    S.ui.sheet = null;
    push({ k: 'v', v, n: +el.dataset.n });
  },
  'dismiss-overlay': () => {
    S.ui.overlay = null;
    render();
  },
  'game-menu': () => openSheet('game-menu'),
  'match-stats': () => openSheet('match-stats'),
  bracket: () => openSheet('bracket'),
  'toggle-caller-game': () => {
    S.settings.caller = !S.settings.caller;
    persist('settings');
    render();
  },
  rematch: () => {
    rematch(S.session, boardIdx());
    persist('session');
    render();
  },
  'next-match': () => {
    const ses = S.session;
    const b = boardIdx();
    const m = startNextOnBoard(ses, b, S.players);
    if (!m) {
      ses.boards[b].matchId = null;
      toast('Na razie brak gotowych par. Poczekaj na inne mecze.');
    }
    persist('session');
    render();
  },
  'end-session': async () => {
    const ses = S.session;
    const live = Object.values(ses.matches).some((m) => !m.finished && m.events.length);
    const ok =
      !live ||
      (await ask({
        title: 'Zakończyć grę?',
        text: 'Niedokończone mecze nie trafią do historii. Ukończone zostają zapisane.',
        confirm: 'Zakończ',
        danger: true,
      }));
    if (!ok) return;
    S.session = null;
    persist('session');
    go('home');
  },
};

// ---------- sheets owned by the game screen ----------

export function gameSheet(sheet) {
  const ses = S.session;
  if (!ses) return '';
  if (sheet.type === 'checkout-darts') {
    const opts = [1, 2, 3].filter((n) => n >= sheet.min);
    const label = { 1: 'Pierwszą', 2: 'Drugą', 3: 'Trzecią' };
    return sheetFrame(
      'Zamknięte!',
      `<p class="hint">${sheet.v} na zero. Którą lotką padło zamknięcie? Liczba lotek trafi do średniej.</p>
      <div class="choice-grid" style="grid-template-columns:repeat(${opts.length},1fr)">${opts.map((n) => `<button class="btn btn-primary" data-act="checkout-darts" data-n="${n}">${label[n]}</button>`).join('')}</div>`,
    );
  }
  if (sheet.type === 'game-menu') {
    const tour = ses.format !== 'single';
    return sheetFrame(
      'Gra',
      `<div class="menu-list">
        <button class="menu-item" data-act="match-stats">${icon.chart}Statystyki meczu</button>
        ${tour ? `<button class="menu-item" data-act="bracket">${icon.bracket}${ses.format === 'knockout' ? 'Drabinka turnieju' : 'Tabela ligi'}</button>` : ''}
        <button class="menu-item" data-act="toggle-caller-game">${S.settings.caller ? icon.sound : icon.mute}Spiker<small>${S.settings.caller ? 'włączony' : 'wyłączony'}</small></button>
        <button class="menu-item" data-act="go" data-to="home">${icon.home}Menu główne<small>gra zostaje zapisana</small></button>
      </div>
      <div class="menu-list"><button class="menu-item danger" data-act="end-session">${icon.flag}${tour ? 'Zakończ turniej' : 'Zakończ grę'}</button></div>`,
    );
  }
  if (sheet.type === 'match-stats') {
    const m = currentMatch();
    if (!m) return sheetFrame('Statystyki', `<p class="hint">Na ${isCue(ses.mode) ? 'tym stole' : 'tej tarczy'} nie trwa żaden mecz.</p>`);
    return sheetFrame('Statystyki', statsTable(m, matchState(m)));
  }
  if (sheet.type === 'bracket') return sheetFrame(ses.format === 'knockout' ? 'Drabinka' : 'Tabela', bracketBody(ses));
  if (isCueSheet(sheet.type)) {
    const m = currentMatch();
    return cueSheet(sheet, m, m && matchState(m));
  }
  return '';
}

function bracketBody(ses) {
  const byId = (id) => S.players.find((p) => p.id === id);
  const name = (id) => esc(byId(id)?.name || '?');
  const liveKeys = new Set(
    ses.boards
      .map((bd) => ses.matches[bd.matchId])
      .filter((m) => m && !m.finished)
      .map((m) => m.tie),
  );
  const boardOf = (key) => ses.boards.findIndex((bd) => ses.matches[bd.matchId]?.tie === key);
  const tieCard = (t, label) => {
    const live = liveKeys.has(t.key);
    const ps = t.players
      .map((pid, i) => {
        if (!pid) return `<div class="tie-p tbd"><span class="tie-name">${t.bye ? 'wolny los' : 'czeka'}</span></div>`;
        const cls = t.winner ? (t.winner === pid ? 'won' : 'lost') : '';
        const legs = t.result ? `<b>${t.result.legs[i]}</b>` : '';
        return `<div class="tie-p ${cls}">${avatar(byId(pid), 'av-sm')}<span class="tie-name">${name(pid)}</span>${legs}</div>`;
      })
      .join('');
    const meta = live ? `Teraz · ${categoryInfo(ses.mode).board.toLowerCase()} ${boardOf(t.key) + 1}` : label;
    return `<div class="tie ${live ? 'live' : ''}">${meta ? `<div class="tie-meta">${meta}</div>` : ''}${ps}</div>`;
  };
  if (ses.format === 'knockout') {
    const rounds = knockoutRounds(ses.ties);
    const cols = Array.from({ length: rounds }, (_, r) => {
      const ties = ses.ties.filter((t) => t.round === r);
      return `<div class="bracket-round"><div class="eyebrow">${roundName(r, rounds)}</div>${ties.map((t) => tieCard(t, t.bye ? 'wolny los' : '')).join('')}</div>`;
    }).join('');
    const champ = ses.champion ? `<div class="card" style="text-align:center"><div class="eyebrow" style="color:var(--brass)">Mistrz</div><div class="winner-name" style="font-size:44px">${name(ses.champion)}</div></div>` : '';
    return `${champ}<div class="bracket">${cols}</div>`;
  }
  const table = standings(ses.ties, ses.playerIds);
  const rows = table
    .map(
      (r, i) =>
        `<tr class="${i === 0 && ses.done ? 'me' : ''}"><td><span class="row">${avatar(byId(r.id), 'av-sm')}${name(r.id)}</span></td><td>${r.played}</td><td>${r.won}</td><td>${r.lost}</td><td>${r.legsFor}:${r.legsAgainst}</td><td class="best">${r.pts}</td></tr>`,
    )
    .join('');
  const rounds = Math.max(...ses.ties.map((t) => t.round)) + 1;
  const fixtures = Array.from({ length: rounds }, (_, r) => {
    const ties = ses.ties.filter((t) => t.round === r);
    return `<div class="stack" style="gap:8px"><div class="eyebrow">${roundName(r, rounds, 'league')}</div>${ties.map((t) => tieCard(t, '')).join('')}</div>`;
  }).join('');
  return `<div class="table-wrap"><table class="table"><thead><tr><th>Gracz</th><th>M</th><th>W</th><th>P</th><th>Legi</th><th>Pkt</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Za wygraną 2 punkty. Przy remisie decyduje bilans legów, potem bezpośredni mecz.</p>
    ${fixtures}`;
}
