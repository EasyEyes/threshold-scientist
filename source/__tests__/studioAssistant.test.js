// The EasyEyes Assistant's tool layer and prompt (source/studio/assistant):
// the model proposes operations, these apply them to the table model and
// answer with the compiler's verdict. Hermetic: a small fake glossary, and
// the bundled csv examples/templates replaced (jest has no csv loader).

const mockGlossary = {
  _about: {
    name: "_about",
    type: "text",
    default: "",
    explanation: "Free-form notes about the experiment.",
    example: "",
    categories: [],
  },
  _consentForm: {
    name: "_consentForm",
    type: "text",
    default: "",
    explanation: "The consent form file. Shown before the experiment.",
    example: "consent.pdf",
    categories: [],
  },
  block: {
    name: "block",
    type: "integer",
    default: "",
    explanation: "The block number. Conditions in the same block interleave.",
    example: "1",
    categories: [],
  },
  conditionName: {
    name: "conditionName",
    type: "text",
    default: "",
    explanation: "A name for the condition.",
    example: "crowding",
    categories: [],
  },
  conditionTrials: {
    name: "conditionTrials",
    type: "integer",
    default: "35",
    explanation: "Number of trials in this condition.",
    example: "40",
    categories: [],
  },
  conditionEnabledBool: {
    name: "conditionEnabledBool",
    type: "boolean",
    default: "TRUE",
    explanation: "FALSE drops the condition from the compile.",
    example: "FALSE",
    categories: [],
  },
  font: {
    name: "font",
    type: "text",
    default: "Roboto Mono",
    explanation:
      "The font of the target. With fontSource file it names a file in EasyEyesResources.",
    example: "Sloan.woff2",
    categories: [],
  },
  fontSource: {
    name: "fontSource",
    type: "categorical",
    default: "google",
    explanation: "Where the font comes from.",
    example: "file",
    categories: ["google", "file", "browser"],
  },
  targetEccentricityXDeg: {
    name: "targetEccentricityXDeg",
    type: "numerical",
    default: "0",
    explanation:
      "Horizontal eccentricity of the target, in degrees.<br>Negative is left.",
    example: "-10",
    categories: [],
  },
};

jest.mock("../studio/glossary", () => ({
  isGlossaryReady: () => true,
  resolveEntry: (name) => mockGlossary[name],
  getEntry: (name) => mockGlossary[name],
  suggestibleEntries: () => Object.values(mockGlossary),
  glossaryVersion: () => "test-1",
  memoByVersion: (compute) => {
    let value;
    return () => (value === undefined ? (value = compute()) : value);
  },
}));

jest.mock("../studio/examples", () => ({
  EXAMPLES: {
    "Minimal experiment":
      '_about,"one block"\nblock,,1\nconditionName,,triplet\nfont,,"Roboto Mono"\nfontSource,,google\n',
  },
}));

jest.mock("../studio/templates", () => ({
  TEMPLATES: {
    "Blank (one block)": () => [
      ["_about", "new experiment"],
      ["block", "", "1"],
      ["conditionName", "", "condition1"],
    ],
  },
}));

// api.ts pulls in the Pavlovia sign-in client; not needed for the hedge.
jest.mock("../../threshold/preprocess/auth/config", () => ({
  getAuthConfig: () => ({ clientId: "", redirectUri: "" }),
}));
jest.mock("../../threshold/preprocess/auth/gitlabOAuthClient", () => ({
  GitLabOAuthClient: { loadFromStorage: () => null },
}));
jest.mock("../../threshold/components/easyeyesBaseUrl", () => ({
  getEasyEyesBaseUrl: async () => "",
}));

jest.mock("../studio/resources", () => ({
  RESOURCE_TYPE_LABELS: { fonts: "Fonts", forms: "Forms" },
  RESOURCE_TYPE_OF_KIND: { font: "fonts", form: "forms" },
  existsInUserResources: (n, res) =>
    !!res &&
    (res[n.kind === "font" ? "fonts" : "forms"] ?? []).includes(n.filename),
}));

// Required (not imported) so the mock data above exists when the factories
// run: ES imports would be hoisted above it.
const { matrixToState, stateToMatrix } = require("../studio/tableModel");
const {
  applyEdits,
  describeChecks,
  letterToValueIndex,
  runTool,
  similarParameterNames,
  valueIndexToLetter,
} = require("../studio/assistant/tools");
const {
  studioStateBlock,
  systemBlocks,
  glossaryIndex,
} = require("../studio/assistant/prompt");
const { segment } = require("../studio/assistant/RichText");
const { callAssistantHedged } = require("../studio/assistant/api");

