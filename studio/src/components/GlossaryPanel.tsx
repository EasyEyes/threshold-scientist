import { getEntry, superMatchingEntryFor } from "../glossary";
import { categoryOfEntry } from "../categories";

interface Props {
  paramName: string;
  onClose: () => void;
}

export function GlossaryPanel({ paramName, onClose }: Props) {
  // A commented row (%font) documents the parameter it refers to.
  const isComment = paramName.startsWith("%");
  const lookupName = paramName.replace(/^%\s*/, "");
  const exact = getEntry(lookupName);
  const superEntry = exact ? undefined : superMatchingEntryFor(lookupName);
  const entry = exact ?? superEntry;
  const category = categoryOfEntry(superEntry?.name ?? lookupName);

  return (
    <div className="glossary-panel">
      <div className="glossary-head">
        <span className="glossary-name">{paramName}</span>
        {isComment && <span className="type-chip">commented out</span>}
        {superEntry && (
          <span className="type-chip" title="Numbered instance of a super-matching parameter">
            = {superEntry.name}
          </span>
        )}
        {entry && <span className={`type-chip type-${entry.type}`}>{entry.type}</span>}
        {category && <span className="category-chip">{category}</span>}
        <button className="icon-btn" onClick={onClose} title="Close">
          ✕
        </button>
      </div>
      {!entry ? (
        <p className="glossary-missing">
          This parameter isn't in the glossary (version shown in the header).
          The compiler will reject it — check the spelling, or pick a
          suggestion when adding parameters.
        </p>
      ) : (
        <>
          <dl className="glossary-facts">
            {entry.default !== "" && (
              <div>
                <dt>Default</dt>
                <dd>
                  <code>{entry.default}</code>
                </dd>
              </div>
            )}
            {entry.categories && entry.categories.length > 0 && (
              <div>
                <dt>Allowed</dt>
                <dd>
                  {entry.categories.map((c) => (
                    <code key={c} className="category-code">
                      {c}
                    </code>
                  ))}
                </dd>
              </div>
            )}
            {entry.example && (
              <div>
                <dt>Example</dt>
                <dd>
                  <code>{entry.example}</code>
                </dd>
              </div>
            )}
          </dl>
          <p className="glossary-explanation">{entry.explanation}</p>
        </>
      )}
    </div>
  );
}
