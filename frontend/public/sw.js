// Esta URL permite retirar el worker anterior de los navegadores que lo registraron.
self.addEventListener("install", (evento) => {
  evento.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      await self.registration.unregister();
      const claves = await caches.keys();
      await Promise.all(
        claves
          .filter((clave) => clave.startsWith("vales-shell-"))
          .map((clave) => caches.delete(clave)),
      );
    })(),
  );
});