describe("RichText", () => {
  it("sets glossary parameter names and backticked spans as code", () => {
    const parts = segment(
      "I set fontSource to file and moved targetEccentricityXDeg; the block and font rows are unchanged. Use `spacingDeg`.",
    );
    const code = parts.filter((p) => p.kind === "code");
    expect(code.map((p) => p.text)).toEqual([
      "fontSource",
      "targetEccentricityXDeg",
      "spacingDeg",
    ]);
    // Bare lowercase words that are parameters stay prose; backticks win.
    expect(code[0].parameter).toBe(true);
    expect(code[2].parameter).toBe(false);
    expect(parts.map((p) => p.text).join("")).toBe(
      "I set fontSource to file and moved targetEccentricityXDeg; the block and font rows are unchanged. Use spacingDeg.",
    );
  });

  it("recognizes underscore parameters and leaves camelCase non-parameters alone", () => {
    const parts = segment(
      "_consentForm is set; QuickBrownFox is not a parameter.",
    );
    expect(parts.filter((p) => p.kind === "code").map((p) => p.text)).toEqual([
      "_consentForm",
    ]);
  });
});

const base = () =>
  matrixToState([
    ["_about", "demo"],
    ["block", "", "1", "1"],
    ["conditionName", "", "left", "right"],
    ["font", "", "Sloan.woff2", "Sloan.woff2"],
    ["fontSource", "", "file", "file"],
  ]);

const noErrors = () => ({ errors: [], resourceErrors: [], needed: [] });

const ctxFor = (table, extra = {}) => ({
  table,
  name: "demo",
  signedIn: true,
  userResources: { fonts: ["Sloan.woff2"], forms: [] },
  droppedFileNames: [],
  focus: null,
  check: noErrors,
  ...extra,
});

describe("column letters", () => {
  it("map B to the experiment-wide slot and C onward to conditions", () => {
    expect(letterToValueIndex("B")).toBe(0);
    expect(letterToValueIndex("c")).toBe(1);
    expect(letterToValueIndex("A")).toBeNull();
    expect(letterToValueIndex("")).toBeNull();
    expect(valueIndexToLetter(0)).toBe("B");
    expect(valueIndexToLetter(2)).toBe("D");
  });
});

