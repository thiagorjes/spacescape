const CACHE_NAME = 'versao-1';
const urlsToCache = [
  '/',
  '/assets/css/styles.css',
  '/assets/css/game.css',
  '/assets/css/login.css',
  '/assets/js/auth-utils.js',
  '/assets/js/scripts.js',
  '/assets/js/physics.js',
  '/assets/js/login.js',
  '/assets/js/game.js',
  '/assets/js/firebase_config.js',
  '/assets/js/component-loader.js',
  '/assets/img/account.png',
  '/assets/img/favicon.png',
  '/assets/img/icon.png',
  '/assets/img/SpaceScape.png',
  '/assets/img/account.svg',
  '/assets/img/rocket.svg',
  '/assets/fonts/Starjedi.ttf',
  '/assets/fonts/Starjedi.woff',
  '/assets/components/header.html',
  '/assets/components/login-modal.html',
  '/assets/components/rocket.html',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/favicon.ico',
];

// Evento de instalação: abre o cache e armazena os arquivos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de fetch: intercepta as requisições e serve do cache se disponível
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Retorna a resposta do cache se encontrada
        if (response) {
          return response;
        }
        // Caso contrário, busca na rede
        return fetch(event.request);
      })
  );
});
