import { test } from 'node:test';
import assert from 'node:assert/strict';

import { checkoutRoute, dartLabel, isValidVisit, minDartsToFinish, canCheckout } from '../js/engine/darts.js';
import { createMatch, matchState, pushEvent, undoEvent, checkVisit } from '../js/engine/match.js';
import { buildKnockout, buildLeague, nextTie, resolveKnockout, seedOrder, standings, champion } from '../js/engine/tournament.js';

const players = (n) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}`, color: 'red' }));
const D = (s, m = 1) => ({ k: 'd', s, m });
const V = (v, n = 3) => ({ k: 'v', v, n });
const route = (rem, darts, out) => checkoutRoute(rem, darts, out)?.map(dartLabel).join(' ');

test('checkout routes', () => {
  assert.equal(route(170, 3), 'T20 T20 BULL');
  assert.equal(route(167, 3), 'T20 T19 BULL');
  assert.equal(route(100, 3), 'T20 D20');
  assert.equal(route(40, 3), 'D20');
  assert.equal(route(32, 1), 'D16');
  assert.equal(route(50, 1), 'BULL');
  assert.equal(route(81, 3), 'T19 D12');
  assert.equal(route(169, 3), undefined);
  assert.equal(route(159, 3), undefined);
  assert.equal(route(41, 1), undefined);
  assert.equal(route(3, 2), '1 D1');
  assert.equal(route(7, 1, 'single'), '7');
  assert.equal(route(60, 1, 'master'), 'T20');
  assert.equal(minDartsToFinish(170), 3);
  assert.equal(minDartsToFinish(101), 2);
  assert.ok(!canCheckout(1));
});

test('every route really finishes the score', () => {
  for (const out of ['double', 'master', 'single']) {
    for (let rem = 2; rem <= 170; rem++) {
      for (let darts = 1; darts <= 3; darts++) {
        const r = checkoutRoute(rem, darts, out);
        if (!r) continue;
        assert.ok(r.length <= darts);
        assert.equal(r.reduce((a, d) => a + d.s * d.m, 0), rem);
        const last = r[r.length - 1];
        if (out === 'double') assert.equal(last.m, 2);
        if (out === 'master') assert.ok(last.m >= 2);
      }
    }
  }
});

test('valid visit totals', () => {
  for (const v of [0, 26, 60, 100, 140, 171, 174, 177, 180]) assert.ok(isValidVisit(v), v);
  for (const v of [163, 166, 169, 172, 173, 175, 176, 178, 179, 181, -1]) assert.ok(!isValidVisit(v), v);
});

test('x01 visit scoring, bust and checkout', () => {
  const m = createMatch({ id: 'm', mode: 'x01', rules: { start: 101, out: 'double', in: 'straight', legs: 1, sets: 1 }, players: players(2) });
  let R = pushEvent(m, V(60));
  assert.equal(R.leg.st.rem[0], 41);
  assert.equal(R.leg.cur, 1);
  // 101 - 100 leaves 1, which is a bust under double out
  assert.deepEqual(checkVisit(R, 100), { bust: true });
  R = pushEvent(m, V(100));
  assert.equal(R.leg.st.rem[1], 101);
  assert.equal(R.leg.visits.at(-1).bust, true);
  assert.equal(R.leg.visits.at(-1).score, 0);
  assert.equal(checkVisit(R, 41).finish, true);
  assert.equal(checkVisit(R, 41).minDarts, 2);
  R = pushEvent(m, V(41, 2));
  assert.equal(R.winner, 0);
  assert.equal(R.last.type, 'match');
  assert.equal(R.stats[0].darts, 5);
  assert.equal(R.stats[0].hiCo, 41);
  assert.equal(R.stats[0].co, 1);
  assert.equal(R.stats[0].points, 101);
});

test('x01 per-dart bust reverts the visit and double out is enforced', () => {
  const m = createMatch({ id: 'm', mode: 'x01', rules: { start: 40, out: 'double', in: 'straight', legs: 1, sets: 1 }, players: players(1) });
  let R = pushEvent(m, D(20));
  assert.equal(R.leg.st.rem[0], 20);
  R = pushEvent(m, D(20)); // reaches 0 with a single -> bust
  assert.equal(R.leg.st.rem[0], 40);
  assert.equal(R.leg.visits.length, 1);
  assert.equal(R.leg.visits[0].bust, true);
  R = pushEvent(m, D(20, 2));
  assert.equal(R.winner, 0);
  assert.equal(R.stats[0].dblAtt, 3); // darts thrown at 40, 20 and 40 again
  assert.equal(R.stats[0].dblHit, 1);
});

test('x01 legs rotate the starting player and sets are counted', () => {
  const m = createMatch({ id: 'm', mode: 'x01', rules: { start: 40, out: 'single', in: 'straight', legs: 2, sets: 2 }, players: players(2) });
  let R = pushEvent(m, V(40, 1)); // p0 wins leg 1
  assert.equal(R.last.type, 'leg');
  assert.equal(R.leg.starter, 1);
  R = pushEvent(m, V(40, 1)); // p1 wins leg 2
  assert.equal(R.leg.starter, 0);
  R = pushEvent(m, V(40, 1)); // p0 wins leg 3 -> set 1
  assert.equal(R.last.type, 'set');
  assert.deepEqual(R.sets, [1, 0]);
  assert.deepEqual(R.legsInSet, [0, 0]);
  R = pushEvent(m, V(0));
  R = pushEvent(m, V(40, 1)); // p0
  R = pushEvent(m, V(40, 1)); // p0? starter of leg 5 is p0 (start 0 + legNo 4)
  assert.equal(R.winner, 0);
});

test('double in needs a double to start scoring', () => {
  const m = createMatch({ id: 'm', mode: 'x01', rules: { start: 301, out: 'double', in: 'double', legs: 1, sets: 1 }, players: players(1) });
  let R = pushEvent(m, D(20, 3));
  assert.equal(R.leg.st.rem[0], 301);
  R = pushEvent(m, D(10, 2));
  assert.equal(R.leg.st.rem[0], 281);
  R = pushEvent(m, D(20, 3));
  assert.equal(R.leg.st.rem[0], 221);
  assert.equal(R.leg.visits[0].score, 80);
});

test('cricket marks, points and win', () => {
  const m = createMatch({ id: 'm', mode: 'cricket', rules: { variant: 'standard', legs: 1, sets: 1 }, players: players(2) });
  let R;
  pushEvent(m, D(20, 3));
  pushEvent(m, D(20, 3)); // scores 60
  R = pushEvent(m, D(19, 1));
  assert.equal(R.leg.st.pts[0], 60);
  assert.equal(R.leg.st.marks[0][20], 3);
  assert.equal(R.leg.visits[0].score, 7);
  for (const s of [20, 18, 17]) pushEvent(m, D(s, 3)); // p1 closes 20 18 17
  for (const s of [19, 18, 17]) pushEvent(m, D(s, 3)); // p0: 19 needs 2 marks, the third scores 19
  assert.equal(matchState(m).leg.st.pts[0], 79);
  for (const s of [19, 16, 15]) pushEvent(m, D(s, 3));
  for (const s of [16, 15]) pushEvent(m, D(s, 3));
  R = pushEvent(m, D(25, 2));
  assert.equal(R.leg.st.marks[0][25], 2);
  pushEvent(m, D(25, 2));
  pushEvent(m, D(25, 1)); // p1 closes bull; 0 pts vs 79 -> no win
  R = pushEvent(m, D(0));
  assert.equal(R.winner, null);
  R = pushEvent(m, D(25, 1)); // p0 closes bull with 79 >= 0 -> wins
  assert.equal(R.winner, 0);
  assert.equal(R.stats[0].marks, 3 + 3 + 1 + 3 + 3 + 3 + 3 + 3 + 2 + 1);
});

test('cut-throat gives points to opponents', () => {
  const m = createMatch({ id: 'm', mode: 'cricket', rules: { variant: 'cut', legs: 1, sets: 1 }, players: players(2) });
  pushEvent(m, D(20, 3));
  const R = pushEvent(m, D(20, 2));
  assert.deepEqual(R.leg.st.pts, [0, 40]);
});

test('around the clock with multipliers and bull finish', () => {
  const m = createMatch({ id: 'm', mode: 'clock', rules: { multi: true, bull: true, legs: 1, sets: 1 }, players: players(1) });
  let R = pushEvent(m, D(1, 3));
  assert.equal(R.leg.st.pos[0], 3);
  R = pushEvent(m, D(5));
  assert.equal(R.leg.st.pos[0], 3);
  for (let s = 4; s <= 19; s++) pushEvent(m, D(s));
  R = pushEvent(m, D(20, 3));
  assert.equal(R.leg.st.pos[0], 20); // clamped to the bull
  R = pushEvent(m, D(25, 1));
  assert.equal(R.winner, 0);
});

test('shanghai instant win and tie-break on bull', () => {
  const m = createMatch({ id: 'm', mode: 'shanghai', rules: { rounds: 2, legs: 1, sets: 1 }, players: players(3) });
  let R = pushEvent(m, D(1, 1));
  pushEvent(m, D(1, 2));
  R = pushEvent(m, D(1, 3));
  assert.equal(R.winner, 0);
  assert.ok(R.leg.visits[0].shanghai);

  const t = createMatch({ id: 't', mode: 'shanghai', rules: { rounds: 1, legs: 1, sets: 1 }, players: players(3) });
  [D(1), D(0), D(0), D(1), D(0), D(0), D(0), D(0), D(0)].forEach((e) => pushEvent(t, e));
  R = matchState(t);
  assert.equal(R.winner, null);
  assert.deepEqual(R.leg.st.tie, [0, 1]);
  assert.equal(R.leg.cur, 0);
  [D(25, 1), D(0), D(0)].forEach((e) => pushEvent(t, e));
  assert.equal(matchState(t).leg.cur, 1, 'player 2 is skipped in the tie-break');
  [D(25, 2), D(0)].forEach((e) => pushEvent(t, e));
  R = pushEvent(t, D(0));
  assert.equal(R.winner, 1);
});

test('killer lives, killers and eliminations', () => {
  const m = createMatch({ id: 'm', mode: 'killer', rules: { lives: 1, zone: 'double', selfHit: true, legs: 1, sets: 1 }, players: players(3) });
  m.meta.nums = [5, 10, 15];
  let R = pushEvent(m, D(10, 2)); // not a killer yet -> nothing
  assert.deepEqual(R.leg.st.lives, [1, 1, 1]);
  R = pushEvent(m, D(5, 2));
  assert.equal(R.leg.st.killer[0], true);
  R = pushEvent(m, D(10, 2));
  assert.deepEqual(R.leg.st.lives, [1, 0, 1]);
  assert.equal(R.leg.cur, 2, 'eliminated player is skipped');
  pushEvent(m, D(15, 2));
  pushEvent(m, D(0));
  R = pushEvent(m, D(0));
  assert.equal(R.leg.cur, 0);
  R = pushEvent(m, D(15, 2));
  assert.equal(R.winner, 0);
  assert.equal(R.stats[0].kills, 2);
});

test('undo restores the previous state exactly', () => {
  const m = createMatch({ id: 'm', mode: 'x01', rules: { start: 501, out: 'double', in: 'straight', legs: 1, sets: 1 }, players: players(2) });
  pushEvent(m, D(20, 3));
  const before = JSON.stringify(matchState(m).leg.st);
  pushEvent(m, D(19, 3));
  undoEvent(m);
  assert.equal(JSON.stringify(matchState(m).leg.st), before);
});

test('bracket seeding gives byes to top seeds', () => {
  assert.deepEqual(seedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  const ties = buildKnockout(['a', 'b', 'c', 'd', 'e']);
  const r0 = ties.filter((t) => t.round === 0);
  assert.equal(r0.length, 4);
  assert.equal(r0.filter((t) => t.bye).length, 3);
  assert.deepEqual(r0.find((t) => !t.bye).players.sort(), ['d', 'e']);
  const ready = nextTie(ties);
  assert.deepEqual(ready.players.sort(), ['d', 'e']);
  ready.winner = 'e';
  ready.result = { legs: [0, 1] };
  resolveKnockout(ties);
  const semis = ties.filter((t) => t.round === 1);
  assert.ok(semis.every((t) => t.players[0] && t.players[1]));
  const final = ties.find((t) => t.round === 2);
  assert.deepEqual(final.players, [null, null]);
  semis.forEach((t) => (t.winner = t.players[0]));
  resolveKnockout(ties);
  final.winner = final.players[1];
  assert.equal(champion('knockout', ties, []), final.players[1]);
});

test('league schedules every pairing once and ranks by points', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  const ties = buildLeague(ids);
  assert.equal(ties.length, 10);
  const pairs = new Set(ties.map((t) => [...t.players].sort().join('')));
  assert.equal(pairs.size, 10);
  const busy = new Set(['a']);
  assert.ok(!nextTie(ties, busy).players.includes('a'));
  for (const t of ties) {
    const w = t.players.includes('c') ? 'c' : t.players.sort()[0];
    t.winner = w;
    t.result = { legs: t.players.map((p) => (p === w ? 2 : 1)) };
  }
  assert.equal(standings(ties, ids)[0].id, 'c');
  assert.equal(champion('league', ties, ids), 'c');
});
