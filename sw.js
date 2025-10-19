const CACHE_NAME = 'versao-4'; // mude este número a cada nova atualização
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

// Instalação: adiciona arquivos ao cache
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Instalando nova versão...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[ServiceWorker] Cache aberto');
      return cache.addAll(urlsToCache);
    })
  );
  // força o service worker a ativar imediatamente após instalar
  self.skipWaiting();
});

// Ativação: remove caches antigos
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Ativando nova versão...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removendo cache antigo:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  // força controle imediato das páginas abertas
  self.clients.claim();
});

// Fetch: serve do cache ou busca na rede
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Se encontrar no cache, retorna
      if (response) return response;

      // Senão, busca na rede e atualiza o cache
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Atualiza o cache em segundo plano
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone);
        });

        return networkResponse;
      });
    })
  );
});
