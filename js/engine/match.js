// Match driver. A match is stored as a list of input events; everything else (scores,
// whose turn it is, legs, sets, statistics) is rebuilt by replaying them. Undo is just
// dropping the last event, and a match survives an app restart as plain JSON.
//
// Events:  { k: 'd', s, m }   one dart
//          { k: 'v', v, n }   a whole X01 visit typed as a total, thrown with n darts
//          { k: 'x' }         end the turn early (remaining darts count as misses)

import { newStats } from './modes.js';
import { CUE_ENGINES, replayCue } from './cue.js';
import { ENGINES } from './registry.js';
import { canCheckout, deadScore, isValidVisit, minDartsToFinish } from './darts.js';

const fill = (n, v) => Array.from({ length: n }, () => v);

export function createMatch({ id, mode, rules, players, start = 0, rand = Math.random }) {
  const eng = ENGINES[mode];
  return {
    id,
    mode,
    rules: { ...rules },
    players: players.map(({ id: pid, name, color }) => ({ id: pid, name, color })),
    start: start % players.length,
    events: [],
    meta: eng.meta ? eng.meta(players.length, rand) : {},
    created: Date.now(),
    finished: null,
  };
}

const cache = new WeakMap();

export function matchState(match) {
  const len = match.events.length;
  const last = match.events[len - 1];
  const hit = cache.get(match);
  if (hit && hit.len === len && hit.last === last) return hit.R;
  const R = replay(match);
  cache.set(match, { len, last, R });
  return R;
}

export function replay(match) {
  if (CUE_ENGINES[match.mode]) return replayCue(match);
  const eng = ENGINES[match.mode];
  const n = match.players.length;
  const R = {
    match,
    eng,
    n,
    rules: match.rules,
    meta: match.meta,
    stats: Array.from({ length: n }, newStats),
    sets: fill(n, 0),
    legsInSet: fill(n, 0),
    legNo: 0,
    setNo: 1,
    legs: [],
    leg: null,
    winner: null,
    last: null,
  };
  startLeg(R);
  for (const ev of match.events) {
    if (R.winner !== null) break;
    R.last = null;
    step(R, ev);
  }
  return R;
}

const isActive = (R, p) => (R.eng.isActive ? R.eng.isActive(R.leg.st, p) : true);

function startLeg(R) {
  const starter = (R.match.start + R.legNo) % R.n;
  R.leg = {
    no: R.legNo,
    set: R.setNo,
    starter,
    cur: starter,
    round: 1,
    darts: fill(R.n, 0),
    visits: [],
    winner: null,
    st: null,
    turn: null,
  };
  R.leg.st = R.eng.init(R);
  newTurn(R);
}

function newTurn(R) {
  const leg = R.leg;
  leg.turn = { p: leg.cur, darts: [], n: 0, score: 0, bust: false, total: null, round: leg.round };
  R.eng.turnStart?.(leg.st, leg.cur, leg.turn, R);
}

function step(R, ev) {
  const { leg, eng } = R;
  const p = leg.cur;
  const t = leg.turn;
  let res;
  if (ev.k === 'd') {
    const d = { s: ev.s, m: ev.m };
    res = eng.dart(leg.st, p, d, t, R) || {};
    t.darts.push(d);
    t.n++;
    leg.darts[p]++;
    R.stats[p].darts++;
    R.last = { type: 'dart', p, dart: d, res };
  } else if (ev.k === 'v' && eng.visit) {
    res = eng.visit(leg.st, p, ev.v, ev.n, t, R) || {};
    t.total = ev.v;
    t.n = ev.n;
    leg.darts[p] += ev.n;
    R.stats[p].darts += ev.n;
  } else if (ev.k === 'x') {
    const missing = Math.max(0, 3 - t.n);
    t.n += missing;
    leg.darts[p] += missing;
    R.stats[p].darts += missing;
    res = { end: true };
  } else {
    return;
  }
  if (res.bust) t.bust = true;
  const done = res.winner != null || res.bust || res.end || ev.k === 'v' || t.n >= 3;
  if (!done) return;
  finishTurn(R);
  if (res.winner != null) winLeg(R, res.winner);
  else advance(R);
}

function finishTurn(R) {
  const { leg, eng } = R;
  const t = leg.turn;
  const info = eng.turnEnd(leg.st, t.p, t, R) || {};
  t.score = info.score ?? 0;
  leg.visits.push(t);
  R.last = { type: 'turn', p: t.p, turn: t };
}

function advance(R) {
  const { leg, n } = R;
  const pos = (i) => (i - leg.starter + n) % n;
  let next = -1;
  for (let k = pos(leg.cur) + 1; k < n; k++) {
    const i = (leg.starter + k) % n;
    if (isActive(R, i)) {
      next = i;
      break;
    }
  }
  if (next < 0) {
    leg.round++;
    const r = R.eng.roundEnd?.(leg.st, R);
    if (r && r.winner != null) return winLeg(R, r.winner);
    for (let k = 0; k < n; k++) {
      const i = (leg.starter + k) % n;
      if (isActive(R, i)) {
        next = i;
        break;
      }
    }
  }
  leg.cur = next;
  newTurn(R);
}

function winLeg(R, w) {
  const { leg, eng } = R;
  const lastTurn = R.last?.turn;
  leg.winner = w;
  eng.legEnd?.(leg.st, R, w);
  const s = R.stats[w];
  s.legs++;
  if (!s.bestLeg || leg.darts[w] < s.bestLeg) s.bestLeg = leg.darts[w];
  R.legs.push(leg);
  R.legsInSet[w]++;
  let type = 'leg';
  if (R.legsInSet[w] >= R.rules.legs) {
    R.sets[w]++;
    s.sets++;
    if (R.sets[w] >= R.rules.sets) {
      R.winner = w;
      R.last = { type: 'match', p: w, leg, turn: lastTurn };
      return;
    }
    type = 'set';
    R.legsInSet = fill(R.n, 0);
    R.setNo++;
  }
  R.last = { type, p: w, leg, turn: lastTurn };
  R.legNo++;
  startLeg(R);
}

// ---------- helpers used by the UI ----------

export function pushEvent(match, ev) {
  match.events.push(ev);
  return matchState(match);
}

export function undoEvent(match) {
  match.events.pop();
  return matchState(match);
}

// Checks a typed X01 visit before it is recorded.
export function checkVisit(R, v) {
  if (!isValidVisit(v)) return { error: v > 180 ? 'Maksymalnie 180 w jednej turze' : `${v} nie da się rzucić trzema lotkami` };
  const p = R.leg.cur;
  const rem = R.leg.st.rem[p];
  const out = R.rules.out;
  if (v > rem) return { bust: true };
  const after = rem - v;
  if (after > 0 && after <= deadScore(out)) return { bust: true };
  if (after === 0) {
    if (!canCheckout(rem, 3, out)) return { error: `${rem} nie da się zamknąć jedną turą` };
    return { finish: true, minDarts: minDartsToFinish(rem, out) };
  }
  return { ok: true };
}

// Legs (or sets) each player needs, as shown in the scoreboard.
export const matchFormat = (rules) => ({ legs: rules.legs || 1, sets: rules.sets || 1 });
