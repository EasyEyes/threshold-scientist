import { useEffect, useMemo, useRef, useState } from "react";
import {
  alphabeticalInsertIndex,
  matrixToState,
  newId,
  stateToMatrix,
  type TableState,
} from "./tableModel";
import {
  runValidation,
  type EasyEyesError,
  type PhraseSource,
} from "./validation";
import { parsePhraseFile } from "../components/parsePhraseFile";
import type { ExperimentTable } from "../../threshold/preprocess/experimentTable";
import { fileToMatrix, parseCsvString } from "./fileImport";
import { EXAMPLES } from "./examples";
import { TEMPLATES } from "./templates";
import { checkResources } from "./resources";
import { exportSourceZip, exportXlsx, tableToCsvFile } from "./exporters";
import { glossaryVersion, parameterCount } from "./glossary";
import { Grid } from "./components/Grid";
import { ErrorPanel } from "./components/ErrorPanel";
import { GlossaryPanel } from "./components/GlossaryPanel";
import { ResourcePanel } from "./components/ResourcePanel";
import { ExistingFilesModal } from "./components/ExistingFilesModal";
import type { UserResources } from "./resources";
import { ParamCatalog } from "./components/ParamCatalog";
import { ParamAutocomplete } from "./components/ParamAutocomplete";
import {
  openPreviewPlaceholder,
  previewSupported,
  registerPreviewWorker,
} from "./preview";
import { warmHostedRuntime } from "../../threshold/preprocess/hostedRuntime";
import "./styles.css";

interface Props {
  /**
   * Return to the classic compiler view. The panel has no button for it (the
   * navbar's Compiler tab does that); App still passes it for completeness.
   */
  onClose?: () => void;
  /**
   * Compile: hands the table (as csv) plus the resource files to the
   * compiler's own drop handler — the same path as dropping the files on the
   * compiler page. Resolves true once handed over.
   */
  onCompile: (files: File[]) => Promise<boolean>;
  /**
   * Preview: the same files and the same compile up to validation, then the
   * experiment opens in `placeholder` (a tab opened on the click) served
   * from the browser — nothing is uploaded. Resolves true once handed over.
   */
  onPreview: (files: File[], placeholder: Window | null) => Promise<boolean>;
  /**
   * Reads a phrase file from the signed-in user's EasyEyesResources
   * `phrases/` folder (null when absent or signed out) — the compile's own
   * fetchPhraseFromRepo, so the live checks resolve ~tilde values from the
   * same file the compile will.
   */
  fetchUserPhraseFile?: (name: string) => Promise<File | null>;
  /**
   * The signed-in user's EasyEyesResources file lists (the compiler page's
   * `resources` state); null when signed out.
   */
  userResources: UserResources | null;
  resourcesLoaded: boolean;
  signedIn: boolean;
}

/**
 * EasyEyes Studio — a live experiment-table editor that runs the compiler's
 * own checks on every keystroke. Rendered inside the compiler page from the
 * Studio navbar tab (/compiler/studio); the page's own navbar stays, so this panel
 * has none. App keeps it mounted (hidden) once opened, so the table survives
 * a round trip to the compiler view.
 * The glossary registry must be initialized before this mounts — the lazy
 * loader in App.js guarantees that (see ensureGlossaryReady).
 */
