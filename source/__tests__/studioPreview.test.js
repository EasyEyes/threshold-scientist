// Studio preview (source/studio/preview.ts): staging a compiled experiment
// for the preview service worker, and the placeholder tab that receives it.
import { PREVIEW_SCOPE } from "../studio/preview";

/**
 * A fake service worker with a state and statechange listeners. Deliberately
 * not built on the environment's EventTarget: removing a listener from inside
 * a jsdom EventTarget handler misbehaves under Node 24.
 */
class FakeWorker {
  constructor(state) {
    this.state = state;
    this.listeners = new Set();
    this.eventTypes = [];
  }
  addEventListener(type, listener) {
    this.eventTypes.push(type);
    this.listeners.add(listener);
  }
  removeEventListener(type, listener) {
    this.eventTypes.push("-" + type);
    this.listeners.delete(listener);
  }
  setState(state) {
    this.state = state;
    for (const listener of [...this.listeners]) listener();
  }
}

/** Like the real registration: its worker slots follow the worker's state. */
const fakeRegistration = (worker) => ({
  get active() {
    return worker?.state === "activated" ? worker : null;
  },
  get installing() {
    return worker && ["installing", "installed"].includes(worker.state)
      ? worker
      : null;
  },
  get waiting() {
    return worker?.state === "installed" ? worker : null;
  },
});

/** jsdom has no fetch Request/Response: the smallest stand-ins. */
class FakeHeaders {
  constructor(init = {}) {
    this.map = new Map(
      Object.entries(init).map(([k, v]) => [k.toLowerCase(), String(v)]),
    );
  }
  get(name) {
    return this.map.get(name.toLowerCase()) ?? null;
  }
}
class FakeResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.headers = new FakeHeaders(init.headers);
    this.status = init.status ?? 200;
  }
  async text() {
    return typeof this.body === "string"
      ? this.body
      : new TextDecoder().decode(this.body);
  }
  async arrayBuffer() {
    if (this.body instanceof Uint8Array)
      return this.body.buffer.slice(
        this.body.byteOffset,
        this.body.byteOffset + this.body.byteLength,
      );
    return new TextEncoder().encode(String(this.body)).buffer;
  }
}
class FakeRequest {
  constructor(url) {
    this.url = String(url);
  }
}

const load = async () => {
  jest.resetModules();
  return require("../studio/preview");
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Resolves to the promise's value, or "timeout" if it never settles. */
const settles = (promise, ms = 300) =>
  Promise.race([promise, sleep(ms).then(() => "timeout")]);

let cacheStore;
let cachePuts;
let openedCaches;
let deletedCaches;
let registerCalls;

const installServiceWorkers = (worker, { caches: extraCaches = [] } = {}) => {
  registerCalls = 0;
  const registerCallsArgs = [];
  installServiceWorkers.lastArgs = () => registerCallsArgs;
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      register: jest.fn(async (url, opts) => {
        registerCalls++;
        registerCallsArgs.push([url, opts]);
        return fakeRegistration(worker);
      }),
    },
  });
  cachePuts = [];
  openedCaches = [];
  deletedCaches = [];
  cacheStore = new Map();
  global.caches = {
    open: jest.fn(async (name) => {
      openedCaches.push(name);
      return {
        put: jest.fn(async (request, response) => {
          cachePuts.push({ name, request, response });
          cacheStore.set(`${name}:${request.url}`, response);
        }),
      };
    }),
    keys: jest.fn(async () => ["ee-preview-old1", "unrelated", ...extraCaches]),
    delete: jest.fn(async (name) => {
      deletedCaches.push(name);
      return true;
    }),
  };
};

const uninstallServiceWorkers = () => {
  delete navigator.serviceWorker;
  delete global.caches;
  global.Request = FakeRequest;
  global.Response = FakeResponse;
};

const stage = async (worker, actions, options = {}) => {
  installServiceWorkers(worker, options);
  const preview = await load();
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => "<html>runtime</html>",
  }));
  const url = await preview.stagePreview(actions);
  return { preview, url };
};

beforeEach(() => {
  uninstallServiceWorkers();
  jest.restoreAllMocks();
});

afterAll(uninstallServiceWorkers);

describe("previewSupported", () => {
  it("needs service workers and the Cache API", async () => {
    uninstallServiceWorkers();
    expect((await load()).previewSupported()).toBe(false);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {},
    });
    expect((await load()).previewSupported()).toBe(false);
    installServiceWorkers();
    expect((await load()).previewSupported()).toBe(true);
    // The Cache API alone is not enough.
    delete navigator.serviceWorker;
    expect((await load()).previewSupported()).toBe(false);
  });
});

