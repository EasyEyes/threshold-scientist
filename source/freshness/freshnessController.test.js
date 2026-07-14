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
      "a mismatching manifest",
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
});
