// Cue sports: 8-ball, 9-ball and snooker. Like darts, a match is a list of events replayed
// into state, but a visit lasts until the shooter misses or fouls instead of three darts.
//
// Events:  { k: 'pot', b }        ball b pocketed (pool: number 1–15, snooker: value 1–7)
//          { k: 'miss' }          visit ends without a foul
//          { k: 'foul', v, red }  foul (snooker: v points to the opponent, red = a red went down)
//          { k: 'frame', p }      frame awarded to player p (8 on the table, concession…)

const fill = (n, v) => Array.from({ length: n }, () => v);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

export const newCueStats = () => ({
  legs: 0, sets: 0, darts: 0,
  pots: 0, visits: 0, fouls: 0, bestRun: 0, breakRuns: 0,
  pts: 0, hb: 0, b50: 0, c100: 0, score: 0,
});

const pool8 = {
  id: 'pool8',
  name: 'Ósemka',
  cue: true,
  minPlayers: 2,
  maxPlayers: 2,
  defaults: { legs: 3, sets: 1, breakRule: 'alternate' },
  describe: () => 'Ósemka',
  init() {
    return { on: range(1, 15), groups: null };
  },
  pot(st, p, b, t, R) {
    if (b === 8 || !st.on.includes(b)) return { invalid: true };
    st.on = st.on.filter((x) => x !== b);
    // The table stays open on the break; the first ball pocketed afterwards picks the groups.
    if (!st.groups && R.leg.visits.length > 0) {
      const mine = b < 8 ? 'solids' : 'stripes';
      const other = mine === 'solids' ? 'stripes' : 'solids';
      st.groups = p === 0 ? [mine, other] : [other, mine];
    }
    return null;
  },
};

const pool9 = {
  id: 'pool9',
  name: 'Dziewiątka',
  cue: true,
  minPlayers: 2,
  maxPlayers: 2,
  defaults: { legs: 5, sets: 1, breakRule: 'winner', threeFoul: true },
  describe: () => 'Dziewiątka',
  init() {
    return { on: range(1, 9) };
  },
  target: (st) => Math.min(...st.on),
  pot(st, p, b) {
    if (!st.on.includes(b)) return { invalid: true };
    st.on = st.on.filter((x) => x !== b);
    return b === 9 ? { winner: p } : null;
  },
  foul(st, p, ev, t, R) {
    if (R.rules.threeFoul && R.leg.fouls[p] >= 3) return { winner: 1 - p, threeFoul: true };
    return null;
  },
};

export const SNOOKER_COLORS = [2, 3, 4, 5, 6, 7];

export function snookerRemaining(st) {
  if (st.phase === 'reds') return st.reds * 8 + (st.colorOn ? 7 : 0) + 27;
  return range(st.next, 7).reduce((a, b) => a + b, 0);
}

// Which balls the shooter may pot right now.
export function snookerOn(st, t) {
  if (st.phase === 'colors') return [st.next];
  if (!st.colorOn) return st.reds > 0 ? [1] : [];
  const extraRed = st.reds > 0 && t.balls[t.balls.length - 1] === 1 ? [1] : [];
  return [...extraRed, ...SNOOKER_COLORS];
}

// With only the black left, the first score or foul ends the frame unless the scores are level.
function blackDecides(st) {
  if (st.pts[0] === st.pts[1]) {
    st.respot = true;
    return null;
  }
  return { winner: st.pts[0] > st.pts[1] ? 0 : 1 };
}

