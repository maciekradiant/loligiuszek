import { S, render, persist, openSheet, closeSheet, ask } from '../state.js';
import { careerStats, statRows, fmt } from '../engine/stats.js';
import { esc, timeAgo, duration, nf } from '../util.js';
import { icon, avatar, tabbar, sheetFrame, seg } from './common.js';

function matchCard(h) {
  const two = h.players.length === 2;
  const useSets = (h.rules?.sets || 1) > 1;
  const showScore = (h.rules?.legs || 1) > 1 || useSets;
  const rows = h.players
    .map((p, i) => {
      const win = p.id === h.winnerId;
      const val = useSets ? h.sets?.[i] : h.legs?.[i];
      const s = h.stats?.[p.id];
      const extra = h.mode === 'x01' && s?.darts ? `śr. ${fmt.f1((s.points / s.darts) * 3)}` : '';
      return `<div class="mc-player ${win ? 'win' : ''}">${avatar(p, 'av-sm')}<span class="grow">${esc(p.name)}</span><span class="faint">${extra}</span>${showScore && (two || win) ? `<span class="display">${val ?? ''}</span>` : win ? `<span class="display" style="color:var(--brass)">✓</span>` : ''}</div>`;
    })
    .join('');
  return `<button class="match-card" data-act="history-detail" data-id="${h.id}">
    <div class="match-card-head"><b>${esc(h.label)}${h.champion ? ' · finał turnieju' : ''}</b><span>${timeAgo(h.ts)}</span></div>
    ${h.context ? `<div class="eyebrow">${esc(h.context)}</div>` : ''}
    ${rows}
  </button>`;
}

function ranking() {
  const rows = S.players
    .map((p) => ({ p, c: careerStats(p.id, S.history) }))
    .filter((r) => r.c.matches)
    .sort((a, b) => b.c.wins - a.c.wins || b.c.winRate - a.c.winRate || b.c.avg - a.c.avg);
  if (!rows.length) return `<div class="empty"><div class="display">Brak danych</div><p>Ranking pojawi się po pierwszym rozegranym meczu.</p></div>`;
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th>Gracz</th><th>M</th><th>W</th><th>%</th><th>Śr.</th><th>180</th></tr></thead>
    <tbody>${rows
      .map(
        ({ p, c }, i) =>
          `<tr><td><span class="row"><span class="rank-pos" style="width:20px;font-size:18px;${i === 0 ? 'color:var(--brass)' : ''}">${i + 1}</span>${avatar(p, 'av-sm')}<span>${esc(p.name)}</span></span></td><td>${c.matches}</td><td>${c.wins}</td><td>${c.winRate}</td><td>${c.darts ? fmt.f1(c.avg) : '–'}</td><td>${c.t180}</td></tr>`,
      )
      .join('')}</tbody>
  </table></div>
  <p class="hint">Kolejność: liczba wygranych, potem procent wygranych. Średnia liczona z meczów X01.</p>`;
}

export function historyView() {
  const tab = S.ui.historyTab;
  const list = S.history.length
    ? `<div class="stack">${S.history.slice(0, 120).map(matchCard).join('')}</div>${S.history.length > 120 ? `<p class="hint">Pokazano 120 najnowszych z ${S.history.length} meczów.</p>` : ''}`
    : `<div class="empty"><div class="display">Bez meczów</div><p>Każdy ukończony mecz trafi tutaj razem ze statystykami.</p><button class="btn btn-primary" data-act="new-game">Zagraj</button></div>`;
  return `<div class="screen">
    <div class="page-head"><h1 class="page-title">Wyniki</h1></div>
    <div class="scroll">
      ${seg('history-tab', [['matches', 'Mecze'], ['ranking', 'Ranking']], tab)}
      <div style="height:14px"></div>
      ${tab === 'ranking' ? ranking() : list}
    </div>
    ${tabbar('history')}
  </div>`;
}

export function historySheet(sheet) {
  if (sheet.type !== 'history-detail') return '';
  const h = S.history.find((x) => x.id === sheet.id);
  if (!h) return '';
  const w = h.players.find((p) => p.id === h.winnerId);
  const first = h.stats?.[h.players[0].id];
  const labels = first ? statRows(h.mode, first).map((r) => r[0]) : [];
  const cols = h.players.map((p) => `<th>${esc(p.name.split(' ')[0])}</th>`).join('');
  const body = labels
    .map((label, r) => `<tr><td>${label}</td>${h.players.map((p) => `<td>${h.stats?.[p.id] ? statRows(h.mode, h.stats[p.id])[r][1] : '–'}</td>`).join('')}</tr>`)
    .join('');
  const legs = `<tr><td>Wygrane legi</td>${h.players.map((_, i) => `<td>${h.legs?.[i] ?? '–'}</td>`).join('')}</tr>`;
  return sheetFrame(
    'Mecz',
    `<div class="row">${avatar(w, 'av-lg')}<div class="grow"><div class="eyebrow" style="color:var(--brass)">Zwycięzca</div><div class="display" style="font-size:40px;text-transform:uppercase">${esc(w?.name || '')}</div></div></div>
    <p class="hint">${esc(h.label)}${h.context ? ` · ${esc(h.context)}` : ''}<br>${timeAgo(h.ts)}${h.started ? ` · ${duration(h.ts - h.started)}` : ''} · ${nf(h.players.length, 'gracz', 'graczy', 'graczy')}</p>
    <div class="table-wrap"><table class="table"><thead><tr><th>Statystyka</th>${cols}</tr></thead><tbody>${legs}${body}</tbody></table></div>
    <button class="btn btn-line btn-danger" data-act="history-delete" data-id="${h.id}">${icon.trash}Usuń z historii</button>`,
  );
}

export const historyActions = {
  'history-tab': (el) => {
    S.ui.historyTab = el.dataset.v;
    render();
  },
  'history-detail': (el) => openSheet('history-detail', { id: el.dataset.id }),
  'history-delete': async (el) => {
    const id = el.dataset.id;
    const ok = await ask({ title: 'Usunąć mecz?', text: 'Mecz zniknie z historii i ze statystyk graczy.', confirm: 'Usuń', danger: true });
    if (!ok) return;
    S.history = S.history.filter((h) => h.id !== id);
    persist('history');
    render();
  },
};
