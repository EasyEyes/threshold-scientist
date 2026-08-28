import type { GlossaryEntry } from "../../../source/components/types";

// Parameters whose categories are BCP-47 codes get a human-readable label
// ("en — English") so nobody needs to memorize language codes.
const LANGUAGE_CODE_PARAMS = new Set(["_language", "fontLanguage"]);
const languageDisplayNames = (() => {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" });
  } catch {
    return null;
  }
})();

function categoryLabel(entry: GlossaryEntry | undefined, code: string): string {
  if (!code || !entry || !LANGUAGE_CODE_PARAMS.has(entry.name)) return code;
  try {
    const name = languageDisplayNames?.of(code);
    return name && name.toLowerCase() !== code.toLowerCase()
      ? `${code} — ${name}`
      : code;
  } catch {
    return code;
  }
}

interface Props {
  entry: GlossaryEntry | undefined;
  value: string;
  /**
   * Cell that the spreadsheet convention says must stay blank (condition
   * cell of an underscore param, or column B of a condition param). Locked
   * when empty; if an imported file put a value here anyway, it stays
   * editable so the mistake can be cleared, and validation flags it.
   */
  offConvention: boolean;
  offConventionHint?: string;
  onChange: (value: string) => void;
}

/**
 * A cell that knows its parameter's glossary type: booleans and categorical
 * parameters become dropdowns, everything else a text input with the
 * glossary default as placeholder.
 */
export function EditableCell({
  entry,
  value,
  offConvention,
  offConventionHint,
  onChange,
}: Props) {
  if (offConvention && value === "") {
    return (
      <input
        className="cell-input locked"
        value=""
        disabled
        title={offConventionHint}
      />
    );
  }

  const isTilde = value.trim().startsWith("~");
  const cls = `cell-input${offConvention ? " off-convention" : ""}${
    isTilde ? " tilde" : ""
  }`;
  const type = entry?.type;
  const def = entry?.default ?? "";

  if (type === "boolean") {
    return (
      <select
        className={cls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{def ? `(default ${def})` : ""}</option>
        <option value="TRUE">TRUE</option>
        <option value="FALSE">FALSE</option>
        {value && !["TRUE", "FALSE"].includes(value) && (
          <option value={value}>{value}</option>
        )}
      </select>
    );
  }

  if (type === "categorical" && entry?.categories?.length) {
    const known = entry.categories.includes(value);
    return (
      <select
        className={cls}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">
          {def ? `(default ${categoryLabel(entry, def)})` : ""}
        </option>
        {entry.categories.map((c) => (
          <option key={c} value={c}>
            {categoryLabel(entry, c)}
          </option>
        ))}
        {value && !known && <option value={value}>{value}</option>}
      </select>
    );
  }

  return (
    <input
      className={cls}
      value={value}
      placeholder={def}
      title={
        offConvention
          ? offConventionHint
          : isTilde
            ? "~Tilde value — looked up in the phrases spreadsheet (per _language) before compiling"
            : type === "multicategorical" && entry?.categories?.length
              ? `Comma-separated. Options: ${entry.categories.join(", ")}`
              : undefined
      }
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
    />
  );
}
