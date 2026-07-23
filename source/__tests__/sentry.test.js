jest.mock("@sentry/react", () => ({
  init: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

import * as Sentry from "@sentry/react";
import {
  captureCompilerFailure,
  finishCompilerOperation,
  getCurrentCompilerOperation,
  recordCompilerPhase,
  startCompilerOperation,
} from "../sentry";

describe("compiler Sentry observability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(global, "crypto", {
      configurable: true,
      value: { randomUUID: () => "operation-123" },
    });
  });

  it("keeps one operation context across compiler phases", () => {
    const context = startCompilerOperation("experiment-compilation", {
      fileSize: 123,
    });
    recordCompilerPhase(context, "preprocessing-started");

    expect(getCurrentCompilerOperation()).toBe(context);
    expect(Sentry.addBreadcrumb).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: "experiment-compilation.preprocessing-started",
        data: expect.objectContaining({ operationId: "operation-123" }),
      }),
    );
  });

  it("classifies failures and filters sensitive metadata", () => {
    const context = startCompilerOperation("pavlovia-upload");
    captureCompilerFailure(
      new Error("404 Tree Not Found"),
      context,
      "repository-tree-requested",
      { projectId: 533619, accessToken: "do-not-send" },
      "pavlovia-api",
    );

    expect(Sentry.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        tags: expect.objectContaining({
          "compiler.phase": "repository-tree-requested",
          "compiler.classification": "pavlovia-api",
        }),
        contexts: {
          compiler: expect.objectContaining({
            projectId: 533619,
            accessToken: "[Filtered]",
          }),
        },
      }),
    );
  });

  it("clears completed operations so uploads cannot reuse stale context", () => {
    const context = startCompilerOperation("experiment-compilation");

    finishCompilerOperation(context, "failed");

    expect(getCurrentCompilerOperation()).toBeNull();
  });
});
