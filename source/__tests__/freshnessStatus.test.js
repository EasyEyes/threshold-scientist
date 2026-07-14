import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import FreshnessStatus from "../components/FreshnessStatus";
import { createFreshnessController } from "../freshness/freshnessController";

const makeController = (mode = "production", overrides = {}) =>
  createFreshnessController({
    mode,
    runningDeploymentId: mode === "production" ? "deploy-123" : null,
    loadDeploymentNotification: jest.fn().mockResolvedValue({
      deploymentId: "deploy-123",
      publishedAt: "2026-07-14T10:15:30.000Z",
    }),
    loadManifest: jest.fn().mockResolvedValue({ deploymentId: "deploy-123" }),
    ...overrides,
  });

describe("FreshnessStatus", () => {
  it("renders Checking then the exact production Fresh copy and check symbol", async () => {
    let resolveManifest;
    const manifest = new Promise((resolve) => {
      resolveManifest = resolve;
    });
    const controller = makeController("production", {
      loadManifest: jest.fn().mockReturnValue(manifest),
    });

    render(<FreshnessStatus controller={controller} />);
    expect(
      screen.getByText("Checking compiler freshness..."),
    ).toBeInTheDocument();

    await act(async () => {
      resolveManifest({ deploymentId: "deploy-123" });
      await manifest;
    });

    expect(screen.getByText("✅", { exact: true })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Fresh. This page is up to date: Jul 14, 2026, 10:15:30 AM UTC.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the exact development Fresh copy", async () => {
    render(<FreshnessStatus controller={makeController("development")} />);

    expect(screen.getByText("✅", { exact: true })).toBeInTheDocument();
    expect(
      screen.getByText("Fresh. This compiler is running in development mode."),
    ).toBeInTheDocument();
  });

  it("renders the stale warning and invokes the Refresh action", async () => {
    const refresh = jest.fn();
    const controller = makeController("production", {
      loadDeploymentNotification: jest.fn().mockResolvedValue({
        deploymentId: "deploy-456",
        publishedAt: "2026-07-14T11:15:30.000Z",
      }),
      loadManifest: jest.fn().mockResolvedValue({ deploymentId: "deploy-456" }),
      retry: {
        getAttempts: jest.fn().mockReturnValue(0),
        setAttempts: jest.fn(),
        replaceWithDeployment: refresh,
        schedule: jest.fn().mockReturnValue(1),
        cancelScheduled: jest.fn(),
      },
    });

    render(<FreshnessStatus controller={controller} />);
    const status = await screen.findByText("Stale.", { exact: false });
    expect(status.closest(".freshness-status")).toHaveTextContent(
      "Stale. Refresh ↻ to update this page to Jul 14, 2026, 11:15:30 AM UTC.",
    );
    expect(screen.getByText("⚠️", { exact: true })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Refresh ↻" }));
    expect(refresh).toHaveBeenCalledWith("deploy-456");
  });

  it("does not update state or navigate after unmount", async () => {
    let notify;
    let resolveManifest;
    const retry = {
      getAttempts: jest.fn().mockReturnValue(0),
      setAttempts: jest.fn(),
      replaceWithDeployment: jest.fn(),
      schedule: jest.fn().mockReturnValue(1),
      cancelScheduled: jest.fn(),
    };
    const controller = makeController("production", {
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
    const view = render(<FreshnessStatus controller={controller} />);
    await screen.findByText(
      "Fresh. This page is up to date: Jul 14, 2026, 10:15:30 AM UTC.",
    );

    notify({
      deploymentId: "deploy-456",
      publishedAt: "2026-07-14T11:15:30.000Z",
    });
    const stateBeforeUnmount = controller.getState();
    view.unmount();
    resolveManifest({ deploymentId: "deploy-456" });
    await act(async () => {
      await Promise.resolve();
    });

    expect(controller.getState()).toBe(stateBeforeUnmount);
    expect(retry.schedule).not.toHaveBeenCalled();
    expect(retry.replaceWithDeployment).not.toHaveBeenCalled();
  });
});
