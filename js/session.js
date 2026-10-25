// A session is one evening at the oche: the rules, the boards in use and every match on them.
// Formats: 'single' (each board plays its own group), 'knockout' and 'league' (tournaments
// whose pairings are handed to whichever board is free).

import { createMatch, matchState } from './engine/match.js';
import { buildKnockout, buildLeague, resolveKnockout, nextTie, champion } from './engine/tournament.js';
import { uid } from './util.js';

export function createSession({ mode, rules, format, boards, groups, order, roster }) {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const session = {
    id: uid(),
    created: Date.now(),
    mode,
    rules: { ...rules },
    format,
    playerIds: format === 'single' ? groups.flat() : [...order],
    boards: [],
    matches: {},
    ties: null,
    champion: null,
    done: false,
  };
  if (format === 'single') {
    groups.forEach((ids) => {
      const m = addMatch(session, ids.map((id) => byId.get(id)), 0);
      session.boards.push({ matchId: m.id });
    });
  } else {
    session.ties = format === 'knockout' ? buildKnockout(order) : buildLeague(order);
    session.boards = Array.from({ length: boards }, () => ({ matchId: null }));
    session.boards.forEach((_, b) => startNextOnBoard(session, b, roster));
  }
  return session;
}

function addMatch(session, players, start, extra = {}) {
  const m = createMatch({ id: uid(), mode: session.mode, rules: session.rules, players, start });
  Object.assign(m, extra);
  session.matches[m.id] = m;
  return m;
}

export const boardMatch = (session, b) => session.matches[session.boards[b]?.matchId] || null;

export function busyPlayers(session) {
  const busy = new Set();
  session.boards.forEach((_, b) => {
    const m = boardMatch(session, b);
    if (m && !m.finished) m.players.forEach((p) => busy.add(p.id));
  });
  return busy;
}

// Puts the next ready pairing on board `b`. Returns the match or null.
export function startNextOnBoard(session, b, roster) {
  if (session.format === 'single' || session.done) return null;
  const tie = nextTie(session.ties, busyPlayers(session));
  if (!tie) return null;
  const byId = new Map(roster.map((p) => [p.id, p]));
  const players = tie.players.map((id) => byId.get(id) || { id, name: '?', color: 'brass' });
  const m = addMatch(session, players, 0, { tie: tie.key, board: b });
  tie.matchId = m.id;
  session.boards[b].matchId = m.id;
  return m;
}

// Records a finished match; returns true when this also decided the tournament.
export function completeMatch(session, match) {
  const R = matchState(match);
  if (R.winner === null) return false;
  match.finished = match.finished || Date.now();
  if (!match.tie || !session.ties) return false;
  const tie = session.ties.find((t) => t.key === match.tie);
  if (!tie || tie.winner) return false;
  tie.winner = match.players[R.winner].id;
  tie.result = { legs: tie.players.map((pid) => R.stats[match.players.findIndex((p) => p.id === pid)]?.legs ?? 0) };
  if (session.format === 'knockout') resolveKnockout(session.ties);
  const champ = champion(session.format, session.ties, session.playerIds);
  if (champ) {
    session.champion = champ;
    session.done = true;
    return true;
  }
  return false;
}

// Undoing the winning dart of a tournament match reopens its pairing.
export function reopenMatch(session, match) {
  match.finished = null;
  if (!match.tie || !session.ties) return;
  const tie = session.ties.find((t) => t.key === match.tie);
  if (!tie) return;
  const dependents = session.ties.filter((t) => t.feeds?.includes(tie.key));
  if (dependents.some((t) => t.matchId)) return;
  tie.winner = null;
  tie.result = null;
  session.champion = null;
  session.done = false;
  if (session.format === 'knockout') resolveKnockout(session.ties);
}

export function canReopen(session, match) {
  if (!match.tie || !session.ties) return true;
  const tie = session.ties.find((t) => t.key === match.tie);
  return !session.ties.some((t) => t.feeds?.includes(tie?.key) && t.matchId);
}

// Same players, same board, next player to throw first.
export function rematch(session, b) {
  const old = boardMatch(session, b);
  if (!old) return null;
  const m = addMatch(session, old.players, old.start + 1);
  delete session.matches[old.id];
  session.boards[b].matchId = m.id;
  return m;
}

export function boardStatus(session, b) {
  const m = boardMatch(session, b);
  if (m) return m.finished ? 'finished' : 'live';
  if (session.done) return 'done';
  return session.ties?.some((t) => !t.winner) ? 'waiting' : 'idle';
}
