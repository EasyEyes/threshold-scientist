import { checkStudyGlossaryAnalysis } from "../../threshold/preprocess/studyGlossaryAnalysis";
import { checkStudyPhraseAnalysis } from "../../threshold/preprocess/studyPhraseAnalysis";
import { ExperimentTable } from "../../threshold/preprocess/experimentTable";

import { initGlossary } from "../../threshold/parameters/glossaryRegistry";
beforeEach(() =>
  initGlossary({
    version: "test",
    glossary: {},
    glossaryFull: [],
    superMatchingParams: [],
  }),
);

it.each([
  ["glossary", checkStudyGlossaryAnalysis],
  ["phrase", checkStudyPhraseAnalysis],
])("separates %s deployment details from user recovery", async (_, check) => {
  const previous = process.env.PHRASE_ANALYSIS_FINGERPRINT;
  delete process.env.PHRASE_ANALYSIS_FINGERPRINT;
  const quiet = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    const { errors } = await check(
      new ExperimentTable([["block", "", "1"]]),
      [],
    );
    const error = errors.find((item) =>
      item.name.includes("analysis unavailable"),
    );
    expect(error.kind).toBe("error");
    expect(error.message).toContain(
      '<span class="alert-section"><strong>For developers.</strong>',
    );
    expect(error.hint).toBe("Reload the compiler and try again.");
  } finally {
    quiet.mockRestore();
    if (previous === undefined) delete process.env.PHRASE_ANALYSIS_FINGERPRINT;
    else process.env.PHRASE_ANALYSIS_FINGERPRINT = previous;
  }
});