const snooker = {
  id: 'snooker',
  name: 'Snooker',
  cue: true,
  minPlayers: 2,
  maxPlayers: 2,
  defaults: { legs: 2, sets: 1, reds: 15 },
  describe: (r) => `Snooker · ${r.reds} czerwonych`,
  init(R) {
    return { reds: R.rules.reds, colorOn: false, phase: 'reds', next: 2, pts: fill(2, 0), respot: false };
  },
  pot(st, p, b, t) {
    if (!snookerOn(st, t).includes(b)) return { invalid: true };
    st.pts[p] += b;
    t.pts += b;
    if (st.phase === 'reds') {
      if (b === 1) {
        st.reds--;
        st.colorOn = true;
      } else {
        st.colorOn = false;
        if (st.reds === 0) st.phase = 'colors';
      }
      return null;
    }
    if (st.next === 7) return blackDecides(st);
    st.next++;
    return null;
  },
  foul(st, p, ev) {
    st.pts[1 - p] += Math.max(4, Math.min(7, ev.v || 4));
    if (ev.red && st.reds > 0) st.reds--;
    if (st.phase === 'colors' && st.next === 7) return blackDecides(st);
    return null;
  },
  visitEnd(st, t, R) {
    if (st.phase === 'reds') {
      st.colorOn = false;
      if (st.reds === 0) st.phase = 'colors';
    }
    const s = R.stats[t.p];
    if (t.pts > s.hb) s.hb = t.pts;
    if (t.pts >= 100) s.c100++;
    else if (t.pts >= 50) s.b50++;
  },
  frameEnd(st, R) {
    st.pts.forEach((v, i) => (R.stats[i].pts += v));
  },
};

// Bieda wersja: one table, more than two people. Players are drawn into groups; two groups play
// a frame of 8- or 9-ball with members taking turns, and with three or more groups the winners
// stay at the table while the losers join the back of the queue.

export const GROUP_NAMES = [
  'Kredowe Łapy',
  'Ekipa z Łuzy',
  'Banda Spod Lampy',
  'Mistrzowie Pudła',
  'Królowie Bandy',
  'Ostatnia Bila',
  'Krzywy Kij',
  'Sępy Bilardowe',
  'Rozbici',
  'Gang Białej Bili',
];

export const groupName = (rules, g) => rules.groupNames?.[g] || `Grupa ${String.fromCharCode(65 + g)}`;

// Splits players into groups of `size` (the last one may be smaller).
export function drawGroups(ids, size, rand = Math.random) {
  const pool = [...ids];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const groups = [];
  for (let i = 0; i < pool.length; i += size) groups.push(pool.slice(i, i + size));
  const names = [...GROUP_NAMES];
  for (let i = names.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [names[i], names[j]] = [names[j], names[i]];
  }
  return { groups, names: groups.map((_, g) => names[g % names.length]) };
}

const bieda = {
  id: 'bieda',
  name: 'Bieda wersja',
  cue: true,
  minPlayers: 3,
  defaults: { game: 'pool8', groupSize: 2, legs: 5, sets: 1, threeFoul: true },
  describe: (r) => `Bieda wersja · ${r.game === 'pool9' ? 'dziewiątka' : 'ósemka'}`,
};

export const CUE_ENGINES = { pool8, pool9, snooker, bieda };

// ---------- driver ----------

const newVisit = (p) => ({ p, balls: [], pts: 0, n: 0, foul: null, score: 0 });

export function replayCue(match) {
  if (match.mode === 'bieda') return replayBieda(match);
  const eng = CUE_ENGINES[match.mode];
  const R = {
    match,
    eng,
    n: 2,
    rules: match.rules,
    meta: match.meta,
    stats: [newCueStats(), newCueStats()],
    sets: fill(2, 0),
    legsInSet: fill(2, 0),
    legNo: 0,
    setNo: 1,
    legs: [],
    leg: null,
    winner: null,
    last: null,
  };
  startFrame(R, match.start % 2);
  for (const ev of match.events) {
    if (R.winner !== null) break;
    R.last = null;
    step(R, ev);
  }
  return R;
}

function startFrame(R, breaker) {
  R.leg = {
    no: R.legNo,
    set: 1,
    starter: breaker,
    cur: breaker,
    round: 1,
    darts: fill(2, 0),
    visits: [],
    fouls: fill(2, 0),
    winner: null,
    st: R.eng.init(R),
    turn: newVisit(breaker),
  };
}

function closeVisit(R) {
  const { leg } = R;
  const t = leg.turn;
  R.eng.visitEnd?.(leg.st, t, R);
  const s = R.stats[t.p];
  s.visits++;
  if (t.balls.length > s.bestRun) s.bestRun = t.balls.length;
  t.score = R.match.mode === 'snooker' ? t.pts : t.balls.length;
  leg.visits.push(t);
}

