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
        "Fresh. This page is up to date: Jul 14, 2026, 10:15 AM UTC+0.",
      ),
    ).toBeInTheDocument();
  });

  it("renders the exact development Fresh copy", async () => {
    render(<FreshnessStatus controller={makeController("development")} />);

    expect(screen.getByText("✅", { exact: true })).toBeInTheDocument();
    expect(
      screen.getByText("Fresh. The compiler is running in development mode."),
    ).toBeInTheDocument();
  });

  it("renders a newer content release date than the deployment date", async () => {
    const onPublicationDate = jest.fn();
    const controller = makeController("production", {
      loadContentPublicationDates: jest
        .fn()
        .mockResolvedValue(["2026-07-18T09:00:00.000Z", null]),
    });

    render(
      <FreshnessStatus
        controller={controller}
        onPublicationDate={onPublicationDate}
      />,
    );

    expect(
      await screen.findByText(
        "Fresh. This page is up to date: Jul 18, 2026, 9:00 AM UTC+0.",
      ),
    ).toBeInTheDocument();
    expect(onPublicationDate).toHaveBeenCalledWith("2026-07-18T09:00:00.000Z");
  });

  it("publishes a newer content date after a live notification", async () => {
    let notify;
    const onPublicationDate = jest.fn();
    const loadContentPublicationDates = jest
      .fn()
      .mockResolvedValueOnce(["2026-07-18T09:00:00.000Z"])
      .mockResolvedValueOnce(["2026-07-19T10:00:00.000Z"]);
    const controller = makeController("production", {
      loadContentPublicationDates,
      subscribeToDeploymentNotifications: (listener) => {
        notify = listener;
        return jest.fn();
      },
    });

    render(
      <FreshnessStatus
        controller={controller}
        onPublicationDate={onPublicationDate}
      />,
    );
    await screen.findByText(
      "Fresh. This page is up to date: Jul 18, 2026, 9:00 AM UTC+0.",
    );

    await act(async () => {
      notify(undefined);
      await Promise.resolve();
    });

    expect(onPublicationDate).toHaveBeenLastCalledWith(
      "2026-07-19T10:00:00.000Z",
    );
  });

  it("relaunches the stale compiler from a button", async () => {
    const controller = makeController("production", {
      loadDeploymentNotification: jest.fn().mockResolvedValue({
        deploymentId: "deploy-456",
        publishedAt: "2026-07-14T11:15:30.000Z",
      }),
      loadManifest: jest.fn().mockResolvedValue({ deploymentId: "deploy-456" }),
      retry: {
        getAttempts: jest.fn().mockReturnValue(0),
        setAttempts: jest.fn(),
        replaceWithDeployment: jest.fn(),
        schedule: jest.fn().mockReturnValue(1),
        cancelScheduled: jest.fn(),
      },
    });

    const reload = jest.fn();

    render(<FreshnessStatus controller={controller} reload={reload} />);
    const status = await screen.findByText("Relaunch to update EasyEyes", {
      exact: true,
    });
    expect(status.closest(".freshness-status")).toHaveTextContent(
      `Relaunch to update EasyEyes to ${controller.getState().publishedAtUtc}.`,
    );
    expect(screen.getByText("⚠️", { exact: true })).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Relaunch to update EasyEyes" }),
    );
    expect(reload).toHaveBeenCalledTimes(1);
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
      "Fresh. This page is up to date: Jul 14, 2026, 10:15 AM UTC+0.",
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

  it("offers a relaunch without a version date after refreshes are exhausted", async () => {
    const controller = makeController("production", {
      loadDeploymentNotification: jest.fn().mockResolvedValue({
        deploymentId: "deploy-456",
        publishedAt: "2026-07-14T11:15:30.000Z",
      }),
      loadManifest: jest.fn().mockResolvedValue({ deploymentId: "deploy-456" }),
      retry: {
        getAttempts: jest.fn().mockReturnValue(3),
        setAttempts: jest.fn(),
        replaceWithDeployment: jest.fn(),
        schedule: jest.fn(),
        cancelScheduled: jest.fn(),
      },
    });

    const reload = jest.fn();

    render(<FreshnessStatus controller={controller} reload={reload} />);

    const button = await screen.findByRole("button", {
      name: "Relaunch to update EasyEyes",
    });
    expect(button.closest(".freshness-status")).toHaveTextContent(
      "⚠️Relaunch to update EasyEyes",
    );
    expect(screen.getByText("⚠️", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText(/This page is stale/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Jul 14, 2026/)).not.toBeInTheDocument();

    fireEvent.click(button);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
