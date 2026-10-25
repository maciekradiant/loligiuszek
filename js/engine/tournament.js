// Tournament brackets. A "tie" is one scheduled pairing; it gets a match once a board picks it up.
//   { key, round, slot, players: [idA|null, idB|null], feeds, matchId, winner, result, bye }

// Standard bracket order so the top seeds meet as late as possible: 8 -> [1,8,4,5,2,7,3,6].
export function seedOrder(size) {
  let order = [1];
  while (order.length < size) {
    const sum = order.length * 2 + 1;
    order = order.flatMap((s) => [s, sum - s]);
  }
  return order;
}

export function buildKnockout(ids) {
  const size = 2 ** Math.ceil(Math.log2(Math.max(2, ids.length)));
  const rounds = Math.log2(size);
  const order = seedOrder(size);
  const ties = [];
  for (let r = 0; r < rounds; r++) {
    const count = size / 2 ** (r + 1);
    for (let i = 0; i < count; i++) {
      const tie = { key: `r${r}m${i}`, round: r, slot: i, players: [null, null], feeds: null, matchId: null, winner: null, result: null, bye: false };
      if (r === 0) {
        tie.players = [ids[order[2 * i] - 1] ?? null, ids[order[2 * i + 1] - 1] ?? null];
      } else {
        tie.feeds = [`r${r - 1}m${2 * i}`, `r${r - 1}m${2 * i + 1}`];
      }
      ties.push(tie);
    }
  }
  return resolveKnockout(ties);
}

export function resolveKnockout(ties) {
  const byKey = new Map(ties.map((t) => [t.key, t]));
  for (const t of ties) {
    if (t.feeds) t.players = t.feeds.map((k) => byKey.get(k).winner);
    const [a, b] = t.players;
    if (t.round === 0 && !t.winner && (!a || !b) && (a || b)) {
      t.winner = a || b;
      t.bye = true;
    }
  }
  return ties;
}

export function knockoutRounds(ties) {
  return ties.reduce((max, t) => Math.max(max, t.round + 1), 0);
}

export function roundName(round, rounds, format = 'knockout') {
  if (format === 'league') return `Kolejka ${round + 1}`;
  const fromEnd = rounds - 1 - round;
  if (fromEnd === 0) return 'Finał';
  if (fromEnd === 1) return 'Półfinał';
  if (fromEnd === 2) return 'Ćwierćfinał';
  return `1/${2 ** fromEnd} finału`;
}

// Round robin by the circle method; every player meets every other once.
export function buildLeague(ids) {
  const list = ids.length % 2 ? [...ids, null] : [...ids];
  const n = list.length;
  const ties = [];
  for (let r = 0; r < n - 1; r++) {
    let slot = 0;
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) {
        const pair = r % 2 ? [b, a] : [a, b];
        ties.push({ key: `r${r}m${slot}`, round: r, slot: slot++, players: pair, feeds: null, matchId: null, winner: null, result: null, bye: false });
      }
    }
    list.splice(1, 0, list.pop());
  }
  return ties;
}

export const tieReady = (t) => !t.winner && !t.matchId && t.players[0] && t.players[1];

// Next pairing a free board can start, skipping players already throwing elsewhere.
export function nextTie(ties, busy = new Set()) {
  return ties
    .filter((t) => tieReady(t) && !busy.has(t.players[0]) && !busy.has(t.players[1]))
    .sort((a, b) => a.round - b.round || a.slot - b.slot)[0] || null;
}

export function standings(ties, ids) {
  const rows = new Map(ids.map((id) => [id, { id, played: 0, won: 0, lost: 0, legsFor: 0, legsAgainst: 0, pts: 0 }]));
  for (const t of ties) {
    if (!t.result) continue;
    t.players.forEach((pid, i) => {
      const row = rows.get(pid);
      if (!row) return;
      row.played++;
      row.legsFor += t.result.legs[i];
      row.legsAgainst += t.result.legs[1 - i];
      if (t.winner === pid) {
        row.won++;
        row.pts += 2;
      } else row.lost++;
    });
  }
  const list = [...rows.values()];
  const headToHead = (a, b) => {
    const t = ties.find((x) => x.result && x.players.includes(a.id) && x.players.includes(b.id));
    if (!t) return 0;
    return t.winner === a.id ? -1 : 1;
  };
  return list.sort(
    (a, b) =>
      b.pts - a.pts ||
      b.legsFor - b.legsAgainst - (a.legsFor - a.legsAgainst) ||
      b.legsFor - a.legsFor ||
      headToHead(a, b),
  );
}

export function champion(format, ties, ids) {
  if (!ties.length) return null;
  if (format === 'knockout') {
    const rounds = knockoutRounds(ties);
    const final = ties.find((t) => t.round === rounds - 1);
    return final?.winner || null;
  }
  if (ties.some((t) => !t.winner)) return null;
  return standings(ties, ids)[0]?.id || null;
}
