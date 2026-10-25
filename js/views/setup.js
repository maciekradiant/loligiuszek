import { S, render, persist, go, toast, ask, addPlayer, playerById } from '../state.js';
import { ENGINES, MODE_IDS } from '../engine/modes.js';
import { buildKnockout } from '../engine/tournament.js';
import { createSession } from '../session.js';
import { MODE_INFO, RULE_FIELDS, RULE_HINTS, describe } from '../modes-ui.js';
import { esc, shuffle, nf, plural, clamp } from '../util.js';
import { flip } from '../dom.js';
import { icon, avatar, seg, stepper } from './common.js';
import { formatLabel } from './game.js';

const MAX_BOARDS = 4;

export function newSetup(mode) {
  const last = S.lastSetup || {};
  const rules = Object.fromEntries(MODE_IDS.map((id) => [id, { ...ENGINES[id].defaults, ...(last.rules?.[id] || {}) }]));
  const su = {
    mode: mode || last.mode || 'x01',
    rules,
    format: last.format || 'single',
    boards: last.boards || 1,
    selected: (last.selected || []).filter((id) => playerById(id)),
    assign: { ...(last.assign || {}) },
  };
  normalize(su);
  return su;
}

// Keeps board assignments valid after players or the board count change.
function normalize(su) {
  su.boards = clamp(su.boards, 1, MAX_BOARDS);
  const assign = {};
  const count = Array(su.boards).fill(0);
  for (const id of su.selected) {
    const b = su.assign[id];
    if (b !== undefined && b < su.boards) {
      assign[id] = b;
      count[b]++;
    }
  }
  for (const id of su.selected) {
    if (assign[id] !== undefined) continue;
    const b = count.indexOf(Math.min(...count));
    assign[id] = b;
    count[b]++;
  }
  su.assign = assign;
}

const groups = (su) => Array.from({ length: su.boards }, (_, b) => su.selected.filter((id) => su.assign[id] === b));

function problem(su) {
  const eng = ENGINES[su.mode];
  const n = su.selected.length;
  if (!n) return 'Wybierz graczy, którzy grają.';
  if (su.format === 'single') {
    if (su.boards > n) return `Na ${su.boards} tarcze potrzeba co najmniej ${su.boards} graczy.`;
    const g = groups(su);
    if (g.some((x) => x.length < eng.minPlayers)) return `${MODE_INFO[su.mode].name}: co najmniej ${eng.minPlayers} graczy na każdej tarczy.`;
    return null;
  }
  if (n < 3) return 'Turniej wymaga co najmniej 3 graczy.';
  return null;
}

function summary(su) {
  const n = su.selected.length;
  const parts = [describe(su.mode, su.rules[su.mode]), nf(n, 'gracz', 'graczy', 'graczy')];
  if (su.boards > 1) parts.push(nf(su.boards, 'tarcza', 'tarcze', 'tarcz'));
  if (su.format === 'knockout') parts.push('puchar');
  if (su.format === 'league') parts.push('liga');
  return parts.join(' · ');
}

// ---------- view ----------

export function setupView() {
  const su = S.ui.setup;
  const rules = su.rules[su.mode];
  const err = problem(su);
  return `<div class="screen">
    <header class="bar-head">
      <button class="icon-btn" data-act="go" data-to="home" aria-label="Wróć">${icon.back}</button>
      <div class="bar-title"><strong>Nowa gra</strong></div>
      <span></span>
    </header>
    <div class="scroll">
      ${modeSection(su)}
      ${rulesSection(su, rules)}
      ${playersSection(su)}
      ${boardsSection(su)}
      ${orderSection(su)}
    </div>
    <div class="cta-bar">
      <p class="cta-note ${err ? 'warn' : ''}">${esc(err || summary(su))}</p>
      <button class="btn btn-primary btn-block" data-act="start" ${err ? 'disabled' : ''}>${su.format === 'single' ? 'Rozpocznij grę' : 'Rozpocznij turniej'}</button>
    </div>
  </div>`;
}

function modeSection(su) {
  const buttons = MODE_IDS.map(
    (id) => `<button data-act="su-mode" data-v="${id}" aria-pressed="${su.mode === id}"><b>${MODE_INFO[id].pick}</b>${MODE_INFO[id].name}</button>`,
  ).join('');
  return `<section class="section" style="padding-top:8px">
    <h2 class="section-title">Gra</h2>
    <div class="mode-pick">${buttons}</div>
    <p class="hint">${MODE_INFO[su.mode].desc}</p>
  </section>`;
}

