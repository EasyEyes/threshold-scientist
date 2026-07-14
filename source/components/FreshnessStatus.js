import React, { useEffect, useState } from "react";

import { createBrowserFreshnessController } from "../freshness/browserFreshnessAdapters";

const FreshnessStatus = ({ controller: suppliedController }) => {
  const [controller] = useState(
    () => suppliedController || createBrowserFreshnessController(),
  );
  const [freshness, setFreshness] = useState(controller.getState());

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
      {freshness.status === "stale" ? (
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
