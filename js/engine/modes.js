// Game modes. Each engine keeps per-leg state `st` and reacts to darts; the match driver
// (match.js) owns turns, rotation, legs and sets.
//
// Engine hooks (all receive the runtime `R` from match.js):
//   init(R)                      -> fresh leg state
//   turnStart(st, p, turn, R)
//   dart(st, p, dart, turn, R)   -> null | { bust } | { end } | { winner }
//   visit(st, p, total, n, turn, R)  (X01 only: whole visit typed as a number)
//   turnEnd(st, p, turn, R)      -> { score }  (what the visit is worth, for display and stats)
//   roundEnd(st, R)              -> null | { winner }  (after every active player has thrown)
//   legEnd(st, R, winner)
//   isActive(st, p)              -> false for players who are out (Killer, Shanghai tie-break)

import { dartValue, isFinishDart, canCheckout, deadScore } from './darts.js';

const fill = (n, v) => Array.from({ length: n }, () => v);
const others = (n, p) => [...Array(n).keys()].filter((i) => i !== p);

export const newStats = () => ({
  darts: 0, legs: 0, sets: 0,
  points: 0, visits: 0, f9pts: 0, f9darts: 0, hi: 0, t180: 0, t140: 0, t100: 0,
  co: 0, hiCo: 0, dblAtt: 0, dblHit: 0, bestLeg: 0,
  marks: 0, hits: 0, kills: 0, score: 0,
});

const OUT_LABEL = { double: 'Double Out', single: 'Single Out', master: 'Master Out' };

const x01 = {
  id: 'x01',
  name: 'X01',
  minPlayers: 1,
  defaults: { start: 501, out: 'double', in: 'straight', legs: 1, sets: 1 },
  describe: (r) => `${r.start} · ${OUT_LABEL[r.out]}${r.in === 'double' ? ' · Double In' : ''}`,
  init(R) {
    return {
      rem: fill(R.n, R.rules.start),
      open: fill(R.n, R.rules.in !== 'double'),
      visits: fill(R.n, 0),
      startRem: 0,
      startOpen: true,
    };
  },
  turnStart(st, p) {
    st.startRem = st.rem[p];
    st.startOpen = st.open[p];
  },
  dart(st, p, d, t, R) {
    const out = R.rules.out;
    const before = st.rem[p];
    if (canCheckout(before, 1, out)) R.stats[p].dblAtt++;
    if (!st.open[p]) {
      if (d.m !== 2) return null;
      st.open[p] = true;
    }
    const after = before - dartValue(d);
    if (after < 0 || (after > 0 && after <= deadScore(out))) return { bust: true };
    if (after === 0) {
      if (!isFinishDart(d, out)) return { bust: true };
      st.rem[p] = 0;
      R.stats[p].dblHit++;
      return { winner: p };
    }
    st.rem[p] = after;
    return null;
  },
  visit(st, p, v, n, t, R) {
    const out = R.rules.out;
    const before = st.rem[p];
    if (!st.open[p] && v > 0) st.open[p] = true;
    const after = before - v;
    if (after < 0 || (after > 0 && after <= deadScore(out))) return { bust: true };
    if (after === 0) {
      if (!canCheckout(before, Math.max(1, n), out)) return { bust: true };
      st.rem[p] = 0;
      return { winner: p };
    }
    st.rem[p] = after;
    return null;
  },
  turnEnd(st, p, t, R) {
    if (t.bust) {
      st.rem[p] = st.startRem;
      st.open[p] = st.startOpen;
    }
    const score = t.bust ? 0 : st.startRem - st.rem[p];
    const s = R.stats[p];
    s.points += score;
    s.visits++;
    if (st.visits[p] < 3) {
      s.f9pts += score;
      s.f9darts += t.n;
    }
    st.visits[p]++;
    if (score > s.hi) s.hi = score;
    if (score === 180) s.t180++;
    else if (score >= 140) s.t140++;
    else if (score >= 100) s.t100++;
    if (st.rem[p] === 0) {
      s.co++;
      if (score > s.hiCo) s.hiCo = score;
    }
    return { score };
  },
};

export const CRICKET_TARGETS = [20, 19, 18, 17, 16, 15, 25];

function cricketWon(st, p, R) {
  if (!CRICKET_TARGETS.every((s) => st.marks[p][s] >= 3)) return false;
  const rest = others(R.n, p);
  return R.rules.variant === 'cut'
    ? rest.every((q) => st.pts[p] <= st.pts[q])
    : rest.every((q) => st.pts[p] >= st.pts[q]);
}

const cricket = {
  id: 'cricket',
  name: 'Cricket',
  minPlayers: 1,
  defaults: { variant: 'standard', legs: 1, sets: 1 },
  describe: (r) => (r.variant === 'cut' ? 'Cricket · Cut-throat' : 'Cricket · Klasyczny'),
  init(R) {
    return {
      marks: Array.from({ length: R.n }, () => Object.fromEntries(CRICKET_TARGETS.map((s) => [s, 0]))),
      pts: fill(R.n, 0),
    };
  },
  turnStart(st, p, t) {
    t.marks = 0;
  },
  dart(st, p, d, t, R) {
    if (!CRICKET_TARGETS.includes(d.s)) return null;
    let counted = 0;
    for (let h = 0; h < d.m; h++) {
      if (st.marks[p][d.s] < 3) {
        st.marks[p][d.s]++;
        counted++;
        continue;
      }
      const open = others(R.n, p).filter((q) => st.marks[q][d.s] < 3);
      if (!open.length) continue;
      counted++;
      if (R.rules.variant === 'cut') open.forEach((q) => (st.pts[q] += d.s));
      else st.pts[p] += d.s;
    }
    R.stats[p].marks += counted;
    t.marks += counted;
    return cricketWon(st, p, R) ? { winner: p } : null;
  },
  turnEnd(st, p, t) {
    return { score: t.marks };
  },
  legEnd(st, R) {
    st.pts.forEach((v, i) => (R.stats[i].score += v));
  },
};