describe("registerPreviewWorker", () => {
  it("resolves to null at once where service workers are unavailable", async () => {
    uninstallServiceWorkers();
    const preview = await load();
    expect(await preview.registerPreviewWorker()).toBeNull();
  });

  it("registers once, with the preview scope, and reuses the registration", async () => {
    const worker = new FakeWorker("activated");
    installServiceWorkers(worker);
    const preview = await load();
    const first = await preview.registerPreviewWorker();
    const second = await preview.registerPreviewWorker();
    expect(second).toBe(first);
    expect(first.active.state).toBe("activated");
    expect(registerCalls).toBe(1);
    expect(worker.eventTypes).toEqual([]);
    const [[url, opts]] = installServiceWorkers.lastArgs();
    expect(url).toBe("/compiler/preview-sw.js");
    expect(opts).toEqual({ scope: PREVIEW_SCOPE });
  });

  it("waits for an installing worker to activate", async () => {
    const worker = new FakeWorker("installing");
    installServiceWorkers(worker);
    const preview = await load();
    let settled = false;
    const p = preview.registerPreviewWorker().then((reg) => {
      settled = true;
      return reg;
    });
    await sleep(50);
    expect(settled).toBe(false);
    worker.setState("installed");
    await sleep(20);
    expect(settled).toBe(false);
    worker.setState("activating");
    await sleep(20);
    expect(settled).toBe(false);
    worker.setState("activated");
    const reg = await p;
    expect(reg.active).toBe(worker);
    expect(worker.listeners.size).toBe(0);
  });

  it("resolves to null when the registration has no worker at all", async () => {
    // A registration whose only worker already failed leaves nothing to wait
    // for: that is a failed preview, not a ready one — and not an exception.
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const worker = new FakeWorker("redundant");
    installServiceWorkers(worker);
    const preview = await load();
    expect(await preview.registerPreviewWorker()).toBeNull();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("resolves to null, and allows a retry, when registration is rejected", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const error = new Error("The path is not served over HTTPS");
    let attempts = 0;
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        register: jest.fn(async () => {
          attempts++;
          if (attempts === 1) throw error;
          return fakeRegistration(new FakeWorker("activated"));
        }),
      },
    });
    global.caches = {};
    const preview = await load();
    expect(await preview.registerPreviewWorker()).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      "Preview worker registration failed:",
      error,
    );
    expect((await preview.registerPreviewWorker()).active.state).toBe(
      "activated",
    );
    expect(attempts).toBe(2);
  });

  it("does not hang forever when the worker fails to install (redundant)", async () => {
    // register() resolves before the install runs; a worker whose script
    // fails at top level, or whose install is rejected, ends up "redundant".
    const worker = new FakeWorker("installing");
    installServiceWorkers(worker);
    const preview = await load();
    const p = preview.registerPreviewWorker();
    await sleep(10); // let waitForActive attach its listener
    worker.setState("redundant");
    expect(await settles(p)).toBeNull();
    // The next call tries again rather than replaying the failure.
    const retry = new FakeWorker("activated");
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register: async () => fakeRegistration(retry) },
    });
    const again = await settles(preview.registerPreviewWorker());
    expect(again).not.toBe("timeout");
    expect(again.active).toBe(retry);
  });
});

