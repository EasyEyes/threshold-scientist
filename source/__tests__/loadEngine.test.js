/**
 * The engine loader: how the shell obtains a pinned threshold-engine release
 * (issue #174, tracer). The shell dynamically imports the engine module from
 * an immutable release URL and refuses engines speaking a newer contract
 * than it understands (ADR 0001).
 */
import {
  loadEngine,
  ENGINE_RELEASE_URL,
  SHELL_CONTRACT_VERSION,
} from "../engine/loadEngine";

const fakeEngine = (contractVersion = 1) => ({
  contractVersion,
  compile: jest.fn().mockResolvedValue({
    files: [],
    manifest: { contractVersion },
  }),
});

describe("loadEngine", () => {
  it("imports the hardcoded release URL by default and returns the engine", async () => {
    const engine = fakeEngine();
    const importModule = jest.fn().mockResolvedValue({ default: engine });

    const loaded = await loadEngine(undefined, importModule);

    expect(importModule).toHaveBeenCalledWith(ENGINE_RELEASE_URL);
    expect(loaded).toBe(engine);
  });

  it("pins an immutable jsDelivr release (exact version, no tag)", () => {
    expect(ENGINE_RELEASE_URL).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/@easyeyes-stage\/threshold-engine@\d{4}\.\d{1,2}\.\d{1,2}(\.\d+)?\/dist\/index\.js$/,
    );
  });

  it("refuses an engine speaking a newer contract than the shell", async () => {
    const engine = fakeEngine(SHELL_CONTRACT_VERSION + 1);
    const importModule = jest.fn().mockResolvedValue({ default: engine });

    await expect(loadEngine(undefined, importModule)).rejects.toThrow(
      /reload|update/i,
    );
  });

  it("accepts an engine speaking an older or equal contract", async () => {
    const engine = fakeEngine(SHELL_CONTRACT_VERSION);
    const importModule = jest.fn().mockResolvedValue({ default: engine });

    await expect(loadEngine(undefined, importModule)).resolves.toBe(engine);
  });

  it("rejects a module that does not export an engine", async () => {
    const importModule = jest
      .fn()
      .mockResolvedValue({ default: { notAnEngine: true } });

    await expect(loadEngine(undefined, importModule)).rejects.toThrow(
      /engine/i,
    );
  });
});
