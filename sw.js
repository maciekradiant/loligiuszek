// Offline support: the app shell is cached on install and served cache-first, then refreshed in
// the background so the next launch picks up updates. Bump VERSION when shipping changes.

const VERSION = 'lotka-1.1.1';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/main.js',
  'js/state.js',
  'js/store.js',
  'js/util.js',
  'js/dom.js',
  'js/audio.js',
  'js/fx.js',
  'js/session.js',
  'js/modes-ui.js',
  'js/engine/darts.js',
  'js/engine/modes.js',
  'js/engine/match.js',
  'js/engine/stats.js',
  'js/engine/tournament.js',
  'js/engine/cue.js',
  'js/engine/registry.js',
  'js/views/common.js',
  'js/views/home.js',
  'js/views/setup.js',
  'js/views/game.js',
  'js/views/players.js',
  'js/views/history.js',
  'js/views/settings.js',
  'js/views/cue.js',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== 'lotka-fonts').map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(
      caches.open('lotka-fonts').then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  const key = req.mode === 'navigate' ? './' : req;
  const cached = caches.open(VERSION);
  const network = cached.then((cache) =>
    fetch(req).then((res) => {
      if (res.ok) cache.put(key, res.clone());
      return res;
    }),
  );
  event.waitUntil(network.catch(() => {}));
  event.respondWith(cached.then((cache) => cache.match(key, { ignoreSearch: true })).then((hit) => hit || network));
});
