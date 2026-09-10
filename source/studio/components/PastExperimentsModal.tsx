import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PastExperiment,
  PastExperimentsApi,
  PastExperimentTable,
} from "../pastExperiments";

interface Props {
  api: PastExperimentsApi;
  /** Called with the table once it is read; the modal closes itself. */
  onOpen: (table: PastExperimentTable) => void;
  onClose: () => void;
}

/** The date shown for each experiment — the classic list's format. */
export const formatExperimentDate = (iso: string): string =>
  new Date(iso).toLocaleString(undefined, {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const messageOf = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message
    : "Could not reach Pavlovia. Please try again.";

/**
 * Picker for the scientist's past compiled experiments — the same experiments
 * the Compiler tab's "Select compiled study" lists, in the Studio's modal
 * style. Picking one reads its table from the repository into the grid.
 */
export function PastExperimentsModal({ api, onOpen, onClose }: Props) {
  const [experiments, setExperiments] = useState<PastExperiment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [nextPage, setNextPage] = useState(2);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PastExperiment[] | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const searchSeq = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadList = async (refresh: boolean) => {
    try {
      const { experiments: list, totalPages: pages } = await api.list(refresh);
      if (!mounted.current) return;
      setExperiments(list);
      setTotalPages(pages);
      setNextPage(2);
      setError(null);
    } catch (e) {
      if (mounted.current) setError(messageOf(e));
    } finally {
      if (mounted.current) setLoaded(true);
    }
  };

  const listRequested = useRef(false);
  useEffect(() => {
    if (listRequested.current) return;
    listRequested.current = true;
    void loadList(false);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Search: the loaded pages are filtered at once; Pavlovia is asked too
  // (debounced), since the list may be longer than what is loaded.
  const q = query.trim().toLowerCase();
  useEffect(() => {
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await api.search(query.trim());
        if (mounted.current && seq === searchSeq.current)
          setSearchResults(found);
      } catch {
        if (mounted.current && seq === searchSeq.current) setSearchResults([]);
      } finally {
        if (mounted.current && seq === searchSeq.current) setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q, query, api]);

  const shown = useMemo(() => {
    if (!q) return experiments;
    const byId = new Map<number, PastExperiment>();
    for (const e of experiments)
      if (e.name.toLowerCase().includes(q)) byId.set(e.id, e);
    for (const e of searchResults ?? []) byId.set(e.id, e);
    return [...byId.values()].sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    );
  }, [q, experiments, searchResults]);

  const hasMore = !q && nextPage <= totalPages;

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const more = await api.page(nextPage);
      if (!mounted.current) return;
      setExperiments((list) => {
        const seen = new Set(list.map((e) => e.id));
        return [...list, ...more.filter((e) => !seen.has(e.id))];
      });
      setNextPage((n) => n + 1);
    } catch (e) {
      if (mounted.current) setError(messageOf(e));
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    setQuery("");
    await loadList(true);
    if (mounted.current) setRefreshing(false);
  };

  const open = async (experiment: PastExperiment) => {
    if (opening !== null) return;
    setOpening(experiment.id);
    setError(null);
    try {
      const table = await api.open(experiment);
      if (!mounted.current) return;
      onOpen(table);
      onClose();
    } catch (e) {
      if (mounted.current) {
        setError(messageOf(e));
        setOpening(null);
      }
    }
  };

  return (
    <div className="catalog-overlay" onClick={onClose}>
      <div
        className="catalog past-experiments"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="catalog-head">
          <span className="catalog-title">
            Past experiments
            <span className="catalog-subtitle">
              compiled experiments on Pavlovia — open one to edit a copy
            </span>
          </span>
          <input
            className="catalog-search"
            placeholder="Search experiments…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className="button-easyeyes button-grey"
            onClick={refresh}
            disabled={refreshing || !loaded}
            title="Ask Pavlovia for the list again"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button className="button-easyeyes button-grey" onClick={onClose}>
            Cancel
          </button>
        </div>
        <div className="catalog-body">
          <div className="catalog-entries">
            {error && <p className="panel-note past-experiments-error">{error}</p>}
            {!loaded ? (
              <p className="panel-note">
                Loading your experiments from Pavlovia…
              </p>
            ) : experiments.length === 0 && !q ? (
              <p className="panel-note">
                No compiled experiments yet. Experiments you compile appear
                here.
              </p>
            ) : (
              <>
                <div className="catalog-group-label">
                  {q ? `Search: “${query.trim()}”` : "Newest first"}
                  <span className="cat-count">
                    {shown.length}
                    {searching ? " …" : ""}
                  </span>
                </div>
                {shown.length === 0 ? (
                  <p className="panel-note">
                    {searching ? "Searching…" : "No experiments match."}
                  </p>
                ) : (
                  <ul>
                    {shown.map((experiment) => {
                      const isOpening = opening === experiment.id;
                      return (
                        <li
                          key={experiment.id}
                          className={`catalog-entry file-entry past-experiment${
                            isOpening ? " open" : ""
                          }`}
                          aria-busy={isOpening}
                        >
                          <div
                            className="catalog-entry-main"
                            role="button"
                            tabIndex={0}
                            onClick={() => open(experiment)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                open(experiment);
                              }
                            }}
                          >
                            <div className="suggestion-head">
                              <span className="suggestion-name">
                                {experiment.name}
                              </span>
                              <span className="suggestion-default">
                                {formatExperimentDate(experiment.created_at)}
                              </span>
                            </div>
                          </div>
                          <span className="catalog-present">
                            {isOpening ? "Opening…" : "Open"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {hasMore && (
                  <div className="past-experiments-more">
                    <button
                      className="button-easyeyes button-grey"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? "Loading…" : "Show more"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
