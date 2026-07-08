/**
 * The Engine Loader / Version Resolver (issue #176): given a release id, the
 * resolver looks it up through the release manifest, derives that release's
 * immutable engine URL, and drives it through loadEngine's existing
 * contractVersion guard (ADR 0001). It never falls through to compiling with
 * an unintended engine — an unresolvable release fails closed with a clear,
 * user-visible error.
 */
import { resolveEngine } from "../engine/resolveEngine";
import { SHELL_CONTRACT_VERSION } from "../engine/loadEngine";

const fakeEngine = (contractVersion = 1) => ({
  contractVersion,
  compile: jest.fn().mockResolvedValue({
    files: [],
    manifest: { contractVersion },
  }),
});

const fakeManifestClient = ({ entries = {}, latest = null } = {}) => ({
  getManifest: jest.fn(async (releaseId) => entries[releaseId] ?? null),
  getLatest: jest.fn(async () => latest),
});

describe("resolveEngine — resolving an explicit release id", () => {
  it("looks up the release's engineVersion and imports exactly that engine release's URL", async () => {
    const engine = fakeEngine();
    const importModule = jest.fn().mockResolvedValue({ default: engine });
    const manifestClient = fakeManifestClient({
      entries: {
        "2026-03-01": {
          engineVersion: "2026.3.1",
          glossaryVersion: "1.0",
          phrasesVersion: "1.0",
          gitSha: "abc123",
          changelog: "",
        },
      },
    });

    const handle = await resolveEngine("2026-03-01", {
      manifestClient,
      importModule,
    });

    expect(manifestClient.getManifest).toHaveBeenCalledWith("2026-03-01");
    expect(importModule).toHaveBeenCalledWith(
      "https://cdn.jsdelivr.net/npm/@easyeyes-stage/threshold-engine@2026.3.1/dist/index.js",
    );
    expect(handle.engine).toBe(engine);
  });
});

describe('resolveEngine — resolving "latest"', () => {
  it("resolves the latest pointer, then loads that release's manifest entry", async () => {
    const engine = fakeEngine();
    const importModule = jest.fn().mockResolvedValue({ default: engine });
    const manifestClient = fakeManifestClient({
      latest: "2026-06-01",
      entries: {
        "2026-06-01": {
          engineVersion: "2026.6.1",
          glossaryVersion: "1.0",
          phrasesVersion: "1.0",
          gitSha: "def456",
          changelog: "",
        },
      },
    });

    const handle = await resolveEngine("latest", {
      manifestClient,
      importModule,
    });

    expect(manifestClient.getLatest).toHaveBeenCalled();
    expect(manifestClient.getManifest).toHaveBeenCalledWith("2026-06-01");
    expect(importModule).toHaveBeenCalledWith(
      "https://cdn.jsdelivr.net/npm/@easyeyes-stage/threshold-engine@2026.6.1/dist/index.js",
    );
    expect(handle.release).toBe("2026-06-01");
  });
});

describe("resolveEngine — contractVersion guard", () => {
  it("refuses an engine speaking a newer contract than the shell, even when the manifest resolves cleanly", async () => {
    const engine = fakeEngine(SHELL_CONTRACT_VERSION + 1);
    const importModule = jest.fn().mockResolvedValue({ default: engine });
    const manifestClient = fakeManifestClient({
      entries: {
        "2026-03-01": {
          engineVersion: "2026.3.1",
          glossaryVersion: "1.0",
          phrasesVersion: "1.0",
          gitSha: "abc123",
          changelog: "",
        },
      },
    });

    await expect(
      resolveEngine("2026-03-01", { manifestClient, importModule }),
    ).rejects.toThrow(/reload|update/i);
  });
});

describe("resolveEngine — fail-closed fallback", () => {
  it("fails closed, without importing anything, when the requested release id is unknown", async () => {
    const importModule = jest.fn();
    const manifestClient = fakeManifestClient({ entries: {} });

    await expect(
      resolveEngine("2099-01-01", { manifestClient, importModule }),
    ).rejects.toThrow(/2099-01-01/);
    expect(importModule).not.toHaveBeenCalled();
  });

  it('fails closed when resolving "latest" finds no latest pointer', async () => {
    const importModule = jest.fn();
    const manifestClient = fakeManifestClient({ latest: null });

    await expect(
      resolveEngine("latest", { manifestClient, importModule }),
    ).rejects.toThrow(/latest/i);
    expect(importModule).not.toHaveBeenCalled();
    expect(manifestClient.getManifest).not.toHaveBeenCalled();
  });
});
