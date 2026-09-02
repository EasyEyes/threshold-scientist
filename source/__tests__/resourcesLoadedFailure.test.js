/**
 * Replication tests for the "Pavlovia server troubles" modal.
 *
 * Live probing (node, unauthenticated, 2026-09-02) shows Pavlovia's GitLab
 * returns 429 + Retry-After under load — a path apiRequest retries
 * indefinitely, so throttling can never produce the null resource type that
 * triggers this modal. These tests characterize which failure shapes DO reach
 * the modal, and how many times the full 10-type burst is re-fired.
 */
import App from "../App";

jest.mock("firebase/database", () => ({
  set: jest.fn(),
  ref: jest.fn(),
  get: jest.fn().mockResolvedValue({ val: () => ({ count: 0 }) }),
}));

jest.mock("@firebase/util", () => ({
  uuidv4: jest.fn(() => "test-uuid"),
}));

jest.mock("../components/firebase", () => ({
  auth: {},
  db: {},
}));

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

jest.mock("../../threshold/preprocess/retry", () => ({
  getRetryDelayMs: jest.fn(() => 0),
}));

jest.mock("../../threshold/preprocess/constants", () => ({
  resourcesFileTypes: ["fonts", "images"],
}));

jest.mock("../sentry", () => ({
  captureError: jest.fn(),
}));

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
const { getRetryDelayMs } = require("../../threshold/preprocess/retry");
const sentry = require("../sentry");
const {
  handleAuthError,
} = require("../../threshold/preprocess/auth/errorHandler");

const makeApp = (user = {}) => {
  const app = {
    state: { user },
    setState: jest.fn((update) => {
      app.state = { ...app.state, ...update };
    }),
  };
  app.handleResourcesLoaded = App.prototype.handleResourcesLoaded.bind(app);
  return app;
};

const flushRetries = () => new Promise((r) => setTimeout(r, 5));

