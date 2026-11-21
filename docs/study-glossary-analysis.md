# Glossary checks during study compilation

The compiler checks explicit glossary parameter rows after disabled conditions
have been removed and before generating condition files. Blank rows and implicit
defaults are outside the explicit usage check. Unknown parameter names remain the
responsibility of the existing parameter-name validation.

## Optional usage audit

`GET /.netlify/functions/glossary-audit-compiler` reads the latest completed
`glossaryAuditRuns` report. It does not start audits or write study data. Queued,
running, and failed newer runs do not hide the completed report. The adapter
preserves the report's classifications: referenced `obsoleteUsed` entries remain
in the used-key set for this check. Existing obsolete-parameter validation remains.

The web compiler skips the usage audit request. Standard parameter validation
still blocks unrecognized names, invalid values, and obsolete definitions,
including numbered parameters that inherit an obsolete definition.

Local examples use a complete audit report to detect a Glossary version
mismatch. A confirmed mismatch triggers one attempt per command to refresh both
catalogs and recompile. Missing, malformed, incomplete, and unused-key findings
produce no compiler warnings.

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
site alone never causes a blocking unused-parameter error. Web compilation
continues silently if the analysis is unavailable, malformed, or mismatched.
Local examples require a valid source index.
No browser replay or submitted source execution happens during compilation.

## Local compilation and tests

`LocalCompileOptions.glossaryAudit` accepts a saved completed compiler-adapter
report. Without one, local compilation checks the API when the study has explicit
Glossary references and has passed parameter validation. The result exposes the
version mismatch separately from compiler alerts. `phraseAnalysisIndex` supplies
the shared local source index for both phrase and glossary path analysis.

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
