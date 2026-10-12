import {
  analysePhrasePaths,
  evaluatePhraseExpression,
} from "../../threshold/preprocess/phrasePathAnalysis";
import { validateStudyPhraseDefinitions } from "../../threshold/preprocess/studyPhraseAnalysis";
import { checkStudyPhraseAnalysis } from "../../threshold/preprocess/studyPhraseAnalysis";
import { ExperimentTable } from "../../threshold/preprocess/experimentTable";
import { initGlossary } from "../../threshold/parameters/glossaryRegistry";
import { initPhrases } from "../../threshold/parameters/phrasesRegistry";
jest.mock("../../threshold/components/easyeyesBaseUrl", () => ({
  getEasyEyesBaseUrl: async () => "",
}));

const index = {
  schemaVersion: 2,
  fingerprint: "a".repeat(64),
  parseFailures: [],
  coverage: { limitations: [] },
  sites: [
    {
      id: "source:1",
      file: "source.js",
      line: 1,
      keys: ["EE_test"],
      guards: [
        {
          truth: true,
          text: "enabled",
          expression: { kind: "parameter", name: "enabled" },
        },
      ],
    },
  ],
};
it("keeps unknown entry separate from locally excluded guards", () => {
  const result = analysePhrasePaths(index, [
    { name: "disabled", parameters: { enabled: false } },
    { name: "enabled", parameters: { enabled: true } },
  ]);
  expect(result.sites[0].studyPaths.map((p) => p.localPath)).toEqual([
    "excluded",
    "possible",
  ]);
  expect(result.sites[0].runtimeReachability).toBe("unresolved");
});
it("does not guess coercive JavaScript comparisons", () => {
  expect(
    evaluatePhraseExpression(
      {
        kind: "==",
        left: { kind: "literal", value: 0 },
        right: { kind: "literal", value: false },
      },
      {},
    ),
  ).toBeUndefined();
  expect(
    evaluatePhraseExpression(
      {
        kind: "===",
        left: { kind: "literal", value: 0 },
        right: { kind: "literal", value: false },
      },
      {},
    ),
  ).toBe(false);
});
it("blocks a study key even when used in the audit but absent from phrase data", () => {
  const errors = validateStudyPhraseDefinitions(
    [{ key: "EE_test", parameter: "instruction", column: 2 }],
    {},
    "en",
  );
  expect(errors[0].name).toBe("International phrase not defined");
  expect(errors[0].message).toContain("EE_test");
});
it("blocks missing translations without accepting inherited keys", () => {
  expect(
    validateStudyPhraseDefinitions(
      [{ key: "EE_test", parameter: "instruction", column: 2 }],
      { EE_test: { fr: "Bonjour" } },
      "en",
    )[0].name,
  ).toBe("International phrase translation not defined");
  expect(
    validateStudyPhraseDefinitions(
      [{ key: "EE_test", parameter: "instruction", column: 2 }],
      Object.create({ EE_test: { en: "Hello" } }),
      "en",
    ),
  ).toHaveLength(1);
});
it("accepts defined translations including intentionally empty strings", () => {
  expect(
    validateStudyPhraseDefinitions(
      [{ key: "EE_test", parameter: "instruction", column: 2 }],
      { EE_test: { en: "" } },
      "en",
    ),
  ).toEqual([]);
});

function setupStudy() {
  process.env.PHRASE_ANALYSIS_FINGERPRINT = index.fingerprint;
  initGlossary({
    glossary: {
      _language: { type: "categorical", default: "en" },
      block: { type: "integer", default: "1" },
      enabled: { type: "boolean", default: "FALSE" },
    },
    glossaryFull: [],
    superMatchingParams: [],
    version: "1",
  });
  initPhrases({ version: "test", phrases: { EE_test: { en: "Hello" } } });
  return new ExperimentTable([
    ["_language", "en"],
    ["block", "", "1"],
    ["enabled", "", "TRUE"],
  ]);
}
afterEach(() => {
  delete process.env.PHRASE_ANALYSIS_FINGERPRINT;
  jest.restoreAllMocks();
});
it("runs analysis even when the study has no explicit international key", async () => {
  const table = setupStudy();
  const report = analysePhrasePaths(index, [
    { name: "1_1", parameters: { enabled: true } },
  ]);
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => report });
  const result = await checkStudyPhraseAnalysis(table, []);
  expect(result.errors).toEqual([]);
  expect(result.report.phrasesVersion).toBe("test");
});
it("blocks unavailable and malformed analysis rather than reporting success", async () => {
  const table = setupStudy();
  for (const response of [
    { ok: false },
    { ok: true, json: async () => ({}) },
    {
      ok: true,
      json: async () => ({
        ...analysePhrasePaths(index, [
          { name: "test", parameters: { enabled: true } },
        ]),
        fingerprint: "stale",
      }),
    },
  ]) {
    global.fetch = jest.fn().mockResolvedValue(response);
    expect(
      (await checkStudyPhraseAnalysis(table, [])).errors.some(
        (error) => error.kind === "error",
      ),
    ).toBe(true);
  }
});
it("reports uncertain missing source keys as warnings, not proven reachable errors", async () => {
  const table = setupStudy();
  initPhrases({ version: "test", phrases: {} });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () =>
      analysePhrasePaths(index, [
        { name: "test", parameters: { enabled: true } },
      ]),
  });
  const result = await checkStudyPhraseAnalysis(table, []);
  expect(result.errors[0].kind).toBe("warning");
  expect(result.report.fullRuntimeAnswerAvailable).toBe(false);
});

it("uses a supplied local source index without needing a browser or network", async () => {
  const table = setupStudy();
  delete process.env.PHRASE_ANALYSIS_FINGERPRINT;
  global.fetch = jest.fn(() => {
    throw new Error("Offline");
  });
  const result = await checkStudyPhraseAnalysis(table, [], undefined, index);
  expect(result.errors).toEqual([]);
  expect(result.report.fingerprint).toBe(index.fingerprint);
  expect(global.fetch).not.toHaveBeenCalled();
});
