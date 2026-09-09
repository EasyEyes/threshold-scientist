/**
 * Studio preview: run a compiled experiment in a new tab without uploading
 * anything to Pavlovia.
 *
 * After the compiler has validated the table (the same preprocessExperimentFile
 * a real compile runs), the files that a compile would commit to the
 * experiment's repository — minus the runtime — are staged in a Cache under
 * /compiler/preview/<id>/. A service worker (preview-sw.js, scope
 * /compiler/preview/) answers requests for that folder from the cache and
 * falls back to the deployed runtime at /compiler/threshold/ for everything
 * else, so the preview runs the exact runtime a compiled experiment would.
 *
 * The runtime reads `<username>/<experimentName>` from the first two URL path
 * segments to look up its pinned glossary and phrases versions; for a preview
 * those are "compiler"/"preview", which the caller pins to the current
 * versions (Table.js) — the same pins a compile makes for its project.
 *
 * Outside Pavlovia the runtime is in its local mode (as with `npm run
 * examples`): the experiment runs in full and offers its data as a download at
 * the end; nothing is saved to Pavlovia and no participant can be recruited.
 */

import type { ICommitAction } from "../../threshold/preprocess/gitlabUtils";
import { _loadDir } from "../../threshold/preprocess/files";

export const PREVIEW_SCOPE = "/compiler/preview/";
const WORKER_URL = "/compiler/preview-sw.js";
const CACHE_PREFIX = "ee-preview-";

/** The URL path pair the runtime pins glossary/phrases versions under. */
export const PREVIEW_PIN = { username: "compiler", experimentName: "preview" };

export const previewSupported = (): boolean =>
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  typeof caches !== "undefined";

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * Register the preview worker (idempotent; safe to call at Studio mount so
 * it is active by the time a preview is requested). Resolves once the worker
 * is active, or to null when service workers are unavailable.
 */
export const registerPreviewWorker =
  (): Promise<ServiceWorkerRegistration | null> => {
    if (!previewSupported()) return Promise.resolve(null);
    if (!registration) {
      registration = navigator.serviceWorker
        .register(WORKER_URL, { scope: PREVIEW_SCOPE })
        .then(waitForActive)
        .catch((error) => {
          console.warn("Preview worker registration failed:", error);
          registration = null;
          return null;
        });
    }
    return registration;
  };

const waitForActive = (
  reg: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> =>
  new Promise((resolve) => {
    if (reg.active) return resolve(reg);
    const worker = reg.installing ?? reg.waiting;
    if (!worker) return resolve(reg);
    const onChange = () => {
      if (worker.state === "activated") {
        worker.removeEventListener("statechange", onChange);
        resolve(reg);
      }
    };
    worker.addEventListener("statechange", onChange);
  });

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  json: "application/json; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pdf: "application/pdf",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  mp4: "video/mp4",
  webm: "video/webm",
  wasm: "application/wasm",
  bin: "application/octet-stream",
};

const mimeFor = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[ext] ?? "application/octet-stream";
};

const base64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const bodyOf = (action: ICommitAction): BodyInit =>
  action.encoding === "base64"
    ? base64ToBytes(action.content ?? "")
    : action.content ?? "";

/**
 * Stage one experiment's files and return the URL to open. `actions` are the
 * commit actions a compile would push (paths relative to the repository
 * root); the runtime's index.html is fetched from the deployed runtime and
 * staged alongside, so the page and its relative references resolve inside
 * the preview folder. Earlier previews' caches are dropped.
 */
export const stagePreview = async (
  actions: ICommitAction[],
): Promise<string> => {
  const reg = await registerPreviewWorker();
  if (!reg) throw new Error("Preview needs a browser with service workers.");

  const id = `${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const base = `${PREVIEW_SCOPE}${id}/`;

  const indexHtml = await fetch(`${_loadDir}index.html`).then((r) => {
    if (!r.ok) throw new Error(`Could not load the runtime page (${r.status})`);
    return r.text();
  });

  const cache = await caches.open(`${CACHE_PREFIX}${id}`);
  const put = (path: string, body: BodyInit) =>
    cache.put(
      new Request(`${base}${path}`),
      new Response(body, {
        headers: {
          "Content-Type": mimeFor(path),
          "Cache-Control": "no-store",
        },
      }),
    );
  await Promise.all([
    put("index.html", indexHtml),
    ...actions
      .filter((a) => a.action !== "delete")
      .map((a) => put(a.file_path, bodyOf(a))),
  ]);

  // Only the newest preview is kept; a tab still open on an older one keeps
  // running (its files are already loaded) but cannot be reloaded.
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((k) => k.startsWith(CACHE_PREFIX) && k !== `${CACHE_PREFIX}${id}`)
      .map((k) => caches.delete(k)),
  );

  return `${base}index.html`;
};

/**
 * Open a placeholder tab synchronously, inside the user's click, so the
 * browser does not treat the later navigation as a pop-up. Returns null if
 * the browser blocked it (the caller then opens the URL when ready).
 */
export const openPreviewPlaceholder = (): Window | null => {
  const win = window.open("", "_blank");
  if (!win) return null;
  try {
    win.document.write(
      "<!doctype html><title>EasyEyes preview</title>" +
        "<body style='margin:0;min-height:100vh;display:flex;align-items:center;" +
        "justify-content:center;background:#fff'>" +
        '<p style=\'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
        "font-style:italic;font-size:1.1rem;color:#666;margin:0'>Preparing preview…</p>" +
        "</body>",
    );
    win.document.close();
  } catch {
    // Cross-origin about:blank quirks — the navigation below still works.
  }
  return win;
};

/** Send the placeholder (or a new tab) to the staged preview. */
export const showPreview = (url: string, placeholder: Window | null): void => {
  if (placeholder && !placeholder.closed) {
    placeholder.location.href = url;
    placeholder.focus?.();
  } else {
    window.open(url, "_blank");
  }
};
