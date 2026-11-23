const CACHE = "vales-shell-__VALES_VERSION__";
const ALCANCE = new URL(self.registration.scope).pathname;
const INICIO = ALCANCE + "index.html";
const COMPILADOS = /* recursos de Vite */ [];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          INICIO,
          ALCANCE + "pwa/icon.svg",
          ALCANCE + "pwa/manifest.webmanifest",
          ...COMPILADOS,
        ]),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) =>
        Promise.all(
          claves
            .filter(
              (clave) => clave.startsWith("vales-shell-") && clave !== CACHE,
            )
            .map((clave) => caches.delete(clave)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (evento) => {
  const solicitud = evento.request;
  const url = new URL(solicitud.url);
  if (solicitud.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(ALCANCE + "assets/")) {
    evento.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const guardada = await cache.match(solicitud);
        if (guardada) return guardada;
        const respuesta = await fetch(solicitud);
        if (respuesta.ok) await cache.put(solicitud, respuesta.clone());
        return respuesta;
      }),
    );
  } else if (
    solicitud.mode === "navigate" &&
    url.pathname.startsWith(ALCANCE)
  ) {
    evento.respondWith(fetch(solicitud).catch(() => caches.match(INICIO)));
  }
});
