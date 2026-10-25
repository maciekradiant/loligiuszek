import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createMatch, matchState, pushEvent } from '../js/engine/match.js';
import { snookerOn, snookerRemaining } from '../js/engine/cue.js';

const players = [
  { id: 'a', name: 'A', color: 'red' },
  { id: 'b', name: 'B', color: 'green' },
];
const pot = (b) => ({ k: 'pot', b });
const MISS = { k: 'miss' };
const foul = (v, red) => ({ k: 'foul', v, red });

test('snooker: reds and colours alternate, remaining points shrink', () => {
  const m = createMatch({ id: 'm', mode: 'snooker', rules: { legs: 1, sets: 1, reds: 6 }, players });
  let R = matchState(m);
  assert.equal(snookerRemaining(R.leg.st), 6 * 8 + 27);
  assert.deepEqual(snookerOn(R.leg.st, R.leg.turn), [1]);
  R = pushEvent(m, pot(1));
  assert.deepEqual(snookerOn(R.leg.st, R.leg.turn), [1, 2, 3, 4, 5, 6, 7]);
  R = pushEvent(m, pot(7));
  assert.equal(R.leg.st.pts[0], 8);
  assert.equal(R.leg.turn.pts, 8);
  assert.equal(snookerRemaining(R.leg.st), 5 * 8 + 27);
  R = pushEvent(m, pot(5)); // not on: ignored
  assert.equal(R.leg.st.pts[0], 8);
  R = pushEvent(m, MISS);
  assert.equal(R.leg.cur, 1);
  assert.equal(R.stats[0].hb, 8);
});

test('snooker: a missed colour after the last red opens the colours, fouls score for the opponent', () => {
  const m = createMatch({ id: 'm', mode: 'snooker', rules: { legs: 1, sets: 1, reds: 6 }, players });
  for (let i = 0; i < 5; i++) [pot(1), pot(2)].forEach((e) => pushEvent(m, e));
  let R = pushEvent(m, pot(1)); // last red
  assert.equal(R.leg.st.reds, 0);
  R = pushEvent(m, MISS); // missed the colour -> yellow is on for B
  assert.equal(R.leg.st.phase, 'colors');
  assert.deepEqual(snookerOn(R.leg.st, R.leg.turn), [2]);
  R = pushEvent(m, foul(4));
  assert.equal(R.leg.st.pts[0], 6 + 10 + 4);
  assert.equal(R.stats[1].fouls, 1);
  assert.equal(R.leg.cur, 0);
});

test('snooker: a tie after the black re-spots it, the next black wins', () => {
  const m = createMatch({ id: 'm', mode: 'snooker', rules: { legs: 2, sets: 1, reds: 6 }, players });
  const seq = [
    pot(1), pot(7), MISS, // A 8
    pot(1), pot(7), MISS, // B 8
    pot(1), pot(7), MISS, // A 16
    pot(1), pot(7), MISS, // B 16
    pot(1), pot(7), MISS, // A 24
    pot(1), pot(2), MISS, // B 19, last red: colours from yellow
    pot(2), MISS, // A 26
    pot(3), MISS, // B 22
    pot(4), pot(5), MISS, // A 35
    pot(6), // B 28
  ];
  seq.forEach((e) => pushEvent(m, e));
  let R = matchState(m);
  assert.equal(R.leg.st.phase, 'colors');
  assert.deepEqual(R.leg.st.pts, [35, 28]);
  assert.equal(snookerRemaining(R.leg.st), 7);
  R = pushEvent(m, pot(7)); // B levels the scores on the black
  assert.equal(R.leg.st.respot, true);
  assert.equal(R.winner, null);
  assert.deepEqual(R.legsInSet, [0, 0]);
  pushEvent(m, MISS);
  R = pushEvent(m, pot(7));
  assert.equal(R.last.type, 'leg');
  assert.deepEqual(R.legsInSet, [1, 0]);
  assert.equal(R.stats[0].hb, 9);
  assert.equal(R.stats[0].pts, 42);
  assert.equal(R.leg.starter, 1, 'snooker alternates the break');
});

test('snooker: a foul with only the black left ends the frame', () => {
  const m = createMatch({ id: 'm', mode: 'snooker', rules: { legs: 1, sets: 1, reds: 6 }, players });
  for (let i = 0; i < 6; i++) [pot(1), pot(7)].forEach((e) => pushEvent(m, e));
  [2, 3, 4, 5, 6].forEach((b) => pushEvent(m, pot(b)));
  pushEvent(m, MISS);
  const R = pushEvent(m, foul(7));
  assert.equal(R.winner, 0);
  assert.equal(R.stats[0].hb, 68);
  assert.equal(R.stats[0].b50, 1);
});

test('pool9: potting the nine wins the frame, three fouls lose it, break and run counted', () => {
  const m = createMatch({ id: 'm', mode: 'pool9', rules: { legs: 2, sets: 1, breakRule: 'winner', threeFoul: true }, players });
  let R = pushEvent(m, pot(1));
  R = pushEvent(m, pot(9));
  assert.equal(R.last.type, 'leg');
  assert.equal(R.last.runOut, true);
  assert.equal(R.stats[0].breakRuns, 1);
  assert.equal(R.leg.starter, 0, 'winner breaks');
  // second frame: A fouls three times in a row (B misses in between)
  pushEvent(m, foul());
  pushEvent(m, MISS);
  pushEvent(m, foul());
  pushEvent(m, MISS);
  R = pushEvent(m, foul());
  assert.equal(R.winner, null);
  assert.deepEqual(R.legsInSet, [1, 1]);
  assert.equal(R.last.threeFoul, true);
});

test('pool9: a legal shot resets the foul count', () => {
  const m = createMatch({ id: 'm', mode: 'pool9', rules: { legs: 1, sets: 1, breakRule: 'alternate', threeFoul: true }, players });
  pushEvent(m, foul());
  pushEvent(m, MISS);
  pushEvent(m, foul());
  pushEvent(m, MISS);
  pushEvent(m, MISS); // A plays a legal shot
  pushEvent(m, MISS);
  const R = pushEvent(m, foul());
  assert.equal(R.winner, null);
  assert.equal(R.leg.fouls[0], 1);
});

test('pool8: groups are picked after the break and the frame is awarded explicitly', () => {
  const m = createMatch({ id: 'm', mode: 'pool8', rules: { legs: 2, sets: 1, breakRule: 'alternate' }, players });
  let R = pushEvent(m, pot(3)); // on the break: table stays open
  assert.equal(R.leg.st.groups, null);
  R = pushEvent(m, MISS);
  R = pushEvent(m, pot(12)); // B pots a stripe
  assert.deepEqual(R.leg.st.groups, ['solids', 'stripes']);
  R = pushEvent(m, pot(8)); // the 8 is never a plain pot
  assert.equal(R.leg.st.on.includes(8), true);
  R = pushEvent(m, { k: 'frame', p: 1 });
  assert.equal(R.legsInSet[1], 1);
  assert.equal(R.leg.starter, 1, 'break alternates');
  assert.equal(R.stats[1].pots, 1);
});
