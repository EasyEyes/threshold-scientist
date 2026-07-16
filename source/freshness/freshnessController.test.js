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

const makeReportingBoundaries = (overrides = {}) => {
  const reportedTargets = new Set();
  return {
    hasReported: jest.fn((target) => reportedTargets.has(target)),
    markReported: jest.fn((target) => reportedTargets.add(target)),
    addFailedAttemptBreadcrumb: jest.fn(),
    reportExhaustedRefreshes: jest.fn(),
    ...overrides,
  };
};

const flushAsyncChecks = () => new Promise((resolve) => setTimeout(resolve, 0));

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
    ["missing", jest.fn().mockResolvedValue(null)],
    ["unavailable", jest.fn().mockRejectedValue(new Error("offline"))],
    [
      "for another deployment",
      jest.fn().mockResolvedValue({
        deploymentId: "production-deploy",
        publishedAt: "2026-07-14T10:15:30.000Z",
      }),
    ],
  ])(
    "publishes Fresh without a timestamp when the notification is %s",
    async (_label, loadDeploymentNotification) => {
      const controller = makeProductionController({
        loadDeploymentNotification,
      });

      await controller.start();

      expect(controller.getState()).toEqual({
        status: "fresh",
        message: "Fresh. This page is up to date.",
      });
    },
  );

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
      message: "Fresh. The compiler is running in development mode.",
    });
    await controller.start();
    await controller.actions.check();

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

  it("rechecks the manifest for deployment notifications and unsubscribes on disposal", async () => {
    let notify;
    const unsubscribeNotifications = jest.fn();
    const subscribeToDeploymentNotifications = jest.fn((listener) => {
      notify = listener;
      return unsubscribeNotifications;
    });
    const loadManifest = jest
      .fn()
      .mockResolvedValue({ deploymentId: "deploy-123" });
    const controller = makeProductionController({
      loadManifest,
      subscribeToDeploymentNotifications,
    });

    await controller.start();
    notify({
      deploymentId: "deploy-123",
      publishedAt: "2026-07-14T12:15:30.000Z",
    });
    await flushAsyncChecks();

    expect(loadManifest).toHaveBeenCalledTimes(2);
    expect(controller.getState()).toEqual({
      status: "fresh",
      message: "Fresh. This page is up to date: Jul 14, 2026, 12:15:30 PM UTC.",
    });

    controller.dispose();
    expect(unsubscribeNotifications).toHaveBeenCalledTimes(1);
  });

  it("rechecks after returning to visible and removes the visibility listener", async () => {
    let returnToVisible;
    const unsubscribeVisibility = jest.fn();
    const subscribeToVisibility = jest.fn((listener) => {
      returnToVisible = listener;
      return unsubscribeVisibility;
    });
    const loadManifest = jest
      .fn()
      .mockResolvedValue({ deploymentId: "deploy-123" });
    const controller = makeProductionController({
      loadManifest,
      subscribeToVisibility,
    });

    await controller.start();
    returnToVisible();
    await flushAsyncChecks();

    expect(loadManifest).toHaveBeenCalledTimes(2);

    controller.dispose();
    expect(unsubscribeVisibility).toHaveBeenCalledTimes(1);
  });

  it("ignores an older check that completes after a newer notification check", async () => {
    let notify;
    let resolveInitialManifest;
    const loadManifest = jest
      .fn()
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveInitialManifest = resolve;
        }),
      )
      .mockResolvedValueOnce({ deploymentId: "deploy-456" });
    const controller = makeProductionController({
      loadManifest,
      subscribeToDeploymentNotifications: (listener) => {
        notify = listener;
        return jest.fn();
      },
    });

    const initialCheck = controller.start();
    notify({
      deploymentId: "deploy-456",
      publishedAt: "2026-07-14T12:15:30.000Z",
    });
    await flushAsyncChecks();

    expect(controller.getState()).toEqual({
      status: "stale",
      publishedAtUtc: "Jul 14, 2026, 12:15:30 PM UTC",
    });

    resolveInitialManifest({ deploymentId: "deploy-123" });
    await initialCheck;

    expect(controller.getState()).toEqual({
      status: "stale",
      publishedAtUtc: "Jul 14, 2026, 12:15:30 PM UTC",
    });
  });

  it("uses the manifest deployment when a notification disagrees", async () => {
    let notify;
    const retry = makeRetryBoundaries({
      schedule: jest.fn((callback) => {
        callback();
        return 1;
      }),
    });
    const controller = makeProductionController({
      loadManifest: jest
        .fn()
        .mockResolvedValueOnce({ deploymentId: "deploy-123" })
        .mockResolvedValueOnce({ deploymentId: "deploy-456" }),
      subscribeToDeploymentNotifications: (listener) => {
        notify = listener;
        return jest.fn();
      },
      retry,
    });

    await controller.start();
    notify({
      deploymentId: "deploy-789",
      publishedAt: "2026-07-14T12:15:30.000Z",
    });
    await flushAsyncChecks();

    expect(retry.replaceWithDeployment).toHaveBeenCalledWith("deploy-456");
    expect(retry.replaceWithDeployment).not.toHaveBeenCalledWith("deploy-789");
  });

  it("does not react to notification data before manifest verification", async () => {
    let notify;
    let resolveManifest;
    const retry = makeRetryBoundaries({
      schedule: jest.fn().mockReturnValue(1),
      cancelScheduled: jest.fn(),
    });
    const controller = makeProductionController({
      loadManifest: jest
        .fn()
        .mockResolvedValueOnce({ deploymentId: "deploy-123" })
        .mockReturnValueOnce(
          new Promise((resolve) => {
            resolveManifest = resolve;
          }),
        ),
      subscribeToDeploymentNotifications: (listener) => {
        notify = listener;
        return jest.fn();
      },
      retry,
    });

    await controller.start();
    const verifiedState = controller.getState();
    notify({
      deploymentId: "deploy-456",
      publishedAt: "2026-07-14T12:15:30.000Z",
    });
    await Promise.resolve();

    expect(controller.getState()).toBe(verifiedState);
    expect(retry.schedule).not.toHaveBeenCalled();
    expect(retry.replaceWithDeployment).not.toHaveBeenCalled();

    resolveManifest({ deploymentId: "deploy-456" });
    await flushAsyncChecks();
    expect(controller.getState().status).toBe("stale");
  });

  it("publishes Fresh and cancels recovery when the manifest returns to the running deployment", async () => {
    let notify;
    const retry = makeRetryBoundaries({
      schedule: jest.fn().mockReturnValue(1),
      cancelScheduled: jest.fn(),
    });
    const controller = makeProductionController({
      loadManifest: jest
        .fn()
        .mockResolvedValueOnce({ deploymentId: "deploy-456" })
        .mockResolvedValueOnce({ deploymentId: "deploy-123" }),
      loadDeploymentNotification: jest.fn().mockResolvedValue({
        deploymentId: "deploy-456",
        publishedAt: "2026-07-14T12:15:30.000Z",
      }),
      subscribeToDeploymentNotifications: (listener) => {
        notify = listener;
        return jest.fn();
      },
      retry,
    });

    await controller.start();
    notify({
      deploymentId: "deploy-456",
      publishedAt: "2026-07-14T12:15:30.000Z",
    });
    await flushAsyncChecks();

    expect(retry.cancelScheduled).toHaveBeenCalledWith(1);
    controller.actions.refresh();
    expect(retry.replaceWithDeployment).not.toHaveBeenCalled();
    expect(controller.getState()).toEqual({
      status: "fresh",
      message: "Fresh. This page is up to date.",
    });
  });

  it("installs lifecycle subscriptions only once", async () => {
    const subscribeToDeploymentNotifications = jest.fn(() => jest.fn());
    const subscribeToVisibility = jest.fn(() => jest.fn());
    const controller = makeProductionController({
      subscribeToDeploymentNotifications,
      subscribeToVisibility,
    });

    await controller.start();
    await controller.start();

    expect(subscribeToDeploymentNotifications).toHaveBeenCalledTimes(1);
    expect(subscribeToVisibility).toHaveBeenCalledTimes(1);
  });

  it("keeps duplicate and delayed notifications scoped to the manifest target", async () => {
    let notify;
    let nextTimer = 0;
    const scheduled = new Map();
    const retry = makeRetryBoundaries({
      schedule: jest.fn((callback) => {
        nextTimer += 1;
        scheduled.set(nextTimer, callback);
        return nextTimer;
      }),
      cancelScheduled: jest.fn((timer) => scheduled.delete(timer)),
    });
    const controller = makeProductionController({
      loadManifest: jest
        .fn()
        .mockResolvedValueOnce({ deploymentId: "deploy-123" })
        .mockResolvedValue({ deploymentId: "deploy-456" }),
      subscribeToDeploymentNotifications: (listener) => {
        notify = listener;
        return jest.fn();
      },
      retry,
    });

    await controller.start();
    const currentNotification = {
      deploymentId: "deploy-456",
      publishedAt: "2026-07-14T12:15:30.000Z",
    };
    notify(currentNotification);
    await flushAsyncChecks();
    notify(currentNotification);
    notify({
      deploymentId: "deploy-delayed",
      publishedAt: "2026-07-14T11:15:30.000Z",
    });
    await flushAsyncChecks();

    scheduled.forEach((callback) => callback());
    expect(retry.replaceWithDeployment).toHaveBeenCalledTimes(1);
    expect(retry.replaceWithDeployment).toHaveBeenCalledWith("deploy-456");
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

    it("publishes terminal diagnostics and reports the three failed attempts once per target", async () => {
      const retry = makeRetryBoundaries({
        getAttempts: jest
          .fn()
          .mockImplementation((target) => (target === "deploy-456" ? 3 : 0)),
      });
      const reporting = makeReportingBoundaries();
      const controller = makeProductionController({
        loadDeploymentNotification: jest.fn().mockResolvedValue({
          deploymentId: "deploy-456",
          publishedAt: "2026-07-14T11:15:30.000Z",
        }),
        loadManifest: jest
          .fn()
          .mockResolvedValue({ deploymentId: "deploy-456" }),
        retry,
        reporting,
      });

      await controller.start();
      await controller.actions.check();

      expect(controller.getState()).toEqual({
        status: "error",
        runningDeploymentId: "deploy-123",
        liveDeploymentId: "deploy-456",
        publishedAtUtc: "Jul 14, 2026, 11:15:30 AM UTC",
        retryCount: 3,
      });
      expect(reporting.addFailedAttemptBreadcrumb.mock.calls).toEqual([
        [
          expect.objectContaining({
            retryCount: 1,
            liveDeploymentId: "deploy-456",
          }),
        ],
        [
          expect.objectContaining({
            retryCount: 2,
            liveDeploymentId: "deploy-456",
          }),
        ],
        [
          expect.objectContaining({
            retryCount: 3,
            liveDeploymentId: "deploy-456",
          }),
        ],
      ]);
      expect(reporting.reportExhaustedRefreshes).toHaveBeenCalledTimes(1);
      expect(reporting.reportExhaustedRefreshes).toHaveBeenCalledWith({
        runningDeploymentId: "deploy-123",
        liveDeploymentId: "deploy-456",
        publishedAt: "2026-07-14T11:15:30.000Z",
        retryCount: 3,
      });
      expect(reporting.markReported).toHaveBeenCalledWith("deploy-456");
    });

    it("deduplicates the terminal report but still enters the recoverable error state", async () => {
      const reporting = makeReportingBoundaries({
        hasReported: jest.fn().mockReturnValue(true),
      });
      const controller = makeProductionController({
        loadDeploymentNotification: jest.fn().mockResolvedValue({
          deploymentId: "deploy-456",
          publishedAt: "2026-07-14T11:15:30.000Z",
        }),
        loadManifest: jest
          .fn()
          .mockResolvedValue({ deploymentId: "deploy-456" }),
        retry: makeRetryBoundaries({
          getAttempts: jest.fn().mockReturnValue(3),
        }),
        reporting,
      });

      await controller.start();

      expect(controller.getState().status).toBe("error");
      expect(reporting.addFailedAttemptBreadcrumb).not.toHaveBeenCalled();
      expect(reporting.reportExhaustedRefreshes).not.toHaveBeenCalled();
      expect(reporting.markReported).not.toHaveBeenCalled();
    });
  });
});
