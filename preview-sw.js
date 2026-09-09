/*
  EasyEyes Studio preview — service worker.

  Serves a compiled experiment straight from the browser, with no upload:
  the Studio stages the experiment's own files (table, block CSVs, generated
  files, fonts, forms, …) in a Cache under /compiler/preview/<id>/, and this
  worker answers requests for that folder from the cache. Anything not staged
  — the runtime itself (js/threshold.min.js, models, …) — is fetched from the
  deployed runtime at /compiler/threshold/, so a preview runs the exact code a
  compiled experiment would, without copying it anywhere.

  Registered by source/studio/preview.ts with scope /compiler/preview/. Only
  requests inside that scope reach this worker; the compiler page itself is
  not controlled by it.
*/

const SCOPE = "/compiler/preview/";
const RUNTIME = "/compiler/threshold/";
const CACHE_PREFIX = "ee-preview-";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(SCOPE)) return;
  event.respondWith(respond(url));
});

async function respond(url) {
  // /compiler/preview/<id>/<path…>
  const rest = url.pathname.slice(SCOPE.length);
  const slash = rest.indexOf("/");
  const id = slash === -1 ? rest : rest.slice(0, slash);
  const file = slash === -1 ? "" : rest.slice(slash + 1);

  const cache = await caches.open(CACHE_PREFIX + id);
  const key = file === "" ? `${SCOPE}${id}/index.html` : url.pathname;
  const staged = await cache.match(key, { ignoreSearch: true });
  if (staged) return staged;

  if (file === "" || file === "index.html") {
    return new Response(
      "<!doctype html><title>EasyEyes preview</title>" +
        "<p style='font-family:sans-serif;padding:2rem'>This preview has expired. " +
        "Go back to the Studio and press Preview again.</p>",
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  // Not experiment-specific: serve the deployed runtime file.
  return fetch(RUNTIME + file + url.search);
}
