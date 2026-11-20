import { useEffect, useMemo, useState } from "react";
import { resourcesFileTypes } from "../../../threshold/preprocess/constants";
import {
  failedResourceTypes,
  resourceListingFor,
  type ResourceCatalog,
  type ResourceType,
} from "../../../threshold/preprocess/resourceCatalog";
import {
  paramsReferencing,
  resourceTypeLabel,
  type NeededResource,
} from "../resources";

interface Props {
  resourceCatalog: ResourceCatalog;
  onRetry?: () => void;
  /** What the current table references — to mark files it uses. */
  needed: NeededResource[];
  onClose: () => void;
}

interface FileRow {
  type: ResourceType;
  name: string;
}

const extensionOf = (name: string): string => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
};

/** Browse ready listings without interpreting failed listings as empty. */
export function ExistingFilesModal({
  resourceCatalog,
  onRetry,
  needed,
  onClose,
}: Props) {
  const types = resourcesFileTypes;
  const namesOf = (type: ResourceType): string[] => {
    const listing = resourceListingFor(resourceCatalog, type);
    return listing.kind === "ready" ? listing.names : [];
  };
  const countOf = (type: ResourceType) => namesOf(type).length;
  const failedTypes = failedResourceTypes(resourceCatalog);
  const total = types.reduce((n, type) => n + countOf(type), 0);
  const [selected, setSelected] = useState<ResourceType>(
    () => types.find((type) => countOf(type) > 0) ?? types[0],
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
        namesOf(type)
          .filter((name) => name.toLowerCase().includes(q))
          .map((name) => ({ type, name })),
      );
      return { label: `Search: “${query.trim()}”`, rows: sortRows(rows) };
    }
    return {
      label: resourceTypeLabel(selected),
      rows: sortRows(
        namesOf(selected).map((name) => ({ type: selected, name })),
      ),
    };
  }, [q, query, selected, resourceCatalog]);

  const retryNotice = failedTypes.length > 0 && (
    <p className="panel-note">
      Couldn’t load {failedTypes.map(resourceTypeLabel).join(", ")}. These are
      unavailable, not empty.{" "}
      {onRetry && (
        <button className="link-button" onClick={onRetry}>
          Retry
        </button>
      )}
    </p>
  );

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
            {types.map((type) => {
              const failed = failedTypes.includes(type);
              return (
                <li
                  key={type}
                  className={`cat-item${
                    selected === type && !q ? " active" : ""
                  }${countOf(type) === 0 ? " empty" : ""}`}
                  onClick={() => {
                    setSelected(type);
                    setQuery("");
                  }}
                >
                  {resourceTypeLabel(type)}
                  <span className="cat-count">
                    {failed ? "—" : countOf(type)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="catalog-entries">
            {resourceCatalog.kind === "loading" ? (
              <p className="panel-note">
                Loading your resources from Pavlovia…
              </p>
            ) : resourceCatalog.kind === "idle" ? (
              <p className="panel-note">
                No resource listing has been requested.
              </p>
            ) : (
              <>
                {retryNotice}
                {total === 0 && failedTypes.length === 0 ? (
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
                    {!q && failedTypes.includes(selected) ? (
                      <p className="panel-note">
                        This resource list is unavailable.
                      </p>
                    ) : shown.rows.length === 0 ? (
                      <p className="panel-note">
                        {q
                          ? "No files match in the available lists."
                          : "No files of this type yet."}
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
                                  {ext && (
                                    <span className="type-chip">{ext}</span>
                                  )}
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
