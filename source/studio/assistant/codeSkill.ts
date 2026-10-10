/**
 * Code lookup — an opt-in skill that lets the assistant read the EasyEyes
 * implementation to answer "how does it work" questions.
 *
 * One of the assistant's skills (skills.ts). Off by default, and when off
 * nothing here is sent: the request is the same system blocks and tools as
 * always. When the scientist turns it on (the skills menu in the composer,
 * or a message starting with "/code"), the request gains one more system
 * block (this skill's instructions and a map of the source) and two
 * read-only tools, search_code and read_code. The table tools are
 * untouched; code lookup never changes the study.
 *
 * The source is read from the site itself. Netlify publishes docs/ as-is
 * and the dev server serves the same tree, so every file under
 * docs/experiment is at /compiler/<path>. What the browser lacks is a
 * listing — that is studio-code-index.json, written by
 * server/writeCodeIndex.js at dev start and build: per file, the path, size,
 * line count, the first sentence of its leading comment and its top-level
 * symbols. search_code matches the index first (paths, symbols) and then
 * greps file contents, downloading files on first use and keeping them for
 * the session. read_code returns a line range, or the lines matching a
 * pattern with context.
 *
 * Where the index is not served (a deployment that did not generate it),
 * the tools answer with that and the model tells the scientist.
 */
import type { SystemBlock } from "./prompt";
import type { Skill } from "./skills";
import type { ToolOutcome } from "./tools";

/** Served from the published docs/ tree, beside the compiler page. */
export const CODE_BASE_URL = "/compiler/";
export const CODE_INDEX_URL = `${CODE_BASE_URL}studio-code-index.json`;

/** A message that starts with this (then a space or newline) turns the skill on. */
export const CODE_TRIGGER = "/code";

export interface CodeIndexFile {
  /** Path under docs/experiment, e.g. "threshold/components/useCalibration.js". */
  p: string;
  /** Lines. */
  l: number;
  /** Bytes. */
  b: number;
  /** First sentence of the leading comment (may be ""). */
  h: string;
  /** Top-level symbol names (exports, functions, classes; md headings). */
  s: string[];
}

export interface CodeIndex {
  version: number;
  generatedAt: string;
  roots: { dir: string; about: string }[];
  files: CodeIndexFile[];
}

/* ------------------------------------------------------------------ */
/* Tool definitions                                                    */
/* ------------------------------------------------------------------ */

export const CODE_TOOLS = [
  {
    name: "search_code",
    description:
      "Search the EasyEyes source (compiler, Studio, experiment runtime). Matches file paths and top-level symbol names first, then lines of code (case-insensitive; `regex: true` for a regular expression). `scope` is a path prefix that limits the search (e.g. 'threshold/components', 'threshold/preprocess', 'source/studio'); with an empty query it lists the files there. Returns 'path:line: text' hits — then read_code around the ones that matter. To find how a parameter is used, search its exact name.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Words, an identifier or a parameter name to look for; empty to list files in scope.",
        },
        scope: {
          type: "string",
          description:
            "Optional path prefix, e.g. 'threshold/components' or 'source/studio/builder'.",
        },
        regex: {
          type: "boolean",
          description: "Treat query as a JavaScript regular expression.",
        },
        limit: {
          type: "integer",
          description: "Maximum hits to return (default 40, max 80).",
        },
      },
    },
  },
  {
    name: "read_code",
    description:
      "Read a source file by its path from search_code. Either a line range (`start`, `end`; up to 240 lines per call, default the first 160) or, with `find`, the lines matching a pattern with a few lines of context on each side. Lines come numbered so you can cite them as path:line.",
    input_schema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "Exact path, e.g. 'threshold/preprocess/validateExperimentTable.ts'.",
        },
        start: { type: "integer", description: "First line (1-based)." },
        end: { type: "integer", description: "Last line (inclusive)." },
        find: {
          type: "string",
          description:
            "Pattern to find in the file instead of a range (case-insensitive; a regular expression).",
        },
        context: {
          type: "integer",
          description: "Lines of context around each find hit (default 4).",
        },
      },
      required: ["path"],
    },
  },
] as const;

export const CODE_TOOL_NAMES: ReadonlySet<string> = new Set(
  CODE_TOOLS.map((t) => t.name),
);

export const isCodeTool = (name: string): boolean => CODE_TOOL_NAMES.has(name);

