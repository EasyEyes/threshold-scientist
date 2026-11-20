/**
 * Integration coverage with real OAuth, storage, search, pagination, catalog,
 * presence, and Prolific metadata modules. Only the outermost fetch transport
 * is faked; no production module is replaced by jest.mock().
 */
import { getCommonResourcesNames } from "../../threshold/preprocess/gitlabUtils";
import { getAuthConfig } from "../../threshold/preprocess/auth/config";
import {
  clearTokensFromStorage,
  saveTokensToStorage,
} from "../../threshold/preprocess/auth/storage";
import {
  resourceAvailabilities,
  settledResourceCatalog,
} from "../../threshold/preprocess/resourceCatalog";
import { checkFontPresence } from "../../threshold/preprocess/experimentFileChecks";
import {
  clearProlificMetadataCache,
  getProlificParticipantGroups,
} from "../../threshold/preprocess/prolificMetadata";

const jsonResponse = (data, { status = 200, headers = {} } = {}) => ({
  status,
  statusText: String(status),
  ok: status >= 200 && status < 300,
  headers: new Headers({ "Content-Type": "application/json", ...headers }),
  json: async () => data,
  text: async () => JSON.stringify(data),
  clone() {
    return this;
  },
});

const projectResponse = () =>
  jsonResponse([{ id: 77, name: "EasyEyesResources" }]);

const entry = (path) => ({
  id: path,
  name: path.split("/").pop(),
  path,
  type: "blob",
});

let originalFetch;

beforeEach(() => {
  originalFetch = global.fetch;
  clearTokensFromStorage();
  clearProlificMetadataCache();
  const { clientId, redirectUri } = getAuthConfig();
  saveTokensToStorage({
    accessToken: "integration-token",
    refreshToken: null,
    expiresAt: Date.now() + 3_600_000,
    clientId,
    redirectUri,
    createdAt: Date.now(),
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  clearTokensFromStorage();
  clearProlificMetadataCache();
});

describe("resource loading with only the transport faked", () => {
  it("uses real OAuth/search/pagination/catalog/presence code", async () => {
    const calls = [];
    global.fetch = jest.fn(async (url, options) => {
      const parsed = new URL(url);
      calls.push({ path: parsed.pathname + parsed.search, options });
      if (parsed.pathname.includes("/users/42/projects"))
        return projectResponse();
      expect(parsed.pathname).toBe("/api/v4/projects/77/repository/tree/");
      return jsonResponse([
        entry("fonts/Sloan.woff2"),
        entry("images/target.png"),
        entry("images/nested/ignored.png"),
        {
          id: "images/nested",
          name: "nested",
          path: "images/nested",
          type: "tree",
        },
      ]);
    });

    const listings = await getCommonResourcesNames({ id: "42" });
    const availability = resourceAvailabilities(
      settledResourceCatalog(listings),
    );

    expect(listings.fonts).toEqual({
      kind: "ready",
      names: ["Sloan.woff2"],
    });
    expect(listings.images).toEqual({
      kind: "ready",
      names: ["target.png"],
    });
    expect(checkFontPresence(["Sloan.woff2"], availability.fonts)).toEqual([]);
    expect(
      checkFontPresence(["Missing.woff2"], availability.fonts)[0].name,
    ).toBe("Font file not found");
    expect(calls).toHaveLength(2);
    for (const call of calls)
      expect(call.options.headers.get("Authorization")).toBe(
        "Bearer integration-token",
      );
  });

  it("retries a real transient page failure while preserving page grouping", async () => {
    let pageTwoFailures = 0;
    const next =
      "https://gitlab.pavlovia.org/api/v4/projects/77/repository/tree?recursive=true&page=2&per_page=100";
    global.fetch = jest.fn(async (url) => {
      const parsed = new URL(url);
      if (parsed.pathname.includes("/users/42/projects"))
        return projectResponse();
      if (parsed.searchParams.get("page") === "2") {
        if (pageTwoFailures++ === 0)
          return jsonResponse({ message: "temporary" }, { status: 500 });
        return jsonResponse([entry("images/target.png")]);
      }
      return jsonResponse([entry("fonts/Sloan.woff2")], {
        headers: {
          "X-Total-Pages": "2",
          Link: `<${next}>; rel="next"`,
        },
      });
    });

    const listings = await getCommonResourcesNames({ id: "42" });

    expect(pageTwoFailures).toBe(2);
    expect(listings.fonts.names).toEqual(["Sloan.woff2"]);
    expect(listings.images.names).toEqual(["target.png"]);
    expect(global.fetch).toHaveBeenCalledTimes(4);
  });

  it("propagates caller cancellation instead of converting it to a failed listing", async () => {
    const controller = new AbortController();
    global.fetch = jest.fn(async (url, options) => {
      const parsed = new URL(url);
      if (parsed.pathname.includes("/users/42/projects"))
        return projectResponse();
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () =>
          reject(new DOMException("Cancelled", "AbortError")),
        );
      });
    });

    const promise = getCommonResourcesNames(
      { id: "42" },
      { signal: controller.signal },
    );
    for (let i = 0; i < 10; i++) await Promise.resolve();
    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("uses the real Prolific retry and per-token cache with only fetch faked", async () => {
    let calls = 0;
    global.fetch = jest.fn(async () => {
      calls++;
      if (calls === 1)
        return jsonResponse(
          { error: "slow down" },
          { status: 429, headers: { "Retry-After": "0" } },
        );
      return jsonResponse({ results: [{ id: "g1", name: "Done" }] });
    });

    const first = await getProlificParticipantGroups("token-a");
    const second = await getProlificParticipantGroups("token-a");

    expect(first.map((group) => group.name)).toEqual(["Done"]);
    expect(second).toBe(first);
    expect(calls).toBe(2);
  });
});
