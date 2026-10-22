import {
  collectStudyGlossaryReferences,
  validateGlossaryAudit,
  checkGlossaryAudit,
} from "../../threshold/preprocess/glossaryAudit";
import { initGlossary } from "../../threshold/parameters/glossaryRegistry";
import {
  __resetGlossaryRowsForTests,
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
it("C2 blocks unused study definitions with exact parameter-row links", async () => {
  await loadGlossaryRows(async () => ({
    ok: true,
    text: async () =>
      "INPUT PARAMETER,TYPE\nfont,text\noldFont,text\nquestionAndAnswer@@,text",
  }));
  const errors = validateGlossaryAudit(
    [{ parameter: "oldFont", key: "oldFont" }],
    audit,
  );
  expect(errors[0].kind).toBe("error");
  expect(errors[0].message).toContain("range=A3:B3");
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
  expect(errors[0].message).toContain("range=A2:B2");
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
it("C5 retries an unavailable audit on the next compile", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: false })
    .mockResolvedValueOnce({ ok: true, json: async () => audit });
  expect((await checkGlossaryAudit([["font", "", "Arial"]]))[0].name).toBe(
    "Glossary audit unavailable",
  );
  expect(await checkGlossaryAudit([["font", "", "Arial"]])).toEqual([]);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
it("does not fetch reports for empty or unknown-only explicit input", async () => {
  global.fetch = jest.fn();
  expect(
    await checkGlossaryAudit([
      ["font", "", ""],
      ["unknown", "", "x"],
    ]),
  ).toEqual([]);
  expect(global.fetch).not.toHaveBeenCalled();
});
it("escapes parameter and audit metadata in compiler error HTML", () => {
  const errors = validateGlossaryAudit(
    [{ parameter: "<img src=x onerror=alert(1)>", key: "oldFont" }],
    { ...audit, id: "<script>" },
  );
  expect(errors[0].message).not.toContain("<img");
  expect(errors[0].message).toContain("&lt;script&gt;");
});
