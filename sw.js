/* Service worker: cache statica per uso offline */
const CACHE = "guardaroba-v1";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js",
  "./manifest.webmanifest", "./icon.svg"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Non intercettare le chiamate all'API Anthropic
  if (url.hostname.includes("anthropic.com")) return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