function endVisit(R) {
  closeVisit(R);
  const { leg } = R;
  leg.cur = 1 - leg.turn.p;
  leg.turn = newVisit(leg.cur);
}

function step(R, ev) {
  const { leg, eng } = R;
  const t = leg.turn;
  const p = t.p;
  if (ev.k === 'pot') {
    const res = eng.pot(leg.st, p, ev.b, t, R) || {};
    if (res.invalid) return;
    t.balls.push(ev.b);
    t.n++;
    leg.fouls[p] = 0;
    R.stats[p].pots++;
    R.last = { type: 'pot', p, b: ev.b, turn: t, res };
    if (res.winner != null) {
      closeVisit(R);
      winFrame(R, res.winner);
    }
  } else if (ev.k === 'miss') {
    leg.fouls[p] = 0;
    R.last = { type: 'visit', p, turn: t };
    endVisit(R);
  } else if (ev.k === 'foul') {
    t.foul = { v: ev.v || 0, red: !!ev.red };
    R.stats[p].fouls++;
    leg.fouls[p]++;
    const res = eng.foul?.(leg.st, p, ev, t, R) || {};
    R.last = { type: 'foul', p, turn: t, res };
    if (res.winner != null) {
      closeVisit(R);
      winFrame(R, res.winner);
    } else endVisit(R);
  } else if (ev.k === 'frame' && (ev.p === 0 || ev.p === 1)) {
    R.last = { type: 'frame', p: ev.p, turn: t };
    closeVisit(R);
    winFrame(R, ev.p);
  }
}

function winFrame(R, w) {
  const { leg, eng } = R;
  const lastTurn = R.last?.turn;
  const res = R.last?.res;
  leg.winner = w;
  eng.frameEnd?.(leg.st, R, w);
  const s = R.stats[w];
  s.legs++;
  // Break and run: the breaker won the frame without ever leaving the table.
  const runOut = R.match.mode !== 'snooker' && w === leg.starter && leg.visits.length === 1 && !leg.visits[0].foul;
  if (runOut) s.breakRuns++;
  R.legs.push(leg);
  R.legsInSet[w]++;
  const info = { p: w, leg, turn: lastTurn, runOut, threeFoul: !!res?.threeFoul };
  if (R.legsInSet[w] >= R.rules.legs) {
    R.sets[w]++;
    s.sets++;
    R.winner = w;
    R.last = { type: 'match', ...info };
    return;
  }
  R.last = { type: 'leg', ...info };
  R.legNo++;
  const breaker = R.rules.breakRule === 'winner' ? w : (R.match.start + R.legNo) % 2;
  startFrame(R, breaker);
}

// ---------- bieda wersja driver ----------

function replayBieda(match) {
  const rules = match.rules;
  const n = match.players.length;
  const groups = rules.groups?.length >= 2 ? rules.groups : [range(0, Math.ceil(n / 2) - 1), range(Math.ceil(n / 2), n - 1)];
  const G = groups.length;
  const R = {
    match,
    eng: bieda,
    base: rules.game === 'pool9' ? pool9 : pool8,
    n,
    rules,
    meta: match.meta,
    groups,
    groupWins: fill(G, 0),
    queue: G > 2 ? range(2, G - 1) : [],
    ptr: fill(G, 0),
    stats: Array.from({ length: n }, newCueStats),
    sets: fill(n, 0),
    legsInSet: fill(n, 0),
    legNo: 0,
    setNo: 1,
    legs: [],
    leg: null,
    winner: null,
    last: null,
  };
  startBiedaFrame(R, [0, 1], 0);
  for (const ev of match.events) {
    if (R.winner !== null) break;
    R.last = null;
    stepBieda(R, ev);
  }
  return R;
}

