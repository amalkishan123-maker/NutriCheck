self.addEventListener("install", e => {
  e.waitUntil(
    caches.open("nutri-cache").then(cache => {
      return cache.addAll([
        "/",
        "/index.html",
        "/manifest.json"
      ]);
    })
  );
});
