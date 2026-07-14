import React from "react";
import { act, render, screen } from "@testing-library/react";
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
});
