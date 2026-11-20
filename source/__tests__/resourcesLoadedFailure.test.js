/** Resource-catalog loading: failures stay typed and retry is user-driven. */
import App from "../App";
import {
  failedResourceTypes,
  loadingResourceCatalog,
  resourceCatalogHasSettled,
} from "../../threshold/preprocess/resourceCatalog";

jest.mock("firebase/database", () => ({
  set: jest.fn(),
  ref: jest.fn(),
  get: jest.fn().mockResolvedValue({ val: () => ({ count: 0 }) }),
}));

jest.mock("@firebase/util", () => ({ uuidv4: jest.fn(() => "test-uuid") }));
jest.mock("../components/firebase", () => ({ auth: {}, db: {} }));
jest.mock("firebase/auth", () => ({
  signInAnonymously: jest.fn().mockResolvedValue({}),
}));
jest.mock("../components/firebase_soundProfile", () => ({
  getSoundProfileStatement: jest.fn(),
}));
jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
  showLoading: jest.fn(),
  close: jest.fn(),
}));
jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  getCommonResourcesNames: jest.fn(),
}));
jest.mock("../../threshold/preprocess/constants", () => ({
  resourcesFileTypes: ["fonts", "images"],
}));
jest.mock("../sentry", () => ({ captureError: jest.fn() }));
jest.mock("../../threshold/preprocess/auth/errorHandler", () => {
  const actual = jest.requireActual(
    "../../threshold/preprocess/auth/errorHandler",
  );
  return { ...actual, handleAuthError: jest.fn(() => Promise.resolve()) };
});

const Swal = require("sweetalert2");
const {
  getCommonResourcesNames,
} = require("../../threshold/preprocess/gitlabUtils");
const sentry = require("../sentry");
const {
  handleAuthError,
} = require("../../threshold/preprocess/auth/errorHandler");

const ready = (names) => ({ kind: "ready", names });
const failed = (error = new Error("listing failed")) => ({
  kind: "failed",
  error,
});
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const makeApp = (user = {}) => {
  const app = {
    state: { user, resourceCatalog: loadingResourceCatalog() },
    setState: jest.fn((update) => {
      app.state = { ...app.state, ...update };
    }),
  };
  app.handleResourcesLoaded = App.prototype.handleResourcesLoaded.bind(app);
  app.handleRetryResources = App.prototype.handleRetryResources.bind(app);
  app.cancelResourceRetry = App.prototype.cancelResourceRetry.bind(app);
  app.handleUpdateUser = App.prototype.handleUpdateUser.bind(app);
  app.handleAddResources = App.prototype.handleAddResources.bind(app);
  return app;
};