describe("applyEdits", () => {
  it("sets an existing cell and adds a missing parameter alphabetically", () => {
    const r = applyEdits(base(), [
      { op: "set", parameter: "font", column: "D", value: "Pelli.woff2" },
      { op: "set", parameter: "conditionTrials", column: "C", value: "40" },
    ]);
    expect(r.refused).toEqual([]);
    expect(r.applied).toBe(2);
    const m = stateToMatrix(r.table);
    expect(m.map((row) => row[0])).toEqual([
      "_about",
      "block",
      "conditionName",
      "conditionTrials",
      "font",
      "fontSource",
    ]);
    expect(m.find((row) => row[0] === "font")).toEqual([
      "font",
      "",
      "Sloan.woff2",
      "Pelli.woff2",
    ]);
    expect(m.find((row) => row[0] === "conditionTrials")).toEqual([
      "conditionTrials",
      "",
      "40",
      "",
    ]);
    expect(r.changed.sort()).toEqual(["conditionTrials", "font"]);
  });

  it("refuses names that are not in the glossary, with near matches", () => {
    const r = applyEdits(base(), [
      { op: "set", parameter: "fontsource", column: "C", value: "google" },
      { op: "set", parameter: "block", column: "C", value: "2" },
    ]);
    expect(r.applied).toBe(1);
    expect(r.refused).toHaveLength(1);
    expect(r.refused[0]).toMatch(/operation 1 \(set\)/);
    expect(r.refused[0]).toMatch(/fontSource/);
    expect(stateToMatrix(r.table).find((row) => row[0] === "block")[2]).toBe(
      "2",
    );
  });

  it("widens the table when a value lands past the last column", () => {
    const r = applyEdits(base(), [
      { op: "set", parameter: "conditionName", column: "E", value: "far" },
    ]);
    expect(r.table.conditionCount).toBe(3);
    expect(stateToMatrix(r.table).find((row) => row[0] === "block")).toEqual([
      "block",
      "",
      "1",
      "1",
      "",
    ]);
  });

  it("set_row writes B, C, D… in order and widens as needed", () => {
    const r = applyEdits(base(), [
      {
        op: "set_row",
        parameter: "targetEccentricityXDeg",
        values: ["", "-5", "5", "10"],
      },
    ]);
    expect(r.table.conditionCount).toBe(3);
    expect(
      stateToMatrix(r.table).find((row) => row[0] === "targetEccentricityXDeg"),
    ).toEqual(["targetEccentricityXDeg", "", "-5", "5", "10"]);
  });

  it("removes, comments and uncomments rows", () => {
    let r = applyEdits(base(), [
      { op: "remove", parameter: "_about" },
      { op: "comment", parameter: "fontSource" },
    ]);
    let names = r.table.rows.map((x) => x.name);
    expect(names).not.toContain("_about");
    expect(names).toContain("%fontSource");
    r = applyEdits(r.table, [{ op: "uncomment", parameter: "fontSource" }]);
    names = r.table.rows.map((x) => x.name);
    expect(names).toContain("fontSource");
    expect(names).not.toContain("%fontSource");
    expect(
      applyEdits(base(), [{ op: "remove", parameter: "nope" }]).refused[0],
    ).toMatch(/no row named/);
  });

  it("adds a column as a copy, removes a column, and disables one via conditionEnabledBool", () => {
    let r = applyEdits(base(), [{ op: "add_column", copy_of: "C" }]);
    expect(r.table.conditionCount).toBe(3);
    expect(
      stateToMatrix(r.table).find((row) => row[0] === "conditionName"),
    ).toEqual(["conditionName", "", "left", "right", "left"]);
    r = applyEdits(r.table, [{ op: "remove_column", column: "D" }]);
    expect(
      stateToMatrix(r.table).find((row) => row[0] === "conditionName"),
    ).toEqual(["conditionName", "", "left", "left"]);
    r = applyEdits(r.table, [{ op: "disable_column", column: "D" }]);
    expect(
      stateToMatrix(r.table).find((row) => row[0] === "conditionEnabledBool"),
    ).toEqual(["conditionEnabledBool", "", "", "FALSE"]);
    // Enabling again removes the now-blank row.
    r = applyEdits(r.table, [{ op: "enable_column", column: "D" }]);
    expect(r.table.rows.some((x) => x.name === "conditionEnabledBool")).toBe(
      false,
    );
    expect(
      applyEdits(base(), [{ op: "remove_column", column: "B" }]).refused[0],
    ).toMatch(/not a condition column/);
  });

  it("keeps the last condition column", () => {
    const one = matrixToState([["block", "", "1"]]);
    const r = applyEdits(one, [{ op: "remove_column", column: "C" }]);
    expect(r.applied).toBe(0);
    expect(r.refused[0]).toMatch(/last condition column/);
  });
});