function rulesSection(su, rules) {
  const fields = RULE_FIELDS[su.mode]
    .map(([key, label, options]) => `<div class="rule"><span class="rule-label">${label}</span>${seg('su-rule', options, rules[key], `data-k="${key}"`)}</div>`)
    .join('');
  const hint = RULE_HINTS[su.mode]?.(rules);
  const legs = rules.legs || 1;
  const sets = rules.sets || 1;
  return `<section class="section">
    <h2 class="section-title">Zasady</h2>
    <div class="rules">
      ${fields}
      ${hint ? `<p class="hint">${hint}</p>` : ''}
      <div class="rule"><span class="rule-label">Legi do wygrania${sets > 1 ? ' w secie' : ''}</span>${stepper('su-legs', legs, 1, 11, nf(legs, 'leg', 'legi', 'legów'))}</div>
      <div class="rule"><span class="rule-label">Sety</span>${stepper('su-sets', sets, 1, 7, sets === 1 ? 'bez setów' : `do ${sets} wygranych`)}</div>
      <p class="hint">Mecz: ${formatLabel(rules)}.</p>
    </div>
  </section>`;
}

function playersSection(su) {
  const chips = S.players
    .map((p) => {
      const on = su.selected.includes(p.id);
      return `<button class="chip" data-act="su-toggle" data-id="${p.id}" aria-pressed="${on}">${avatar(p)}<span>${esc(p.name)}</span></button>`;
    })
    .join('');
  return `<section class="section">
    <div class="section-head"><h2 class="section-title">Gracze</h2><span class="faint">${su.selected.length ? `wybrano ${su.selected.length}` : ''}</span></div>
    ${S.players.length ? `<div class="chips">${chips}</div>` : '<p class="hint">Dodaj pierwszych graczy. Zapamiętam ich na kolejne gry razem ze statystykami.</p>'}
    <form class="add-player" data-form="su-add" autocomplete="off">
      <input type="text" id="su-name" name="name" placeholder="Imię nowego gracza" maxlength="24" enterkeyhint="done" aria-label="Imię nowego gracza">
      <button class="btn" type="submit" aria-label="Dodaj gracza">${icon.plus}</button>
    </form>
  </section>`;
}

function boardsSection(su) {
  const n = su.selected.length;
  const fmt = seg('su-format', [['single', 'Jedna gra'], ['knockout', 'Puchar'], ['league', 'Liga']], su.format);
  const boards = seg('su-boards', [1, 2, 3, 4].map((b) => [b, `${b} ${plural(b, 'tarcza', 'tarcze', 'tarcz')}`]), su.boards);
  let hint;
  if (su.format === 'single') {
    hint =
      su.boards === 1
        ? 'Wszyscy grają na jednej tarczy, po kolei.'
        : `Gracze dzielą się na ${su.boards} tarcze i każda tarcza gra własny mecz. Przełączasz się między nimi zakładkami.`;
  } else if (su.format === 'knockout') {
    hint = `Puchar: przegrany odpada, wygrany idzie dalej aż do finału. ${su.boards > 1 ? `Mecze rozgrywane równolegle na ${su.boards} tarczach.` : ''}`;
  } else {
    hint = `Liga: każdy gra z każdym${n >= 3 ? ` (${nf((n * (n - 1)) / 2, 'mecz', 'mecze', 'meczów')})` : ''}, za wygraną 2 punkty. ${su.boards > 1 ? `Mecze rozgrywane równolegle na ${su.boards} tarczach.` : ''}`;
  }
  return `<section class="section">
    <h2 class="section-title">Rozgrywki</h2>
    ${fmt}
    ${boards}
    <p class="hint">${hint}</p>
  </section>`;
}

function orderItem(id, pos, b, su) {
  const p = playerById(id);
  if (!p) return '';
  const move = su.format === 'single' && su.boards > 1 ? `<button class="move-btn" data-act="su-move" data-id="${id}">T${((b + 1) % su.boards) + 1} →</button>` : '';
  const starts = pos === 0 && su.format === 'single' ? '<small>zaczyna</small>' : '';
  return `<li class="order-item" data-key="${id}">
    <span class="order-pos">${pos + 1}</span>${avatar(p)}
    <span class="order-name">${esc(p.name)}${starts}</span>
    ${move}
    <span class="grip" data-grip aria-label="Przeciągnij, aby zmienić kolejność">${icon.grip}</span>
  </li>`;
}