describe("resource catalog loading", () => {
  beforeEach(() => jest.clearAllMocks());

  it("settles partial failure without a modal or automatic refetch", async () => {
    const listings = { fonts: failed(), images: ready(["b.png"]) };
    getCommonResourcesNames.mockResolvedValue(listings);
    const user = {};
    const app = makeApp(user);

    app.handleResourcesLoaded(getCommonResourcesNames(user), user);
    for (let i = 0; i < 5; i++) await flush();

    expect(getCommonResourcesNames).toHaveBeenCalledTimes(1);
    expect(Swal.fire).not.toHaveBeenCalled();
    expect(app.state.resourceCatalog).toEqual({ kind: "settled", listings });
    expect(failedResourceTypes(app.state.resourceCatalog)).toEqual(["fonts"]);
    expect(app.state.resources).toBeUndefined();
    expect(app.state.resourcesLoaded).toBeUndefined();
  });

  it("refetches only when the scientist explicitly retries", async () => {
    const unavailable = { fonts: failed(), images: ready([]) };
    const recovered = { fonts: ready(["Inter.woff2"]), images: ready([]) };
    getCommonResourcesNames
      .mockResolvedValueOnce(unavailable)
      .mockResolvedValueOnce(recovered);
    const user = {};
    const app = makeApp(user);

    app.handleResourcesLoaded(getCommonResourcesNames(user), user);
    await flush();
    expect(getCommonResourcesNames).toHaveBeenCalledTimes(1);

    app.handleRetryResources();
    expect(app.state.resourceCatalog.kind).toBe("loading");
    await flush();

    expect(getCommonResourcesNames).toHaveBeenCalledTimes(2);
    expect(app.state.resourceCatalog).toEqual({
      kind: "settled",
      listings: recovered,
    });
    expect(Swal.fire).not.toHaveBeenCalled();
  });

  it("deduplicates an in-flight explicit retry", async () => {
    const user = {};
    const app = makeApp(user);
    let resolveLoad;
    getCommonResourcesNames.mockImplementation(
      () => new Promise((resolve) => (resolveLoad = resolve)),
    );

    const first = app.handleRetryResources();
    const second = app.handleRetryResources();

    expect(second).toBe(first);
    expect(getCommonResourcesNames).toHaveBeenCalledTimes(1);
    resolveLoad({ fonts: ready(["Fresh.woff2"]), images: ready([]) });
    await flush();
    expect(app.state.resourceCatalog.listings.fonts).toEqual(
      ready(["Fresh.woff2"]),
    );
  });

  it("keeps a ready empty list distinct from failure", async () => {
    const listings = { fonts: ready([]), images: ready([]) };
    const user = {};
    const app = makeApp(user);

    app.handleResourcesLoaded(Promise.resolve(listings), user);
    await flush();

    expect(app.state.resourceCatalog.listings.fonts).toEqual(ready([]));
    expect(failedResourceTypes(app.state.resourceCatalog)).toEqual([]);
    expect(Swal.fire).not.toHaveBeenCalled();
  });

  it("aborts and invalidates an in-flight retry when the account changes", async () => {
    const userA = { id: "a" };
    const app = makeApp(userA);
    let rejectLoad;
    getCommonResourcesNames.mockImplementation(
      () => new Promise((_, reject) => (rejectLoad = reject)),
    );

    app.handleRetryResources();
    const signal = getCommonResourcesNames.mock.calls[0][1].signal;
    app.handleUpdateUser({ id: "b" });

    expect(signal.aborted).toBe(true);
    rejectLoad(new DOMException("Cancelled", "AbortError"));
    await flush();
    expect(sentry.captureError).not.toHaveBeenCalled();
    expect(app.state.resourceCatalog.kind).toBe("loading");
  });

  it("does not let an aborted retry overwrite fresh upload listings", async () => {
    const user = { id: "a" };
    const app = makeApp(user);
    let rejectLoad;
    getCommonResourcesNames.mockImplementation(
      () => new Promise((_, reject) => (rejectLoad = reject)),
    );
    app.handleRetryResources();
    const fresh = { fonts: ready(["Fresh.woff2"]), images: ready([]) };

    app.handleAddResources(fresh);
    rejectLoad(new DOMException("Cancelled", "AbortError"));
    await flush();

    expect(app.state.resourceCatalog).toEqual({
      kind: "settled",
      listings: fresh,
    });
    expect(sentry.captureError).not.toHaveBeenCalled();
  });

  it("ignores a stale load that resolves after the user changed", async () => {
    const userA = { id: "a" };
    const userB = { id: "b" };
    let resolveA;
    const pendingA = new Promise((resolve) => (resolveA = resolve));
    const listingsB = { fonts: ready(["B.woff2"]), images: ready([]) };
    const app = makeApp(userA);

    app.handleResourcesLoaded(pendingA, userA);
    app.setState({ user: userB });
    app.handleResourcesLoaded(Promise.resolve(listingsB), userB);
    await flush();
    resolveA({ fonts: ready(["A.woff2"]), images: ready([]) });
    await flush();

    expect(app.state.resourceCatalog.listings).toBe(listingsB);
    expect(app.state.user).toBe(userB);
  });

  it("ignores a stale AUTH rejection after the user changed", async () => {
    const userA = { id: "a" };
    const userB = { id: "b" };
    let rejectA;
    const pendingA = new Promise((_, reject) => (rejectA = reject));
    const app = makeApp(userA);

    app.handleResourcesLoaded(pendingA, userA);
    app.setState({ user: userB });
    rejectA(new Error("AUTH_TOKEN_INVALID"));
    await flush();

    expect(handleAuthError).not.toHaveBeenCalled();
    expect(sentry.captureError).not.toHaveBeenCalled();
    expect(app.state.user).toBe(userB);
  });

  it("routes auth rejection to re-authentication without retry or modal", async () => {
    getCommonResourcesNames.mockRejectedValue(new Error("AUTH_TOKEN_INVALID"));
    const user = {};
    const app = makeApp(user);

    app.handleResourcesLoaded(getCommonResourcesNames(user), user);
    await flush();

    expect(handleAuthError).toHaveBeenCalledTimes(1);
    expect(getCommonResourcesNames).toHaveBeenCalledTimes(1);
    expect(Swal.fire).not.toHaveBeenCalled();
    expect(sentry.captureError).not.toHaveBeenCalled();
  });

  it("reports and settles an unexpected whole-catalog rejection", async () => {
    const bug = new TypeError("cannot read properties of undefined");
    const user = {};
    const app = makeApp(user);

    app.handleResourcesLoaded(Promise.reject(bug), user);
    await flush();

    expect(sentry.captureError).toHaveBeenCalledWith(
      bug,
      "Unexpected error loading resources",
      { type: "resources" },
    );
    expect(app.state.resourceCatalog).toEqual({ kind: "failed", error: bug });
    expect(resourceCatalogHasSettled(app.state.resourceCatalog)).toBe(true);
    expect(failedResourceTypes(app.state.resourceCatalog)).toEqual([
      "fonts",
      "images",
    ]);
  });

  it("settles a failed catalog after a rejected retry, so Retry stays available", async () => {
    const bug = new TypeError("boom");
    getCommonResourcesNames.mockRejectedValue(bug);
    const user = {};
    const app = makeApp(user);

    app.handleRetryResources();
    await flush();
    await flush();

    expect(app.state.resourceCatalog).toEqual({ kind: "failed", error: bug });
    expect(failedResourceTypes(app.state.resourceCatalog)).toEqual([
      "fonts",
      "images",
    ]);
    expect(Swal.fire).not.toHaveBeenCalled();
  });

  it("reports a failed re-authentication redirect", async () => {
    const authError = new Error("AUTH_TOKEN_INVALID");
    const redirectFailure = new Error("redirect failed");
    handleAuthError.mockRejectedValueOnce(redirectFailure);
    const user = {};
    const app = makeApp(user);

    app.handleResourcesLoaded(Promise.reject(authError), user);
    await flush();

    expect(handleAuthError).toHaveBeenCalledWith(authError);
    expect(sentry.captureError).toHaveBeenCalledWith(
      redirectFailure,
      expect.stringMatching(/re-?auth/i),
      expect.anything(),
    );
  });
});