describe("handleResourcesLoaded — modal trigger characterization", () => {
  beforeEach(() => jest.clearAllMocks());

  it("fires the modal only after attempt 3, refetching the FULL resource set 4 times", async () => {
    getCommonResourcesNames.mockResolvedValue({ fonts: null, images: [] });
    const user = {};
    const app = makeApp(user);

    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(user),
      user,
    );
    // allow initial attempt + 3 backoff retries to run
    for (let i = 0; i < 6; i++) await flushRetries();

    expect(getCommonResourcesNames).toHaveBeenCalledTimes(4);
    expect(getRetryDelayMs.mock.calls.map((c) => c[0])).toEqual([0, 1, 2]);
    expect(Swal.fire).toHaveBeenCalledTimes(1);
    expect(Swal.fire.mock.calls[0][0]).toMatchObject({
      title: "Pavlovia server troubles",
    });
    // state still committed with the failed type silently emptied
    expect(app.state.resourcesLoaded).toBe(true);
    expect(app.state.resources).toEqual({ fonts: [], images: [] });
  });

  it("stays silent when a transient failure recovers on a retry", async () => {
    getCommonResourcesNames
      .mockResolvedValueOnce({ fonts: null, images: [] })
      .mockResolvedValue({ fonts: ["Inter-Regular.woff2"], images: [] });
    const user = {};
    const app = makeApp(user);

    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(user),
      user,
    );
    for (let i = 0; i < 4; i++) await flushRetries();

    expect(getCommonResourcesNames).toHaveBeenCalledTimes(2);
    expect(Swal.fire).not.toHaveBeenCalled();
    expect(app.state.resources.fonts).toEqual(["Inter-Regular.woff2"]);
  });

  it("fires the same 'server troubles' modal for a total auth-shaped failure (all types null)", async () => {
    // Documents the mislabeling: a 401/AUTH_TOKEN_INVALID failure (e.g. stale
    // tab after refresh-token rotation) nulls every type, yet the participant
    // is told the Pavlovia server is at fault.
    getCommonResourcesNames.mockResolvedValue({ fonts: null, images: null });
    const user = {};
    const app = makeApp(user);

    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(user),
      user,
    );
    for (let i = 0; i < 6; i++) await flushRetries();

    expect(Swal.fire).toHaveBeenCalledTimes(1);
    expect(Swal.fire.mock.calls[0][0].title).toBe("Pavlovia server troubles");
  });

  it("never fires the modal when all types load", async () => {
    getCommonResourcesNames.mockResolvedValue({
      fonts: ["a.woff2"],
      images: ["b.png"],
    });
    const user = {};
    const app = makeApp(user);

    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(user),
      user,
    );
    for (let i = 0; i < 4; i++) await flushRetries();

    expect(getCommonResourcesNames).toHaveBeenCalledTimes(1);
    expect(Swal.fire).not.toHaveBeenCalled();
  });

  it("treats 'repo absent' (all empty arrays) as success, not failure", async () => {
    getCommonResourcesNames.mockResolvedValue({ fonts: [], images: [] });
    const user = {};
    const app = makeApp(user);

    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(user),
      user,
    );
    for (let i = 0; i < 4; i++) await flushRetries();

    expect(Swal.fire).not.toHaveBeenCalled();
    expect(app.state.resourcesLoaded).toBe(true);
  });

  it("ignores a stale retry that resolves after the user changed", async () => {
    // Account switch: attempt 0 for user A schedules a retry; before it
    // settles, user B logs in and loads successfully. When A's stale retry
    // resolves later, it must not clobber B's state with A's resource list.
    const userA = { id: "a" };
    const userB = { id: "b" };
    let resolveA2;
    const deferredA2 = new Promise((res) => {
      resolveA2 = res;
    });
    let aCalls = 0;
    getCommonResourcesNames.mockImplementation((u) => {
      if (u === userB)
        return Promise.resolve({ fonts: ["B.woff2"], images: [] });
      aCalls += 1;
      return aCalls === 1
        ? Promise.resolve({ fonts: null, images: [] })
        : deferredA2;
    });
    const app = makeApp(userA);

    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(userA),
      userA,
    );
    await flushRetries(); // attempt-0 settles, retry fires, its promise is pending
    expect(aCalls).toBe(2);

    // user B takes over while A's retry is still in flight
    app.setState({ user: userB });
    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(userB),
      userB,
    );
    await flushRetries();
    expect(app.state.resources.fonts).toEqual(["B.woff2"]);

    // A's stale retry resolves last — must not overwrite B
    resolveA2({ fonts: ["A-stale.woff2"], images: [] });
    for (let i = 0; i < 3; i++) await flushRetries();
    expect(app.state.resources.fonts).toEqual(["B.woff2"]);
    expect(app.state.user).toBe(userB);
    expect(Swal.fire).not.toHaveBeenCalled();
  });

  it("ignores a stale AUTH rejection that lands after the user changed", async () => {
    // A's session dies mid-fetch; the user re-logs-in as B. When A's stale
    // rejection arrives, it must NOT clear B's fresh tokens / redirect —
    // only the current user's failures may trigger re-authentication.
    const userA = { id: "a" };
    const userB = { id: "b" };
    let rejectA;
    getCommonResourcesNames.mockImplementation((u) =>
      u === userB
        ? Promise.resolve({ fonts: ["B.woff2"], images: [] })
        : new Promise((_, rej) => {
            rejectA = rej;
          }),
    );
    const app = makeApp(userA);

    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(userA),
      userA,
    );
    await flushRetries();

    app.setState({ user: userB });
    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(userB),
      userB,
    );
    await flushRetries();
    expect(app.state.resources.fonts).toEqual(["B.woff2"]);

    rejectA(new Error("AUTH_TOKEN_INVALID"));
    for (let i = 0; i < 3; i++) await flushRetries();

    expect(handleAuthError).not.toHaveBeenCalled();
    expect(sentry.captureError).not.toHaveBeenCalled();
    expect(app.state.resources.fonts).toEqual(["B.woff2"]);
  });

  it("routes an auth rejection to silent re-authentication, never the modal", async () => {
    getCommonResourcesNames.mockRejectedValue(new Error("AUTH_TOKEN_INVALID"));
    const user = {};
    const app = makeApp(user);

    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(user),
      user,
    );
    for (let i = 0; i < 4; i++) await flushRetries();

    expect(handleAuthError).toHaveBeenCalledTimes(1);
    expect(Swal.fire).not.toHaveBeenCalled();
    expect(sentry.captureError).not.toHaveBeenCalled();
    // no retry burst — an invalid token will not heal in 1.2s
    expect(getCommonResourcesNames).toHaveBeenCalledTimes(1);
  });

  it("still reports genuinely unexpected rejections to Sentry", async () => {
    const bug = new TypeError("cannot read properties of undefined");
    getCommonResourcesNames.mockRejectedValue(bug);
    const user = {};
    const app = makeApp(user);

    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(user),
      user,
    );
    for (let i = 0; i < 4; i++) await flushRetries();

    expect(sentry.captureError).toHaveBeenCalledWith(
      bug,
      expect.any(String),
      expect.objectContaining({ type: "resources" }),
    );
    expect(handleAuthError).not.toHaveBeenCalled();
  });

  it("routes an auth rejection on a RETRY attempt to re-auth, never the modal", async () => {
    // Attempt 0 returns a persistent null (starts the retry loop); attempt 1
    // rejects with an expired session — the most common real-world shape:
    // token dies between the initial load and the retry.
    getCommonResourcesNames
      .mockResolvedValueOnce({ fonts: null, images: [] })
      .mockRejectedValueOnce(new Error("AUTH_TOKEN_INVALID"));
    const user = {};
    const app = makeApp(user);

    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(user),
      user,
    );
    for (let i = 0; i < 6; i++) await flushRetries();

    expect(handleAuthError).toHaveBeenCalledTimes(1);
    expect(Swal.fire).not.toHaveBeenCalled();
  });

  it("reports a failed re-authentication instead of dying silently", async () => {
    // handleAuthError clears tokens then redirects; if the redirect itself
    // fails (import/network), the user must not be left with a dead app and
    // an unhandled rejection.
    const authError = new Error("AUTH_TOKEN_INVALID");
    const redirectFailure = new Error("redirect failed");
    handleAuthError.mockRejectedValueOnce(redirectFailure);
    getCommonResourcesNames.mockRejectedValue(authError);
    const user = {};
    const app = makeApp(user);

    App.prototype.handleResourcesLoaded.call(
      app,
      getCommonResourcesNames(user),
      user,
    );
    for (let i = 0; i < 4; i++) await flushRetries();

    expect(handleAuthError).toHaveBeenCalledWith(authError);
    expect(sentry.captureError).toHaveBeenCalledWith(
      redirectFailure,
      expect.stringMatching(/re-?auth/i),
      expect.anything(),
    );
  });
});