describe("stagePreview", () => {
  const actions = () => [
    {
      action: "create",
      file_path: "myExperiment.csv",
      content: "block,\n1,",
      encoding: "text",
    },
    {
      action: "create",
      file_path: "fonts/Sloan.woff2",
      content: btoa("\u0001\u0002\u0003font"),
      encoding: "base64",
    },
    {
      action: "create",
      file_path: "conditions/block_1_1.csv",
      content: "AAEFAQ==", // base64 with no whitespace
      encoding: "base64",
    },
    { action: "delete", file_path: "obsolete.csv" },
    { action: "update", file_path: "js/experimentLanguage.js", content: "" },
  ];

  it("rejects with a plain explanation where service workers are unavailable", async () => {
    uninstallServiceWorkers();
    const preview = await load();
    global.fetch = jest.fn();
    await expect(preview.stagePreview([])).rejects.toThrow(
      /service worker.*could not start.*Reload the page/,
    );
    // Nothing was fetched or staged.
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("rejects, staging nothing, when the preview worker failed to install", async () => {
    const worker = new FakeWorker("redundant");
    installServiceWorkers(worker);
    const preview = await load();
    global.fetch = jest.fn();
    await expect(preview.stagePreview([])).rejects.toThrow(
      /service worker.*could not start/,
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(openedCaches).toEqual([]);
  });

  it("fetches the runtime page from the deployed runtime and stages it as index.html", async () => {
    installServiceWorkers(new FakeWorker("activated"));
    const { url } = await stage(new FakeWorker("activated"), []);
    expect(global.fetch).toHaveBeenCalledWith("/compiler/threshold/index.html");
    const index = cachePuts.find((p) => p.request.url === `${url}`);
    expect(url).toMatch(/^\/compiler\/preview\/[a-z0-9]+\/index\.html$/);
    expect(index.response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(await index.response.text()).toBe("<html>runtime</html>");
  });

  it("throws when the runtime page cannot be loaded", async () => {
    installServiceWorkers(new FakeWorker("activated"));
    const preview = await load();
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 }));
    await expect(preview.stagePreview([])).rejects.toThrow(
      "Could not load the runtime page (404)",
    );
  });

  it("stages every non-delete action under the preview folder, decoding base64", async () => {
    const { url } = await stage(new FakeWorker("activated"), actions());
    const base = url.replace(/index\.html$/, "");
    const put = (path) =>
      cachePuts.find((p) => p.request.url === `${base}${path}`);
    expect(put("myExperiment.csv").response.headers.get("Content-Type")).toBe(
      "text/csv; charset=utf-8",
    );
    expect(await put("myExperiment.csv").response.text()).toBe("block,\n1,");
    // Binary content is decoded from base64 to bytes.
    const font = new Uint8Array(
      await put("fonts/Sloan.woff2").response.arrayBuffer(),
    );
    expect([...font]).toEqual([1, 2, 3, 102, 111, 110, 116]);
    expect(put("fonts/Sloan.woff2").response.headers.get("Content-Type")).toBe(
      "font/woff2",
    );
    const block = new Uint8Array(
      await put("conditions/block_1_1.csv").response.arrayBuffer(),
    );
    expect([...block]).toEqual([0, 1, 5, 1]);
    expect(
      put("conditions/block_1_1.csv").response.headers.get("Content-Type"),
    ).toBe("text/csv; charset=utf-8");
    // Deleted paths are not staged; empty text is staged as an empty body.
    expect(put("obsolete.csv")).toBeUndefined();
    expect(await put("js/experimentLanguage.js").response.text()).toBe("");
    expect(cachePuts).toHaveLength(5); // index.html + 4 actions
    expect(
      cachePuts.every(
        (p) => p.response.headers.get("Cache-Control") === "no-store",
      ),
    ).toBe(true);
  });

  it("gives each staged file a MIME type by extension, defaulting to a byte stream", async () => {
    const { url } = await stage(new FakeWorker("activated"), [
      { action: "create", file_path: "LICENSE" },
      { action: "create", file_path: "README.MD", content: "x" },
      {
        action: "create",
        file_path: "models/detector/model.json",
        content: "{}",
      },
      {
        action: "create",
        file_path: "components/images/favicon.ico",
        content: "AA==",
      },
      { action: "create", file_path: "sounds/tone.mp3", content: "AA==" },
      { action: "create", file_path: "x.ttf", content: "AA==" },
      { action: "create", file_path: "y.otf", content: "AA==" },
      { action: "create", file_path: "z.woff", content: "AA==" },
      { action: "create", file_path: "a.png", content: "AA==" },
      { action: "create", file_path: "b.jpg", content: "AA==" },
      { action: "create", file_path: "c.jpeg", content: "AA==" },
      { action: "create", file_path: "d.svg", content: "AA==" },
      { action: "create", file_path: "e.webp", content: "AA==" },
      { action: "create", file_path: "f.gif", content: "AA==" },
      { action: "create", file_path: "g.mp4", content: "AA==" },
      { action: "create", file_path: "h.webm", content: "AA==" },
      { action: "create", file_path: "i.ogg", content: "AA==" },
      { action: "create", file_path: "j.m4a", content: "AA==" },
      { action: "create", file_path: "k.wav", content: "AA==" },
      { action: "create", file_path: "l.wasm", content: "AA==" },
      { action: "create", file_path: "m.bin", content: "AA==" },
      { action: "create", file_path: "n.mjs", content: "x" },
      { action: "create", file_path: "o.css", content: "x" },
      { action: "create", file_path: "p.txt", content: "x" },
      { action: "create", file_path: "q.pdf", content: "AA==" },
      { action: "create", file_path: "r.xlsx", content: "AA==" },
    ]);
    const typeOf = (path) =>
      cachePuts
        .find((p) => p.request.url.endsWith(`/${path}`))
        .response.headers.get("Content-Type");
    expect(typeOf("LICENSE")).toBe("application/octet-stream");
    // An action without content stages an empty body.
    expect(
      await cachePuts
        .find((p) => p.request.url.endsWith("/LICENSE"))
        .response.text(),
    ).toBe("");
    expect(typeOf("README.MD")).toBe("text/markdown; charset=utf-8");
    expect(typeOf("model.json")).toBe("application/json; charset=utf-8");
    expect(typeOf("favicon.ico")).toBe("image/x-icon");
    expect(typeOf("tone.mp3")).toBe("audio/mpeg");
    expect(typeOf("x.ttf")).toBe("font/ttf");
    expect(typeOf("y.otf")).toBe("font/otf");
    expect(typeOf("z.woff")).toBe("font/woff");
    expect(typeOf("a.png")).toBe("image/png");
    expect(typeOf("b.jpg")).toBe("image/jpeg");
    expect(typeOf("c.jpeg")).toBe("image/jpeg");
    expect(typeOf("d.svg")).toBe("image/svg+xml");
    expect(typeOf("e.webp")).toBe("image/webp");
    expect(typeOf("f.gif")).toBe("image/gif");
    expect(typeOf("g.mp4")).toBe("video/mp4");
    expect(typeOf("h.webm")).toBe("video/webm");
    expect(typeOf("i.ogg")).toBe("audio/ogg");
    expect(typeOf("j.m4a")).toBe("audio/mp4");
    expect(typeOf("k.wav")).toBe("audio/wav");
    expect(typeOf("l.wasm")).toBe("application/wasm");
    expect(typeOf("m.bin")).toBe("application/octet-stream");
    expect(typeOf("n.mjs")).toBe("text/javascript; charset=utf-8");
    expect(typeOf("o.css")).toBe("text/css; charset=utf-8");
    expect(typeOf("p.txt")).toBe("text/plain; charset=utf-8");
    expect(typeOf("q.pdf")).toBe("application/pdf");
    expect(typeOf("r.xlsx")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("keeps only the newest preview's cache", async () => {
    const { url } = await stage(new FakeWorker("activated"), [], {
      caches: ["ee-preview-older", "ee-preview-oldest"],
    });
    const id = url.split("/")[3];
    expect(openedCaches).toEqual([`ee-preview-${id}`]);
    expect(deletedCaches.sort()).toEqual([
      "ee-preview-old1",
      "ee-preview-older",
      "ee-preview-oldest",
    ]);
  });

  it("stages each preview under a fresh id", async () => {
    installServiceWorkers(new FakeWorker("activated"));
    const a = await stage(new FakeWorker("activated"), []);
    const b = await stage(new FakeWorker("activated"), []);
    expect(a.url).not.toBe(b.url);
  });
});

describe("placeholder tab", () => {
  const fakeWindow = () => ({
    document: { write: jest.fn(), close: jest.fn() },
    location: {},
    closed: false,
    focus: jest.fn(),
  });

  it("returns null when the browser blocks the tab", async () => {
    window.open = jest.fn(() => null);
    const preview = await load();
    expect(preview.openPreviewPlaceholder()).toBeNull();
  });

  it("writes a placeholder page so the tab is not blank", async () => {
    const win = fakeWindow();
    window.open = jest.fn(() => win);
    const preview = await load();
    expect(preview.openPreviewPlaceholder()).toBe(win);
    expect(window.open).toHaveBeenCalledWith("", "_blank");
    expect(win.document.write.mock.calls[0][0]).toContain("Preparing preview");
    expect(win.document.close).toHaveBeenCalled();
  });

  it("survives a cross-origin about:blank that cannot be written", async () => {
    const win = fakeWindow();
    win.document.write = jest.fn(() => {
      // (A plain Error: touching the DOMException global crashes Node 24's
      // jsdom test environment.)
      const e = new Error("Blocked");
      e.name = "SecurityError";
      throw e;
    });
    window.open = jest.fn(() => win);
    const preview = await load();
    expect(preview.openPreviewPlaceholder()).toBe(win);
  });

  it("navigates the placeholder to the preview", async () => {
    const win = fakeWindow();
    window.open = jest.fn(() => win);
    const preview = await load();
    preview.showPreview("/compiler/preview/abc/index.html", win);
    expect(win.location.href).toBe("/compiler/preview/abc/index.html");
    expect(win.focus).toHaveBeenCalled();
    expect(window.open).toHaveBeenCalledTimes(0);
  });

  it("opens a new tab when the placeholder was blocked or has been closed", async () => {
    const win = fakeWindow();
    window.open = jest.fn(() => null);
    const preview = await load();
    preview.showPreview("/compiler/preview/abc/index.html", null);
    win.closed = true;
    preview.showPreview("/compiler/preview/abc/index.html", win);
    expect(window.open).toHaveBeenCalledWith(
      "/compiler/preview/abc/index.html",
      "_blank",
    );
    expect(window.open).toHaveBeenCalledTimes(2);
    expect(win.location.href).toBeUndefined();
  });
});