function startBiedaFrame(R, sides, breakSide) {
  R.leg = {
    no: R.legNo,
    set: 1,
    sides,
    breakSide,
    starter: null,
    cur: null,
    round: 1,
    darts: fill(R.n, 0),
    visits: [],
    fouls: fill(2, 0),
    winner: null,
    st: R.base.init(R),
    turn: null,
  };
  biedaVisit(R, breakSide);
  R.leg.starter = R.leg.turn.p;
}

// Members of a group take turns: each group keeps its own pointer across frames.
function biedaVisit(R, side) {
  const g = R.leg.sides[side];
  const members = R.groups[g];
  const p = members[R.ptr[g] % members.length];
  R.leg.turn = { side, p, balls: [], pts: 0, n: 0, foul: null, score: 0 };
  R.leg.cur = p;
}

function endBiedaVisit(R) {
  closeVisit(R);
  const side = R.leg.turn.side;
  R.ptr[R.leg.sides[side]]++;
  biedaVisit(R, 1 - side);
}

function stepBieda(R, ev) {
  const { leg, base } = R;
  const t = leg.turn;
  const side = t.side;
  const p = t.p;
  if (ev.k === 'pot') {
    const res = base.pot(leg.st, side, ev.b, t, R) || {};
    if (res.invalid) return;
    t.balls.push(ev.b);
    t.n++;
    leg.fouls[side] = 0;
    R.stats[p].pots++;
    R.last = { type: 'pot', p, side, b: ev.b, turn: t, res };
    if (res.winner != null) {
      closeVisit(R);
      winBiedaFrame(R, res.winner);
    }
  } else if (ev.k === 'miss') {
    leg.fouls[side] = 0;
    R.last = { type: 'visit', p, side, turn: t };
    endBiedaVisit(R);
  } else if (ev.k === 'foul') {
    t.foul = { v: 0, red: false };
    R.stats[p].fouls++;
    leg.fouls[side]++;
    const res = base.foul?.(leg.st, side, ev, t, R) || {};
    R.last = { type: 'foul', p, side, turn: t, res };
    if (res.winner != null) {
      closeVisit(R);
      winBiedaFrame(R, res.winner);
    } else endBiedaVisit(R);
  } else if (ev.k === 'frame' && (ev.p === 0 || ev.p === 1)) {
    R.last = { type: 'frame', p, side, turn: t };
    closeVisit(R);
    winBiedaFrame(R, ev.p);
  }
}

function winBiedaFrame(R, side) {
  const { leg } = R;
  const lastTurn = R.last?.turn;
  const res = R.last?.res;
  const g = leg.sides[side];
  const loser = leg.sides[1 - side];
  // The visit that ended the frame counts: that group's next visit goes to its next member.
  R.ptr[leg.sides[leg.turn.side]]++;
  leg.winner = side;
  leg.winnerGroup = g;
  R.groupWins[g]++;
  for (const i of R.groups[g]) {
    R.stats[i].legs++;
    R.legsInSet[i]++;
  }
  const runOut = side === leg.breakSide && leg.visits.length === 1 && !leg.visits[0].foul;
  if (runOut) R.stats[leg.visits[0].p].breakRuns++;
  R.legs.push(leg);
  const info = { p: R.groups[g][0], side, group: g, loser, leg, turn: lastTurn, runOut, threeFoul: !!res?.threeFoul, next: null };
  if (R.groupWins[g] >= R.rules.legs) {
    R.winner = g;
    for (const i of R.groups[g]) {
      R.stats[i].sets++;
      R.sets[i]++;
    }
    R.last = { type: 'match', ...info };
    return;
  }
  R.legNo++;
  let sides = leg.sides;
  let breakSide = 1 - leg.breakSide;
  if (R.queue.length) {
    // Winner stays on; the next group in the queue comes to the table and breaks.
    R.queue.push(loser);
    info.next = R.queue.shift();
    sides = [g, info.next];
    breakSide = 1;
  }
  R.last = { type: 'leg', ...info };
  startBiedaFrame(R, sides, breakSide);
}

// Player indices of the match winner (a whole group in bieda wersja).
export function winnerIndices(match, R) {
  if (R.winner === null) return [];
  return match.mode === 'bieda' ? R.groups[R.winner] : [R.winner];
}
