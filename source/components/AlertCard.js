import React, { useId } from "react";
import { linkGlossaryParameters } from "../../threshold/parameters/glossaryLink";
import ParameterList from "./ParameterList";
import "../css/AlertCard.scss";

const displayName = ({ kind, name }) => {
  if (kind === "warning") return `⚠️ ${name.replace(/^(?:⚠️\s*)+/u, "")}`;
  return name;
};

const presentationFor = (kind) =>
  ({
    error: { role: "alert", label: "error" },
    warning: { role: "region", label: "warning" },
    correct: { role: "status", label: "success" },
  })[kind] ?? { role: "region", label: "alert" };

/** The single presentation for EasyEyes errors, warnings, and successes.
 * @param {{
 *   alert: {
 *     kind: string,
 *     context?: string,
 *     name: string,
 *     message?: string,
 *     hint?: string,
 *     parameters?: string[]
 *   },
 *   as?: string,
 *   headingLevel?: number,
 *   onClose?: () => void,
 *   onParameter?: (name: string) => void
 * }} props
 */
export default function AlertCard({
  alert,
  as: Tag = "div",
  headingLevel = 2,
  onClose,
  onParameter,
}) {
  const { kind, message, hint, parameters = [] } = alert;
  const { role, label } = presentationFor(kind);
  const onClick =
    onParameter && parameters[0] ? () => onParameter(parameters[0]) : undefined;
  const Heading = `h${headingLevel}`;
  const headingId = useId();
  return (
    <Tag
      className={`alert-card alert-card-${kind}${
        onClick ? " alert-card-actionable" : ""
      }`}
      role={role}
      aria-labelledby={headingId}
      onClick={(event) => {
        if (!event.target.closest("a, button")) onClick?.();
      }}
      title={onClick ? "Jump to the parameter" : undefined}
    >
      <div className="alert-flex">
        <Heading className="alert-heading" id={headingId}>
          {onClick ? (
            <button
              type="button"
              className={`alert-name alert-name-${kind} alert-name-action`}
              onClick={(event) => {
                event.stopPropagation();
                onClick();
              }}
            >
              {displayName(alert)}
            </button>
          ) : (
            <span className={`alert-name alert-name-${kind}`}>
              {displayName(alert)}
            </span>
          )}
        </Heading>
        {onClose && (
          <button
            type="button"
            className="alert-close"
            aria-label={`Dismiss ${label} message`}
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
          >
            <i className="bi bi-x" aria-hidden="true"></i>
          </button>
        )}
      </div>
      {message && (
        <div
          className="alert-message"
          dangerouslySetInnerHTML={{
            __html: linkGlossaryParameters(message),
          }}
        ></div>
      )}
      {hint && (
        <div className="alert-hint">
          <span className="alert-hint-prefix">HINT </span>
          <div
            className="alert-hint-content"
            dangerouslySetInnerHTML={{
              __html: linkGlossaryParameters(hint),
            }}
          ></div>
        </div>
      )}
      {parameters.length ? (
        <ParameterList parameters={parameters} onParameter={onParameter} />
      ) : null}
    </Tag>
  );
}
