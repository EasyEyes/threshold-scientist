/** Characterizes per-type ready/failed resource listings. */
jest.mock("../../threshold/preprocess/auth/config", () => ({
  getAuthConfig: () => ({ clientId: "test", redirectUri: "http://test" }),
}));
jest.mock("../../threshold/preprocess/auth/gitlabOAuthClient", () => ({
  GitLabOAuthClient: { loadFromStorage: jest.fn() },
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

const treeResponse = (entries, totalPages) => ({
  ok: true,
  json: jest.fn().mockResolvedValue(entries),
  headers: {
    get: jest.fn((name) =>
      name === "X-Total-Pages" && totalPages ? String(totalPages) : null,
    ),
  },
});

const setup = ({ apiRequest, repo = { id: 42 } }) => {
  searchProjectByName.mockResolvedValue(repo);
  GitLabOAuthClient.loadFromStorage.mockReturnValue({ apiRequest });
};

const expectAll = (result, predicate) => {
  for (const listing of Object.values(result)) predicate(listing);
};

describe("getCommonResourcesNames — typed listings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns a ready empty listing for every type when the repo is absent", async () => {
    setup({ apiRequest: jest.fn(), repo: null });
    const result = await getCommonResourcesNames({ id: "1" });
    expectAll(result, (listing) =>
      expect(listing).toEqual({ kind: "ready", names: [] }),
    );
  });

  it("maps a missing folder (404 Tree Not Found) to ready empty", async () => {
    setup({
      apiRequest: jest.fn().mockRejectedValue(
        Object.assign(new Error("404"), {
          status: 404,
          responseMessage: "404 Tree Not Found",
        }),
      ),
    });
    const result = await getCommonResourcesNames({ id: "1" });
    expectAll(result, (listing) =>
      expect(listing).toEqual({ kind: "ready", names: [] }),
    );
  });

  it("rejects authentication failures rather than fabricating per-type results", async () => {
    setup({
      apiRequest: jest.fn().mockRejectedValue(new Error("AUTH_TOKEN_INVALID")),
    });
    await expect(getCommonResourcesNames({ id: "1" })).rejects.toThrow(
      "AUTH_TOKEN_INVALID",
    );
  });

  it("maps a plain 403 to failed with its error and no names", async () => {
    const failure = Object.assign(new Error("API request failed: 403"), {
      status: 403,
    });
    setup({ apiRequest: jest.fn().mockRejectedValue(failure) });
    const result = await getCommonResourcesNames({ id: "1" });
    expectAll(result, (listing) => {
      expect(listing.kind).toBe("failed");
      expect(listing.error).toBe(failure);
      expect(listing).not.toHaveProperty("names");
    });
  });

  it("maps a JSON parse failure to failed", async () => {
    setup({
      apiRequest: jest.fn().mockResolvedValue({
        ok: true,
        json: jest
          .fn()
          .mockRejectedValue(new SyntaxError("Unexpected token <")),
        headers: { get: jest.fn(() => null) },
      }),
    });
    const result = await getCommonResourcesNames({ id: "1" });
    expectAll(result, (listing) => expect(listing.kind).toBe("failed"));
  });

  it("uses one recursive tree request and groups only direct resource files", async () => {
    const apiRequest = jest.fn().mockResolvedValue(
      treeResponse([
        { name: "fonts", path: "fonts", type: "tree" },
        {
          name: "Sloan.woff2",
          path: "fonts/Sloan.woff2",
          type: "blob",
        },
        { name: "target.png", path: "images/target.png", type: "blob" },
        { name: "nested", path: "images/nested", type: "tree" },
        {
          name: "nested.png",
          path: "images/nested/nested.png",
          type: "blob",
        },
        { name: "root.txt", path: "root.txt", type: "blob" },
      ]),
    );
    setup({ apiRequest });

    const controller = new AbortController();
    const result = await getCommonResourcesNames(
      { id: "1" },
      { signal: controller.signal },
    );

    expect(result.fonts).toEqual({ kind: "ready", names: ["Sloan.woff2"] });
    expect(result.images).toEqual({ kind: "ready", names: ["target.png"] });
    expect(result.texts).toEqual({ kind: "ready", names: [] });
    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest.mock.calls[0][0]).toContain(
      "repository/tree/?recursive=true",
    );
    expect(apiRequest.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it("starts later recursive-tree pages in parallel", async () => {
    let finishSecondPage;
    const apiRequest = jest
      .fn()
      .mockImplementationOnce(() =>
        Promise.resolve(
          treeResponse(
            [
              {
                name: "Sloan.woff2",
                path: "fonts/Sloan.woff2",
                type: "blob",
              },
            ],
            2,
          ),
        ),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishSecondPage = () =>
              resolve(
                treeResponse([
                  {
                    name: "target.png",
                    path: "images/target.png",
                    type: "blob",
                  },
                ]),
              );
          }),
      );
    setup({ apiRequest });

    const promise = getCommonResourcesNames({ id: "1" });
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(apiRequest).toHaveBeenCalledTimes(2);

    finishSecondPage();
    const result = await promise;
    expect(result.fonts.names).toEqual(["Sloan.woff2"]);
    expect(result.images.names).toEqual(["target.png"]);
  });

  it("rejects a status-only 401", async () => {
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

  it("does not treat incidental 401 text as authentication", async () => {
    const incidental = new Error("Failed listing folder with 401 files");
    setup({ apiRequest: jest.fn().mockRejectedValue(incidental) });
    const result = await getCommonResourcesNames({ id: "1" });
    expectAll(result, (listing) => expect(listing.kind).toBe("failed"));
  });

  it("reports non-auth failures with type and status", async () => {
    const failure = Object.assign(new Error("API request failed: 403"), {
      status: 403,
      responseMessage: "Forbidden",
    });
    setup({ apiRequest: jest.fn().mockRejectedValue(failure) });
    await getCommonResourcesNames({ id: "1" });
    expect(sentry.captureError).toHaveBeenCalled();
    const [error, context, extra] = sentry.captureError.mock.calls[0];
    expect(error).toBe(failure);
    expect(String(context)).toMatch(/resource/i);
    expect(extra).toMatchObject({ status: 403 });
    expect(typeof extra.type).toBe("string");
  });

  it("rejects when the session is gone entirely", async () => {
    searchProjectByName.mockResolvedValue({ id: 42 });
    GitLabOAuthClient.loadFromStorage.mockReturnValue(null);
    await expect(getCommonResourcesNames({ id: "1" })).rejects.toThrow(
      "AUTH_TOKEN_INVALID",
    );
  });
});
