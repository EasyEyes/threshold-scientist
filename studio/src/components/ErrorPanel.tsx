import type { EasyEyesError } from "../validation";

interface Props {
  errors: EasyEyesError[];
  onJump: (paramName: string) => void;
}

/**
 * Renders the compiler's own error objects — message and hint are the
 * exact HTML the production compiler shows after upload, except here they
 * appear while typing.
 */
export function ErrorPanel({ errors, onJump }: Props) {
  const errorCount = errors.filter((e) => e.kind === "error").length;
  const warningCount = errors.filter((e) => e.kind === "warning").length;

  if (errors.length === 0) {
    return (
      <div className="all-clear">
        <div className="all-clear-mark">✓</div>
        <div>
          <strong>No problems.</strong>
          <div className="all-clear-sub">
            This table passes every compiler check — it would compile.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="error-panel">
      <div className="error-summary">
        {errorCount > 0 && (
          <span className="count-chip errors">{errorCount} error{errorCount !== 1 ? "s" : ""}</span>
        )}
        {warningCount > 0 && (
          <span className="count-chip warnings">
            {warningCount} warning{warningCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <ul className="error-list">
        {errors.map((e, i) => (
          <li
            key={i}
            className={`error-card ${e.kind}`}
            onClick={() => e.parameters[0] && onJump(e.parameters[0])}
            title={e.parameters[0] ? "Click to jump to the parameter" : undefined}
          >
            <div className="error-name">
              {e.kind === "error" ? "⛔" : "⚠️"} {e.name}
            </div>
            <div
              className="error-message"
              dangerouslySetInnerHTML={{ __html: e.message }}
            />
            {e.hint && (
              <div className="error-hint">
                <span className="hint-label">HINT</span>
                <span dangerouslySetInnerHTML={{ __html: e.hint }} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