/* ------------------------------------------------------------------ */
/* Instructions                                                        */
/* ------------------------------------------------------------------ */

export const CODE_INSTRUCTIONS = `CODE LOOKUP (on)
The scientist has turned on code lookup: you may read the EasyEyes implementation with search_code and read_code to answer questions about how EasyEyes works — what a parameter actually does at run time, how the compiler checks something, how a stimulus or calibration is computed, where a message comes from. These tools only read; the table tools still do every change, and the rules above still apply to building and editing.
- A question about how EasyEyes works is in scope now; do not steer away from it. Answer from the code you read, not from memory: search, read the relevant lines, then answer.
- A parameter's behavior lives in threshold/components (runtime; values are read with paramReader.read("parameterName", block_condition)) and threshold/preprocess (compiler checks, validateExperimentTable.ts). Search the exact parameter name first.
- Cite what you relied on as path:line (e.g. threshold/components/useCalibration.js:412). Say when the code is unclear or when you did not find it; do not guess.
- Keep the reply short: a few plain sentences, parameter and function names verbatim, no markdown, no lists. Prose may run longer than usual only when the question asks for a walkthrough.
- Be economical: one search, one or two reads is the normal shape. Use scope to narrow, read_code with find to jump to the lines, and do not read a whole file.
- If a request mixes a question and a change, do the change with the table tools as usual and answer the question from the code.`;

/* ------------------------------------------------------------------ */
/* Source store: the index and fetched files, kept for the session     */
/* ------------------------------------------------------------------ */

export interface CodeStore {
  index: () => Promise<CodeIndex | null>;
  /** Why the index is unavailable, once known. */
  indexError: () => string | null;
  file: (path: string) => Promise<string | null>;
  /** Forget everything (tests; a reload does it in the browser). */
  reset: () => void;
}

export function createCodeStore(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  base: string = CODE_BASE_URL,
  indexUrl: string = CODE_INDEX_URL,
): CodeStore {
  let indexPromise: Promise<CodeIndex | null> | null = null;
  let indexError: string | null = null;
  const files = new Map<string, Promise<string | null>>();

  const loadIndex = async (): Promise<CodeIndex | null> => {
    try {
      const r = await fetchImpl(indexUrl, { cache: "no-cache" });
      if (!r.ok) {
        indexError = `the code index answered ${r.status}`;
        return null;
      }
      const body = (await r.json()) as CodeIndex;
      if (!body || !Array.isArray(body.files)) {
        indexError = "the code index is malformed";
        return null;
      }
      return body;
    } catch (e) {
      indexError = e instanceof Error ? e.message : String(e);
      return null;
    }
  };

  return {
    index: () => {
      if (!indexPromise) indexPromise = loadIndex();
      return indexPromise;
    },
    indexError: () => indexError,
    file: (path: string) => {
      const have = files.get(path);
      if (have) return have;
      const p = (async () => {
        try {
          const r = await fetchImpl(base + path);
          return r.ok ? await r.text() : null;
        } catch {
          return null;
        }
      })();
      files.set(path, p);
      return p;
    },
    reset: () => {
      indexPromise = null;
      indexError = null;
      files.clear();
    },
  };
}

/** The browser's store: one per page load. */
export const codeStore: CodeStore = createCodeStore();

/* ------------------------------------------------------------------ */
/* System block                                                        */
/* ------------------------------------------------------------------ */

/** Directories two levels deep with file counts — the map the model gets. */
export function describeCodeLayout(index: CodeIndex): string {
  const counts = new Map<string, number>();
  for (const f of index.files) {
    const parts = f.p.split("/");
    const dir =
      parts.length > 3
        ? parts.slice(0, 3).join("/")
        : parts.slice(0, -1).join("/");
    counts.set(dir, (counts.get(dir) ?? 0) + 1);
  }
  const lines: string[] = [];
  for (const root of index.roots) {
    lines.push(`${root.dir}/ — ${root.about}`);
    const subs = [...counts.entries()]
      .filter(([d]) => d.startsWith(root.dir + "/"))
      .sort((a, b) => a[0].localeCompare(b[0]));
    const top = counts.get(root.dir) ?? 0;
    const bits = [
      ...(top ? [`${top} files at the top`] : []),
      ...subs.map(([d, n]) => `${d.slice(root.dir.length + 1)}/ (${n})`),
    ];
    if (bits.length) lines.push(`  ${bits.join(", ")}`);
  }
  const loose = index.files.filter((f) => !f.p.includes("/")).map((f) => f.p);
  if (loose.length) lines.push(`top-level: ${loose.join(", ")}`);
  return lines.join("\n");
}

