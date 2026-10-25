import { nf } from '../util.js';

// Turning raw per-match counters into the numbers players care about.

export const avg3 = (s) => (s.darts ? (s.points / s.darts) * 3 : 0);
export const first9 = (s) => (s.f9darts ? (s.f9pts / s.f9darts) * 3 : 0);
export const mpr = (s) => (s.darts ? (s.marks / s.darts) * 3 : 0);
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const f1 = (n) => n.toFixed(1).replace('.', ',');
const f2 = (n) => n.toFixed(2).replace('.', ',');

// Headline figure shown next to a player's name during and after a match.
export function headline(mode, s) {
  switch (mode) {
    case 'x01':
      return { label: 'Średnia', value: f1(avg3(s)) };
    case 'cricket':
      return { label: 'MPR', value: f2(mpr(s)) };
    case 'killer':
      return { label: 'Eliminacje', value: String(s.kills) };
    default:
      return { label: 'Skuteczność', value: `${pct(s.hits, s.darts)}%` };
  }
}

// Detailed rows for the stats table.
export function statRows(mode, s) {
  if (mode === 'x01') {
    return [
      ['Średnia (3 lotki)', f1(avg3(s))],
      ['Pierwsze 9', f1(first9(s))],
      ['Najwyższa tura', s.hi],
      ['180', s.t180],
      ['140+', s.t140],
      ['100+', s.t100],
      ['Zamknięcia', s.co],
      ['Najwyższe zamknięcie', s.hiCo || '–'],
      ['Skuteczność na podwójnych', s.dblAtt ? `${pct(s.dblHit, s.dblAtt)}% (${s.dblHit}/${s.dblAtt})` : '–'],
      ['Najlepszy leg', s.bestLeg ? nf(s.bestLeg, 'lotka', 'lotki', 'lotek') : '–'],
      ['Lotki', s.darts],
    ];
  }
  if (mode === 'cricket') {
    return [
      ['Znaczniki na rundę (MPR)', f2(mpr(s))],
      ['Znaczniki', s.marks],
      ['Punkty', s.score],
      ['Lotki', s.darts],
    ];
  }
  if (mode === 'killer') {
    return [
      ['Eliminacje', s.kills],
      ['Trafienia rywali', s.hits],
      ['Lotki', s.darts],
    ];
  }
  const rows = [
    ['Trafienia', s.hits],
    ['Skuteczność', `${pct(s.hits, s.darts)}%`],
    ['Lotki', s.darts],
  ];
  if (mode === 'shanghai') rows.unshift(['Punkty', s.score]);
  if (mode === 'clock' && s.bestLeg) rows.push(['Najlepsze okrążenie', nf(s.bestLeg, 'lotka', 'lotki', 'lotek')]);
  return rows;
}

// Lifetime numbers for one player, folded from match history.
export function careerStats(playerId, history) {
  const c = {
    matches: 0, wins: 0, points: 0, darts: 0, t180: 0, t140: 0, t100: 0, hi: 0, hiCo: 0, co: 0,
    bestLeg: 0, bestAvg: 0, marks: 0, crDarts: 0, dblAtt: 0, dblHit: 0, kills: 0, byMode: {},
  };
  for (const h of history) {
    const s = h.stats?.[playerId];
    if (!s) continue;
    c.matches++;
    c.byMode[h.mode] = (c.byMode[h.mode] || 0) + 1;
    if (h.winnerId === playerId) c.wins++;
    if (h.mode === 'x01') {
      c.points += s.points;
      c.darts += s.darts;
      c.t180 += s.t180;
      c.t140 += s.t140;
      c.t100 += s.t100;
      c.co += s.co;
      c.dblAtt += s.dblAtt;
      c.dblHit += s.dblHit;
      c.hi = Math.max(c.hi, s.hi);
      c.hiCo = Math.max(c.hiCo, s.hiCo);
      if (s.bestLeg && s.legs && (!c.bestLeg || s.bestLeg < c.bestLeg)) c.bestLeg = s.bestLeg;
      c.bestAvg = Math.max(c.bestAvg, avg3(s));
    }
    if (h.mode === 'cricket') {
      c.marks += s.marks;
      c.crDarts += s.darts;
    }
    c.kills += s.kills || 0;
  }
  c.avg = c.darts ? (c.points / c.darts) * 3 : 0;
  c.mpr = c.crDarts ? (c.marks / c.crDarts) * 3 : 0;
  c.winRate = pct(c.wins, c.matches);
  return c;
}

export const fmt = { f1, f2 };
