import { useRef, useState } from "react";
import type { NeededResource } from "../resources";
import type { PhraseSource } from "../validation";

interface Props {
  needed: NeededResource[];
  phrase: PhraseSource | null;
  files: File[];
  onAddFiles: (files: File[]) => void;
  onRemoveFile: (name: string) => void;
}

/**
 * The anti-zip panel: the table itself tells the scientist which files the
 * experiment needs; they drop them here and watch the checklist go green.
 */
export function ResourcePanel({ needed, phrase, files, onAddFiles, onRemoveFile }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const have = new Set(files.map((f) => f.name));
  const referenced = new Set(needed.map((n) => n.filename));
  const extras = files.filter((f) => !referenced.has(f.name));
  const missingCount = needed.filter((n) => !have.has(n.filename)).length;

  return (
    <div className="resource-panel">
      <div className="panel-title">
        Upload resources
        {needed.length > 0 && (
          <span
            className={`count-chip ${missingCount ? "warnings" : "ok"}`}
          >
            {needed.length - missingCount}/{needed.length} present
          </span>
        )}
      </div>
      {needed.length === 0 ? (
        <p className="panel-note">
          This table references no resource files (fonts with{" "}
          <code>fontSource=file</code>, consent/debrief forms, sound folders,
          phrase spreadsheets).
          Nothing to upload.
        </p>
      ) : (
        <ul className="resource-list">
          {needed.map((n) => {
            const present = have.has(n.filename);
            return (
              <li key={`${n.kind}:${n.filename}`} className={present ? "present" : "missing"}>
                <span className="resource-status">{present ? "✓" : "•"}</span>
                <span className="resource-name">{n.filename}</span>
                <span className="resource-kind">
                  {n.kind} · {n.params.join(", ")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {phrase && (
        <p className="panel-note phrase-note">
          ✓ <strong>{phrase.fileName}</strong> loaded — ~tilde values resolve
          in {phrase.availableLanguageCodes.length} language
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
                <span className="resource-kind">not referenced by the table</span>
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
    </div>
  );
}
