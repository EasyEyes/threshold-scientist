import { useRef, useState } from "react";
import {
  existsInUserResources,
  type NeededResource,
  type UserResources,
} from "../resources";
import type { EasyEyesError, PhraseSource } from "../validation";

interface Props {
  needed: NeededResource[];
  /**
   * The compiler's own missing-resource errors for this table (resources.ts
   * checkResources) — shown here as what a compile will report. They do not
   * gate the Fast compile button.
   */
  compilerErrors: EasyEyesError[];
  onJump: (paramName: string) => void;
  phrase: PhraseSource | null;
  files: File[];
  /** Files already in the user's EasyEyesResources (null when signed out). */
  userResources: UserResources | null;
  /** False while the compiler page is still fetching the resource lists. */
  resourcesLoaded: boolean;
  signedIn: boolean;
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (name: string) => void;
  onBrowseExisting: () => void;
}

/**
 * The anti-zip panel: the table itself tells the scientist which files the
 * experiment needs (found by the compiler's own resource discovery). Each one
 * is either already in their EasyEyesResources on Pavlovia (nothing to do),
 * dropped here, or still missing — in which case the compiler's own message
 * for it is shown below the list.
 */
export function ResourcePanel({
  needed,
  compilerErrors,
  onJump,
  phrase,
  files,
  userResources,
  resourcesLoaded,
  signedIn,
  onAddFiles,
  onRemoveFile,
  onBrowseExisting,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const have = new Set(files.map((f) => f.name));
  const referenced = new Set(needed.map((n) => n.filename));
  const extras = files.filter((f) => !referenced.has(f.name));
  const checkingRemote = signedIn && !resourcesLoaded;
  const statusOf = (n: NeededResource) =>
    have.has(n.filename)
      ? "local"
      : existsInUserResources(n, userResources)
      ? "remote"
      : "missing";
  const missingCount = needed.filter((n) => statusOf(n) === "missing").length;

  return (
    <div className="resource-panel">
      <div className="panel-title">
        Upload resources
        {needed.length > 0 && (
          <span className={`count-chip ${missingCount ? "warnings" : "ok"}`}>
            {needed.length - missingCount}/{needed.length} present
          </span>
        )}
      </div>
      {needed.length === 0 ? (
        <p className="panel-note">
          This table references no resource files (fonts with{" "}
          <code>fontSource=file</code>, consent/debrief forms, reading corpora,
          images, sound or image folders, phrase spreadsheets, …). Nothing to
          upload.
        </p>
      ) : (
        <ul className="resource-list">
          {needed.map((n) => {
            const status = statusOf(n);
            return (
              <li
                key={`${n.kind}:${n.filename}`}
                className={status === "missing" ? "missing" : "present"}
                title={
                  status === "remote"
                    ? "Already in your EasyEyesResources on Pavlovia — nothing to do"
                    : status === "local"
                    ? "Uploaded here"
                    : "Not found — drop the file below"
                }
              >
                <span className="resource-status">
                  {status === "missing" ? "•" : "✓"}
                </span>
                <span className="resource-name">{n.filename}</span>
                <span className="resource-kind">{n.params.join(", ")}</span>
              </li>
            );
          })}
        </ul>
      )}
      {needed.length > 0 && checkingRemote && (
        <p className="panel-note">
          Checking your EasyEyesResources on Pavlovia…
        </p>
      )}
      {compilerErrors.length > 0 && signedIn && resourcesLoaded && (
        <details className="compiler-will-say">
          <summary>
            What the compiler will report ({compilerErrors.length}) — you can
            still compile; drop the files to clear these
          </summary>
          <ul className="error-list">
            {compilerErrors.map((e, i) => (
              <li
                key={i}
                className="error-card warning"
                onClick={() => e.parameters[0] && onJump(e.parameters[0])}
                title={
                  e.parameters[0] ? "Click to jump to the parameter" : undefined
                }
              >
                <div className="error-name">⚠️ {e.name}</div>
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
        </details>
      )}
      {needed.length > 0 && !signedIn && (
        <p className="panel-note">
          Sign in on the Compiler tab to check these against the files you have
          already uploaded to EasyEyesResources.
        </p>
      )}
      {phrase && (
        <p className="panel-note phrase-note">
          ✓ <strong>{phrase.fileName}</strong>{" "}
          {phrase.origin === "resources"
            ? "read from your EasyEyesResources"
            : "loaded"}{" "}
          — ~tilde values resolve in{" "}
          {phrase.availableLanguageCodes.length} language
          {phrase.availableLanguageCodes.length !== 1 ? "s" : ""} (
          {phrase.availableLanguageCodes.join(", ")}).
        </p>
      )}
      <div
        className={`dropzone${dragOver ? " drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          onAddFiles(Array.from(e.dataTransfer.files));
        }}
        onClick={() => inputRef.current?.click()}
      >
        Drop resource files here, or click to browse
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>
      {files.length > 0 && (
        <ul className="uploaded-list">
          {files.map((f) => (
            <li key={f.name}>
              <span className="resource-name">{f.name}</span>
              {!referenced.has(f.name) && (
                <span className="resource-kind">
                  not referenced by the table
                </span>
              )}
              <button
                className="icon-btn"
                title="Remove"
                onClick={() => onRemoveFile(f.name)}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {extras.length > 0 && needed.length > 0 && (
        <p className="panel-note">
          Files not referenced by the table are still included in the exported
          source zip.
        </p>
      )}
      {signedIn && (
        <div className="panel-footer">
          <button
            className="link-button"
            onClick={onBrowseExisting}
            title="Browse the files already in your EasyEyesResources on Pavlovia"
          >
            Browse your existing files
          </button>
        </div>
      )}
    </div>
  );
}