describe("runTool", () => {
  it("looks up parameters with allowed values, and flags unknown ones", () => {
    const out = runTool(
      "lookup_parameters",
      { names: ["fontSource", "fontsize"] },
      ctxFor(base()),
    );
    expect(out.result).toMatch(/fontSource — type categorical/);
    expect(out.result).toMatch(/allowed values: google, file, browser/);
    expect(out.result).toMatch(/fontsize — UNKNOWN/);
    expect(out.activity).toBe("Looked up 2 parameters");
  });

  it("searches names and explanations", () => {
    const out = runTool(
      "search_parameters",
      { query: "eccentricity" },
      ctxFor(base()),
    );
    expect(out.result.split("\n")[0]).toMatch(
      /^targetEccentricityXDeg \(numerical; default 0\) — Horizontal/,
    );
    expect(out.result).not.toMatch(/<br>/);
  });

  it("starts from a template and reports the checks", () => {
    const check = jest.fn(noErrors);
    const out = runTool(
      "start_from",
      { source: "template", name: "Blank (one block)" },
      ctxFor(base(), { check }),
    );
    expect(out.table.rows.map((r) => r.name)).toEqual([
      "_about",
      "block",
      "conditionName",
    ]);
    expect(check).toHaveBeenCalledWith(out.table);
    expect(out.result).toMatch(
      /Compiler checks: 0 errors, 0 warnings — the table would compile/,
    );
    expect(
      runTool("start_from", { source: "example", name: "Nope" }, ctxFor(base()))
        .isError,
    ).toBe(true);
  });

  it("edits the table and hands back the compiler's verdict on the result", () => {
    const check = jest.fn((t) => ({
      errors: [
        {
          name: "Missing value",
          message: "<span>conditionTrials</span> needs a value",
          hint: "Give it <b>40</b>",
          context: "",
          kind: "error",
          parameters: ["conditionTrials"],
        },
      ],
      resourceErrors: [],
      needed: [
        { kind: "font", filename: "Sloan.woff2", params: ["font"] },
        { kind: "form", filename: "consent.pdf", params: ["_consentForm"] },
      ],
    }));
    const out = runTool(
      "edit_table",
      {
        operations: [
          {
            op: "set",
            parameter: "_consentForm",
            column: "B",
            value: "consent.pdf",
          },
        ],
      },
      ctxFor(base(), { check }),
    );
    expect(out.table.rows.some((r) => r.name === "_consentForm")).toBe(true);
    expect(out.result).toMatch(/1 operation applied\./);
    expect(out.result).toMatch(
      /- ERROR \[conditionTrials\] Missing value: conditionTrials needs a value Hint: Give it 40/,
    );
    expect(out.result).toMatch(/font Sloan.woff2 \(font\): present/);
    expect(out.result).toMatch(
      /form consent.pdf \(_consentForm\): MISSING from EasyEyesResources/,
    );
    expect(out.activity).toBe("Edited the table (1 change) · 1 error");
  });

  it("returns no table when every operation was refused", () => {
    const out = runTool(
      "edit_table",
      {
        operations: [
          { op: "set", parameter: "bogus", column: "C", value: "1" },
        ],
      },
      ctxFor(base()),
    );
    expect(out.table).toBeUndefined();
    expect(out.isError).toBe(true);
  });

  it("lists EasyEyesResources, and says so when signed out", () => {
    expect(
      runTool("list_resources", { kind: "fonts" }, ctxFor(base())).result,
    ).toBe("fonts (1): Sloan.woff2");
    expect(
      runTool("list_resources", {}, ctxFor(base(), { signedIn: false })).result,
    ).toMatch(/Not signed in/);
  });

  it("asks the scientist and renames the experiment", () => {
    const ask = runTool(
      "ask_user",
      { question: "Which font?", options: ["Sloan", "Pelli"] },
      ctxFor(base()),
    );
    expect(ask.ask).toEqual({
      question: "Which font?",
      options: ["Sloan", "Pelli"],
    });
    const named = runTool(
      "set_experiment_name",
      { name: "My crowding study!" },
      ctxFor(base()),
    );
    expect(named.name).toBe("My-crowding-study");
  });

  it("suggests near names", () => {
    expect(similarParameterNames("fontsource")[0]).toBe("fontSource");
    expect(similarParameterNames("targetEcc")[0]).toBe(
      "targetEccentricityXDeg",
    );
  });
});

