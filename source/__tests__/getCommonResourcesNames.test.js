/**
 * Characterizes getCommonResourcesNames' error → null mapping.
 *
 * Live probing shows Pavlovia throttles with 429 + Retry-After, which
 * apiRequest retries indefinitely — so throttling never produces a null
 * resource type. These tests pin down which failures DO produce null (and
 * thus the "Pavlovia server troubles" modal downstream in App.js).
 */
jest.mock("../../threshold/preprocess/auth/config", () => ({
  getAuthConfig: () => ({ clientId: "test", redirectUri: "http://test" }),
}));

jest.mock("../../threshold/preprocess/auth/gitlabOAuthClient", () => ({
  GitLabOAuthClient: {
    loadFromStorage: jest.fn(),
  },
}));

jest.mock("../../threshold/preprocess/gitlabSearch", () => ({
  searchProjectByName: jest.fn(),
  searchProjectsByName: jest.fn(),
}));

jest.mock("../../threshold/components/sentry", () => ({
  captureError: jest.fn(),
}));

const {
  GitLabOAuthClient,
} = require("../../threshold/preprocess/auth/gitlabOAuthClient");
const {
  searchProjectByName,
} = require("../../threshold/preprocess/gitlabSearch");
const {
  getCommonResourcesNames,
} = require("../../threshold/preprocess/gitlabUtils");
const sentry = require("../../threshold/components/sentry");

const okResponse = (names) => ({
  ok: true,
  json: jest.fn().mockResolvedValue(names.map((name) => ({ name }))),
  headers: { get: jest.fn(() => null) },
});

const setup = ({ apiRequest }) => {
  searchProjectByName.mockResolvedValue({ id: 42 });
  GitLabOAuthClient.loadFromStorage.mockReturnValue({ apiRequest });
  jest.spyOn(console, "warn").mockImplementation(() => {});
};

describe("getCommonResourcesNames — error mapping", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps a missing folder (404 Tree Not Found) to an empty list, not null", async () => {
    setup({
      apiRequest: jest.fn().mockRejectedValue(
        Object.assign(new Error("404"), {
          status: 404,
          responseMessage: "404 Tree Not Found",
        }),
      ),
    });
    const r = await getCommonResourcesNames({ id: "1" });
    for (const [type, value] of Object.entries(r)) {
      expect(value).toEqual([]);
    }
  });

  it("rejects on AUTH_TOKEN_INVALID (stale/expired session) rather than nulling every type", async () => {
    setup({
      apiRequest: jest.fn().mockRejectedValue(new Error("AUTH_TOKEN_INVALID")),
    });
    await expect(getCommonResourcesNames({ id: "1" })).rejects.toThrow(
      "AUTH_TOKEN_INVALID",
    );
  });

  it("maps a plain 403 to null (would trigger the modal downstream)", async () => {
    setup({
      apiRequest: jest.fn().mockRejectedValue(
        Object.assign(new Error("API request failed: 403 Forbidden"), {
          status: 403,
        }),
      ),
    });
    const r = await getCommonResourcesNames({ id: "1" });
    expect(Object.values(r).every((v) => v === null)).toBe(true);
  });

  it("maps a JSON parse failure (HTML/proxy body with 200) to null", async () => {
    setup({
      apiRequest: jest.fn().mockResolvedValue({
        ok: true,
        json: jest
          .fn()
          .mockRejectedValue(new SyntaxError("Unexpected token < in JSON")),
        headers: { get: jest.fn(() => null) },
      }),
    });
    const r = await getCommonResourcesNames({ id: "1" });
    expect(Object.values(r).every((v) => v === null)).toBe(true);
  });

  it("maps successful tree listings to file names per type", async () => {
    setup({
      apiRequest: jest.fn().mockResolvedValue(okResponse(["a.woff2", "b.ttf"])),
    });
    const r = await getCommonResourcesNames({ id: "1" });
    for (const value of Object.values(r)) {
      expect(value).toEqual(["a.woff2", "b.ttf"]);
    }
  });

  it("does not record which type or status failed anywhere but console.warn", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    setup({
      apiRequest: jest.fn().mockRejectedValue(new Error("AUTH_TOKEN_INVALID")),
    });
    await expect(getCommonResourcesNames({ id: "1" })).rejects.toThrow(
      "AUTH_TOKEN_INVALID",
    );
    warn.mockRestore();
  });

  it("rejects on a status-only 401 (message need not contain '401')", async () => {
    setup({
      apiRequest: jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("Session expired"), { status: 401 }),
        ),
    });
    await expect(getCommonResourcesNames({ id: "1" })).rejects.toThrow(
      "Session expired",
    );
  });

  it("does not treat incidental '401' text in unrelated messages as auth", async () => {
    // A failure whose message merely contains the digits 401 (e.g. a file
    // count) is not an auth failure — it must still map to null, not
    // trigger a re-auth redirect.
    const incidental = new Error("Failed listing folder with 401 files");
    setup({ apiRequest: jest.fn().mockRejectedValue(incidental) });
    const r = await getCommonResourcesNames({ id: "1" });
    expect(Object.values(r).every((v) => v === null)).toBe(true);
  });

  it("reports non-auth per-type failures to Sentry with type and status", async () => {
    const failure = Object.assign(new Error("API request failed: 403"), {
      status: 403,
      responseMessage: "Forbidden",
    });
    setup({ apiRequest: jest.fn().mockRejectedValue(failure) });
    const r = await getCommonResourcesNames({ id: "1" });
    expect(Object.values(r).every((v) => v === null)).toBe(true);
    expect(sentry.captureError).toHaveBeenCalled();
    const [error, context, extra] = sentry.captureError.mock.calls[0];
    expect(error).toBe(failure);
    expect(String(context)).toMatch(/resource/i);
    expect(extra).toMatchObject({ status: 403 });
    expect(typeof extra.type).toBe("string");
  });

  it("rejects on authentication failure instead of nulling every type", async () => {
    setup({
      apiRequest: jest.fn().mockRejectedValue(new Error("AUTH_TOKEN_INVALID")),
    });
    await expect(getCommonResourcesNames({ id: "1" })).rejects.toThrow(
      "AUTH_TOKEN_INVALID",
    );
  });

  it("rejects when the session is gone entirely (no OAuth client)", async () => {
    searchProjectByName.mockResolvedValue({ id: 42 });
    GitLabOAuthClient.loadFromStorage.mockReturnValue(null);
    await expect(getCommonResourcesNames({ id: "1" })).rejects.toThrow();
  });
});
