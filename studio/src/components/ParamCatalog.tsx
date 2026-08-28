import { useEffect, useMemo, useState } from "react";
import {
  CATEGORIES,
  PRESET_RECOMMENDATIONS,
  recommendedFor,
  type Recommendation,
} from "../categories";
import type { GlossaryEntry } from "../../../source/components/types";

interface Props {
  existingNames: Set<string>;
  targetKinds: string[];
  targetTasks: string[];
  onAdd: (name: string) => void;
  onClose: () => void;
}

const RECOMMENDED = "__recommended__";

/**
 * Full-glossary browser: pick parameters by category instead of recalling
 * them by name. The first group is tailored to the experiment's targetKind.
 */
export function ParamCatalog({
  existingNames,
  targetKinds,
  targetTasks,
  onAdd,
  onClose,
}: Props) {
  const recommendation: Recommendation | null = useMemo(
    () => recommendedFor(targetKinds, targetTasks),
    [targetKinds, targetTasks],
  );
  const [selected, setSelected] = useState<string>(
    recommendation ? RECOMMENDED : CATEGORIES[0].name,
  );
  const [query, setQuery] = useState("");
  // Click a parameter to read its full glossary entry in place; click again
  // or press Escape to collapse. A second Escape closes the catalog.
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setExpanded((cur) => {
        if (cur === null) onClose();
        return null;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.trim().toLowerCase();
  const shown: { label: string; entries: GlossaryEntry[] } | null = useMemo(() => {
    if (q) {
      const all = CATEGORIES.flatMap((c) => c.entries);
      const starts = all.filter((e) => e.name.toLowerCase().startsWith(q));
      const contains = all.filter(
        (e) => !e.name.toLowerCase().startsWith(q) && e.name.toLowerCase().includes(q),
      );
      return { label: `Search: “${query.trim()}”`, entries: [...starts, ...contains] };
    }
    if (selected === RECOMMENDED && recommendation) return recommendation;
    const preset = PRESET_RECOMMENDATIONS.find((p) => p.label === selected);
    if (preset) return preset;
    const cat = CATEGORIES.find((c) => c.name === selected);
    return cat ? { label: cat.name, entries: cat.entries } : null;
  }, [q, query, selected, recommendation]);

  const presentCount = (entries: GlossaryEntry[]) =>
    entries.filter((e) => existingNames.has(e.name)).length;

  return (
    <div className="catalog-overlay" onClick={onClose}>
      <div className="catalog" onClick={(e) => e.stopPropagation()}>
        <div className="catalog-head">
          <span className="catalog-title">Parameter catalog</span>
          <input
            className="catalog-search"
            placeholder="Search all parameters…"
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
            {recommendation && (
              <li
                className={`cat-item recommended${
                  selected === RECOMMENDED && !q ? " active" : ""
                }`}
                onClick={() => {
                  setSelected(RECOMMENDED);
                  setQuery("");
                }}
              >
                <span className="cat-star">★</span> {recommendation.label}
                <span className="cat-count">
                  {presentCount(recommendation.entries)}/{recommendation.entries.length}
                </span>
              </li>
            )}
            {PRESET_RECOMMENDATIONS.map((p) => (
              <li
                key={p.label}
                className={`cat-item recommended${
                  selected === p.label && !q ? " active" : ""
                }`}
                onClick={() => {
                  setSelected(p.label);
                  setQuery("");
                }}
              >
                <span className="cat-star">★</span> {p.label}
                <span className="cat-count">
                  {presentCount(p.entries)}/{p.entries.length}
                </span>
              </li>
            ))}
            {CATEGORIES.map((c) => (
              <li
                key={c.name}
                className={`cat-item${selected === c.name && !q ? " active" : ""}`}
                onClick={() => {
                  setSelected(c.name);
                  setQuery("");
                }}
              >
                {c.name}
                <span className="cat-count">
                  {presentCount(c.entries)}/{c.entries.length}
                </span>
              </li>
            ))}
          </ul>
          <div className="catalog-entries">
            {shown && (
              <>
                <div className="catalog-group-label">{shown.label}</div>
                <ul>
                  {shown.entries.map((e) => {
                    const present = existingNames.has(e.name);
                    const isOpen = expanded === e.name;
                    return (
                      <li
                        key={e.name}
                        className={`catalog-entry${isOpen ? " open" : ""}`}
                      >
                        <div
                          className="catalog-entry-main"
                          title={
                            isOpen
                              ? "Click to collapse"
                              : "Click to read the full description"
                          }
                          onClick={() =>
                            setExpanded((cur) => (cur === e.name ? null : e.name))
                          }
                        >
                          <div className="suggestion-head">
                            <span className="entry-caret">{isOpen ? "▾" : "▸"}</span>
                            <span className="suggestion-name">{e.name}</span>
                            <span className={`type-chip type-${e.type}`}>{e.type}</span>
                            {e.default !== "" && (
                              <span className="suggestion-default">
                                default {e.default}
                              </span>
                            )}
                          </div>
                          {isOpen ? (
                            <div className="catalog-entry-full">
                              {e.categories && e.categories.length > 0 && (
                                <div className="catalog-entry-allowed">
                                  {e.categories.map((c) => (
                                    <code key={c} className="category-code">
                                      {c}
                                    </code>
                                  ))}
                                </div>
                              )}
                              {e.example && (
                                <div className="catalog-entry-example">
                                  Example: <code>{e.example}</code>
                                </div>
                              )}
                              <p>{e.explanation}</p>
                            </div>
                          ) : (
                            <div className="suggestion-explanation">
                              {firstSentence(e.explanation)}
                            </div>
                          )}
                        </div>
                        {present ? (
                          <span className="catalog-present">✓ in table</span>
                        ) : (
                          <button
                            className="button-easyeyes button-green catalog-add"
                            onClick={() => onAdd(e.name)}
                          >
                            Add
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function firstSentence(text: string): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  const end = t.indexOf(". ");
  const s = end === -1 ? t : t.slice(0, end + 1);
  return s.length > 180 ? s.slice(0, 177) + "…" : s;
}
