# EasyEyes Studio (demo)

A proof-of-concept editor for EasyEyes experiment tables: **the same compiler,
running live while you type, instead of after you upload.**

The pitch in one sentence: same spreadsheet format, same 52 validation checks,
same glossary, same export files — we only moved the feedback loop from
minutes (edit in Excel → zip → upload → read errors → repeat) to milliseconds.

## What it does

- **Imports** any existing experiment `.csv` / `.xlsx` (identical parsing to
  the production compiler: first sheet → CSV → PapaParse), or starts from the
  bundled example tables.
- **Live validation** — every keystroke (debounced) runs the production
  `TABLE_CHECKS` from `threshold/preprocess/validateExperimentTable.ts`, plus
  the block-presence check. Error and hint text is the compiler's own HTML,
  including the "did you mean…" suggestions and column letters.
- **Type-aware cells** — booleans and categorical parameters become dropdowns
  populated from the glossary; defaults show as placeholders; underscore
  convention is visualized (hatched cells).
- **Parameter autocomplete** — fuzzy search over the 593-parameter glossary
  with type, default, and explanation; inserts alphabetically. Click a
  parameter name for its full glossary entry; double-click to rename.
- **Parameter catalog** ("Add parameters…" / "Browse by category…") — the
  whole glossary grouped into ~25 topic categories (Calibration, Reading,
  Fonts, Threshold, Sound, …) derived from the naming conventions
  (`src/categories.ts`), with per-category present/total counts. The first
  group is "★ Recommended for <targetKind>", computed from the table's
  current `targetKind`/`targetTask`.
- **Templates** — the "New / open…" menu offers compile-clean starters
  (Blank, Letter crowding, Letter acuity, Reading) built by patching the real
  example tables (`src/templates.ts`), alongside the raw example files.
- **Resource awareness** — the table itself announces which files it needs
  (fonts with `fontSource=file`, consent/debrief forms, sound folders, phrases
  spreadsheets); drop files and watch the checklist go green. No more zip
  assembly by memory.
- **~Tilde phrase resolution** — drop a `*.phrases.xlsx` and tilde values
  (`~fontCharacterSet`, `~LanguageDirection`, …) resolve through the
  production `resolveTildeValues` + `parsePhraseFile` before validation,
  in the language chosen by `_language`. Without the file, you get the
  compiler's own "tilde value requires phrase table" error. A sample pair
  lives in `testdata/`.
- **Readable language codes** — `_language` and `fontLanguage` dropdowns
  label each BCP-47 code with its English name ("en — English",
  "zh-Hans — Simplified Chinese").
- **Round-trip export** — `.csv`, `.xlsx`, or a `.source.zip` (table +
  dropped resources) that the current compiler accepts unchanged.

## What it reuses (no forks, no mocks)

| Piece                 | Source                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Table model           | `../threshold/preprocess/experimentTable.ts`                                                                                 |
| All validation checks | `../threshold/preprocess/validateExperimentTable.ts`                                                                         |
| Block check           | `../threshold/preprocess/experimentFileChecks.ts`                                                                            |
| Tilde resolution      | `../threshold/preprocess/resolveTildeValues.ts`                                                                              |
| Phrase-file parser    | `../../source/components/parsePhraseFile.ts`                                                                                 |
| Column letters        | `../threshold/preprocess/utils.ts`                                                                                           |
| Glossary registry     | `../threshold/parameters/glossaryRegistry.ts`                                                                                |
| Glossary data         | `src/glossarySnapshot.js` (copy of `website/glossary_local.js`, v28.0 — refresh with `npm run glossary:local` in `website/`) |

The existing compiler and upload flow are untouched; this app only imports
from them.

## Run it

```bash
cd website/docs/experiment/studio
npm install
npm run dev     # http://localhost:5199
```

Requires `website/docs/experiment/node_modules` to exist (run `npm install`
there once), since the compiler sources resolve their dependencies from it.

The UI follows the EasyEyes design language (palette and button styles from
`source/css/root.scss` / `Step.scss`, logo from `docs/media`).

## Demo script (2 minutes)

1. Open **Examples → Reading experiment** — status pill says "✓ would compile".
2. Double-click `readingCorpus`, rename to `readingCorpuss` — two production
   errors appear instantly, including "The closest supported parameter is
   readingCorpus — is that what you meant?" Fix it, watch the pill go green.
3. Type an `abc` into `conditionTrials` — "must be integer" with the column
   letter, live.
4. Set `fontSource` to `file` — the Resources panel demands the font file.
5. Click **Download .source.zip** — the exact artifact today's pipeline takes.

## Not in the demo (deliberately)

conditionEnabled filtering, font-content checks
(shaping/features need the uploaded font bytes), Prolific checks, and the
Pavlovia upload step. All of these reuse points exist in the same modules and
can be wired the same way.
