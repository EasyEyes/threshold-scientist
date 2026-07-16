describe("browser freshness retry adapters", () => {
  const loadModule = () => require("./browserFreshnessAdapters");

  beforeEach(() => {
    jest.resetModules();
    window.sessionStorage.clear();
    window.history.replaceState(
      null,
      "",
      "/compiler/?participant=abc&study=contrast",
    );
  });

  it("persists attempts independently for each target deployment", () => {
    const { browserRetry, createBrowserRetry } = loadModule();

    browserRetry.setAttempts("deploy-456", 2);
    const afterReload = createBrowserRetry(
      { href: window.location.href, replace: jest.fn() },
      window.sessionStorage,
    );

    expect(afterReload.getAttempts("deploy-456")).toBe(2);
    expect(afterReload.getAttempts("deploy-789")).toBe(0);
  });

  it("builds a replacement URL preserving query parameters", () => {
    const replace = jest.fn();
    const reload = jest.fn();
    const deleteCachedResponse = jest.fn();
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: { delete: deleteCachedResponse },
    });
    const { createBrowserRetry } = loadModule();
    const retry = createBrowserRetry(
      { href: window.location.href, replace, reload },
      window.sessionStorage,
    );

    retry.replaceWithDeployment("deploy-456");

    const replacement = new URL(
      replace.mock.calls[0][0],
      window.location.origin,
    );
    expect(replacement.pathname).toBe("/compiler/");
    expect(replacement.searchParams.get("participant")).toBe("abc");
    expect(replacement.searchParams.get("study")).toBe("contrast");
    expect(replacement.searchParams.get("compilerDeploymentId")).toBe(
      "deploy-456",
    );
    expect(reload).not.toHaveBeenCalled();
    expect(deleteCachedResponse).not.toHaveBeenCalled();
  });

  it("notifies once per hidden-to-visible transition and removes its listener", () => {
    const { subscribeToVisibility } = loadModule();
    let visibilityListener;
    const documentBoundary = {
      visibilityState: "visible",
      addEventListener: jest.fn((_event, listener) => {
        visibilityListener = listener;
      }),
      removeEventListener: jest.fn(),
    };
    const onReturnToVisible = jest.fn();

    const unsubscribe = subscribeToVisibility(
      documentBoundary,
      onReturnToVisible,
    );
    visibilityListener();
    documentBoundary.visibilityState = "hidden";
    visibilityListener();
    documentBoundary.visibilityState = "visible";
    visibilityListener();
    visibilityListener();

    expect(onReturnToVisible).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(documentBoundary.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      visibilityListener,
    );
  });

  it("reports only allowlisted diagnostics with sanitized URL and stable grouping", () => {
    const Sentry = {
      addBreadcrumb: jest.fn(),
      captureException: jest.fn(),
    };
    const { createBrowserFreshnessReporting } = loadModule();
    const reporting = createBrowserFreshnessReporting(
      Sentry,
      {
        href: `${window.location.origin}/compiler/?token=SECRET_TOKEN#experiment=SECRET_EXPERIMENT`,
      },
      { userAgent: "Test Browser SECRET_BROWSER_SENTINEL" },
      window.sessionStorage,
    );
    const diagnostics = {
      runningDeploymentId: "deploy-123",
      liveDeploymentId: "deploy-456",
      publishedAt: "2026-07-14T11:15:30.000Z",
      retryCount: 3,
      pavloviaToken: "SECRET_TOKEN",
      experimentData: "SECRET_EXPERIMENT",
      spreadsheetData: "SECRET_SPREADSHEET",
      applicationState: "SECRET_STATE",
    };

    reporting.addFailedAttemptBreadcrumb(diagnostics);
    reporting.reportExhaustedRefreshes(diagnostics);

    expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
      category: "compiler-freshness",
      level: "warning",
      message: "Compiler remained stale after refresh attempt 3",
      data: {
        runningDeploymentId: "deploy-123",
        liveDeploymentId: "deploy-456",
        retryCount: 3,
      },
    });
    const [error, event] = Sentry.captureException.mock.calls[0];
    expect(error).toEqual(
      new Error("Compiler remained stale after refresh attempts"),
    );
    expect(event).toEqual({
      fingerprint: ["compiler-stale-after-refresh"],
      tags: { context: "compiler-stale-after-refresh" },
      extra: {
        runningDeploymentId: "deploy-123",
        liveDeploymentId: "deploy-456",
        publishedAt: "2026-07-14T11:15:30.000Z",
        retryCount: 3,
        url: `${window.location.origin}/compiler/`,
        browser: "Test Browser SECRET_BROWSER_SENTINEL",
      },
    });
    const serialized = JSON.stringify(
      Sentry.mock?.calls || [
        Sentry.addBreadcrumb.mock.calls,
        Sentry.captureException.mock.calls,
      ],
    );
    expect(serialized).not.toContain("SECRET_TOKEN");
    expect(serialized).not.toContain("SECRET_EXPERIMENT");
    expect(serialized).not.toContain("SECRET_SPREADSHEET");
    expect(serialized).not.toContain("SECRET_STATE");
  });

  it("persists report deduplication independently for each target deployment", () => {
    const { createBrowserFreshnessReporting } = loadModule();
    const reporting = createBrowserFreshnessReporting(
      { addBreadcrumb: jest.fn(), captureException: jest.fn() },
      window.location,
      window.navigator,
      window.sessionStorage,
    );

    expect(reporting.hasReported("deploy-456")).toBe(false);
    reporting.markReported("deploy-456");
    expect(reporting.hasReported("deploy-456")).toBe(true);
    expect(reporting.hasReported("deploy-789")).toBe(false);
  });
});
