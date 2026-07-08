/**
 * The engine loader: how the shell obtains a specific, already-resolved
 * threshold-engine release URL. The shell dynamically imports the engine
 * module and refuses engines speaking a newer contract than it understands
 * (ADR 0001). Release resolution itself (release id → URL) is
 * resolveEngine.ts's job (issue #176).
 */
import {
  loadEngine,
  engineUrlsForVersion,
  SHELL_CONTRACT_VERSION,
} from "../engine/loadEngine";

const TEST_URL =
  "https://cdn.jsdelivr.net/npm/@example/engine@1.0.0/dist/index.js";

const fakeEngine = (contractVersion = 1) => ({
  contractVersion,
  compile: jest.fn().mockResolvedValue({
    files: [],
    manifest: { contractVersion },
  }),
});

describe("loadEngine", () => {
  it("imports the given URL and returns the engine", async () => {
    const engine = fakeEngine();
    const importModule = jest.fn().mockResolvedValue({ default: engine });

    const loaded = await loadEngine(TEST_URL, importModule);

    expect(importModule).toHaveBeenCalledWith(TEST_URL);
    expect(loaded).toBe(engine);
  });

  it("refuses an engine speaking a newer contract than the shell", async () => {
    const engine = fakeEngine(SHELL_CONTRACT_VERSION + 1);
    const importModule = jest.fn().mockResolvedValue({ default: engine });

    await expect(loadEngine(TEST_URL, importModule)).rejects.toThrow(
      /reload|update/i,
    );
  });

  it("accepts an engine speaking an older or equal contract", async () => {
    const engine = fakeEngine(SHELL_CONTRACT_VERSION);
    const importModule = jest.fn().mockResolvedValue({ default: engine });

    await expect(loadEngine(TEST_URL, importModule)).resolves.toBe(engine);
  });

  it("rejects a module that does not export an engine", async () => {
    const importModule = jest
      .fn()
      .mockResolvedValue({ default: { notAnEngine: true } });

    await expect(loadEngine(TEST_URL, importModule)).rejects.toThrow(/engine/i);
  });
});

describe("engineUrlsForVersion", () => {
  it("derives an immutable per-version jsDelivr URL for the compiler module and runtime base", () => {
    const { releaseUrl, runtimeBaseUrl } = engineUrlsForVersion("2026.3.1");

    expect(releaseUrl).toBe(
      "https://cdn.jsdelivr.net/npm/@easyeyes-stage/threshold-engine@2026.3.1/dist/index.js",
    );
    expect(runtimeBaseUrl).toBe(
      "https://cdn.jsdelivr.net/npm/@easyeyes-stage/threshold-engine@2026.3.1/runtime/",
    );
  });
});
