import { useEffect, useMemo, useState } from "react";
import { resourcesFileTypes } from "../../../threshold/preprocess/constants";
import {
  paramsReferencing,
  resourceTypeLabel,
  type NeededResource,
  type UserResources,
} from "../resources";

interface Props {
  resources: UserResources;
  loaded: boolean;
  /** What the current table references — to mark files it uses. */
  needed: NeededResource[];
  onClose: () => void;
}

interface FileRow {
  type: string;
  name: string;
}

const extensionOf = (name: string): string => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
};

/**
 * Browser for the files already in the user's EasyEyesResources repository
 * on Pavlovia — same layout as the parameter catalog: file types on the
 * left, files on the right, search across everything.
 */
export function ExistingFilesModal({
  resources,
  loaded,
  needed,
  onClose,
}: Props) {
  const types = resourcesFileTypes.filter((t) => t in resources);
  const countOf = (t: string) => (resources[t] ?? []).length;
  const total = types.reduce((n, t) => n + countOf(t), 0);
  const [selected, setSelected] = useState<string>(
    () => types.find((t) => countOf(t) > 0) ?? types[0],
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const shown: { label: string; rows: FileRow[] } = useMemo(() => {
    const sortRows = (rows: FileRow[]) =>
      rows.sort((a, b) =>
        a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
      );
    if (q) {
      const rows = types.flatMap((type) =>
        (resources[type] ?? [])
          .filter((name) => name.toLowerCase().includes(q))
          .map((name) => ({ type, name })),
      );
      return { label: `Search: “${query.trim()}”`, rows: sortRows(rows) };
    }
    return {
      label: resourceTypeLabel(selected),
      rows: sortRows(
        (resources[selected] ?? []).map((name) => ({ type: selected, name })),
      ),
    };
  }, [q, query, selected, resources, types]);

  return (
    <div className="catalog-overlay" onClick={onClose}>
      <div className="catalog" onClick={(e) => e.stopPropagation()}>
        <div className="catalog-head">
          <span className="catalog-title">
            Existing files
            <span className="catalog-subtitle">
              your EasyEyesResources on Pavlovia
            </span>
          </span>
          <input
            className="catalog-search"
            placeholder="Search all files…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="button-easyeyes button-grey" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="catalog-body">
          <ul className="catalog-cats">
            {types.map((t) => (
              <li
                key={t}
                className={`cat-item${selected === t && !q ? " active" : ""}${
                  countOf(t) === 0 ? " empty" : ""
                }`}
                onClick={() => {
                  setSelected(t);
                  setQuery("");
                }}
              >
                {resourceTypeLabel(t)}
                <span className="cat-count">{countOf(t)}</span>
              </li>
            ))}
          </ul>
          <div className="catalog-entries">
            {!loaded ? (
              <p className="panel-note">
                Loading your resources from Pavlovia…
              </p>
            ) : total === 0 ? (
              <p className="panel-note">
                Your EasyEyesResources repository is empty. Files you upload
                with an experiment are kept there for reuse.
              </p>
            ) : (
              <>
                <div className="catalog-group-label">
                  {shown.label}
                  <span className="cat-count">{shown.rows.length}</span>
                </div>
                {shown.rows.length === 0 ? (
                  <p className="panel-note">
                    {q ? "No files match." : "No files of this type yet."}
                  </p>
                ) : (
                  <ul>
                    {shown.rows.map((row) => {
                      const usedBy = paramsReferencing(
                        row.type,
                        row.name,
                        needed,
                      );
                      const ext = extensionOf(row.name);
                      return (
                        <li
                          key={`${row.type}/${row.name}`}
                          className="catalog-entry file-entry"
                        >
                          <div className="catalog-entry-main">
                            <div className="suggestion-head">
                              <span className="suggestion-name">
                                {row.name}
                              </span>
                              {ext && <span className="type-chip">{ext}</span>}
                              {q && (
                                <span className="suggestion-default">
                                  {resourceTypeLabel(row.type)}
                                </span>
                              )}
                            </div>
                          </div>
                          {usedBy.length > 0 && (
                            <span
                              className="catalog-present"
                              title={`Referenced by ${usedBy.join(", ")}`}
                            >
                              ✓ used by {usedBy.join(", ")}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