function orderSection(su) {
  if (!su.selected.length) return '';
  if (su.format === 'single') {
    const g = groups(su);
    const cards = g
      .map(
        (ids, b) => `<div class="board-card">
        ${su.boards > 1 ? `<div class="board-card-head"><b>Tarcza ${b + 1}</b><span class="faint">${nf(ids.length, 'gracz', 'graczy', 'graczy')}</span></div>` : ''}
        <ol class="order-list" data-group="${b}">${ids.map((id, i) => orderItem(id, i, b, su)).join('') || '<li class="hint" style="padding:10px">Brak graczy</li>'}</ol>
      </div>`,
      )
      .join('');
    return `<section class="section">
      <div class="section-head"><h2 class="section-title">Kolejność</h2></div>
      <p class="hint">Przeciągnij za uchwyt albo wylosuj. W kolejnych legach zaczyna następny gracz.</p>
      <div class="row" style="flex-wrap:wrap">
        <button class="btn btn-sm btn-line" data-act="su-shuffle">${icon.shuffle}Losuj kolejność</button>
        ${su.boards > 1 ? `<button class="btn btn-sm btn-line" data-act="su-shuffle-boards">${icon.shuffle}Losuj tarcze</button>` : ''}
      </div>
      <div id="order-root">${cards}</div>
    </section>`;
  }
  const preview = su.format === 'knockout' && su.selected.length >= 3 ? knockoutPreview(su) : '';
  return `<section class="section">
    <div class="section-head"><h2 class="section-title">Rozstawienie</h2></div>
    <p class="hint">${su.format === 'knockout' ? 'Najwyżej rozstawieni spotkają się najpóźniej i to oni dostają wolne losy.' : 'Kolejność ustala plan spotkań.'}</p>
    <div class="row"><button class="btn btn-sm btn-line" data-act="su-shuffle">${icon.shuffle}Losuj rozstawienie</button></div>
    <div id="order-root"><div class="board-card"><ol class="order-list" data-group="all">${su.selected.map((id, i) => orderItem(id, i, 0, su)).join('')}</ol></div></div>
    ${preview}
  </section>`;
}

function knockoutPreview(su) {
  const ties = buildKnockout(su.selected).filter((t) => t.round === 0);
  const name = (id) => (id ? esc(playerById(id)?.name || '?') : '<span class="faint">wolny los</span>');
  return `<div class="card"><div class="eyebrow">Pierwsza runda</div><div class="pairs">${ties
    .map((t) => `<div class="pair"><b>${name(t.players[0])}</b><span>–</span><b>${name(t.players[1])}</b></div>`)
    .join('')}</div></div>`;
}

// ---------- actions ----------

const su = () => S.ui.setup;

function setOrder(group, newIds) {
  const s = su();
  const slots = s.selected.map((id, i) => (group === 'all' || s.assign[id] === +group ? i : -1)).filter((i) => i >= 0);
  slots.forEach((slot, k) => (s.selected[slot] = newIds[k]));
}

let shuffling = false;

function animateShuffle(finalize) {
  const root = document.getElementById('order-root');
  if (!root || shuffling) return finalize();
  shuffling = true;
  root.classList.add('shuffling');
  let n = 0;
  const steps = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 6;
  const tick = () => {
    if (n++ >= steps) {
      flip(root, () => {
        finalize();
        render();
      });
      root.classList.remove('shuffling');
      shuffling = false;
      return;
    }
    flip(
      root,
      () => {
        const s = su();
        const lists = s.format === 'single' ? groups(s).map((ids, b) => [b, ids]) : [['all', s.selected]];
        for (const [g, ids] of lists) setOrder(g, shuffle(ids));
        render();
      },
      120,
    );
    setTimeout(tick, 130);
  };
  tick();
}

