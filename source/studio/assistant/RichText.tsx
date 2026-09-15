/**
 * Prose from the assistant with parameter names set as code.
 *
 * A reply like "I set thresholdParameter to spacingDeg in D and E" reads
 * badly as plain text: the parameter names are camelCase tokens that look
 * like typos. Here every token that is a glossary parameter (exact or
 * super-matching, e.g. questionAndAnswer01), and anything the model put in
 * `backticks`, is rendered as an inline code chip; parameter chips jump to
 * that row in the grid when clicked.
 *
 * Plain lowercase words that happen to be parameters ("block", "font") stay
 * as text unless backticked — highlighting them would litter a sentence.
 */
import { isGlossaryReady, resolveEntry } from "../glossary";

/** `code` spans, then word-ish tokens that may be parameter names. */
const TOKEN = /`([^`\n]+)`|([_%]?[A-Za-z][A-Za-z0-9_]*)/g;

const looksLikeParameter = (word: string): boolean =>
  word.startsWith("_") || /[A-Z0-9]/.test(word);

const isParameter = (word: string): boolean => {
  if (!isGlossaryReady()) return false;
  const name = word.startsWith("%") ? word.slice(1) : word;
  return resolveEntry(name) !== undefined;
};

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string; parameter: boolean };

/** Splits prose into text and code segments (exported for tests). */
export function segment(text: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  const pushText = (s: string) => {
    if (!s) return;
    const prev = out[out.length - 1];
    if (prev?.kind === "text") prev.text += s;
    else out.push({ kind: "text", text: s });
  };
  for (const m of text.matchAll(TOKEN)) {
    const [whole, ticked, word] = m;
    const start = m.index ?? 0;
    if (ticked !== undefined) {
      pushText(text.slice(last, start));
      out.push({
        kind: "code",
        text: ticked,
        parameter: isParameter(ticked.trim()),
      });
      last = start + whole.length;
      continue;
    }
    if (word && looksLikeParameter(word) && isParameter(word)) {
      pushText(text.slice(last, start));
      out.push({ kind: "code", text: word, parameter: true });
      last = start + whole.length;
    }
  }
  pushText(text.slice(last));
  return out;
}

export function RichText({
  text,
  onFocus,
}: {
  text: string;
  /** Called with the parameter name when a parameter chip is clicked. */
  onFocus?: (name: string) => void;
}) {
  const parts = segment(text);
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "text" ? (
          <span key={i}>{p.text}</span>
        ) : p.parameter && onFocus ? (
          <button
            key={i}
            type="button"
            className="asst-inline-param"
            onClick={() => onFocus(p.text.replace(/^%/, ""))}
            title={`Show ${p.text} in the grid`}
          >
            {p.text}
          </button>
        ) : (
          <code key={i} className="asst-inline-code">
            {p.text}
          </code>
        ),
      )}
    </>
  );
}
