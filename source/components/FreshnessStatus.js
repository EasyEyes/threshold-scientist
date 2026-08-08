import React, { useEffect, useState } from "react";

import { createBrowserFreshnessController } from "../freshness/browserFreshnessAdapters";

const FreshnessStatus = ({
  controller: suppliedController,
  onPublicationDate,
  reload = () => window.location.reload(),
}) => {
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

  useEffect(() => {
    const publishedAt = controller.getPublishedAt();
    if (publishedAt) onPublicationDate?.(publishedAt);
  }, [controller, freshness, onPublicationDate]);

  return (
    <div className="freshness-status" data-status={freshness.status}>
      {freshness.status === "fresh" && <span aria-hidden="true">✅</span>}
      {freshness.status === "stale" || freshness.status === "error" ? (
        <>
          <span aria-hidden="true">⚠️</span>
          <span>
            <button type="button" onClick={reload}>
              Relaunch to update EasyEyes
            </button>
            {freshness.status === "stale" && (
              <> to {freshness.publishedAtUtc}.</>
            )}
          </span>
        </>
      ) : (
        <span>{freshness.message}</span>
      )}
    </div>
  );
};

export default FreshnessStatus;
