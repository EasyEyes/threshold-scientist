import { useMemo, useRef, useState } from "react";
import { suggestibleEntries } from "../glossary";
import type { GlossaryEntry } from "../../../source/components/types";

interface Props {
  existingNames: Set<string>;
  onAdd: (name: string) => void;
}

const MAX_SUGGESTIONS = 12;

export function ParamAutocomplete({ existingNames, onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const pool = suggestibleEntries.filter((e) => !existingNames.has(e.name));
    const starts: GlossaryEntry[] = [];
    const contains: GlossaryEntry[] = [];
    for (const e of pool) {
      const n = e.name.toLowerCase();
      if (n.startsWith(q)) starts.push(e);
      else if (n.includes(q)) contains.push(e);
      if (starts.length >= MAX_SUGGESTIONS) break;
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [query, existingNames]);

  const choose = (name: string) => {
    onAdd(name);
    setQuery("");
    setOpen(false);
    setActive(0);
    inputRef.current?.focus();
  };

  return (
    <div className="autocomplete">
      <input
        ref={inputRef}
        className="autocomplete-input"
        placeholder="Add a parameter — start typing, e.g. “thresh” or “font”…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (!suggestions.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(suggestions[active].name);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <ul className="autocomplete-list">
          {suggestions.map((e, i) => (
            <li
              key={e.name}
              className={i === active ? "active" : ""}
              onMouseDown={(ev) => {
                ev.preventDefault();
                choose(e.name);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <div className="suggestion-head">
                <span className="suggestion-name">{e.name}</span>
                <span className={`type-chip type-${e.type}`}>{e.type}</span>
                {e.default !== "" && (
                  <span className="suggestion-default">
                    default {e.default}
                  </span>
                )}
              </div>
              <div className="suggestion-explanation">
                {firstSentence(e.explanation)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function firstSentence(text: string): string {
  const t = (text || "").replace(/\s+/g, " ").trim();
  const end = t.indexOf(". ");
  const s = end === -1 ? t : t.slice(0, end + 1);
  return s.length > 160 ? s.slice(0, 157) + "…" : s;
}
