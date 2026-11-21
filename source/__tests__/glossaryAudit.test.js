import {
  collectStudyGlossaryReferences,
  validateGlossaryAudit,
  hasGlossaryAuditVersionMismatch,
} from "../../threshold/preprocess/glossaryAudit";
import { initGlossary } from "../../threshold/parameters/glossaryRegistry";
import {
  __resetGlossaryRowsForTests,
  linkGlossaryParameters,
  loadGlossaryRows,
} from "../../threshold/parameters/glossaryLink";
jest.mock("../../threshold/components/easyeyesBaseUrl", () => ({
  getEasyEyesBaseUrl: async () => "",
}));
const audit = {
  id: "audit",
  generatedAt: "2026-10-20",
  glossaryVersion: "1",
  usedKeys: ["font", "questionAndAnswer@@"],
  unusedKeys: ["oldFont"],
};
beforeEach(() => {
  initGlossary({
    version: "1",
    glossary: {
      font: { type: "text" },
      oldFont: { type: "text" },
      "questionAndAnswer@@": { type: "text" },
    },
    glossaryFull: [],
    superMatchingParams: ["questionAndAnswer@@"],
  });
  __resetGlossaryRowsForTests();
});
afterEach(() => jest.restoreAllMocks());
it("C1/C6/C7 collects populated recognized rows and numbered definitions, not defaults or unknown names", () => {
  expect(
    collectStudyGlossaryReferences([
      ["font", "", "Arial"],
      ["oldFont", "", ""],
      ["questionAndAnswer01", "", "Question?"],
      ["#comment", "", "x"],
      ["unknown", "", "x"],
    ]),
  ).toEqual([
    { parameter: "font", key: "font" },
    { parameter: "questionAndAnswer01", key: "questionAndAnswer@@" },
  ]);
});
it("C2 warns about unused study definitions with exact parameter-row links", async () => {
  await loadGlossaryRows(async () => ({
    ok: true,
    text: async () =>
      "INPUT PARAMETER,TYPE\nfont,text\noldFont,text\nquestionAndAnswer@@,text",
  }));
  const errors = validateGlossaryAudit(
    [{ parameter: "oldFont", key: "oldFont" }],
    audit,
  );
  expect(errors[0].kind).toBe("warning");
  expect(linkGlossaryParameters(errors[0].message)).toContain("range=A3:B3");
  expect(errors[0].parameters).toEqual(["oldFont"]);
});
it("C6 uses the numbered family row while displaying the actual study name", async () => {
  await loadGlossaryRows(async () => ({
    ok: true,
    text: async () => "INPUT PARAMETER,TYPE\nquestionAndAnswer@@,text",
  }));
  const errors = validateGlossaryAudit(
    [{ parameter: "questionAndAnswer01", key: "questionAndAnswer@@" }],
    {
      ...audit,
      usedKeys: ["font"],
      unusedKeys: ["oldFont", "questionAndAnswer@@"],
    },
  );
  expect(errors[0].message).toContain("questionAndAnswer01");
  expect(linkGlossaryParameters(errors[0].message)).toContain("range=A2:B2");
});
it("C4 rejects mismatched, malformed, or incomplete reports rather than inventing unused keys", () => {
  for (const value of [
    {},
    { ...audit, glossaryVersion: "old" },
    { ...audit, unusedKeys: ["font"] },
    { ...audit, usedKeys: [] },
  ])
    expect(() =>
      validateGlossaryAudit([{ parameter: "font", key: "font" }], value),
    ).toThrow();
});
it("C5 checks the next local compile after an unavailable audit", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...audit, glossaryVersion: "old" }),
    });
  const refs = [{ parameter: "font", key: "font" }];
  expect(await hasGlossaryAuditVersionMismatch(refs)).toBe(false);
  expect(await hasGlossaryAuditVersionMismatch(refs)).toBe(true);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
it("does not fetch reports for empty or unknown-only explicit input", async () => {
  global.fetch = jest.fn();
  expect(
    await hasGlossaryAuditVersionMismatch(
      collectStudyGlossaryReferences([
        ["font", "", ""],
        ["unknown", "", "x"],
      ]),
    ),
  ).toBe(false);
  expect(global.fetch).not.toHaveBeenCalled();
});
it("escapes parameter HTML and omits internal audit metadata and removal history", () => {
  const errors = validateGlossaryAudit(
    [{ parameter: "<img src=x onerror=alert(1)>", key: "oldFont" }],
    {
      ...audit,
      id: "<script>",
      findings: [
        {
          key: "oldFont",
          removals: [{ repository: "threshold", removedAt: "2026-07-02" }],
        },
      ],
    },
  );
  expect(errors[0].message).not.toContain("<img");
  expect(errors[0].message).toContain("&lt;img");
  expect(errors[0].message + errors[0].hint).not.toMatch(
    /script|2026-|Removed from/,
  );
  expect(errors[0].hint).toContain("Review the Glossary entry");
});

it.each([
  ["unused", { ...audit, usedKeys: [], unusedKeys: ["font"] }, false],
  ["stale", { ...audit, glossaryVersion: "old" }, true],
  ["malformed", {}, false],
  [
    "incomplete and stale",
    { ...audit, glossaryVersion: "old", usedKeys: [] },
    false,
  ],
])(
  "reports a version mismatch only for a complete, stale audit (%s)",
  async (_, report, mismatch) => {
    expect(
      await hasGlossaryAuditVersionMismatch(
        [{ parameter: "font", key: "font" }],
        report,
      ),
    ).toBe(mismatch);
  },
);
