# Study phrase analysis during compilation

The compiler combines three separate checks:

1. Explicit `EE_`, `RC_`, and `T_` references in enabled original study cells must belong to the latest completed audit's `used` keys. The existing `phrases-audit-compiler` adapter remains unchanged.
2. Those references must exist in the phrase data loaded by the compiler and have a string translation in the resolved study language. Intentionally empty strings remain valid, matching the runtime reader. A missing key or translation blocks compilation.
3. The final normalized condition parameters are evaluated against a source index built for the compiler deployment. An unavailable, malformed, or mismatched analysis blocks compilation. Source candidates without a translation produce a warning when runtime entry is unproven.

Custom symbols and their replacement text remain outside the explicit-reference check. Custom values can still resolve parameters used by the source guard analysis. The study and stored audit formats are unchanged.

## Source index and API

Run `npm run phrase-analysis:build` from the website repository. The Netlify build runs this command before building the compiler. It generates `netlify/functions/study-phrase-analysis/source-index.json`, which is ignored by Git and bundled into the function. Existing build artifacts are reused only when their source fingerprint and content checksum match. The index is not rebuilt for each study.

The indexer is adapted from the local `international-phrases-codeql/study-reachability` prototype. It follows direct phrase-reader calls, literal candidate keys, local guards, and named callers. The production index covers the deployed threshold source. Separately hosted calibrator bundles, wrapper forwarding, callbacks, scheduling, and dynamic key construction are not fully covered.

`POST /.netlify/functions/study-phrase-analysis` accepts:

```json
{
  "schemaVersion": 1,
  "fingerprint": "<64-character source fingerprint embedded in the compiler>",
  "conditions": [
    {
      "name": "condition-1",
      "parameters": { "_online2PayShow": "payAndTime" }
    }
  ]
}
```

Only parameters referenced by indexed guards are sent by the production compiler. This read-only endpoint does not store study configuration or execute submitted code. Requests are limited to 256 conditions and one million characters of JSON. It returns 400 for invalid input, 409 for a fingerprint mismatch, 413 for an oversized body, 415 for an unsupported content type, and 503 when analysis cannot be completed.

Successful responses include the fingerprint, candidate keys, source sites, condition-specific local path states (`possible`, `excluded`, or `unresolved`), and coverage limitations. `runtimeReachability` remains `unresolved`, and `fullRuntimeAnswerAvailable` is always false. A locally excluded call site does not establish that the key is unreachable elsewhere.

The compiler validates the response and adds phrase-data version, study language, original explicit references, definition errors, and uncertain candidate-definition issues. The current report can be downloaded from the **Phrase analysis** status line. The fingerprint prevents an old compiler tab from accepting an analysis for a newer source build; reload the compiler after a deployment mismatch.

Local Node compilation uses the same evaluator with the build-generated index, without browser APIs or a network request for path analysis. `LocalCompileOptions.phraseAnalysisIndex` can supply an explicit trusted index. The existing audit requirement for explicit references still applies.

## Blocking policy and limits

This integration does not execute Playwright, start Cloud Run jobs, or certify all runtime paths. Unproven source candidates are warnings rather than claims that a participant will execute those paths. Empty source matches and unobserved paths must not be treated as evidence of runtime unreachability.

To verify the integration locally:

```sh
# website
npm run phrase-analysis:build
npx tsx --test netlify/functions/study-phrase-analysis/handler.test.ts

# website/docs/experiment
npm test -- --runInBand --runTestsByPath source/__tests__/studyPhraseAnalysis.test.js source/__tests__/internationalPhraseAudit.test.js source/__tests__/StatusLines.language.test.js
npm run check:ts
```