export const setupActions = {
  'su-mode': (el) => {
    su().mode = el.dataset.v;
    render();
  },
  'su-rule': (el) => {
    const raw = el.dataset.v;
    const v = raw === 'true' ? true : raw === 'false' ? false : isNaN(+raw) ? raw : +raw;
    su().rules[su().mode][el.dataset.k] = v;
    render();
  },
  'su-legs': (el) => {
    const r = su().rules[su().mode];
    r.legs = clamp((r.legs || 1) + +el.dataset.d, 1, 11);
    render();
  },
  'su-sets': (el) => {
    const r = su().rules[su().mode];
    r.sets = clamp((r.sets || 1) + +el.dataset.d, 1, 7);
    if (r.sets > 1 && r.legs < 2) r.legs = 3;
    render();
  },
  'su-toggle': (el) => {
    const s = su();
    const id = el.dataset.id;
    s.selected = s.selected.includes(id) ? s.selected.filter((x) => x !== id) : [...s.selected, id];
    normalize(s);
    render();
  },
  'su-add': (form) => {
    const input = form.querySelector('input');
    const p = addPlayer(input.value);
    if (!p) {
      input.focus();
      return;
    }
    const s = su();
    if (!s.selected.includes(p.id)) s.selected.push(p.id);
    normalize(s);
    input.value = '';
    render();
  },
  'su-format': (el) => {
    su().format = el.dataset.v;
    render();
  },
  'su-boards': (el) => {
    su().boards = +el.dataset.v;
    normalize(su());
    render();
  },
  'su-move': (el) => {
    const s = su();
    const id = el.dataset.id;
    flip(document.getElementById('order-root'), () => {
      s.assign[id] = (s.assign[id] + 1) % s.boards;
      render();
    });
  },
  'su-shuffle': () => animateShuffle(() => {}),
  'su-shuffle-boards': () => {
    const s = su();
    animateShuffle(() => {
      shuffle(s.selected).forEach((id, i) => (s.assign[id] = i % s.boards));
    });
  },
  start: async () => {
    const s = su();
    if (problem(s)) return;
    const running = S.session && Object.values(S.session.matches).some((m) => !m.finished && m.events.length);
    if (running) {
      const ok = await ask({
        title: 'Zacząć od nowa?',
        text: 'Trwa inna gra. Jej niedokończone mecze przepadną, ukończone zostają w historii.',
        confirm: 'Nowa gra',
      });
      if (!ok) return;
    }
    const rules = s.rules[s.mode];
    const boards = s.format === 'single' ? s.boards : Math.max(1, Math.min(s.boards, Math.floor(s.selected.length / 2)));
    S.session = createSession({
      mode: s.mode,
      rules,
      format: s.format,
      boards,
      groups: groups(s),
      order: s.selected,
      roster: S.players,
    });
    S.lastSetup = { mode: s.mode, rules: s.rules, format: s.format, boards: s.boards, selected: s.selected, assign: s.assign };
    S.ui.board = 0;
    S.ui.entry = '';
    S.ui.mult = 1;
    persist('session', 'lastSetup');
    if (boards < s.boards) toast(`Wystarczą ${nf(boards, 'tarcza', 'tarcze', 'tarcz')} dla ${s.selected.length} graczy.`);
    go('game');
  },
};

// ---------- drag to reorder ----------

export function initDrag(root) {
  root.addEventListener('pointerdown', (e) => {
    const grip = e.target.closest('[data-grip]');
    if (!grip) return;
    const item = grip.closest('.order-item');
    const list = item?.parentElement;
    if (!list?.dataset.group) return;
    e.preventDefault();
    const items = [...list.children].filter((c) => c.classList.contains('order-item'));
    const from = items.indexOf(item);
    const rects = items.map((el) => el.getBoundingClientRect());
    const step = rects.length > 1 ? rects[1].top - rects[0].top : rects[0].height;
    const startY = e.clientY;
    let to = from;
    item.classList.add('dragging');
    grip.setPointerCapture?.(e.pointerId);

    const move = (ev) => {
      const dy = clamp(ev.clientY - startY, (0 - from) * step, (items.length - 1 - from) * step);
      item.style.transform = `translateY(${dy}px)`;
      to = clamp(Math.round(dy / step) + from, 0, items.length - 1);
      items.forEach((el, i) => {
        if (el === item) return;
        let shift = 0;
        if (from < to && i > from && i <= to) shift = -step;
        if (from > to && i < from && i >= to) shift = step;
        el.style.transition = 'transform .18s ease';
        el.style.transform = shift ? `translateY(${shift}px)` : '';
      });
    };
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      items.forEach((el) => {
        el.style.transform = '';
        el.style.transition = '';
      });
      item.classList.remove('dragging');
      if (to !== from) {
        const ids = items.map((el) => el.dataset.key);
        const [moved] = ids.splice(from, 1);
        ids.splice(to, 0, moved);
        setOrder(list.dataset.group, ids);
        render();
      }
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });
}
