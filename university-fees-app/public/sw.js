const CACHE_NAME = "cre-bursary-static-v1";
const APP_SHELL = [
  "/offline.html",
  "/css/styles.css",
  "/js/theme.js",
  "/js/welcome.js",
  "/js/pwa.js",
  "/images/cresa-logo.jpg",
  "/images/pwa-icon-192.png",
  "/images/pwa-icon-512.png"
];
const STATIC_DESTINATIONS = new Set(["style", "script", "image", "font"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("cre-bursary-") && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname === "/api" ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE_NAME).then((cache) => cache.match("/offline.html"))
      )
    );
    return;
  }

  if (!STATIC_DESTINATIONS.has(request.destination)) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          if (!response.ok) {
            return response;
          }

          return cache.put(request, response.clone())
            .then(() => response)
            .catch((error) => {
              console.error("Could not cache a public static asset.", error);
              return response;
            });
        });
      })
    )
  );
});
