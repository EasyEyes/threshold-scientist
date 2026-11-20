import React, { useRef, useState } from "react";
import {
  resourceTypeLabel,
  userResourceStatus,
  type NeededResource,
} from "../resources";
import {
  failedResourceTypes,
  resourceCatalogHasSettled,
  type ResourceCatalog,
} from "../../../threshold/preprocess/resourceCatalog";
import type { Alert, PhraseSource } from "../validation";
import AlertCard from "../../components/AlertCard";

interface Props {
  needed: NeededResource[];
  /**
   * The compiler's own missing-resource errors for this table (resources.ts
   * checkResources) — shown here as what a compile will report. They do not
   * gate the Fast compile button.
   */
  compilerErrors: Alert[];
  onJump: (paramName: string) => void;
  phrase: PhraseSource | null;
  files: File[];
  /** EasyEyesResources listing states (idle when signed out). */
  resourceCatalog: ResourceCatalog;
  onRetryResources?: () => void;
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
  resourceCatalog,
  onRetryResources,
  signedIn,
  onAddFiles,
  onRemoveFile,
  onBrowseExisting,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const localNames = files.map((f) => f.name);
  const referenced = new Set(needed.map((n) => n.filename));
  const extras = files.filter((f) => !referenced.has(f.name));
  const checkingRemote =
    signedIn && !resourceCatalogHasSettled(resourceCatalog);
  const unavailableTypes = failedResourceTypes(resourceCatalog);
  const statusOf = (n: NeededResource) =>
    userResourceStatus(n, resourceCatalog, localNames);
  const missingCount = needed.filter((n) => statusOf(n) === "missing").length;
  const unverifiedCount = needed.filter(
    (n) => statusOf(n) === "unverified",
  ).length;
  const statusGlyph = {
    local: "✓",
    remote: "✓",
    missing: "•",
    unverified: "?",
  };

  return (
    <div className="resource-panel">
      <div className="panel-title">
        Upload resources
        {needed.length > 0 && (
          <span
            className={`count-chip ${
              missingCount + unverifiedCount ? "warnings" : "ok"
            }`}
          >
            {needed.length - missingCount - unverifiedCount}/{needed.length}{" "}
            present
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
                className={
                  status === "local" || status === "remote" ? "present" : status
                }
                title={
                  status === "remote"
                    ? "Already in your EasyEyesResources on Pavlovia — nothing to do"
                    : status === "local"
                    ? "Uploaded here"
                    : status === "unverified"
                    ? "The resource list is unavailable, so presence cannot be verified"
                    : "Not found — drop the file below"
                }
              >
                <span className="resource-status">{statusGlyph[status]}</span>
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
      {unverifiedCount > 0 && !checkingRemote && (
        <p className="panel-note">
          {unverifiedCount} resource{unverifiedCount === 1 ? "" : "s"} cannot be
          verified until the resource list is available.
        </p>
      )}
      {compilerErrors.length > 0 &&
        signedIn &&
        resourceCatalogHasSettled(resourceCatalog) && (
          <details className="compiler-will-say">
            <summary>
              What the compiler will report ({compilerErrors.length}) — you can
              still compile; drop the files to clear these
            </summary>
            <ul className="alert-list">
              {compilerErrors.map((e, i) => (
                <AlertCard
                  key={i}
                  as="li"
                  headingLevel={3}
                  alert={e}
                  onParameter={onJump}
                />
              ))}
            </ul>
          </details>
        )}
      {signedIn && unavailableTypes.length > 0 && (
        <p className="panel-note">
          Couldn’t load {unavailableTypes.map(resourceTypeLabel).join(", ")}.{" "}
          {onRetryResources && (
            <button className="link-button" onClick={onRetryResources}>
              Retry
            </button>
          )}
        </p>
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
          — ~tilde values resolve in {phrase.availableLanguageCodes.length}{" "}
          language
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
