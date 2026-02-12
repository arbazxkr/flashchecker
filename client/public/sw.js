
const CACHE_NAME = 'flashchecker-v1';

self.addEventListener('install', (event) => {
    console.log('Service Worker: Installed');
    // Cache core assets if you want offline support
});

self.addEventListener('fetch', (event) => {
    // Pass-through fetch (network only for now)
    // This empty handler satisfies PWA requirement
});
