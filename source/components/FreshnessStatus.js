import React, { useEffect, useState } from "react";

import { createBrowserFreshnessController } from "../freshness/browserFreshnessAdapters";

const FreshnessStatus = ({ controller: suppliedController }) => {
  const [controller] = useState(
    () => suppliedController || createBrowserFreshnessController(),
  );
  const [freshness, setFreshness] = useState(controller.getState());
  const [showInformation, setShowInformation] = useState(false);

  useEffect(() => {
    const unsubscribe = controller.subscribe(setFreshness);
    void controller.start();
    return () => {
      unsubscribe();
      controller.dispose();
    };
  }, [controller]);

  return (
    <div className="freshness-status" data-status={freshness.status}>
      {freshness.status === "fresh" && <span aria-hidden="true">✅</span>}
      {freshness.status === "error" ? (
        <>
          <span aria-hidden="true">❌</span>
          <span>This page is stale and shouldn't be.</span>{" "}
          <button
            type="button"
            aria-label="More information"
            onClick={() => setShowInformation(true)}
          >
            ℹ️
          </button>
          {showInformation && (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Compiler freshness problem"
            >
              <p>
                This compiler is running deployment{" "}
                {freshness.runningDeploymentId}, but deployment{" "}
                {freshness.liveDeploymentId} was published at{" "}
                {freshness.publishedAtUtc}.
              </p>
              <p>
                Close all compiler tabs, clear site data and cached files for
                the EasyEyes origin, then reopen the compiler.
              </p>
              <p>
                Clearing site data may sign you out of Pavlovia and remove
                locally stored compiler settings.
              </p>
              <button type="button" onClick={controller.actions.refresh}>
                Try refreshing again
              </button>{" "}
              <button type="button" onClick={() => setShowInformation(false)}>
                Close
              </button>
            </div>
          )}
        </>
      ) : freshness.status === "stale" ? (
        <>
          <span aria-hidden="true">⚠️</span>
          <span>
            Stale.{" "}
            <button type="button" onClick={controller.actions.refresh}>
              Refresh ↻
            </button>{" "}
            to update this page to {freshness.publishedAtUtc}.
          </span>
        </>
      ) : (
        <span>{freshness.message}</span>
      )}
    </div>
  );
};

export default FreshnessStatus;
