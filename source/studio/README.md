# EasyEyes Studio (beta)

A live editor for EasyEyes experiment tables: **the same compiler, running
while you type, instead of after you upload.** Same spreadsheet format, same
validation checks, same glossary, same export files — only the feedback loop
moved from minutes (edit in Excel → zip → upload → read errors → repeat) to
milliseconds.

## Status: beta — a Studio tab that compiles and previews

The studio lives inside the compiler page (title "EasyEyes Studio" with a
beta marker; the Compiler tab is unchanged), opened from the **Studio**
navbar tab (between Media and Hiring on every site page) or directly:

```
https://easyeyes.app/compiler/studio
```

The host serves the compiler page for that path (a 200 rewrite in
`netlify.toml`; the dev server's `historyApiFallback` does the same), and
`App.js` opens the panel when the path ends in `/studio`. Because the page's
assets are relative, the canonical form has no trailing slash. The
pre-release `?studio=1` flag still works and is rewritten to the path.

It follows the Media panel's pattern exactly: the tab is a plain link so it
works from any page before the bundle loads; once React is running
`source/App.js` takes the click over and opens the panel without a reload.
The studio is a lazy webpack chunk — nothing is downloaded until it is opened.
Once opened it stays mounted (hidden) while the compiler is showing, and the
compiler stays mounted while the studio is showing, so switching back and
forth loses nothing; Media and Studio close each other.

**Compile** (signed in, no table errors) writes the table to a `<name>.csv`
File and hands it — together with any resource files dropped in the studio —
to the compiler's `Table.compileFiles(files, "studio")`, the same entry the
Compiler tab's drop zone uses (`Table.onDrop` → `compileFiles(files,
"compiler")`): resources are saved to `EasyEyesResources`, the table is
compiled, uploaded to Pavlovia and set to RUNNING. Nothing about compilation
differs; the studio then shows the compiler view, where the progress dialog,
any compile errors, and the upload/run steps appear. Whatever the compiler was
showing — the Run page of an experiment just compiled, a previous experiment —
a Studio compile or preview first resets it to a fresh table step
(`App.resetCompilerForNewExperiment`). Missing resources do not disable
Compile (see Resource awareness below); the compile reports them exactly as
the Compiler tab would.

**Preview** (signed in, no errors) runs the experiment right away in a new
tab, with nothing uploaded. The files go through the very same
`Table.compileFiles` → `handleDrop` → `handleTable` → `preprocessExperimentFile`
as a compile, so validation is identical; the compile then stops before
`setRepoName`/upload. The files a compile would commit — minus the runtime —
are staged in a Cache under `/compiler/preview/<id>/` (`source/studio/preview.ts`)
and a service worker (`preview-sw.js`, scope `/compiler/preview/`) serves that
folder, falling back to the deployed runtime at `/compiler/threshold/` for
`js/threshold.min.js`, the WASM, the models and so on. The preview therefore
runs the exact runtime a compiled experiment would; outside Pavlovia the
runtime is in its local mode (as with `npm run examples`): data is offered as a
download at the end and nothing reaches Pavlovia. The runtime reads its
glossary/phrases pins from the URL's first two path segments, `compiler/preview`,
which the preview pins to the current versions. Typical cost: the ~3 s of
validation. If validation fails, the placeholder tab closes and the compiler
view comes forward with the errors.

**Studio-only speed optimizations.** A compile started from the studio is
tagged `"studio"` (`threshold/preprocess/compileMode.ts`), which turns on,
inside that shared pipeline: the preamble's independent round trips
(glossary/phrases version probes, resource listing, project list,
EasyEyesResources lookup) running concurrently; the runtime files fetched
concurrently and cached per deploy for the page session; requested resources
read concurrently; metadata round trips overlapping the work they used to
precede (the project list not waited for before validation, corpus texts read
during the preamble, the repo-name search started before validation, the
phrases pin and project-list refresh together, the upload's files prepared
while the repository is created, the data-folder count not delaying
activation); the first Pavlovia readiness check after 1 s instead of 5 s and
then every 0.4 s for a while. With those, what is uploaded does not change,
and every failure still stops the compile where it did. A compile started from
the Compiler tab runs exactly as before. To give every compile an
optimization, change its entry in `COMPILE_OPTIMIZATIONS_FOR` from `"studio"`
to `"all"`.

**Thin experiment repository (hosted runtime).** The one Studio optimization
that changes what is uploaded (`hostedRuntime` in `compileMode.ts`,
implemented in `threshold/preprocess/hostedRuntime.ts`). A classic compile
copies the whole EasyEyes runtime — `js/*.js`, their source maps, the
face-tracking `models/`, ≈17 MB identical for every experiment — into each
experiment's repository; that copy is most of the upload and of Pavlovia's
clone on activation. A Studio compile commits the experiment's own files plus
only the small runtime files the page looks up relative to itself
(`index.html`, `coi-serviceworker.js`, `js/threshold.css`, the generated
`js/experimentLanguage.js`, the images, the multiple-display page,
`recruitmentServiceConfig.csv`, the licenses — ≈170 KB), and its `index.html`
loads the runtime from an immutable npm version on jsDelivr — the
remote-calibrator pattern, automated:

```
https://cdn.jsdelivr.net/npm/@easyeyes/runtime@<version>/
```

At the end of the Netlify runtime build (`threshold` `netlify:website` →
`publish:runtime`, i.e. `threshold/server/publishRuntime.ts`), the built
runtime is published as an npm version and `runtime-release.json` is written
next to `index.html` (served at `/compiler/threshold/runtime-release.json`)
naming the package, version, fingerprint, per-file integrity hashes and the
deploy that built it. npm versions are immutable and never expire; jsDelivr
mirrors npm permanently and serves every file with
`Access-Control-Allow-Origin: *`, byte for byte. Versions are
`1.<YYYYMMDD>.<secondOfDay>` (UTC) so they read as dates and sort
chronologically. Identical runtimes share a version: the step fingerprints the
files and, when a published version already has that fingerprint (dist-tag
`fp-<hash>`, also recorded in the package's `package.json`), reuses it instead
of publishing again — most deploys change the website or the compiler, not the
runtime.

The step is inert until the build environment has an npm automation token in
`EASYEYES_RUNTIME_NPM_TOKEN` (Netlify → Site configuration → Environment
variables; the `@easyeyes` npm organization must exist, or set
`EASYEYES_RUNTIME_PACKAGE` to another name, e.g. `easyeyes-runtime`). Without
it, it logs one line and exits 0; with it, a failure is logged and the site
deploy continues — it can never break a build.
`EASYEYES_RUNTIME_PUBLISH_DRY_RUN=1` runs everything except the upload
(`npm publish --dry-run`) for a trial.

At compile time the compiler reads its own `runtime-release.json` (the same
origin the classic path fetches the runtime files from) and, before using the
CDN, checks that the bytes jsDelivr serves hash to what the build recorded.
**Until the token is set there is no release file, and a Studio compile
uploads the classic full copy exactly as the Compiler tab does** — the thin
repository switches on by itself with the first published deploy. An
experiment compiled from a published runtime runs that runtime for as long as
npm exists — the guarantee the copy in the repository gave. Two things make
the page work from the CDN:

- The two module scripts (`js/first.min.js`, `js/threshold.min.js`) get
  absolute URLs, `crossorigin="anonymous"` and Subresource Integrity hashes
  (`sha384-…`) that the compiler computes from the very bytes jsDelivr
  serves; a byte that differs and the browser refuses the script. Everything
  the runtime imports itself (`./easyeyes_wasm.js`, `./index.js`, the source
  maps) resolves relative to those scripts, so it comes from the host too.
- remote-calibrator asks for the face-tracking models relative to the page
  (`./models/…`). A small router, the first script in `<head>`, sends
  `fetch()` calls for `models/` to the host and leaves every other request —
  `conditions/`, fonts, forms, `CompatibilityRequirements.txt`, … — alone.
  It also records the runtime on `window.EasyEyesRuntime`.

Each thin repository carries `EasyEyesRuntime.json`: the runtime URL, npm
package and version (`npm pack @easyeyes/runtime@<version>` fetches the exact
files), the runtime's fingerprint and publication date, the deploy that built
it (id, branch, commit, context), the integrity hashes and the list of hosted
files — everything needed to re-host or freeze the runtime (copy the hosted
files in, restore the relative script paths). `CompatibilityRequirements.txt`
keeps recording the published deploy's date as it always has.

The release file is re-read on every compile (it is tiny, same-origin) so a
new publication is picked up at once; the fetched and hashed runtime is cached
per version for the page session (the two scripts hashed, the small files
fetched — about 1 s cold; the Studio starts it on mount so a compile finds it
ready). Every resolution is verified: if jsDelivr is not serving the version
yet, a served byte differs from what the build recorded, the page does not
look like the runtime's `index.html`, or any committed runtime file is missing
on the CDN, the compile silently uploads the classic full copy instead.
Re-compiling into an existing repository removes the old copied runtime files
as part of the usual replace commit. Note for local development: a dev server
has no release file, so a Studio compile from `localhost` always uploads the
full copy.

The per-phase timing (`compileTiming.ts`) is the one entry already set to
`"all"`, so a Compiler-tab compile and a Studio compile can be compared like
for like; it only records performance marks and adds `elapsedMs` to the Sentry
compile breadcrumbs. Its console table is commented out in
`printCompileTiming` for both paths — uncomment it there while measuring.

Later phases (not yet done): open past experiments in the studio.

## What it does

- **Imports** any existing experiment `.csv` / `.xlsx` (identical parsing to
  the compiler: first sheet → CSV → PapaParse, with Excel's phantom empty
  columns trimmed), or starts from the bundled example tables / templates.
- **Live validation** — every keystroke (debounced) runs the compiler's
  `TABLE_CHECKS` plus the block-presence check and `~tilde` resolution. Error
  and hint text is the compiler's own HTML, including "did you mean…" and
  column letters. These are the table checks; the compile itself additionally
  runs the checks that need the network or file contents (web/Adobe fonts,
  font shaping and language support, corpus lengths, Prolific fields, …).
  Two small pieces of the compiler's pre-validation are mirrored rather than
  imported and must be kept in step by hand: `mirrorPreprocess` in
  `validation.ts` (main.ts's row pre-cleaning: `%` rows, blank rows, trailing
  blank columns, trimmed names) and `toLanguageCode`
  (`convertLanguageToLanguageCode` in `compatibilityCheck.js`, which is too
  heavy a module to import).
- **Type-aware cells** — booleans and categorical parameters become
  dropdowns populated from the glossary; defaults show as placeholders;
  underscore parameters are editable only in column B; `%`-commented rows are
  skipped, not flagged.
- **Parameter autocomplete and catalog** — the strip above the grid: type a
  name for glossary suggestions (super-matching parameters such as
  `questionAndAnswer@@` are added as the next free numbered instance), or
  browse the glossary grouped into topic categories derived from the naming
  conventions (`categories.ts`), with "For <targetKind>", "For reading" and
  "For sound" groups pinned on top. Click an entry to read its full
  description; clicking a row in the grid shows the same in the sidebar.
- **Resource awareness** — the table announces which files it needs, found by
  the compiler's own resource discovery (`preprocess/utils.ts`: fonts with
  `fontSource=file`, forms, reading corpora and foils, images, impulse and
  frequency responses, sound and image folders, code, the phrase
  spreadsheet), and the compiler's own missing-file checks
  (`experimentFileChecks.ts`) run live against the pool a compile would have
  — the user's EasyEyesResources lists plus files dropped here. Their
  messages appear under the checklist as "what the compiler will report";
  they never disable Compile, so a scientist can compile with resources still
  missing and get the same errors the Compiler tab would give. (Image-folder
  contents and target sound lists need GitLab and are checked only at
  compile time; here their folders are checked by name.) Tilde values
  (`~symbol`) resolve from the phrase file
  `_languagePhrasesSpreadsheet` names, sourced as the compile sources it
  (`selectPhraseSource`): a file of that name dropped here, otherwise the
  copy in the signed-in user's EasyEyesResources `phrases/` folder
  (`fetchPhraseFileFromResources`, via App's `fetchStudioPhraseFile`), in
  the language chosen by `_language` (mirroring
  `convertLanguageToLanguageCode`). Live checks wait while that file is
  being read, so a slow read never shows up as tilde errors.
- **Round-trip export** — `.xlsx`, or a `.source.zip` (table +
  dropped resources) that the current upload step accepts unchanged.

## What it reuses (no forks, no mocks)

| Piece                 | Source                                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| Table model           | `threshold/preprocess/experimentTable.ts`                              |
| All validation checks | `threshold/preprocess/validateExperimentTable.ts`                      |
| Block check           | `threshold/preprocess/experimentFileChecks.ts`                         |
| Tilde resolution      | `threshold/preprocess/resolveTildeValues.ts`                           |
| Phrase-file parser    | `source/components/parsePhraseFile.ts`                                 |
| Phrase file from repo | `threshold/preprocess/gitlabUtils.ts` (`fetchPhraseFileFromResources`) |
| Resource discovery    | `threshold/preprocess/utils.ts` (get\*List/Names)                      |
| Resource checks       | `threshold/preprocess/experimentFileChecks.ts`                         |
| Language names        | `threshold/components/readPhrases.js` (`EE_LanguageEnglishName`)       |
| Glossary              | `threshold/parameters/glossaryRegistry.ts` (live)                      |

The glossary is the compiler page's own live registry (`glossaryApi.js`
prefetch), not a snapshot. Because the registry can be re-initialized with a
newer version mid-session, every derived list (`suggestibleEntries`,
`getCategories`, …) is computed on demand and memoized per glossary version
(`memoByVersion` in `glossary.ts`) — never at module scope.

## Layout notes

- All styles are scoped under `.ee-studio` (`styles.css`) so nothing leaks
  into the compiler's stylesheets, and design tokens are CSS variables on that
  root element.
- The site shell caps `<main>` at 960px (`docs/uni.css`); `App.js`
  (`syncStudioMenu`) adds `main.ee-studio-wide` while the Studio is showing
  to get full width for the grid.
- Layout: title row, toolbar (experiment name · New/open… · Open existing
  csv/xlsx · Export xlsx · Download .source.zip · Preview · Compile), then the
  workspace — the editor on the left (the add-parameter strip, then the grid)
  and the sidebar on the right (parameter definition when a row is selected,
  Compiler checks, Upload resources).
- The editor is nearly a viewport tall (`.editor`, `100vh − 100px`), so the
  page scrolls only past the navbar/title/toolbar and then the grid fills the
  screen; the grid scrolls inside `.grid-wrap` with its header row and first
  column frozen (sticky `th`/`td.col-param`; the corner cell has the highest
  z-index). The sidebar is `position: sticky`, so the definition of the
  clicked parameter and the checks stay beside the grid however far the
  page is scrolled.
- The Preview button is orange, Compile green (EasyEyes button idiom); the
  preview's placeholder tab shows a centered italic "Preparing preview…".
- The example tables are bundled as text via the `.csv` → `asset/source`
  rule in `webpack.config.js` (`modules.d.ts` types those imports).

## Development

Run the compiler dev server as usual from `website/docs/experiment`
(`npm start`; it must be on port 5500 for the Pavlovia OAuth redirect) and
open `http://localhost:5500/compiler/studio`. The `/compiler/studio` rewrite
is dev-server configuration (`webpack.config.js`), so a running server must be
restarted to pick it up. `npm run check:ts` type-checks the studio together
with the rest of the app. On `localhost` the resource lists come from the
signed-in user's real EasyEyesResources, as on the Compiler tab.