describe("build_study and apply_knobs", () => {
  const cell = (table, name, ci) =>
    table.rows.find((r) => r.name === name)?.values[ci + 1];

  it("build_study replaces the table, names it, and asks the grid to reveal", () => {
    const out = runTool(
      "build_study",
      {
        spec: {
          recipe: "letter-crowding",
          name: "my crowding",
          conditions: [
            { eccentricityDeg: 5, side: "right" },
            { eccentricityDeg: 10, side: "right" },
          ],
          trials: 30,
          questionsBefore: [{ nickname: "AGE", question: "Age?" }],
        },
      },
      ctxFor(base()),
    );
    expect(out.isError).toBeFalsy();
    expect(out.reveal).toBe(true);
    expect(out.name).toBe("my-crowding");
    expect(out.table.conditionCount).toBe(3);
    expect(cell(out.table, "targetTask", 0)).toBe("questionAndAnswer");
    expect(cell(out.table, "targetEccentricityXDeg", 2)).toBe("10");
    expect(cell(out.table, "conditionTrials", 1)).toBe("30");
    expect(out.changedParams).toContain("block");
    expect(out.result).toMatch(/^Built: Letter crowding: 2 conditions/);
    expect(out.result).toMatch(/Table \(csv\):/);
    expect(out.result).toMatch(/Compiler checks: 0 errors/);
    expect(out.activity).toMatch(/Built letter crowding — 3 conditions/);
  });

  it("build_study refuses an unknown recipe with the list", () => {
    const out = runTool(
      "build_study",
      { spec: { recipe: "sound-x" } },
      ctxFor(base()),
    );
    expect(out.isError).toBe(true);
    expect(out.table).toBeUndefined();
    expect(out.result).toMatch(/letter-crowding/);
  });

  it("apply_knobs runs knobs in order and reports refusals without stopping", () => {
    const built = runTool(
      "build_study",
      {
        spec: {
          recipe: "letter-crowding",
          conditions: [{ eccentricityDeg: 5 }],
        },
      },
      ctxFor(base()),
    ).table;
    const out = runTool(
      "apply_knobs",
      {
        knobs: [
          { knob: "set_trials", args: { trials: 50 } },
          { knob: "mirror_conditions", args: {} },
          {
            knob: "set_eccentricity",
            args: { columns: ["Q"], eccentricityDeg: 3 },
          },
          { knob: "no_such_knob", args: {} },
          { knob: "set_for_all", args: { parameter: "notAParam", value: "1" } },
          {
            knob: "set_for_all",
            args: { parameter: "_about", value: "mirrored" },
          },
        ],
      },
      ctxFor(built),
    );
    expect(out.isError).toBeFalsy();
    expect(out.table.conditionCount).toBe(2);
    expect(cell(out.table, "conditionTrials", 1)).toBe("50");
    expect(cell(out.table, "targetEccentricityXDeg", 1)).toBe("-5");
    expect(out.table.rows.find((r) => r.name === "_about").values[0]).toBe(
      "mirrored",
    );
    expect(out.result).toMatch(/^3 knobs applied, 3 refused\./);
    expect(out.result).toMatch(
      /refused knob 3 \(set_eccentricity\): No condition "Q"/,
    );
    expect(out.result).toMatch(/refused knob 4 \(no_such_knob\): unknown knob/);
    expect(out.result).toMatch(
      /refused knob 5 \(set_for_all\): "notAParam" is not a glossary parameter/,
    );
    expect(out.changedParams).toEqual(
      expect.arrayContaining([
        "conditionTrials",
        "targetEccentricityXDeg",
        "_about",
      ]),
    );
    expect(out.activity).toMatch(/50 trials/);
  });

  it("apply_knobs with nothing applicable is an error and leaves the table", () => {
    const out = runTool(
      "apply_knobs",
      { knobs: [{ knob: "set_trials", args: {} }] },
      ctxFor(base()),
    );
    expect(out.isError).toBe(true);
    expect(out.table).toBeUndefined();
  });
});

