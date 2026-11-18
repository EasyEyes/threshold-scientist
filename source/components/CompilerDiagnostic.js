import React, { useId } from "react";
import { linkGlossaryParameters } from "../../threshold/parameters/glossaryLink";
import ParameterList from "./ParameterList";
import "../css/CompilerDiagnostic.scss";

const displayName = ({ kind, name }) => {
  if (kind === "warning") return `⚠️ ${name.replace(/^(?:⚠️\s*)+/u, "")}`;
  return name;
};

const presentationFor = (kind) =>
  ({
    error: { role: "alert", label: "error" },
    warning: { role: "region", label: "warning" },
    correct: { role: "status", label: "success" },
  })[kind] ?? { role: "region", label: "diagnostic" };

/**
 * The single presentation for compiler errors, warnings, and success messages.
 * @param {{
 *   diagnostic: {
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
 *   onClick?: (event: any) => void,
 *   title?: string
 * }} props
 */
export default function CompilerDiagnostic({
  diagnostic,
  as: Tag = "div",
  headingLevel = 2,
  onClose,
  onClick,
  title,
}) {
  const { kind, message, hint, parameters = [] } = diagnostic;
  const { role, label } = presentationFor(kind);
  const Heading = `h${headingLevel}`;
  const headingId = useId();
  return (
    <Tag
      className={`compiler-diagnostic compiler-diagnostic-${kind}${
        onClick ? " compiler-diagnostic-actionable" : ""
      }`}
      role={role}
      aria-labelledby={headingId}
      onClick={(event) => {
        if (!event.target.closest("a, button")) onClick?.(event);
      }}
      title={title}
    >
      {parameters.length ? <ParameterList parameters={parameters} /> : null}
      <div className="error-flex">
        <Heading className="error-heading" id={headingId}>
          {onClick ? (
            <button
              type="button"
              className={`error-name error-name-${kind} error-name-action`}
              onClick={(event) => {
                event.stopPropagation();
                onClick(event);
              }}
            >
              {displayName(diagnostic)}
            </button>
          ) : (
            <span className={`error-name error-name-${kind}`}>
              {displayName(diagnostic)}
            </span>
          )}
        </Heading>
        {onClose && (
          <button
            type="button"
            className="error-close"
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
        <p
          className="error-message"
          dangerouslySetInnerHTML={{
            __html: linkGlossaryParameters(message),
          }}
        ></p>
      )}
      {hint && (
        <p className="error-hint">
          <span className="error-hint-prefix">HINT: </span>
          <span
            dangerouslySetInnerHTML={{
              __html: linkGlossaryParameters(hint),
            }}
          ></span>
        </p>
      )}
    </Tag>
  );
}
