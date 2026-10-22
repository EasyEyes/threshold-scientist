# Glossary checks during study compilation

The compiler checks explicit glossary parameter rows after disabled conditions
have been removed and before generating condition files. Blank rows and implicit
defaults are outside the explicit usage check. Unknown parameter names remain the
responsibility of the existing parameter-name validation.

## Blocking usage check

`GET /.netlify/functions/glossary-audit-compiler` reads the latest completed
`glossaryAuditRuns` report. It does not start audits or write study data. Queued,
running, and failed newer runs do not hide the completed report. The adapter
preserves the report's classifications: referenced `obsoleteUsed` entries remain
in the used-key set for this check. Existing obsolete-parameter validation remains.

A study-defined parameter classified as `unused` produces a blocking **Glossary
parameter not audited as used** error. The message names the actual study parameter
and links to its definition's full row in the published Google Sheets glossary.
For example, `questionAndAnswer01` is audited and linked through
`questionAndAnswer@@`. The existing glossary CSV row map supplies the link;
if the row map cannot be loaded, the existing whole-sheet fallback applies.
HTML values in messages are escaped.

The report must match the glossary version loaded by the compiler. Missing,
malformed, overlapping, incomplete, or version-mismatched reports block compilation
with **Glossary audit unavailable** rather than fabricating an unused result.
Failures are not cached; the next compile retries. A new glossary version requires
a completed audit of that version before this check can succeed.

This usage audit records source references. In particular, a glossary-wide data
logging loop can establish a source reference without establishing task-specific
consumption. The unused classification is not a proof of every runtime path.

## Study-specific source paths

`npm run phrase-analysis:build` now includes `glossarySites` in the existing cached
source index. Direct `read`, `has`, and `readMatching` calls on receivers named
`paramReader`, `reader`, and `ParamReader` are indexed. Receiver names are a
heuristic rather than proven object types. Simple literal/variable alternatives
are retained; unsupported dynamic names, regex expansion, numbered constructions,
and wrapper forwarding remain unresolved.

The shared `POST /.netlify/functions/study-phrase-analysis` endpoint accepts
`analysis: "glossary"` with the same request schema, size limits, normalized
condition parameters, and source fingerprint as phrase analysis. Omitting
`analysis` preserves the phrase response. The compiler sends parameters used in
guards from both sets of sites. Analysis is built once per source build, never
rebuilt for each study.

The report is stored in `user.currentExperiment.glossaryAnalysis`, with the loaded
glossary version and explicit parameter references. It is cleared at the start of
each compile. Source path states are `possible`, `excluded`, or `unresolved` for
each enabled condition. Caller/runtime entry stays unresolved; a locally excluded
site alone never causes a blocking unused-parameter error. An unavailable,
malformed, or build-mismatched analysis blocks compilation like phrase analysis.
No browser replay or submitted source execution happens during compilation.

## Local compilation and tests

`LocalCompileOptions.glossaryAudit` accepts a saved completed compiler-adapter
report and validates it using the same rules as the web response. Without one,
the normal API is required. `phraseAnalysisIndex` supplies the shared local source
index for both phrase and glossary path analysis. Tests inject the external audit
boundary explicitly; production never synthesizes a used-key list.

Run from website:

```sh
node --test netlify/functions/glossary-audit/*.test.mjs
npm run phrase-analysis:build
npx tsx --test netlify/functions/study-phrase-analysis/handler.test.ts
```

Run from docs/experiment:

```sh
npm test -- --runInBand --runTestsByPath source/__tests__/glossaryAudit.test.js source/__tests__/studyGlossaryAnalysis.test.js source/__tests__/internationalPhraseAudit.test.js source/__tests__/studyPhraseAnalysis.test.js
npm run check:ts
```

Run from docs/experiment/threshold:

```sh
npm test -- --runInBand --runTestsByPath tests/localCompileFidelity.test.ts tests/glossaryLink.test.ts
npm run build
```