export const clockSequence = (rules) => {
  const seq = Array.from({ length: 20 }, (_, i) => i + 1);
  if (rules.bull) seq.push(25);
  return seq;
};

const clock = {
  id: 'clock',
  name: 'Dookoła zegara',
  minPlayers: 1,
  defaults: { multi: false, bull: true, legs: 1, sets: 1 },
  describe: (r) => `Zegar${r.multi ? ' · z mnożnikami' : ''}${r.bull ? ' · z bullem' : ''}`,
  init(R) {
    return { pos: fill(R.n, 0) };
  },
  target(st, p, R) {
    return clockSequence(R.rules)[st.pos[p]];
  },
  turnStart(st, p, t) {
    t.hits = 0;
  },
  dart(st, p, d, t, R) {
    const seq = clockSequence(R.rules);
    const target = seq[st.pos[p]];
    if (d.s === 0 || d.s !== target) return null;
    R.stats[p].hits++;
    t.hits++;
    const last = seq.length - 1;
    if (st.pos[p] === last) {
      st.pos[p] = seq.length;
      return { winner: p };
    }
    const step = R.rules.multi && target !== 25 ? d.m : 1;
    st.pos[p] = R.rules.bull ? Math.min(st.pos[p] + step, last) : Math.min(st.pos[p] + step, seq.length);
    return st.pos[p] >= seq.length ? { winner: p } : null;
  },
  turnEnd(st, p, t) {
    return { score: t.hits };
  },
};

const shanghaiTarget = (R) => (R.leg.round <= R.rules.rounds ? R.leg.round : 25);

const shanghai = {
  id: 'shanghai',
  name: 'Shanghai',
  minPlayers: 1,
  defaults: { rounds: 7, legs: 1, sets: 1 },
  describe: (r) => `Shanghai · ${r.rounds} rund`,
  init(R) {
    return { pts: fill(R.n, 0), tie: null };
  },
  target(st, p, R) {
    return shanghaiTarget(R);
  },
  turnStart(st, p, t) {
    t.pts = 0;
    t.ms = [];
  },
  dart(st, p, d, t, R) {
    const target = shanghaiTarget(R);
    if (d.s === 0 || d.s !== target) return null;
    const v = dartValue(d);
    st.pts[p] += v;
    t.pts += v;
    t.ms.push(d.m);
    R.stats[p].hits++;
    if (target !== 25 && [1, 2, 3].every((m) => t.ms.includes(m))) {
      t.shanghai = true;
      return { winner: p };
    }
    return null;
  },
  turnEnd(st, p, t) {
    return { score: t.pts };
  },
  isActive(st, p) {
    return !st.tie || st.tie.includes(p);
  },
  roundEnd(st, R) {
    if (R.leg.round - 1 < R.rules.rounds) return null;
    const pool = st.tie || [...Array(R.n).keys()];
    const max = Math.max(...pool.map((i) => st.pts[i]));
    const leaders = pool.filter((i) => st.pts[i] === max);
    if (leaders.length === 1) return { winner: leaders[0] };
    st.tie = leaders;
    return null;
  },
  legEnd(st, R) {
    st.pts.forEach((v, i) => (R.stats[i].score += v));
  },
};

const killer = {
  id: 'killer',
  name: 'Killer',
  minPlayers: 2,
  defaults: { lives: 3, zone: 'double', selfHit: true, legs: 1, sets: 1 },
  describe: (r) => `Killer · ${r.lives} ${r.lives === 1 ? 'życie' : r.lives < 5 ? 'życia' : 'żyć'} · ${r.zone === 'double' ? 'podwójne' : 'całe pole'}`,
  meta(n, rand = Math.random) {
    const pool = Array.from({ length: 20 }, (_, i) => i + 1);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return { nums: pool.slice(0, n) };
  },
  init(R) {
    return { lives: fill(R.n, R.rules.lives), killer: fill(R.n, false), nums: R.meta.nums.slice() };
  },
  turnStart(st, p, t) {
    t.notes = [];
  },
  dart(st, p, d, t, R) {
    if (d.s < 1 || d.s > 20) return null;
    if (R.rules.zone === 'double' && d.m !== 2) return null;
    const q = st.nums.findIndex((x, i) => x === d.s && st.lives[i] > 0);
    if (q < 0) return null;
    const alive = () => st.lives.map((l, i) => (l > 0 ? i : -1)).filter((i) => i >= 0);
    if (q === p) {
      if (!st.killer[p]) {
        st.killer[p] = true;
        t.notes.push({ type: 'killer', p });
        return null;
      }
      if (!R.rules.selfHit) return null;
      st.lives[p]--;
      t.notes.push({ type: 'hit', p, q: p });
      if (st.lives[p] > 0) return null;
      const left = alive();
      return left.length === 1 ? { winner: left[0] } : { end: true };
    }
    if (!st.killer[p]) return null;
    st.lives[q]--;
    R.stats[p].hits++;
    t.notes.push({ type: 'hit', p, q });
    if (st.lives[q] === 0) R.stats[p].kills++;
    const left = alive();
    return left.length === 1 ? { winner: left[0] } : null;
  },
  turnEnd() {
    return { score: 0 };
  },
  isActive(st, p) {
    return st.lives[p] > 0;
  },
};

export const ENGINES = { x01, cricket, clock, shanghai, killer };
export const MODE_IDS = Object.keys(ENGINES);
