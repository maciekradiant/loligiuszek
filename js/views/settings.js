import { S, render, persist, openSheet, closeSheet, toast, ask } from '../state.js';
import { exportData, parseImport, DEFAULT_SETTINGS } from '../store.js';
import { say } from '../audio.js';
import { icon, tabbar, switchRow, seg, sheetFrame } from './common.js';
import { esc } from '../util.js';

export const APP_VERSION = '1.1.1';

const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export function settingsView() {
  const s = S.settings;
  const install = standalone()
    ? ''
    : `<section class="section">
        <h2 class="section-title">Na ekran iPhone’a</h2>
        <div class="card stack">
          <p class="hint" style="color:var(--sisal)">Lotka działa jak zwykła aplikacja: pełny ekran, bez internetu, z ikoną na ekranie początkowym.</p>
          <ol class="install-steps">
            <li>Otwórz tę stronę w <b>Safari</b>.</li>
            <li>Stuknij <b>Udostępnij</b> ${icon.share.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px;stroke:currentColor;fill:none;stroke-width:1.8"')} na dole ekranu.</li>
            <li>Wybierz <b>Do ekranu początkowego</b> i potwierdź <b>Dodaj</b>.</li>
          </ol>
        </div>
      </section>`;
  return `<div class="screen">
    <div class="page-head"><h1 class="page-title">Opcje</h1></div>
    <div class="scroll">
      <section class="section" style="padding-top:0">
        <h2 class="section-title">Podczas gry</h2>
        <div class="card" style="padding-block:0">
          ${switchRow('set-toggle', s.caller, 'Spiker', 'Czyta wyniki tur na głos, jak sędzia przy tarczy.', 'data-k="caller"')}
          ${switchRow('set-toggle', s.sounds, 'Dźwięki', 'Stuknięcie przy każdej lotce, fanfary przy 180 i wygranej.', 'data-k="sounds"')}
          ${switchRow('set-toggle', s.hints, 'Podpowiedzi zamknięć', 'Pokazuje drogę do zera, np. T20 T20 BULL przy 170.', 'data-k="hints"')}
          ${switchRow('set-toggle', s.wakeLock, 'Ekran zawsze włączony', 'Telefon nie wygasa w trakcie meczu.', 'data-k="wakeLock"')}
        </div>
        <div class="rule"><span class="rule-label">Wpisywanie w X01</span>${seg('set-input', [['total', 'Suma tury'], ['darts', 'Każda lotka']], s.inputMode)}</div>
        <p class="hint">Suma tury jest najszybsza. Każda lotka daje dokładniejsze statystyki, m.in. skuteczność na podwójnych.</p>
        <button class="btn btn-line" data-act="test-voice">${icon.sound}Sprawdź głos spikera</button>
      </section>
      ${install}
      <section class="section">
        <h2 class="section-title">Dane</h2>
        <p class="hint">Gracze i wyniki są zapisane tylko na tym telefonie. Zrób kopię, zanim wyczyścisz dane Safari albo zmienisz telefon.</p>
        <div class="menu-list">
          <button class="menu-item" data-act="export">${icon.copy}Skopiuj kopię zapasową</button>
          <button class="menu-item" data-act="import-open">${icon.upload}Wczytaj kopię zapasową</button>
          <button class="menu-item danger" data-act="clear-history">${icon.trash}Usuń historię meczów</button>
          <button class="menu-item danger" data-act="clear-all">${icon.trash}Usuń wszystkie dane</button>
        </div>
      </section>
      <p class="hint" style="margin-top:22px;text-align:center">Lotka ${APP_VERSION} · ${S.players.length} graczy · ${S.history.length} meczów w historii</p>
    </div>
    ${tabbar('settings')}
  </div>`;
}

export function settingsSheet(sheet) {
  if (sheet.type === 'export') {
    return sheetFrame(
      'Kopia danych',
      `<p class="hint">Skopiowano do schowka. Wklej ją do notatki lub wiadomości do siebie. Jeśli kopiowanie nie zadziałało, zaznacz tekst poniżej.</p>
      <textarea id="export-text" rows="7" readonly>${esc(sheet.text)}</textarea>
      <button class="btn btn-primary" data-act="export-copy">Kopiuj jeszcze raz</button>`,
    );
  }
  if (sheet.type === 'import') {
    return sheetFrame(
      'Wczytaj kopię',
      `<p class="hint">Wklej tekst kopii zapasowej. Gracze i mecze z kopii zostaną dołączone do obecnych.</p>
      <form class="stack" data-form="import">
        <textarea id="import-text" name="data" rows="7" placeholder='{"app":"lotka", …}' aria-label="Kopia zapasowa"></textarea>
        <button class="btn btn-primary" type="submit">Wczytaj</button>
      </form>`,
    );
  }
  return '';
}

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.getElementById('export-text');
    if (el) {
      el.focus();
      el.select();
    }
    return false;
  }
}

export const settingsActions = {
  'set-toggle': (el) => {
    const k = el.dataset.k;
    S.settings[k] = !S.settings[k];
    persist('settings');
    render();
  },
  'set-input': (el) => {
    S.settings.inputMode = el.dataset.v;
    persist('settings');
    render();
  },
  'test-voice': () => say('Sto osiemdziesiąt! Ania, zostało czterdzieści.'),
  export: () => {
    const text = exportData(S);
    const copied = copy(text);
    openSheet('export', { text });
    copied.then((ok) => !ok && toast('Zaznacz tekst i skopiuj ręcznie.', 'warn'));
  },
  'export-copy': () => copy(S.ui.sheet.text).then((ok) => ok && toast('Skopiowano')),
  'import-open': () => openSheet('import'),
  import: (form) => {
    let data;
    try {
      data = parseImport(form.querySelector('textarea').value.trim());
    } catch (e) {
      toast(e instanceof SyntaxError ? 'Ten tekst nie wygląda na kopię Lotki.' : e.message, 'warn');
      return;
    }
    const ids = new Set(S.players.map((p) => p.id));
    const added = data.players.filter((p) => p?.id && p?.name && !ids.has(p.id));
    S.players.push(...added);
    const hids = new Set(S.history.map((h) => h.id));
    const newMatches = data.history.filter((h) => h?.id && !hids.has(h.id));
    S.history = [...S.history, ...newMatches].sort((a, b) => b.ts - a.ts);
    persist('players', 'history');
    closeSheet();
    toast(`Wczytano: ${added.length} graczy, ${newMatches.length} meczów`);
  },
  'clear-history': async () => {
    const ok = await ask({ title: 'Usunąć historię?', text: 'Znikną wszystkie zapisane mecze i statystyki. Gracze zostaną.', confirm: 'Usuń historię', danger: true });
    if (!ok) return;
    S.history = [];
    persist('history');
    toast('Historia usunięta');
  },
  'clear-all': async () => {
    const ok = await ask({ title: 'Usunąć wszystko?', text: 'Gracze, mecze, trwająca gra i ustawienia zostaną skasowane z tego telefonu.', confirm: 'Usuń wszystko', danger: true });
    if (!ok) return;
    S.players = [];
    S.history = [];
    S.session = null;
    S.lastSetup = {};
    S.settings = { ...DEFAULT_SETTINGS };
    persist('players', 'history', 'session', 'lastSetup', 'settings');
    toast('Wszystkie dane usunięte');
  },
};