/** The skill's system block: instructions plus the map, or why it is unavailable. */
export async function codeSkillBlock(
  store: CodeStore = codeStore,
): Promise<SystemBlock> {
  const index = await store.index();
  const map = index
    ? `SOURCE MAP (${
        index.files.length
      } files, paths under docs/experiment; index from ${index.generatedAt.slice(
        0,
        10,
      )})\n${describeCodeLayout(index)}`
    : `The code index is not available in this deployment (${
        store.indexError() ?? "unknown reason"
      }). search_code and read_code will fail; tell the scientist code lookup is not available here, and answer what you can from the glossary.`;
  return { type: "text", text: `${CODE_INSTRUCTIONS}\n\n${map}` };
}

/* ------------------------------------------------------------------ */
/* Tools                                                               */
/* ------------------------------------------------------------------ */

const MAX_RESULT_CHARS = 12_000;
const MAX_HITS = 80;
const DEFAULT_HITS = 40;
const HITS_PER_FILE = 6;
const READ_DEFAULT_LINES = 160;
const READ_MAX_LINES = 240;
const FIND_MAX_MATCHES = 20;
const FETCH_CONCURRENCY = 12;
const LINE_MAX = 180;

const clip = (s: string, max = LINE_MAX): string =>
  s.length > max ? s.slice(0, max - 1) + "…" : s;

const capResult = (s: string): string =>
  s.length > MAX_RESULT_CHARS
    ? s.slice(0, MAX_RESULT_CHARS - 40) + "\n… (truncated; narrow the request)"
    : s;

const escapeRegex = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A case-insensitive matcher from the query, literal unless asked otherwise. */
function compile(query: string, regex: boolean): RegExp | string {
  if (!regex) return query.toLowerCase();
  try {
    return new RegExp(query, "i");
  } catch (e) {
    return `invalid regular expression: ${
      e instanceof Error ? e.message : String(e)
    }`;
  }
}

const matches = (line: string, m: RegExp | string): boolean =>
  typeof m === "string" ? line.toLowerCase().includes(m) : m.test(line);

const inScope = (f: CodeIndexFile, scope: string): boolean =>
  !scope || f.p === scope || f.p.startsWith(scope.replace(/\/+$/, "") + "/");

/** Fetches many files with bounded concurrency; nulls for the unreadable. */
async function fetchAll(
  store: CodeStore,
  paths: string[],
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  let next = 0;
  const worker = async () => {
    while (next < paths.length) {
      const p = paths[next++];
      out.set(p, await store.file(p));
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, paths.length) }, worker),
  );
  return out;
}

const describeIndexed = (f: CodeIndexFile): string =>
  `${f.p} (${f.l} lines)${f.h ? ` — ${f.h}` : ""}${
    f.s.length
      ? `; symbols: ${f.s.slice(0, 12).join(", ")}${
          f.s.length > 12 ? ", …" : ""
        }`
      : ""
  }`;

/** Paths whose file name resembles the one asked for. */
function nearPaths(index: CodeIndex, path: string, limit = 5): string[] {
  const base = path.split("/").pop()?.toLowerCase() ?? "";
  const stem = base.replace(/\.[^.]+$/, "");
  if (!stem) return [];
  return index.files
    .map((f) => f.p)
    .filter((p) => p.toLowerCase().includes(stem))
    .slice(0, limit);
}

const unavailable = (store: CodeStore, activity: string): ToolOutcome => ({
  result: `Code lookup is not available in this deployment: ${
    store.indexError() ?? "the code index could not be loaded"
  }. Tell the scientist, and answer from the glossary if you can.`,
  isError: true,
  activity: `${activity} — code index unavailable`,
});

