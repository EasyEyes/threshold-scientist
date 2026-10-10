// The assistant's opt-in code lookup (source/studio/assistant/codeSkill.ts)
// and the index it reads (server/writeCodeIndex.js). Hermetic: the index and
// the files come from an in-memory fake fetch; the generator runs on a
// temporary tree.

const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  buildIndex,
  headOf,
  symbolsOf,
} = require("../../server/writeCodeIndex.js");
const {
  CODE_TOOLS,
  CODE_INSTRUCTIONS,
  codeLookupSkill,
  codeSkillBlock,
  createCodeStore,
  describeCodeLayout,
  isCodeTool,
  runCodeTool,
} = require("../studio/assistant/codeSkill");
const {
  SKILLS,
  parseSkillTrigger,
  skillForTool,
  skillsUsedIn,
} = require("../studio/assistant/skills");

/* ------------------------------------------------------------------ */
/* The generator                                                       */
/* ------------------------------------------------------------------ */

describe("writeCodeIndex", () => {
  let root;
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "ee-code-index-"));
    const write = (rel, text) => {
      const abs = path.join(root, rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, text);
    };
    write(
      "threshold/components/fixation.ts",
      `/**
 * Draws the fixation cross. Also handles the
 * "track" variant.
 */
import { x } from "./y";

export function drawFixation(a: number) {}
export const FIXATION_SIZE = 3;
const helper = () => 1;
class Marker {}
export { helper as fixationHelper };
`,
    );
    write(
      "threshold/components/useCalibration.js",
      `import { readi18nPhrases } from "./readPhrases";
export const useCalibration = () => {};
`,
    );
    write("threshold/components/types.d.ts", "export type T = 1;\n");
    write("threshold/components/big.min.js", "x\n");
    write("threshold/components/addons/CHANGELOG.md", "# changes\n");
    write("threshold/components/tests/a.test.ts", "test()\n");
    write("threshold/components/node_modules/m/index.js", "x\n");
    write("threshold/preprocess/files.ts", "export const _loadFiles = [];\n");
    write(
      "threshold/README.md",
      "# EasyEyes Threshold\n\nRuns the **experiment** in the browser.\n\n## Development\n",
    );
    write("source/App.js", "// The compiler app.\nexport default 1;\n");
    write("source/__tests__/App.test.js", "test()\n");
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it("indexes source files with lines, head and symbols, skipping tests, builds and generated files", () => {
    const index = buildIndex(root);
    const paths = index.files.map((f) => f.p);
    expect(paths).toEqual([
      "source/App.js",
      "threshold/README.md",
      "threshold/components/fixation.ts",
      "threshold/components/useCalibration.js",
    ]);
    const fix = index.files.find(
      (f) => f.p === "threshold/components/fixation.ts",
    );
    expect(fix.l).toBe(11);
    expect(fix.h).toBe("Draws the fixation cross.");
    expect(fix.s).toEqual([
      "drawFixation",
      "FIXATION_SIZE",
      "helper",
      "Marker",
      "fixationHelper",
    ]);
    expect(index.roots.map((r) => r.dir)).toEqual([
      "source",
      "threshold/preprocess",
      "threshold/components",
    ]);
  });

  it("leaves the head empty when a file opens with code, and reads markdown headings as symbols", () => {
    const index = buildIndex(root);
    const cal = index.files.find((f) => f.p.endsWith("useCalibration.js"));
    expect(cal.h).toBe("");
    const readme = index.files.find((f) => f.p === "threshold/README.md");
    expect(readme.h).toBe("Runs the experiment in the browser.");
    expect(readme.s).toEqual(["EasyEyes Threshold", "Development"]);
  });

  it("head: first sentence of // comments too; symbols: typed consts and async functions", () => {
    expect(
      headOf(["// eslint-disable", "// Reads a cell. Then more."], ".ts"),
    ).toBe("Reads a cell.");
    expect(
      symbolsOf(
        [
          "export async function load() {}",
          "const table: TableState = make();",
          "export default class Foo {}",
          "  const inner = 1;",
        ],
        ".ts",
      ),
    ).toEqual(["load", "table", "Foo"]);
  });
});

/* ------------------------------------------------------------------ */
/* The skill                                                           */
/* ------------------------------------------------------------------ */

const FILES = {
  "threshold/components/fixation.ts": [
    "/** Draws the fixation cross. */",
    'import { paramReader } from "../parameters/paramReader";',
    "",
    "export function drawFixation(block_condition) {",
    '  const size = paramReader.read("fixationSizeDeg", block_condition);',
    '  const track = paramReader.read("fixationTrackBool", block_condition);',
    "  return { size, track };",
    "}",
    "",
    "export const FIXATION_SIZE = 3;",
  ].join("\n"),
  "threshold/preprocess/validateExperimentTable.ts": [
    "// Validates the table.",
    "export function checkFixation(df) {",
    '  if (df.has("fixationSizeDeg")) return [];',
    "  return [makeError('fixationSizeDeg')];",
    "}",
  ].join("\n"),
  "source/studio/README.md": "# Studio\n\nThe editor.\n",
};

