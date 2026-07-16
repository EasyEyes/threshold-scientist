import React, { useEffect, useState } from "react";

import { createBrowserFreshnessController } from "../freshness/browserFreshnessAdapters";
import { Question } from "../components";

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

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
      {freshness.status === "error" ? (
        <>
          <span aria-hidden="true">❌</span>
          <span>This page is stale and shouldn't be.</span>{" "}
          <Question
            title="Compiler freshness problem"
            text={`
              <p>This compiler is running deployment ${escapeHtml(
                freshness.runningDeploymentId,
              )}, but deployment ${escapeHtml(
                freshness.liveDeploymentId,
              )} was published at ${escapeHtml(freshness.publishedAtUtc)}.</p>
              <p>Close all compiler tabs, clear site data and cached files for the EasyEyes origin, then reopen the compiler.</p>
              <p>Clearing site data may sign you out of Pavlovia and remove locally stored compiler settings.</p>
            `}
          />
        </>
      ) : freshness.status === "stale" ? (
        <>
          <span aria-hidden="true">⚠️</span>
          <span>
            Stale. Refresh ↻ to update this page to {freshness.publishedAtUtc}.
          </span>
        </>
      ) : (
        <span>{freshness.message}</span>
      )}
    </div>
  );
};

export default FreshnessStatus;