async function searchCode(
  input: Record<string, unknown>,
  store: CodeStore,
): Promise<ToolOutcome> {
  const index = await store.index();
  if (!index) return unavailable(store, "Searched the code");
  const query = String(input.query ?? "").trim();
  const scope = String(input.scope ?? "")
    .trim()
    .replace(/^\/+/, "");
  const regex = input.regex === true;
  const limit = Math.max(
    1,
    Math.min(MAX_HITS, Number(input.limit) || DEFAULT_HITS),
  );
  const scoped = index.files.filter((f) => inScope(f, scope));
  if (!scoped.length)
    return {
      result: `Nothing under "${scope}". Areas: ${index.roots
        .map((r) => r.dir)
        .join(", ")}.`,
      isError: true,
      activity: `Searched the code — no such area “${scope}”`,
    };

  // No query: a listing of the scope.
  if (!query) {
    const list = scoped.slice(0, 120).map(describeIndexed);
    const more = scoped.length > 120 ? `\n… ${scoped.length - 120} more` : "";
    return {
      result: capResult(
        `${scoped.length} file${scoped.length === 1 ? "" : "s"} under ${
          scope || "the source"
        }:\n${list.join("\n")}${more}`,
      ),
      activity: `Listed ${scoped.length} files${
        scope ? ` under ${scope}` : ""
      }`,
    };
  }

  const m = compile(query, regex);
  if (typeof m === "string" && regex)
    return {
      result: m,
      isError: true,
      activity: "Searched the code — bad regex",
    };

  // 1. The index: paths and symbols.
  const lower = query.toLowerCase();
  const byName = scoped.filter(
    (f) =>
      f.p.toLowerCase().includes(lower) ||
      f.s.some((s) => matches(s, m)) ||
      (f.h && matches(f.h, m)),
  );

  // 2. The contents.
  const texts = await fetchAll(
    store,
    scoped.map((f) => f.p),
  );
  const hits: string[] = [];
  let total = 0;
  let filesWithHits = 0;
  let unreadable = 0;
  for (const f of scoped) {
    const text = texts.get(f.p);
    if (text === null || text === undefined) {
      unreadable++;
      continue;
    }
    const lines = text.split("\n");
    let inFile = 0;
    for (let i = 0; i < lines.length; i++) {
      if (!matches(lines[i], m)) continue;
      total++;
      inFile++;
      if (hits.length < limit && inFile <= HITS_PER_FILE)
        hits.push(`${f.p}:${i + 1}: ${clip(lines[i].trim())}`);
    }
    if (inFile) {
      filesWithHits++;
      if (inFile > HITS_PER_FILE && hits.length < limit)
        hits.push(`${f.p}: … ${inFile - HITS_PER_FILE} more in this file`);
    }
  }

  const out: string[] = [];
  out.push(
    `Searched ${scoped.length} file${scoped.length === 1 ? "" : "s"}${
      scope ? ` under ${scope}` : ""
    } for ${regex ? "/" + query + "/" : `"${query}"`}: ${total} line hit${
      total === 1 ? "" : "s"
    } in ${filesWithHits} file${filesWithHits === 1 ? "" : "s"}${
      unreadable ? ` (${unreadable} could not be read)` : ""
    }.`,
  );
  if (byName.length) {
    out.push("", "Files whose path or symbols match:");
    for (const f of byName.slice(0, 15)) out.push(`- ${describeIndexed(f)}`);
    if (byName.length > 15) out.push(`- … ${byName.length - 15} more`);
  }
  if (hits.length) {
    out.push("", "Lines:");
    out.push(...hits);
    if (total > hits.length)
      out.push(
        `… ${
          total - hits.length
        } more; narrow with scope or a more specific query.`,
      );
  } else if (!byName.length) {
    out.push(
      "",
      "No match. Try other words, a parameter's exact name, or a wider scope.",
    );
  }
  return {
    result: capResult(out.join("\n")),
    activity: `Searched the code for “${clip(query, 40)}” — ${total} hit${
      total === 1 ? "" : "s"
    }${scope ? ` under ${scope}` : ""}`,
  };
}

const numbered = (lines: string[], from: number): string =>
  lines
    .map((l, i) => `${String(from + i).padStart(5, " ")}| ${clip(l, 400)}`)
    .join("\n");