const INDEX = {
  version: 1,
  generatedAt: "2026-10-06T00:00:00.000Z",
  roots: [
    { dir: "source", about: "The compiler app" },
    { dir: "threshold/preprocess", about: "The compiler" },
    { dir: "threshold/components", about: "The runtime" },
  ],
  files: Object.entries(FILES).map(([p, text]) => ({
    p,
    l: text.split("\n").length,
    b: text.length,
    h: p.endsWith("fixation.ts") ? "Draws the fixation cross." : "",
    s: p.endsWith("fixation.ts")
      ? ["drawFixation", "FIXATION_SIZE"]
      : p.endsWith(".ts")
      ? ["checkFixation"]
      : ["Studio"],
  })),
};

const response = (ok, body) => ({
  ok,
  status: ok ? 200 : 404,
  json: async () => body,
  text: async () => body,
});

/** A fetch over the fake tree; records what was asked for. */
const fakeFetch = (overrides = {}) => {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    if (url in overrides) return overrides[url]();
    if (url === "/compiler/studio-code-index.json")
      return response(true, INDEX);
    const p = url.replace(/^\/compiler\//, "");
    return p in FILES ? response(true, FILES[p]) : response(false, "");
  };
  fn.calls = calls;
  return fn;
};

describe("code lookup tools", () => {
  it("declares two read-only tools and recognizes them", () => {
    expect(CODE_TOOLS.map((t) => t.name)).toEqual(["search_code", "read_code"]);
    expect(isCodeTool("search_code")).toBe(true);
    expect(isCodeTool("build_study")).toBe(false);
  });

  it("search_code reports path/symbol matches and numbered line hits, with a scope", async () => {
    const fetch = fakeFetch();
    const store = createCodeStore(fetch);
    const out = await runCodeTool(
      "search_code",
      { query: "fixationSizeDeg" },
      store,
    );
    expect(out.isError).toBeUndefined();
    expect(out.result).toContain("Searched 3 files");
    expect(out.result).toContain("threshold/components/fixation.ts:5:");
    expect(out.result).toContain(
      "threshold/preprocess/validateExperimentTable.ts:3:",
    );
    expect(out.result).toContain("3 line hits in 2 files");
    expect(out.activity).toMatch(
      /Searched the code for “fixationSizeDeg” — 3 hits/,
    );

    const scoped = await runCodeTool(
      "search_code",
      { query: "fixation", scope: "threshold/preprocess" },
      store,
    );
    expect(scoped.result).toContain(
      "Searched 1 file under threshold/preprocess",
    );
    expect(scoped.result).not.toContain("threshold/components/fixation.ts:");
    // Files whose path or symbols match are listed from the index.
    const bySymbol = await runCodeTool(
      "search_code",
      { query: "drawFixation", scope: "threshold/components" },
      store,
    );
    expect(bySymbol.result).toContain("Files whose path or symbols match:");
    expect(bySymbol.result).toContain(
      "- threshold/components/fixation.ts (10 lines) — Draws the fixation cross.; symbols: drawFixation, FIXATION_SIZE",
    );
    // Files are fetched once and kept.
    const fileFetches = fetch.calls.filter((u) => !u.endsWith(".json"));
    expect(new Set(fileFetches).size).toBe(fileFetches.length);
  });

  it("search_code with no query lists the scope; an unknown scope and a bad regex are errors", async () => {
    const store = createCodeStore(fakeFetch());
    const list = await runCodeTool(
      "search_code",
      { scope: "threshold/components" },
      store,
    );
    expect(list.result).toMatch(/^1 file under threshold\/components:/);
    expect(list.result).toContain(
      "threshold/components/fixation.ts (10 lines)",
    );

    const none = await runCodeTool(
      "search_code",
      { query: "x", scope: "nope" },
      store,
    );
    expect(none.isError).toBe(true);
    expect(none.result).toContain(
      "Areas: source, threshold/preprocess, threshold/components",
    );

    const bad = await runCodeTool(
      "search_code",
      { query: "(", regex: true },
      store,
    );
    expect(bad.isError).toBe(true);
    expect(bad.result).toMatch(/invalid regular expression/);

    const re = await runCodeTool(
      "search_code",
      { query: 'paramReader\\.read\\("fixation\\w+"', regex: true },
      store,
    );
    expect(re.result).toContain("2 line hits in 1 file");
  });

  it("read_code returns a numbered range with a continuation note, clamped to the file", async () => {
    const store = createCodeStore(fakeFetch());
    const out = await runCodeTool(
      "read_code",
      { path: "threshold/components/fixation.ts", start: 4, end: 6 },
      store,
    );
    expect(out.result).toContain(
      "threshold/components/fixation.ts (10 lines) — Draws the fixation cross.",
    );
    expect(out.result).toContain("lines 4–6 of 10:");
    expect(out.result).toContain(
      "    4| export function drawFixation(block_condition) {",
    );
    expect(out.result).toContain(
      "… continues to line 10; read_code with start 7 for more.",
    );
    expect(out.activity).toBe(
      "Read threshold/components/fixation.ts lines 4–6",
    );

    const whole = await runCodeTool(
      "read_code",
      {
        path: "/compiler/threshold/components/fixation.ts",
        start: 9,
        end: 999,
      },
      store,
    );
    expect(whole.result).toContain("lines 9–10 of 10:");
    expect(whole.result).not.toContain("continues");
  });

  it("read_code with find returns matching lines with merged context", async () => {
    const store = createCodeStore(fakeFetch());
    const out = await runCodeTool(
      "read_code",
      {
        path: "threshold/components/fixation.ts",
        find: "paramReader\\.read",
        context: 1,
      },
      store,
    );
    expect(out.result).toContain("2 matches for /paramReader\\.read/");
    // Lines 5 and 6 with one line of context each merge into 4–7.
    expect(out.result).toContain("lines 4–7:");
    expect(out.result).not.toContain("lines 5–6");
    expect(out.activity).toMatch(/2 matches/);

    const miss = await runCodeTool(
      "read_code",
      { path: "threshold/components/fixation.ts", find: "zzz" },
      store,
    );
    expect(miss.result).toContain("Nothing in it matches /zzz/.");
  });

  it("read_code refuses a path that is not indexed, with near names", async () => {
    const store = createCodeStore(fakeFetch());
    const out = await runCodeTool(
      "read_code",
      { path: "threshold/components/Fixation.js" },
      store,
    );
    expect(out.isError).toBe(true);
    expect(out.result).toContain(
      "Did you mean: threshold/components/fixation.ts?",
    );
  });

  it("when the index is not served, both tools and the system block say so", async () => {
    const store = createCodeStore(
      fakeFetch({
        "/compiler/studio-code-index.json": () => response(false, null),
      }),
    );
    const out = await runCodeTool("search_code", { query: "x" }, store);
    expect(out.isError).toBe(true);
    expect(out.result).toContain(
      "Code lookup is not available in this deployment: the code index answered 404",
    );
    const block = await codeSkillBlock(store);
    expect(block.text).toContain(CODE_INSTRUCTIONS);
    expect(block.text).toContain(
      "The code index is not available in this deployment (the code index answered 404)",
    );
  });

  it("the system block carries the instructions and a map of the source", async () => {
    const store = createCodeStore(fakeFetch());
    const block = await codeSkillBlock(store);
    expect(block.type).toBe("text");
    expect(block.cache_control).toBeUndefined();
    expect(block.text.startsWith("CODE LOOKUP (on)")).toBe(true);
    expect(block.text).toContain(
      "SOURCE MAP (3 files, paths under docs/experiment; index from 2026-10-06)",
    );
    expect(block.text).toContain("threshold/components/ — The runtime");
    expect(describeCodeLayout(INDEX)).toContain(
      "source/ — The compiler app\n  studio/ (1)",
    );
  });
});

