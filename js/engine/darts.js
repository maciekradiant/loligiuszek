// Dart values, labels and checkout maths shared by every game mode.
// A dart is { s, m }: s = segment (0 miss, 1–20, 25 bull), m = multiplier (1–3; bull uses 1 or 2).

export const MISS = Object.freeze({ s: 0, m: 1 });

export const dartValue = (d) => d.s * d.m;

export function dartLabel(d) {
  if (!d || d.s === 0) return 'X';
  if (d.s === 25) return d.m === 2 ? 'BULL' : '25';
  return (d.m === 3 ? 'T' : d.m === 2 ? 'D' : '') + d.s;
}

// Every scoring throw on the board.
export const ALL_DARTS = (() => {
  const out = [];
  for (let m = 1; m <= 3; m++) for (let s = 1; s <= 20; s++) out.push({ s, m });
  out.push({ s: 25, m: 1 }, { s: 25, m: 2 });
  return out;
})();

export function isFinishDart(d, out = 'double') {
  if (d.s === 0) return false;
  if (out === 'single') return true;
  if (out === 'master') return d.m >= 2;
  return d.m === 2;
}

// Lowest remaining score that can no longer be finished (1 under double/master out).
export const deadScore = (out) => (out === 'single' ? 0 : 1);

// Totals reachable with up to three darts (misses included).
export const VALID_VISITS = (() => {
  const vals = [0, ...new Set(ALL_DARTS.map(dartValue))];
  const set = new Set();
  for (const a of vals) for (const b of vals) for (const c of vals) set.add(a + b + c);
  return set;
})();

export const isValidVisit = (n) => Number.isInteger(n) && n >= 0 && n <= 180 && VALID_VISITS.has(n);

// Preference order for finishing doubles: the ones pros like to leave first.
const DOUBLE_PREF = [20, 16, 8, 18, 12, 10, 4, 14, 6, 2, 9, 19, 17, 15, 13, 11, 7, 5, 3, 1];
const TREBLE_PREF = [20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

function finishCost(d) {
  if (d.s === 25) return d.m === 2 ? 14 : 16;
  if (d.m === 2) return DOUBLE_PREF.indexOf(d.s);
  if (d.m === 3) return 20 + TREBLE_PREF.indexOf(d.s) * 0.2;
  return 0.5 + (20 - d.s) * 0.01;
}

function setupCost(d) {
  if (d.s === 25) return d.m === 2 ? 9 : 7;
  if (d.m === 1) return 1 + (20 - d.s) * 0.005;
  if (d.m === 3) return 3 + TREBLE_PREF.indexOf(d.s) * 0.5;
  return 12 + DOUBLE_PREF.indexOf(d.s) * 0.1;
}

const routeCache = new Map();

// Best checkout route for `rem` using at most `darts` darts, or null.
export function checkoutRoute(rem, darts = 3, out = 'double') {
  const key = `${rem}|${darts}|${out}`;
  if (routeCache.has(key)) return routeCache.get(key);
  let best = null;
  if (rem > 0 && rem <= 180) {
    const finishers = ALL_DARTS.filter((d) => isFinishDart(d, out));
    const byValue = new Map();
    for (const d of finishers) {
      const v = dartValue(d);
      const cur = byValue.get(v);
      if (!cur || finishCost(d) < finishCost(cur)) byValue.set(v, d);
    }
    const consider = (setup, fin) => {
      const cost = setup.length * 100 + setup.reduce((a, d) => a + setupCost(d), 0) + finishCost(fin);
      if (!best || cost < best.cost) best = { cost, route: [...setup, fin] };
    };
    const f1 = byValue.get(rem);
    if (f1) consider([], f1);
    if (darts >= 2) {
      for (const a of ALL_DARTS) {
        const f = byValue.get(rem - dartValue(a));
        if (f) consider([a], f);
      }
    }
    if (darts >= 3 && (!best || best.route.length > 2)) {
      for (const a of ALL_DARTS) {
        for (const b of ALL_DARTS) {
          const f = byValue.get(rem - dartValue(a) - dartValue(b));
          if (f) consider(setupOrder(a, b), f);
        }
      }
    }
  }
  const route = best ? best.route : null;
  routeCache.set(key, route);
  return route;
}

// Throw the bigger setup dart first (T20 before S10), the usual way routes are written.
const setupOrder = (a, b) => (dartValue(a) >= dartValue(b) ? [a, b] : [b, a]);

export function minDartsToFinish(rem, out = 'double') {
  for (let n = 1; n <= 3; n++) if (checkoutRoute(rem, n, out)) return n;
  return Infinity;
}

export const canCheckout = (rem, darts = 3, out = 'double') => !!checkoutRoute(rem, darts, out);
