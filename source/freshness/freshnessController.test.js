import { createFreshnessController } from "./freshnessController";

const notification = {
  deploymentId: "deploy-123",
  publishedAt: "2026-07-14T10:15:30.000Z",
};

const makeProductionController = (overrides = {}) =>
  createFreshnessController({
    mode: "production",
    runningDeploymentId: "deploy-123",
    loadDeploymentNotification: jest.fn().mockResolvedValue(notification),
    loadManifest: jest.fn().mockResolvedValue({ deploymentId: "deploy-123" }),
    ...overrides,
  });

const makeRetryBoundaries = (overrides = {}) => ({
  getAttempts: jest.fn().mockReturnValue(0),
  setAttempts: jest.fn(),
  replaceWithDeployment: jest.fn(),
  schedule: (callback, delay) => setTimeout(callback, delay),
  cancelScheduled: (timer) => clearTimeout(timer),
  ...overrides,
});

describe("freshness controller", () => {
  it("starts production in Checking and publishes Fresh after a verified match", async () => {
    const controller = makeProductionController();
    const states = [];
    const unsubscribe = controller.subscribe((state) => {
      states.push(state.message);
    });

    expect(controller.getState()).toEqual({
      status: "checking",
      message: "Checking compiler freshness...",
    });
    expect(controller.actions.check).toEqual(expect.any(Function));

    await controller.start();

    expect(states).toEqual([
      "Checking compiler freshness...",
      "Fresh. This page is up to date: Jul 14, 2026, 10:15:30 AM UTC.",
    ]);
    expect(controller.getState()).toEqual({
      status: "fresh",
      message: "Fresh. This page is up to date: Jul 14, 2026, 10:15:30 AM UTC.",
    });

    unsubscribe();
    controller.dispose();
  });

  it.each([
    [
      "an unavailable manifest",
      jest.fn().mockRejectedValue(new Error("offline")),
    ],
    ["an invalid manifest", jest.fn().mockResolvedValue({ deploymentId: "" })],
    [
      "a manifest that disagrees with the notification",
      jest.fn().mockResolvedValue({ deploymentId: "deploy-456" }),
    ],
  ])("keeps %s non-blocking in Checking", async (_label, loadManifest) => {
    const controller = makeProductionController({ loadManifest });

    await expect(controller.start()).resolves.toBeUndefined();

    expect(controller.getState()).toEqual({
      status: "checking",
      message: "Checking compiler freshness...",
    });
  });

  it("bypasses production services in development", async () => {
    const loadDeploymentNotification = jest.fn();
    const loadManifest = jest.fn();
    const controller = createFreshnessController({
      mode: "development",
      runningDeploymentId: null,
      loadDeploymentNotification,
      loadManifest,
    });

    expect(controller.getState()).toEqual({
      status: "fresh",
      message: "Fresh. This compiler is running in development mode.",
    });
    await controller.start();

    expect(loadDeploymentNotification).not.toHaveBeenCalled();
    expect(loadManifest).not.toHaveBeenCalled();
  });

  it("stops publishing after unsubscribe and disposal", async () => {
    let resolveManifest;
    const loadManifest = jest.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveManifest = resolve;
      }),
    );
    const controller = makeProductionController({ loadManifest });
    const listener = jest.fn();
    const unsubscribe = controller.subscribe(listener);
    const check = controller.start();

    unsubscribe();
    controller.dispose();
    resolveManifest({ deploymentId: "deploy-123" });
    await check;

    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe("confirmed stale recovery", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it.each([
      [0, 1000],
      [1, 2000],
      [2, 4000],
    ])("replaces after the delay for attempt %i", async (attempts, delay) => {
      const retry = makeRetryBoundaries({
        getAttempts: jest.fn().mockReturnValue(attempts),
      });
      const controller = makeProductionController({
        loadDeploymentNotification: jest.fn().mockResolvedValue({
          deploymentId: "deploy-456",
          publishedAt: "2026-07-14T11:15:30.000Z",
        }),
        loadManifest: jest
          .fn()
          .mockResolvedValue({ deploymentId: "deploy-456" }),
        retry,
      });

      await controller.start();

      expect(controller.getState()).toEqual({
        status: "stale",
        message:
          "Stale. Refresh ↻ to update this page to Jul 14, 2026, 11:15:30 AM UTC.",
        publishedAtUtc: "Jul 14, 2026, 11:15:30 AM UTC",
      });
      expect(retry.replaceWithDeployment).not.toHaveBeenCalled();
      jest.advanceTimersByTime(delay - 1);
      expect(retry.replaceWithDeployment).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(retry.setAttempts).toHaveBeenCalledWith(
        "deploy-456",
        attempts + 1,
      );
      expect(retry.replaceWithDeployment).toHaveBeenCalledWith("deploy-456");
    });

    it("cancels the delay and replaces immediately for manual Refresh", async () => {
      const retry = makeRetryBoundaries();
      const controller = makeProductionController({
        loadDeploymentNotification: jest.fn().mockResolvedValue({
          deploymentId: "deploy-456",
          publishedAt: "2026-07-14T11:15:30.000Z",
        }),
        loadManifest: jest
          .fn()
          .mockResolvedValue({ deploymentId: "deploy-456" }),
        retry,
      });

      await controller.start();
      controller.actions.refresh();

      expect(retry.setAttempts).toHaveBeenCalledWith("deploy-456", 1);
      expect(retry.replaceWithDeployment).toHaveBeenCalledWith("deploy-456");
      jest.runAllTimers();
      expect(retry.replaceWithDeployment).toHaveBeenCalledTimes(1);
    });

    it("cancels a pending replacement when disposed", async () => {
      const retry = makeRetryBoundaries();
      const controller = makeProductionController({
        loadDeploymentNotification: jest.fn().mockResolvedValue({
          deploymentId: "deploy-456",
          publishedAt: "2026-07-14T11:15:30.000Z",
        }),
        loadManifest: jest
          .fn()
          .mockResolvedValue({ deploymentId: "deploy-456" }),
        retry,
      });

      await controller.start();
      controller.dispose();
      jest.runAllTimers();

      expect(retry.replaceWithDeployment).not.toHaveBeenCalled();
    });

    it("does not automatically replace after three persisted attempts", async () => {
      const retry = makeRetryBoundaries({
        getAttempts: jest
          .fn()
          .mockImplementation((target) => (target === "deploy-456" ? 3 : 0)),
      });
      const controller = makeProductionController({
        loadDeploymentNotification: jest.fn().mockResolvedValue({
          deploymentId: "deploy-456",
          publishedAt: "2026-07-14T11:15:30.000Z",
        }),
        loadManifest: jest
          .fn()
          .mockResolvedValue({ deploymentId: "deploy-456" }),
        retry,
      });

      await controller.start();
      jest.runAllTimers();

      expect(retry.getAttempts).toHaveBeenCalledWith("deploy-456");
      expect(retry.replaceWithDeployment).not.toHaveBeenCalled();
    });

    it("keeps manual Refresh usable after the automatic budget is exhausted", async () => {
      const retry = makeRetryBoundaries({
        getAttempts: jest.fn().mockReturnValue(3),
      });
      const controller = makeProductionController({
        loadDeploymentNotification: jest.fn().mockResolvedValue({
          deploymentId: "deploy-456",
          publishedAt: "2026-07-14T11:15:30.000Z",
        }),
        loadManifest: jest
          .fn()
          .mockResolvedValue({ deploymentId: "deploy-456" }),
        retry,
      });

      await controller.start();
      controller.actions.refresh();

      expect(retry.setAttempts).toHaveBeenCalledWith("deploy-456", 4);
      expect(retry.replaceWithDeployment).toHaveBeenCalledWith("deploy-456");
    });
  });
});