describe("skills registry", () => {
  it("lists code lookup as a skill with its tools and trigger", () => {
    expect(SKILLS.map((s) => s.id)).toContain("code");
    expect(codeLookupSkill.title).toBe("Code lookup");
    expect(codeLookupSkill.trigger).toBe("/code");
    expect(codeLookupSkill.tools).toBe(CODE_TOOLS);
    expect(skillForTool("search_code")).toBe(codeLookupSkill);
    expect(skillForTool("read_code")).toBe(codeLookupSkill);
    expect(skillForTool("build_study")).toBeUndefined();
  });

  it("the skill's run and systemBlock are the code tools", async () => {
    const out = await codeLookupSkill.run("read_code", { path: "nope" });
    // No index in jsdom: the tool says code lookup is unavailable here.
    expect(out.isError).toBe(true);
    expect(out.result).toMatch(/Code lookup is not available/);
    const block = await codeLookupSkill.systemBlock();
    expect(block.text).toContain(CODE_INSTRUCTIONS);
  });

  it("parses a leading trigger and leaves other messages alone", () => {
    expect(parseSkillTrigger("/code how is fixation drawn?")).toEqual({
      text: "how is fixation drawn?",
      skill: codeLookupSkill,
    });
    expect(parseSkillTrigger("  /CODE\nwhere is QUEST?")).toEqual({
      text: "where is QUEST?",
      skill: codeLookupSkill,
    });
    expect(parseSkillTrigger("/code")).toEqual({
      text: "",
      skill: codeLookupSkill,
    });
    expect(parseSkillTrigger("/coder is a word")).toEqual({
      text: "/coder is a word",
      skill: null,
    });
    expect(parseSkillTrigger("set /code in the cell")).toEqual({
      text: "set /code in the cell",
      skill: null,
    });
  });

  it("knows which skills a transcript has already used", () => {
    const plain = [
      { role: "user", content: [{ type: "text", text: "hi" }] },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: "1", name: "build_study", input: {} },
        ],
      },
    ];
    expect([...skillsUsedIn(plain)]).toEqual([]);
    expect([
      ...skillsUsedIn([
        ...plain,
        {
          role: "assistant",
          content: [
            { type: "tool_use", id: "2", name: "read_code", input: {} },
          ],
        },
      ]),
    ]).toEqual(["code"]);
  });
});