async function readCode(
  input: Record<string, unknown>,
  store: CodeStore,
): Promise<ToolOutcome> {
  const index = await store.index();
  if (!index) return unavailable(store, "Read code");
  const path = String(input.path ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/^(docs\/)?experiment\//, "")
    .replace(/^compiler\//, "");
  const entry = index.files.find((f) => f.p === path);
  if (!entry) {
    const near = nearPaths(index, path);
    return {
      result: `No file "${path}" in the index.${
        near.length
          ? ` Did you mean: ${near.join(", ")}?`
          : " Use search_code to find the path."
      }`,
      isError: true,
      activity: `Read code — no file ${clip(path, 50)}`,
    };
  }
  const text = await store.file(path);
  if (text === null)
    return {
      result: `"${path}" is in the index but could not be fetched.`,
      isError: true,
      activity: `Read code — ${clip(path, 50)} unreadable`,
    };
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  const total = lines.length;
  const head = `${path} (${total} lines)${entry.h ? ` — ${entry.h}` : ""}`;

  const find = String(input.find ?? "").trim();
  if (find) {
    let re: RegExp;
    try {
      re = new RegExp(find, "i");
    } catch {
      re = new RegExp(escapeRegex(find), "i");
    }
    const context = Math.max(0, Math.min(12, Number(input.context) || 4));
    const matchLines: number[] = [];
    for (let i = 0; i < total && matchLines.length < FIND_MAX_MATCHES; i++)
      if (re.test(lines[i])) matchLines.push(i);
    if (!matchLines.length)
      return {
        result: `${head}\nNothing in it matches /${find}/.`,
        activity: `Read ${clip(path, 50)} — nothing matches “${clip(
          find,
          30,
        )}”`,
      };
    // Merge overlapping windows so a cluster of hits reads as one excerpt.
    const windows: [number, number][] = [];
    for (const i of matchLines) {
      const a = Math.max(0, i - context);
      const b = Math.min(total - 1, i + context);
      const last = windows[windows.length - 1];
      if (last && a <= last[1] + 1) last[1] = Math.max(last[1], b);
      else windows.push([a, b]);
    }
    const parts = windows.map(
      ([a, b]) =>
        `lines ${a + 1}–${b + 1}:\n${numbered(lines.slice(a, b + 1), a + 1)}`,
    );
    const more =
      matchLines.length >= FIND_MAX_MATCHES
        ? `\n… more matches beyond the first ${FIND_MAX_MATCHES}; refine the pattern or read a range.`
        : "";
    return {
      result: capResult(
        `${head}\n${matchLines.length} match${
          matchLines.length === 1 ? "" : "es"
        } for /${find}/\n\n${parts.join("\n\n")}${more}`,
      ),
      activity: `Read ${clip(path, 50)} — ${matchLines.length} match${
        matchLines.length === 1 ? "" : "es"
      } for “${clip(find, 30)}”`,
    };
  }

  const start = Math.max(
    1,
    Math.min(total, Math.floor(Number(input.start)) || 1),
  );
  const wanted =
    Math.floor(Number(input.end)) || start + READ_DEFAULT_LINES - 1;
  const end = Math.max(
    start,
    Math.min(total, wanted, start + READ_MAX_LINES - 1),
  );
  const tail =
    end < total
      ? `\n… continues to line ${total}; read_code with start ${
          end + 1
        } for more.`
      : "";
  return {
    result: capResult(
      `${head}\nlines ${start}–${end} of ${total}:\n${numbered(
        lines.slice(start - 1, end),
        start,
      )}${tail}`,
    ),
    activity: `Read ${clip(path, 50)} lines ${start}–${end}`,
  };
}

/** Runs a code tool; `store` is injectable for tests. */
export async function runCodeTool(
  name: string,
  input: Record<string, unknown>,
  store: CodeStore = codeStore,
): Promise<ToolOutcome> {
  switch (name) {
    case "search_code":
      return searchCode(input, store);
    case "read_code":
      return readCode(input, store);
    default:
      return {
        result: `Unknown code tool "${name}".`,
        isError: true,
        activity: `Unknown tool ${name}`,
      };
  }
}

/** The skill, as the registry (skills.ts) and the composer's menu see it. */
export const codeLookupSkill: Skill = {
  id: "code",
  title: "Code lookup",
  summary:
    "Read the EasyEyes source to answer how-it-works questions: what a parameter does at run time, how the compiler checks something, where a value is computed.",
  trigger: CODE_TRIGGER,
  // Not in the menu for now: a lookup needs the scientist's question, so it
  // has nothing to run on its own. "/code …" still turns it on.
  menu: false,
  tools: CODE_TOOLS,
  toolNames: CODE_TOOL_NAMES,
  systemBlock: () => codeSkillBlock(),
  run: (name, input) => runCodeTool(name, input),
};
