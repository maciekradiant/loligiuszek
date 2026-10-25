import { S, render, persist, openSheet, closeSheet, toast, ask, addPlayer, playerById, PLAYER_COLORS } from '../state.js';
import { careerStats, fmt } from '../engine/stats.js';
import { esc, nf } from '../util.js';
import { MODE_INFO } from '../modes-ui.js';
import { icon, avatar, tabbar, sheetFrame, colorVar } from './common.js';

export function playersView() {
  const rows = S.players
    .map((p) => {
      const c = careerStats(p.id, S.history);
      const line = c.matches
        ? `${nf(c.matches, 'mecz', 'mecze', 'meczów')} · ${c.wins} ${c.wins === 1 ? 'wygrana' : 'wygranych'}${c.darts ? ` · śr. ${fmt.f1(c.avg)}` : ''}${c.hb ? ` · brejk ${c.hb}` : ''}`
        : 'Jeszcze bez meczów';
      return `<button class="list-row" data-act="player" data-id="${p.id}" data-key="${p.id}">${avatar(p)}<span class="grow"><b>${esc(p.name)}</b><small>${line}</small></span>${icon.chev}</button>`;
    })
    .join('');
  return `<div class="screen">
    <div class="page-head"><h1 class="page-title">Gracze</h1><button class="btn btn-sm" data-act="player-new">${icon.plus}Dodaj</button></div>
    <div class="scroll">
      ${
        S.players.length
          ? `<div class="list-card">${rows}</div><p class="hint" style="margin-top:12px">Stuknij gracza, aby zobaczyć jego statystyki, zmienić imię albo kolor.</p>`
          : `<div class="empty"><div class="display">Pusta lista</div><p>Dodaj osoby, z którymi grasz. Lotka zapamięta ich wyniki, średnie i rekordy.</p><button class="btn btn-primary" data-act="player-new">Dodaj gracza</button></div>`
      }
    </div>
    ${tabbar('players')}
  </div>`;
}

function colorPicker(current) {
  return `<div class="colors" role="radiogroup" aria-label="Kolor">${PLAYER_COLORS.map(
    (c) => `<button class="color-dot" style="--pc:${colorVar(c)}" data-act="player-color" data-c="${c}" aria-pressed="${c === current}" aria-label="${c}"></button>`,
  ).join('')}</div>`;
}

function favourite(c) {
  const top = Object.entries(c.byMode).sort((a, b) => b[1] - a[1])[0];
  return top ? MODE_INFO[top[0]].name : '–';
}

