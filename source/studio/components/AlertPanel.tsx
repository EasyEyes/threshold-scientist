import React from "react";
import type { Alert } from "../validation";
import { makeAlert } from "../../../threshold/preprocess/alerts";
import AlertCard from "../../components/AlertCard";

interface Props {
  alerts: Alert[];
  onJump: (paramName: string) => void;
}

const allClear = makeAlert({
  kind: "correct",
  name: "No problems",
  message: "This table passes every compiler check — it would compile.",
});

/** Live compiler alerts, using exactly the production compiler's HTML. */
export function AlertPanel({ alerts, onJump }: Props) {
  const errorCount = alerts.filter((alert) => alert.kind === "error").length;
  const warningCount = alerts.filter(
    (alert) => alert.kind === "warning",
  ).length;

  if (alerts.length === 0) return <AlertCard alert={allClear} />;

  return (
    <div className="alert-panel">
      <div className="alert-summary">
        {errorCount > 0 && (
          <span className="count-chip errors">
            {errorCount} error{errorCount !== 1 ? "s" : ""}
          </span>
        )}
        {warningCount > 0 && (
          <span className="count-chip warnings">
            {warningCount} warning{warningCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <ul className="alert-list">
        {alerts.map((alert, index) => (
          <AlertCard
            key={index}
            as="li"
            headingLevel={3}
            alert={alert}
            onParameter={onJump}
          />
        ))}
      </ul>
    </div>
  );
}
