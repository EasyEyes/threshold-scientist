import { analyseGlossaryPaths } from "../../threshold/preprocess/phrasePathAnalysis";
import { checkStudyGlossaryAnalysis } from "../../threshold/preprocess/studyGlossaryAnalysis";
import { initGlossary } from "../../threshold/parameters/glossaryRegistry";
import { ExperimentTable } from "../../threshold/preprocess/experimentTable";
jest.mock("../../threshold/components/easyeyesBaseUrl", () => ({
  getEasyEyesBaseUrl: async () => "",
}));
const site = {
  id: "g1",
  file: "source.js",
  line: 1,
  keys: ["font"],
  guards: [
    {
      truth: true,
      text: "enabled",
      expression: { kind: "parameter", name: "enabled" },
    },
  ],
};
const index = {
  schemaVersion: 2,
  fingerprint: "b".repeat(64),
  parseFailures: [],
  coverage: { limitations: ["Caller entry unknown"] },
  sites: [],
  glossarySites: [site],
};
beforeEach(() =>
  initGlossary({
    version: "1",
    glossary: {
      font: { type: "text", default: "Arial" },
      enabled: { type: "boolean", default: "FALSE" },
      block: { type: "integer", default: "1" },
    },
    glossaryFull: [],
    superMatchingParams: [],
  }),
);
it("C8 keeps excluded, possible, unknown paths separate from runtime entry", () => {
  const report = analyseGlossaryPaths(index, [
    { name: "off", parameters: { enabled: false } },
    { name: "on", parameters: { enabled: true } },
    { name: "unknown", parameters: {} },
  ]);
  expect(report.sites[0].studyPaths.map((p) => p.localPath)).toEqual([
    "excluded",
    "possible",
    "unresolved",
  ]);
  expect(report.sites[0].runtimeReachability).toBe("unresolved");
  expect(report.candidateKeys).toEqual(["font"]);
});
it("C8 uses final normalized values locally and does not block an excluded path", async () => {
  const table = new ExperimentTable([
    ["block", "", "1"],
    ["enabled", "", "TRUE"],
    ["font", "", "Arial"],
  ]);
  global.fetch = jest.fn();
  const result = await checkStudyGlossaryAnalysis(
    table,
    [{ parameter: "font", key: "font" }],
    [{ enabled: "FALSE" }],
    index,
  );
  expect(result.errors.every((e) => e.kind !== "error")).toBe(true);
  expect(result.report.sites[0].studyPaths[0].localPath).toBe("excluded");
  expect(result.report.studyDefinedParameters).toEqual([
    { parameter: "font", key: "font" },
  ]);
  expect(global.fetch).not.toHaveBeenCalled();
});
it("C9 rejects incomplete and mismatched responses", async () => {
  process.env.PHRASE_ANALYSIS_FINGERPRINT = index.fingerprint;
  const table = new ExperimentTable([
    ["block", "", "1"],
    ["font", "", "Arial"],
  ]);
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      schemaVersion: 1,
      fingerprint: "stale",
      candidateKeys: [],
      sites: [],
      limitations: [],
      fullRuntimeAnswerAvailable: false,
    }),
  });
  const result = await checkStudyGlossaryAnalysis(table, []);
  expect(result.errors[0].kind).toBe("error");
  expect(result.report).toBeUndefined();
  delete process.env.PHRASE_ANALYSIS_FINGERPRINT;
});
