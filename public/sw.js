const CACHE = "logtogether-shell-v0.14.0-science-builders-timers";
const SHELL = [
  "/",
  "/index.html",
  "/styles.css",
  "/config.js",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/timer-cue-single.mp3",
  "/timer-cue-double.mp3",
  "/assets/main.js"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Firebase Hosting reserves /__/ for Auth and other Firebase helpers.
  if (url.pathname.startsWith("/__")) return;

  event.respondWith(
    fetch(new Request(event.request, { cache: "no-store" }))
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === "navigate") return (await caches.match("/index.html")) ?? Response.error();
        return Response.error();
      })
  );
});

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : "" }; }
  const title = typeof data.title === "string" && data.title.trim() ? data.title : "LogTogether";
  const eventId = typeof data.eventId === "string" && data.eventId ? data.eventId : `${data.kind || "family"}-${Date.now()}`;
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: `logtogether-${eventId}`,
    renotify: false,
    silent: false,
    data: { url: typeof data.url === "string" ? data.url : "/#family", eventId, kind: data.kind || "family" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/#family", self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clients => {
    for (const client of clients) {
      if ("focus" in client) { client.navigate(target).catch(()=>undefined); return client.focus(); }
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  }));
});