const stat = (value, label) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`;

export function playerSheet(sheet) {
  if (sheet.type === 'player-new') {
    return sheetFrame(
      'Nowy gracz',
      `<form class="stack" data-form="player-create" autocomplete="off">
        <input type="text" id="new-player-name" name="name" placeholder="Imię lub ksywka" maxlength="24" enterkeyhint="done" aria-label="Imię">
        <span class="rule-label">Kolor</span>
        ${colorPicker(sheet.color)}
        <button class="btn btn-primary" type="submit">Dodaj gracza</button>
      </form>`,
    );
  }
  if (sheet.type === 'player') {
    const p = playerById(sheet.id);
    if (!p) return '';
    const c = careerStats(p.id, S.history);
    const x01 = c.darts
      ? `<span class="eyebrow">X01</span><div class="stat-grid">
          ${stat(fmt.f1(c.avg), 'Średnia 3 lotek')}
          ${stat(fmt.f1(c.bestAvg), 'Najlepsza średnia meczu')}
          ${stat(c.hi || '–', 'Najwyższa tura')}
          ${stat(c.hiCo || '–', 'Najwyższe zamknięcie')}
          ${stat(c.t180, '180')}
          ${stat(c.t140, '140+')}
          ${stat(c.t100, '100+')}
          ${stat(c.bestLeg || '–', 'Najlepszy leg (lotki)')}
          ${stat(c.dblAtt ? `${Math.round((c.dblHit / c.dblAtt) * 100)}%` : '–', 'Skuteczność podwójnych')}
        </div>`
      : '';
    const cricket = c.crDarts ? `<span class="eyebrow">Cricket</span><div class="stat-grid">${stat(fmt.f2(c.mpr), 'Znaczniki na rundę')}${stat(c.marks, 'Znaczniki')}</div>` : '';
    const played = (...ids) => ids.some((id) => c.byMode[id]);
    const cue = played('pool8', 'pool9', 'snooker', 'bieda')
      ? `<span class="eyebrow">Bilard</span><div class="stat-grid">
          ${stat(c.frames, 'Wygrane partie')}
          ${stat(c.pots, 'Wbite bile')}
          ${played('pool8', 'pool9', 'bieda') ? stat(c.breakRuns, 'Break & run') : ''}
          ${played('snooker') ? `${stat(c.hb || '–', 'Najwyższy brejk')}${stat(c.b50 + c.c100, 'Brejki 50+')}` : ''}
        </div>`
      : '';
    return sheetFrame(
      esc(p.name),
      `<div class="row">${avatar(p, 'av-lg')}<div class="grow"><b style="font-size:18px">${esc(p.name)}</b><div class="faint">W Lotce od ${new Date(p.created).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</div></div></div>
      <div class="stat-grid">
        ${stat(c.matches, 'Mecze')}
        ${stat(c.wins, 'Wygrane')}
        ${stat(`${c.winRate}%`, 'Procent wygranych')}
        ${c.byMode.killer ? stat(c.kills, 'Eliminacje w Killerze') : stat(favourite(c), 'Ulubiony tryb')}
      </div>
      ${x01}${cricket}${cue}
      <span class="eyebrow">Edycja</span>
      <form class="add-player" data-form="player-rename" data-id="${p.id}" autocomplete="off">
        <input type="text" id="rename-${p.id}" name="name" value="${esc(p.name)}" maxlength="24" aria-label="Imię">
        <button class="btn" type="submit" aria-label="Zapisz imię">${icon.edit}</button>
      </form>
      ${colorPicker(p.color)}
      <button class="btn btn-line btn-danger" data-act="player-delete" data-id="${p.id}">${icon.trash}Usuń gracza</button>`,
    );
  }
  return '';
}

export const playerActions = {
  player: (el) => openSheet('player', { id: el.dataset.id }),
  'player-new': () => openSheet('player-new', { color: null }),
  'player-color': (el) => {
    const sheet = S.ui.sheet;
    if (sheet?.type === 'player') {
      const p = playerById(sheet.id);
      p.color = el.dataset.c;
      persist('players');
    } else if (sheet) sheet.color = el.dataset.c;
    render();
  },
  'player-create': (form) => {
    const name = form.querySelector('input').value;
    if (!name.trim()) {
      form.querySelector('input').focus();
      return;
    }
    const exists = S.players.some((p) => p.name.toLowerCase() === name.trim().toLowerCase());
    if (exists) {
      toast('Taki gracz już jest na liście.', 'warn');
      return;
    }
    const p = addPlayer(name, S.ui.sheet?.color);
    closeSheet();
    toast(`Dodano: ${p.name}`);
  },
  'player-rename': (form) => {
    const p = playerById(form.dataset.id);
    const name = form.querySelector('input').value.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!p || !name) return;
    p.name = name;
    persist('players');
    form.querySelector('input').blur();
    toast('Zapisano');
  },
  'player-delete': async (el) => {
    const p = playerById(el.dataset.id);
    if (!p) return;
    const busy = S.session?.playerIds?.includes(p.id);
    if (busy) {
      toast('Ten gracz gra teraz w trwającej grze.', 'warn');
      return;
    }
    const ok = await ask({
      title: `Usunąć ${p.name}?`,
      text: 'Gracz zniknie z listy. Rozegrane mecze zostaną w historii.',
      confirm: 'Usuń',
      danger: true,
    });
    if (!ok) return;
    S.players = S.players.filter((x) => x.id !== p.id);
    for (const last of Object.values(S.lastSetup)) last.selected = (last.selected || []).filter((id) => id !== p.id);
    persist('players', 'lastSetup');
    render();
  },
};
