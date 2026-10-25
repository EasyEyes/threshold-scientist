# Study phrase analysis during compilation

The compiler combines phrase definition checks with source analysis:

1. Explicit `EE_`, `RC_`, and `T_` references in enabled original study cells must exist in the phrase data loaded by the compiler (column A of International Phrases). A missing key blocks compilation; translation columns are not checked. Empty or absent translations are allowed. The compiler does not require membership in a source-usage audit, so a defined key such as `EE_Translator` is accepted even if that audit omits it.
2. The final normalized condition parameters are evaluated against a source index built for the compiler deployment. An unavailable, malformed, or mismatched analysis blocks compilation. Source candidate keys absent from column A of International Phrases produce a warning with instructions for scientists. Translation values and the selected language do not affect this check. Invalid `_language` values are independently blocked by glossary category validation.

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

Local Node compilation uses the same evaluator with the build-generated index, without browser APIs or a network request for path analysis. `LocalCompileOptions.phraseAnalysisIndex` can supply an explicit trusted index. Explicit phrase references are checked against the loaded phrase catalog, without requesting a phrase-usage audit. The separate glossary-usage audit remains required.

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

## Scientist warning preview

Missing source keys appear one per line below `⚠️ WARNING: N missing phrases`, followed by the “CAN I RUN THE STUDY?” and “REPORT THE PROBLEM.” instructions. The count uses the singular form for one key. The unused `simulateRuntimeError.js` helper was removed, so its intentionally absent `T_thisPhraseDoesNotExist` key no longer enters the source index.

These screenshots use the compiler UI test harness with one missing key:

[Desktop preview](screenshots/compiler-missing-phrases-desktop.png) · [Mobile preview](screenshots/compiler-missing-phrases-mobile.png)
