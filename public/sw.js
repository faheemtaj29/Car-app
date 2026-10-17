/* Service worker: fast repeat visits and a friendly page when offline.
 * Only public, non-personal files are cached. APIs, accounts and the back
 * office always go to the network, so nobody ever sees stale or someone
 * else's data. */
const VERSION = "am-v1";
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-pages`;
const NEVER = [/^\/api\//, /^\/account/, /^\/garage/, /^\/alerts/, /^\/saved/, /^\/login/, /^\/setup/, /^\/dashboard/, /^\/analytics/, /^\/dealership/, /^\/inventory/, /^\/accounting/, /^\/settings/, /^\/ecommerce/];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(STATIC).then((c) => c.addAll(["/offline.html", "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (NEVER.some((r) => r.test(url.pathname))) return;

  // Built files and photos never change under the same name: cache first.
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/uploads/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(STATIC).then((c) => c.put(req, copy)); }
        return res;
      })),
    );
    return;
  }

  // Pages: network first; if the phone is offline show the last copy, else the offline page.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok && !res.headers.get("set-cookie")) { const copy = res.clone(); caches.open(PAGES).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match("/offline.html"))),
    );
  }
});
