import { esc, initials } from '../util.js';

const svg = (body, vb = '0 0 24 24') => `<svg viewBox="${vb}" aria-hidden="true">${body}</svg>`;

export const icon = {
  target: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>'),
  trophy: svg('<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v4M8.5 20h7"/>'),
  sliders: svg('<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>'),
  undo: svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  back: svg('<path d="m15 18-6-6 6-6"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  more: svg('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
  shuffle: svg('<path d="M16 4h4v4M4 20 20 4M20 16v4h-4M15 15l5 5M4 4l5 5"/>'),
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  bracket: svg('<path d="M3 5h5v6H3M3 13h5v6H3M8 8h4v8H8M12 12h5M17 9h4v6h-4z"/>'),
  sound: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>'),
  mute: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="m17 9 5 6M22 9l-5 6"/>'),
  flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  home: svg('<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  upload: svg('<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>'),
  share: svg('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5v10h14V11h-1"/>'),
  next: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
  grip: svg('<circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>'),
  backspace: svg('<path d="M21 5H9l-6 7 6 7h12z"/><path d="m12 9 6 6M18 9l-6 6"/>'),
};

export const colorVar = (c) => `var(--c-${c || 'brass'})`;

export const avatar = (p, cls = '') =>
  `<span class="av ${cls}" style="--pc:${colorVar(p?.color)}" aria-hidden="true">${esc(initials(p?.name))}</span>`;

export function tabbar(current) {
  const tabs = [
    ['home', 'Graj', icon.target],
    ['players', 'Gracze', icon.users],
    ['history', 'Wyniki', icon.trophy],
    ['settings', 'Opcje', icon.sliders],
  ];
  return `<nav class="tabbar" aria-label="Główne">${tabs
    .map(([id, label, ic]) => `<button class="tab" data-act="go" data-to="${id}" ${current === id ? 'aria-current="page"' : ''}>${ic}<span>${label}</span></button>`)
    .join('')}</nav>`;
}

// Segmented control. options: [[value, label], ...]
export function seg(act, options, value, extra = '') {
  return `<div class="seg" role="group">${options
    .map(([v, label]) => `<button data-act="${act}" data-v="${esc(v)}" ${extra} aria-pressed="${String(v) === String(value)}">${label}</button>`)
    .join('')}</div>`;
}

export function stepper(act, value, min, max, label) {
  return `<div class="stepper">
    <button data-act="${act}" data-d="-1" ${value <= min ? 'disabled' : ''} aria-label="Mniej">−</button>
    <output>${label}</output>
    <button data-act="${act}" data-d="1" ${value >= max ? 'disabled' : ''} aria-label="Więcej">+</button>
  </div>`;
}

export function switchRow(act, on, title, sub = '', extra = '') {
  return `<button class="switch-row" role="switch" aria-checked="${!!on}" data-act="${act}" ${extra}>
    <span class="grow"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="switch"></span>
  </button>`;
}

export function sheetFrame(title, body, { closable = true } = {}) {
  return `<div class="sheet-wrap" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="sheet-backdrop" ${closable ? 'data-act="close-sheet"' : ''}></div>
    <div class="sheet">
      <div class="sheet-grabber"></div>
      <div class="sheet-head"><h2>${title}</h2>${closable ? `<button class="icon-btn" data-act="close-sheet" aria-label="Zamknij">${icon.close}</button>` : ''}</div>
      <div class="sheet-body">${body}</div>
    </div>
  </div>`;
}

export const pips = (won, need) =>
  need > 1 && need <= 7 ? `<span class="pc-legs">${Array.from({ length: need }, (_, i) => `<i class="pip ${i < won ? 'won' : ''}"></i>`).join('')}</span>` : need > 7 ? `<span class="set-badge">${won}/${need}</span>` : '';

// Cricket mark: 1 slash, 2 cross, 3 circled cross.
export function markSvg(n) {
  if (!n) return '';
  const slash = '<path d="M7 19 17 5"/>';
  const back = '<path d="M7 5l10 14"/>';
  const ring = '<circle cx="12" cy="12" r="9.5"/>';
  return `<svg viewBox="0 0 24 24" aria-label="${n}">${slash}${n >= 2 ? back : ''}${n >= 3 ? ring : ''}</svg>`;
}
