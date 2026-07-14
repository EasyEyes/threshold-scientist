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
  });
});