export default function StudioPanel({
  onCompile,
  onPreview,
  fetchUserPhraseFile,
  userResources,
  resourcesLoaded,
  signedIn,
}: Props) {
  const [table, setTable] = useState<TableState>(() =>
    matrixToState(parseCsvString(EXAMPLES["Demo experiment"])),
  );
  const [errors, setErrors] = useState<EasyEyesError[]>([]);
  const [expTable, setExpTable] = useState<ExperimentTable | null>(null);
  const [checkedData, setCheckedData] = useState<string[][] | null>(null);
  const [selectedParam, setSelectedParam] = useState<string | null>(null);
  const [flashParam, setFlashParam] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [phrase, setPhrase] = useState<PhraseSource | null>(null);
  const [phraseLoading, setPhraseLoading] = useState(false);
  const [name, setName] = useState("myDemoExperiment");
  const [validating, setValidating] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [existingOpen, setExistingOpen] = useState(false);
  const [compiling, setCompiling] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Have the preview's service worker active, and the hosted runtime (the
  // published npm version on jsDelivr, its integrity hashes and the small
  // runtime files a Studio compile commits) resolved, before either is first
  // needed. A no-op until the build publishes a version.
  useEffect(() => {
    registerPreviewWorker();
    warmHostedRuntime();
  }, []);

  // The phrase file that resolves ~tilde values, chosen exactly as the compile
  // chooses it (main.ts / selectPhraseSource): the file
  // _languagePhrasesSpreadsheet names, taken from the files dropped here if
  // one has that name, otherwise read from the signed-in user's
  // EasyEyesResources phrases/ folder. Repo reads are cached per name; the
  // cache is dropped whenever the resource lists refresh (e.g. after an
  // upload), so a newer copy is picked up.
  const requestedPhraseFile = useMemo(
    () =>
      table.rows
        .find((r) => r.name === "_languagePhrasesSpreadsheet")
        ?.values[0]?.trim() ?? "",
    [table],
  );
  const repoPhraseFiles = useRef(new Map<string, Promise<File | null>>());
  useEffect(() => {
    repoPhraseFiles.current = new Map();
  }, [userResources, signedIn]);
  useEffect(() => {
    if (!requestedPhraseFile) {
      setPhrase(null);
      setPhraseLoading(false);
      return;
    }
    let stale = false;
    const dropped = files.find((f) => f.name === requestedPhraseFile);
    let source: Promise<File | null>;
    if (dropped) source = Promise.resolve(dropped);
    else if (signedIn && fetchUserPhraseFile) {
      const cached = repoPhraseFiles.current.get(requestedPhraseFile);
      source =
        cached ??
        fetchUserPhraseFile(requestedPhraseFile).catch(() => null);
      repoPhraseFiles.current.set(requestedPhraseFile, source);
    } else source = Promise.resolve(null);

    setPhraseLoading(true);
    source
      .then((file) => (file ? parsePhraseFile(file) : null))
      .then((parsed) => {
        if (stale) return;
        setPhrase(
          parsed
            ? {
                fileName: requestedPhraseFile,
                origin: dropped ? "dropped" : "resources",
                table: parsed.phraseTable,
                sourceLanguageCode: parsed.sourceLanguageCode,
                availableLanguageCodes: parsed.availableLanguageCodes,
              }
            : null,
        );
        setPhraseLoading(false);
      })
      .catch(() => {
        if (stale) return;
        setPhrase(null);
        setPhraseLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [requestedPhraseFile, files, signedIn, fetchUserPhraseFile, userResources]);

  // Live validation: the production compiler's checks, debounced per
  // keystroke. Waits while the phrase file is being read, so tilde values are
  // never reported as unresolvable merely because the read is still in
  // flight.
  useEffect(() => {
    setValidating(true);
    if (phraseLoading) return;
    const timer = setTimeout(() => {
      const {
        errors,
        table: t,
        data,
      } = runValidation(stateToMatrix(table), phrase);
      setErrors(errors);
      setExpTable(t);
      setCheckedData(data);
      setValidating(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [table, phrase, phraseLoading]);

  const problemParams = useMemo(() => {
    const m = new Map<string, "error" | "warning">();
    for (const e of errors)
      for (const p of e.parameters ?? []) {
        if (e.kind === "error") m.set(p, "error");
        else if (!m.has(p)) m.set(p, "warning");
      }
    return m;
  }, [errors]);

  // The compiler's own resource discovery and missing-file checks, against
  // the pool a compile would have (EasyEyesResources + files dropped here).
  // Informational: what the compile will report, not a bar to compiling.
  const resourceReport = useMemo(
    () => checkResources(checkedData, expTable, userResources, files),
    [checkedData, expTable, userResources, files],
  );
  const needed = resourceReport.needed;

  const targetKinds = useMemo(
    () =>
      expTable?.params.includes("targetKind")
        ? expTable.effectiveValues("targetKind")
        : [],
    [expTable],
  );
  const targetTasks = useMemo(
    () =>
      expTable?.params.includes("targetTask")
        ? expTable.effectiveValues("targetTask")
        : [],
    [expTable],
  );

  const errorCount = errors.filter((e) => e.kind === "error").length;
  const jumpTo = (param: string) => {
    setSelectedParam(param);
    setFlashParam(param);
    setTimeout(() => setFlashParam(null), 1400);
  };

  const loadMatrix = (matrix: string[][]) => {
    setTable(matrixToState(matrix));
    setSelectedParam(null);
  };

  const openFile = async (file: File) => {
    loadMatrix(await fileToMatrix(file));
    setName(file.name.replace(/\.(csv|xlsx)$/i, ""));
  };

  const addParam = (rawName: string) =>
    setTable((t) => {
      // Super-matching params (questionAndAnswer@@) are added as the next
      // free numbered instance: questionAndAnswer01, 02, …
      let paramName = rawName;
      if (rawName.includes("@@")) {
        const base = rawName.slice(0, rawName.indexOf("@@"));
        const taken = new Set(t.rows.map((r) => r.name));
        for (let i = 1; i <= 99; i++) {
          const candidate = `${base}${String(i).padStart(2, "0")}`;
          if (!taken.has(candidate)) {
            paramName = candidate;
            break;
          }
        }
      }
      if (t.rows.some((r) => r.name === paramName && !r.name.startsWith("%")))
        return t;
      const idx = alphabeticalInsertIndex(t.rows, paramName);
      const row = {
        id: newId(),
        name: paramName,
        values: new Array<string>(t.conditionCount + 1).fill(""),
      };
      const rows = [...t.rows];
      rows.splice(idx, 0, row);
      setSelectedParam(paramName);
      return { ...t, rows };
    });

  // Commented (%-prefixed) rows are skipped by the compiler, so they don't
  // block re-adding the same parameter — that's the two-versions workflow.
  const existingNames = new Set(
    table.rows.filter((r) => !r.name.startsWith("%")).map((r) => r.name),
  );

  return (
    <div className="ee-studio">
      <div className="app">
        <div className="studio-head">
          <span className="studio-title">
            EasyEyes <span className="ee-brand-studio">Studio</span>
            <span
              className="studio-beta"
              title="The Studio is in beta — the Compiler tab is unchanged"
            >
              beta
            </span>
          </span>
        </div>

        <div className="toolbar">
          <input
            className="experiment-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            title="Experiment name (used for exported files)"
            spellCheck={false}
          />
          <select
            className="toolbar-select"
            value=""
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith("t:")) loadMatrix(TEMPLATES[v.slice(2)]());
              else if (v.startsWith("e:"))
                loadMatrix(parseCsvString(EXAMPLES[v.slice(2)]));
            }}
          >
            <option value="">New / open…</option>
            <optgroup label="Templates">
              {Object.keys(TEMPLATES).map((k) => (
                <option key={k} value={`t:${k}`}>
                  {k}
                </option>
              ))}
            </optgroup>
            <optgroup label="Example tables">
              {Object.keys(EXAMPLES).map((k) => (
                <option key={k} value={`e:${k}`}>
                  {k}
                </option>
              ))}
            </optgroup>
          </select>
          <button
            className="button-easyeyes button-grey"
            onClick={() => fileInputRef.current?.click()}
          >
            Open existing csv/xlsx
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) openFile(f);
              e.target.value = "";
            }}
          />
          <div className="toolbar-spacer" />
          <button
            className="button-easyeyes button-grey"
            onClick={() => exportXlsx(stateToMatrix(table), name)}
          >
            Export xlsx
          </button>
          <button
            className="button-easyeyes button-grey"
            title="The exact zip today's compiler accepts: table + resources"
            onClick={() => exportSourceZip(stateToMatrix(table), files, name)}
          >
            Download .source.zip
          </button>
          <button
            className="button-easyeyes button-orange button-preview"
            disabled={
              previewing ||
              compiling ||
              validating ||
              errorCount > 0 ||
              !signedIn ||
              !name.trim() ||
              !previewSupported()
            }
            title={
              !previewSupported()
                ? "Preview needs a browser with service workers"
                : !signedIn
                ? "Sign in on the Compiler tab to preview"
                : errorCount > 0
                ? "Fix the compiler errors first"
                : !name.trim()
                ? "Give the experiment a name"
                : "Run the experiment now in a new tab, served from this browser — nothing is uploaded to Pavlovia"
            }
            onClick={async () => {
              // Opened inside the click so the browser allows the tab.
              const placeholder = openPreviewPlaceholder();
              setPreviewing(true);
              try {
                await onPreview(
                  [tableToCsvFile(stateToMatrix(table), name.trim()), ...files],
                  placeholder,
                );
              } finally {
                setPreviewing(false);
              }
            }}
          >
            {previewing ? "Previewing…" : "Preview"}
          </button>
          <button
            className="button-easyeyes button-green button-compile"
            disabled={
              compiling ||
              previewing ||
              validating ||
              errorCount > 0 ||
              !signedIn ||
              !name.trim()
            }
            title={
              !signedIn
                ? "Sign in on the Compiler tab to compile"
                : errorCount > 0
                ? "Fix the compiler errors first"
                : !name.trim()
                ? "Give the experiment a name"
                : "Compile and upload to Pavlovia — the same steps as dropping the table on the Compiler tab"
            }
            onClick={async () => {
              setCompiling(true);
              try {
                await onCompile([
                  tableToCsvFile(stateToMatrix(table), name.trim()),
                  ...files,
                ]);
              } finally {
                setCompiling(false);
              }
            }}
          >
            {compiling ? "Compiling…" : "Compile"}
          </button>
        </div>

        <div className="workspace">
          <section className="editor">
            {/* Adding parameters: type a name, or browse the glossary by
                category. Sits above the grid so it is always at hand. */}
            <div className="add-row">
              <ParamAutocomplete
                existingNames={existingNames}
                onAdd={addParam}
              />
              <button
                className="button-easyeyes button-green"
                onClick={() => setCatalogOpen(true)}
              >
                Browse by category…
              </button>
            </div>
            <Grid
              table={table}
              problemParams={problemParams}
              selectedParam={selectedParam}
              flashParam={flashParam}
              onSelectParam={(n) => setSelectedParam(n)}
              onRenameRow={(rowId, newName) =>
                setTable((t) => ({
                  ...t,
                  rows: t.rows.map((r) =>
                    r.id === rowId ? { ...r, name: newName } : r,
                  ),
                }))
              }
              onCellChange={(rowId, vi, v) =>
                setTable((t) => ({
                  ...t,
                  rows: t.rows.map((r) =>
                    r.id === rowId
                      ? {
                          ...r,
                          values: r.values.map((old, i) =>
                            i === vi ? v : old,
                          ),
                        }
                      : r,
                  ),
                }))
              }
              onDeleteRow={(rowId) =>
                setTable((t) => ({
                  ...t,
                  rows: t.rows.filter((r) => r.id !== rowId),
                }))
              }
              onAddCondition={() =>
                setTable((t) => ({
                  conditionCount: t.conditionCount + 1,
                  rows: t.rows.map((r) => ({
                    ...r,
                    values: [...r.values, ""],
                  })),
                }))
              }
              onDeleteCondition={(ci) =>
                setTable((t) => ({
                  conditionCount: t.conditionCount - 1,
                  rows: t.rows.map((r) => ({
                    ...r,
                    values: r.values.filter((_, i) => i !== ci + 1),
                  })),
                }))
              }
            />
          </section>

          <aside className="sidebar">
            {selectedParam !== null && (
              <GlossaryPanel
                paramName={selectedParam}
                onClose={() => setSelectedParam(null)}
              />
            )}
            <div className="problems">
              <div className="panel-title">Compiler checks</div>
              <ErrorPanel errors={errors} onJump={jumpTo} />
            </div>
            <ResourcePanel
              needed={needed}
              compilerErrors={resourceReport.errors}
              onJump={jumpTo}
              phrase={phrase}
              files={files}
              userResources={userResources}
              resourcesLoaded={resourcesLoaded}
              signedIn={signedIn}
              onBrowseExisting={() => setExistingOpen(true)}
              onAddFiles={(newFiles) =>
                setFiles((old) => {
                  const names = new Set(old.map((f) => f.name));
                  return [
                    ...old,
                    ...newFiles.filter((f) => !names.has(f.name)),
                  ];
                })
              }
              onRemoveFile={(n) =>
                setFiles((old) => old.filter((f) => f.name !== n))
              }
            />
          </aside>
        </div>

        {catalogOpen && (
          <ParamCatalog
            existingNames={existingNames}
            targetKinds={targetKinds}
            targetTasks={targetTasks}
            onAdd={addParam}
            onClose={() => setCatalogOpen(false)}
          />
        )}

        {existingOpen && (
          <ExistingFilesModal
            resources={userResources ?? {}}
            loaded={resourcesLoaded}
            needed={needed}
            onClose={() => setExistingOpen(false)}
          />
        )}

        <footer className="footnote">
          Validation runs the compiler's own checks in this page — glossary v
          {glossaryVersion()}, {parameterCount()} parameters. Exports are
          byte-compatible with the current upload pipeline.
        </footer>
      </div>
    </div>
  );
}
