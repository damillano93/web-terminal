// Service worker for the home-screen app.
//
// Deliberately narrow. The only thing worth caching here is the ~1.4MB bundle,
// which is re-downloaded on every cold start on an iPad otherwise. Everything
// that carries state — the HTML, /api/*, /auth/*, the terminal WebSocket — goes
// to the network every time. A terminal that serves you a stale shell or a
// stale login page is worse than a slow one.
//
// Safari only registers a worker on a secure context, so this file is simply
// never used over the plain-http Tailscale path. app.js checks for that.

const CACHE = "wt-static-v1";

// Only assets the server stamps with ?v=<mtime>, plus the hashed files esbuild
// emits into /lib/. A new build changes the URL, so a cached entry can never
// shadow a newer asset — which is what makes cache-first safe here.
const STAMPED = ["/app.js", "/style.css", "/app.css"];

function isCacheable(url) {
  if (url.origin !== self.location.origin) return false;
  if (STAMPED.includes(url.pathname) && url.searchParams.has("v")) return true;
  // esbuild's assetNames puts a content hash in the filename itself.
  if (url.pathname.startsWith("/lib/")) return true;
  if (url.pathname.startsWith("/icons/")) return true;
  if (url.pathname === "/gogh-themes.json") return true;
  return false;
}

self.addEventListener("install", (e) => {
  // Take over as soon as this version is ready rather than waiting for every
  // tab to close — there is usually exactly one, and it is the app itself.
  self.skipWaiting();
  e.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (!isCacheable(url)) return;   // fall through to the network untouched

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    // Opaque and error responses are not worth persisting; caching a 404 for a
    // stamped asset would survive the deploy that fixes it.
    if (res && res.ok && res.type === "basic") {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  })());
});

// Lets the page drop the cache without the user digging through Safari settings.
self.addEventListener("message", (e) => {
  if (e.data === "wt:clear-cache") {
    e.waitUntil(caches.delete(CACHE));
  }
});
