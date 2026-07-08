/**
 * releaseManifestClient talks to netlify/functions/release-manifest
 * (issue #175). Every failure mode — network error, non-2xx, malformed
 * body — must resolve to null rather than reject, so resolveEngine.ts can
 * treat any manifest failure as the single "release unresolved" case
 * without an unhandled rejection reaching the compile path.
 */
import { createReleaseManifestClient } from "../engine/releaseManifestClient";

const jsonResponse = (body, ok = true) => ({
  ok,
  json: async () => body,
});

describe("releaseManifestClient — getManifest", () => {
  it("returns the manifest entry on a successful lookup", async () => {
    const entry = {
      engineVersion: "2026.3.1",
      glossaryVersion: "1.0",
      phrasesVersion: "1.0",
      gitSha: "abc123",
      changelog: "",
    };
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(entry));
    const client = createReleaseManifestClient(fetchImpl);

    const result = await client.getManifest("2026-03-01");

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining(
        "/.netlify/functions/release-manifest?release=2026-03-01",
      ),
    );
    expect(result).toEqual(entry);
  });

  it("resolves to null on a non-2xx response (e.g. 404 unknown release)", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: "Release not found" }, false));
    const client = createReleaseManifestClient(fetchImpl);

    await expect(client.getManifest("unknown")).resolves.toBeNull();
  });

  it("resolves to null on a network error instead of rejecting", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));
    const client = createReleaseManifestClient(fetchImpl);

    await expect(client.getManifest("2026-03-01")).resolves.toBeNull();
  });

  it("resolves to null on a malformed (non-JSON) body instead of rejecting", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    });
    const client = createReleaseManifestClient(fetchImpl);

    await expect(client.getManifest("2026-03-01")).resolves.toBeNull();
  });
});

describe("releaseManifestClient — getLatest", () => {
  it("returns the latest release id on success", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValue(jsonResponse({ release: "2026-06-01" }));
    const client = createReleaseManifestClient(fetchImpl);

    await expect(client.getLatest()).resolves.toBe("2026-06-01");
  });

  it("resolves to null when the service is unreachable", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));
    const client = createReleaseManifestClient(fetchImpl);

    await expect(client.getLatest()).resolves.toBeNull();
  });
});

describe("releaseManifestClient — listReleases", () => {
  it("returns the releases as served (the manifest service sorts newest-first)", async () => {
    const releases = [
      { release: "2026-06-01", changelog: "June release" },
      { release: "2026-03-01", changelog: "March release" },
    ];
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse(releases));
    const client = createReleaseManifestClient(fetchImpl);

    const result = await client.listReleases();

    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining("/.netlify/functions/release-manifest?list"),
    );
    expect(result).toEqual(releases);
  });

  it("resolves to an empty list when the service is unreachable", async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error("network down"));
    const client = createReleaseManifestClient(fetchImpl);

    await expect(client.listReleases()).resolves.toEqual([]);
  });
});