describe("prompt", () => {
  it("splits instructions from the cached reference", () => {
    const blocks = systemBlocks();
    expect(blocks).toHaveLength(2);
    expect(blocks[0].cache_control).toBeUndefined();
    expect(blocks[1].cache_control).toEqual({ type: "ephemeral" });
    expect(blocks[1].text).toMatch(/GLOSSARY INDEX \(version test-1/);
    // The Study Builder's reference comes first: the spec, every recipe
    // with an example spec, every knob with its args.
    expect(blocks[1].text).toMatch(/^# RECIPES \(build_study\)/m);
    expect(blocks[1].text).toMatch(/^### letter-crowding — Letter crowding$/m);
    expect(blocks[1].text).toMatch(/Example: \{"recipe":"letter-crowding"/);
    expect(blocks[1].text).toMatch(/^# KNOBS \(apply_knobs/m);
    expect(blocks[1].text).toMatch(/^- set_eccentricity: /m);
    // start_from sources are listed by name only; recipes replace them.
    expect(blocks[1].text).toMatch(
      /- example "Minimal experiment" — one block/,
    );
    expect(blocks[1].text).toMatch(
      /- template "Blank \(one block\)" — new experiment/,
    );
    expect(blocks[1].text).not.toMatch(/\nblock,,1/);
  });

  it("indexes each parameter on one line with type, default and allowed values", () => {
    const index = glossaryIndex();
    expect(index).toMatch(
      /^fontSource \(categorical; default google; allowed google\|file\|browser\) — Where the font comes from\.$/m,
    );
    expect(index).toMatch(/^## Fonts$/m);
  });

  it("describes the Studio's state with the table as csv", () => {
    const block = studioStateBlock(ctxFor(base()));
    expect(block).toMatch(/experiment name: demo/);
    expect(block).toMatch(/^font,,Sloan.woff2,Sloan.woff2$/m);
    expect(block).toMatch(/selected in the grid: none/);
    expect(block).toMatch(/Compiler checks: 0 errors/);
  });

  it("tells the model which row or cell the scientist clicked", () => {
    expect(
      studioStateBlock(
        ctxFor(base(), { focus: { parameter: "font", column: null } }),
      ),
    ).toMatch(/selected in the grid: row font/);
    expect(
      studioStateBlock(
        ctxFor(base(), { focus: { parameter: "font", column: "D" } }),
      ),
    ).toMatch(/selected in the grid: cell font in column D/);
  });

  it("describeChecks counts warnings separately", () => {
    const text = describeChecks(
      {
        errors: [
          {
            name: "W",
            message: "m",
            hint: "",
            context: "",
            kind: "warning",
            parameters: [],
          },
        ],
        resourceErrors: [],
        needed: [],
      },
      ctxFor(base()),
    );
    expect(text).toMatch(/0 errors, 1 warning/);
    expect(text).toMatch(/- WARNING W: m/);
  });
});

describe("callAssistantHedged", () => {
  const reply = (tag) => ({
    content: [{ type: "text", text: tag }],
    stop_reason: "end_turn",
    usage: null,
    model: null,
  });
  /** A fake relay: `plan` maps mode ("normal" | "fast") to [delay, ok]. */
  const relay = (plan) => {
    const calls = [];
    const impl = (call, signal) =>
      new Promise((resolve, reject) => {
        const mode = call.mode ?? "normal";
        const [ms, ok] = plan[mode];
        calls.push({ mode, aborted: false });
        const entry = calls[calls.length - 1];
        const t = setTimeout(
          () =>
            ok ? resolve(reply(mode)) : reject(new Error(`${mode} failed`)),
          ms,
        );
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          entry.aborted = true;
          reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        });
      });
    return { impl, calls };
  };
  const call = { system: [], messages: [], tools: [] };

  it("a prompt normal round answers alone; no fast round is sent", async () => {
    const { impl, calls } = relay({ normal: [5, true], fast: [1, true] });
    const onHedge = jest.fn();
    const r = await callAssistantHedged(call, undefined, {
      hedgeAfterMs: 50,
      callImpl: impl,
      onHedge,
    });
    expect(r.content[0].text).toBe("normal");
    expect(calls.map((c) => c.mode)).toEqual(["normal"]);
    expect(onHedge).not.toHaveBeenCalled();
  });

  it("a slow normal round gets a fast round beside it; the first reply wins and the other is aborted", async () => {
    const { impl, calls } = relay({ normal: [500, true], fast: [10, true] });
    const onHedge = jest.fn();
    const r = await callAssistantHedged(call, undefined, {
      hedgeAfterMs: 20,
      callImpl: impl,
      onHedge,
    });
    expect(r.content[0].text).toBe("fast");
    expect(onHedge).toHaveBeenCalledTimes(1);
    expect(calls.map((c) => c.mode)).toEqual(["normal", "fast"]);
    expect(calls[0].aborted).toBe(true);
    expect(calls[1].aborted).toBe(false);
    // The fast round was sent with mode "fast" (a thought-free round).
  });

  it("the normal round still wins if it finishes before the fast one", async () => {
    const { impl, calls } = relay({ normal: [40, true], fast: [200, true] });
    const r = await callAssistantHedged(call, undefined, {
      hedgeAfterMs: 20,
      callImpl: impl,
    });
    expect(r.content[0].text).toBe("normal");
    expect(calls[1].aborted).toBe(true);
  });

  it("a normal round that times out after the hedge fired is covered by the fast one", async () => {
    const { impl } = relay({ normal: [30, false], fast: [60, true] });
    const r = await callAssistantHedged(call, undefined, {
      hedgeAfterMs: 10,
      callImpl: impl,
    });
    expect(r.content[0].text).toBe("fast");
  });

  it("errors before the hedge fires are final (sign-in, rate limit); both failing shows the normal round's error", async () => {
    const early = relay({ normal: [5, false], fast: [1, true] });
    await expect(
      callAssistantHedged(call, undefined, {
        hedgeAfterMs: 50,
        callImpl: early.impl,
      }),
    ).rejects.toThrow("normal failed");
    expect(early.calls.map((c) => c.mode)).toEqual(["normal"]);

    const both = relay({ normal: [60, false], fast: [30, false] });
    await expect(
      callAssistantHedged(call, undefined, {
        hedgeAfterMs: 10,
        callImpl: both.impl,
      }),
    ).rejects.toThrow("normal failed");
  });

  it("Stop aborts both rounds", async () => {
    const { impl, calls } = relay({ normal: [500, true], fast: [500, true] });
    const controller = new AbortController();
    const p = callAssistantHedged(call, controller.signal, {
      hedgeAfterMs: 10,
      callImpl: impl,
    });
    await new Promise((r) => setTimeout(r, 30));
    controller.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
    expect(calls.every((c) => c.aborted)).toBe(true);
  });
});
