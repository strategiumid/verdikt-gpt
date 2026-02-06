// Простой Service Worker для офлайн работы
self.addEventListener('install', function(event) {
    console.log('Service Worker установлен');
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        fetch(event.request).catch(function() {
            console.log('Офлайн режим');
            return new Response('Офлайн режим');
        })
    );
});
