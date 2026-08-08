import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Swal from "sweetalert2";
import FreshnessStatus from "../components/FreshnessStatus";
import { createFreshnessController } from "../freshness/freshnessController";

jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
}));

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

  it("renders Refresh as part of the stale text rather than a button", async () => {
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

    render(<FreshnessStatus controller={controller} />);
    const status = await screen.findByText("Stale.", { exact: false });
    expect(status.closest(".freshness-status")).toHaveTextContent(
      "Stale. Refresh ↻ to update this page to Jul 14, 2026, 11:15 AM UTC+0.",
    );
    expect(screen.getByText("⚠️", { exact: true })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Refresh ↻" }),
    ).not.toBeInTheDocument();
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

  it("opens the exhausted-refresh information through Question", async () => {
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

    render(<FreshnessStatus controller={controller} />);

    expect(
      await screen.findByText("This page is stale and shouldn't be."),
    ).toBeInTheDocument();
    expect(screen.getByText("❌", { exact: true })).toBeInTheDocument();
    fireEvent.click(document.querySelector(".freshness-status .icon-holder"));

    expect(Swal.fire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Compiler freshness problem",
        html: expect.stringContaining("deploy-123"),
      }),
    );
    const { html } = Swal.fire.mock.calls[0][0];
    expect(html).toContain("deploy-456");
    expect(html).toContain("Jul 14, 2026, 11:15 AM UTC+0");
    expect(html).toContain("Close all compiler tabs");
    expect(html).toContain("clear site data and cached files");
    expect(html).toContain("reopen the compiler");
    expect(html).toContain("sign you out of Pavlovia");
    expect(html).toContain("remove locally stored compiler settings");
  });
});
