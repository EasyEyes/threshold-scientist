import { useEffect, useMemo, useRef, useState } from "react";
import "./glossary"; // initializes the compiler's glossary registry first
import {
  alphabeticalInsertIndex,
  matrixToState,
  newId,
  stateToMatrix,
  type TableState,
} from "./tableModel";
import { runValidation, type EasyEyesError, type PhraseSource } from "./validation";
import { parsePhraseFile } from "../../source/components/parsePhraseFile";
import type { ExperimentTable } from "../../threshold/preprocess/experimentTable";
import { fileToMatrix, parseCsvString } from "./fileImport";
import { EXAMPLES } from "./examples";
import { TEMPLATES } from "./templates";
import { computeNeededResources } from "./resources";
import { exportCsv, exportSourceZip, exportXlsx } from "./exporters";
import { GLOSSARY_VERSION, PARAMETER_COUNT } from "./glossary";
import { Grid } from "./components/Grid";
import { ErrorPanel } from "./components/ErrorPanel";
import { GlossaryPanel } from "./components/GlossaryPanel";
import { ResourcePanel } from "./components/ResourcePanel";
import { ParamCatalog } from "./components/ParamCatalog";
import logoUrl from "../../../media/easyeyes-default.svg";

export default function App() {
  const [table, setTable] = useState<TableState>(() =>
    matrixToState(parseCsvString(EXAMPLES["Demo experiment"])),
  );
  const [errors, setErrors] = useState<EasyEyesError[]>([]);
  const [expTable, setExpTable] = useState<ExperimentTable | null>(null);
  const [selectedParam, setSelectedParam] = useState<string | null>(null);
  const [flashParam, setFlashParam] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [phrase, setPhrase] = useState<PhraseSource | null>(null);
  const [name, setName] = useState("myDemoExperiment");
  const [validating, setValidating] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Any dropped *.phrases.xlsx becomes the tilde-resolution source (the
  // production parsePhraseFile). Prefer the file _languagePhrasesSpreadsheet
  // names; otherwise use the first phrase file present.
  useEffect(() => {
    const requested = table.rows
      .find((r) => r.name === "_languagePhrasesSpreadsheet")
      ?.values[0]?.trim();
    const candidates = files.filter((f) =>
      /\.phrases\.xlsx$/i.test(f.name),
    );
    const file =
      candidates.find((f) => f.name === requested) ?? candidates[0];
    if (!file) {
      setPhrase(null);
      return;
    }
    if (phrase?.fileName === file.name) return;
    let stale = false;
    parsePhraseFile(file)
      .then((parsed) => {
        if (!stale)
          setPhrase({
            fileName: file.name,
            table: parsed.phraseTable,
            sourceLanguageCode: parsed.sourceLanguageCode,
            availableLanguageCodes: parsed.availableLanguageCodes,
          });
      })
      .catch(() => {
        if (!stale) setPhrase(null);
      });
    return () => {
      stale = true;
    };
  }, [files, table, phrase]);

  // Live validation: the production compiler's checks, debounced per keystroke.
  useEffect(() => {
    setValidating(true);
    const timer = setTimeout(() => {
      const { errors, table: t } = runValidation(stateToMatrix(table), phrase);
      setErrors(errors);
      setExpTable(t);
      setValidating(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [table, phrase]);

  const problemParams = useMemo(() => {
    const m = new Map<string, "error" | "warning">();
    for (const e of errors)
      for (const p of e.parameters ?? []) {
        if (e.kind === "error") m.set(p, "error");
        else if (!m.has(p)) m.set(p, "warning");
      }
    return m;
  }, [errors]);

  const needed = useMemo(() => computeNeededResources(expTable), [expTable]);

  const targetKinds = useMemo(
    () => (expTable?.params.includes("targetKind") ? expTable.effectiveValues("targetKind") : []),
    [expTable],
  );
  const targetTasks = useMemo(
    () => (expTable?.params.includes("targetTask") ? expTable.effectiveValues("targetTask") : []),
    [expTable],
  );

  const errorCount = errors.filter((e) => e.kind === "error").length;
  const warningCount = errors.filter((e) => e.kind === "warning").length;

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
    <div className="app">
      <nav className="ee-navbar">
        <img className="ee-logo" src={logoUrl} alt="EasyEyes" />
        <div className="ee-brand">
          <span className="ee-brand-name">
            EasyEyes <span className="ee-brand-studio">Studio</span>
          </span>
        </div>
        <div className="ee-nav-links">
          <a
            href="https://docs.google.com/document/u/1/d/e/2PACX-1vTTrqaSyva2afVupLchBjfTHc_YW5jAbEexGbudXMJ9xMKPBDA3nxQmHXa4wjnAoSVabeEA8T9CGIMa/pub"
            target="_blank"
            rel="noopener noreferrer"
          >
            Manual
          </a>
          <a
            href="https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8QswX_5h_oNS2Ly6VgoONGIxJHqDFjdZqWY_HUxH2Nr_LNkGDBL8FXz74l9BxVNR2AIXGhHir9GAd/pubhtml?gid=1287694458&single=true"
            target="_blank"
            rel="noopener noreferrer"
          >
            Parameter Glossary
          </a>
        </div>
      </nav>

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
        <button
          className="button-easyeyes button-green"
          onClick={() => setCatalogOpen(true)}
        >
          Add parameters…
        </button>
        <div className="toolbar-spacer" />
        <button
          className="button-easyeyes button-grey"
          onClick={() => exportCsv(stateToMatrix(table), name)}
        >
          Export csv
        </button>
        <button
          className="button-easyeyes button-grey"
          onClick={() => exportXlsx(stateToMatrix(table), name)}
        >
          Export xlsx
        </button>
        <button
          className="button-easyeyes button-green"
          title="The exact zip today's compiler accepts: table + resources"
          onClick={() => exportSourceZip(stateToMatrix(table), files, name)}
        >
          Download .source.zip
        </button>
        <div
          className={`status-pill ${
            validating ? "checking" : errorCount ? "bad" : warningCount ? "warn" : "good"
          }`}
        >
          {validating
            ? "checking…"
            : errorCount
              ? `${errorCount} error${errorCount !== 1 ? "s" : ""}${
                  warningCount ? `, ${warningCount} warning${warningCount !== 1 ? "s" : ""}` : ""
                }`
              : warningCount
                ? `${warningCount} warning${warningCount !== 1 ? "s" : ""}`
                : "✓ would compile"}
        </div>
      </div>

      <main className="workspace">
        <section className="editor">
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
                    ? { ...r, values: r.values.map((old, i) => (i === vi ? v : old)) }
                    : r,
                ),
              }))
            }
            onDeleteRow={(rowId) =>
              setTable((t) => ({ ...t, rows: t.rows.filter((r) => r.id !== rowId) }))
            }
            onAddParam={addParam}
            onOpenCatalog={() => setCatalogOpen(true)}
            onAddCondition={() =>
              setTable((t) => ({
                conditionCount: t.conditionCount + 1,
                rows: t.rows.map((r) => ({ ...r, values: [...r.values, ""] })),
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
            phrase={phrase}
            files={files}
            onAddFiles={(newFiles) =>
              setFiles((old) => {
                const names = new Set(old.map((f) => f.name));
                return [...old, ...newFiles.filter((f) => !names.has(f.name))];
              })
            }
            onRemoveFile={(n) => setFiles((old) => old.filter((f) => f.name !== n))}
          />
        </aside>
      </main>

      {catalogOpen && (
        <ParamCatalog
          existingNames={existingNames}
          targetKinds={targetKinds}
          targetTasks={targetTasks}
          onAdd={addParam}
          onClose={() => setCatalogOpen(false)}
        />
      )}

      <footer className="footnote">
        Validation runs the production compiler's own checks in this page —
        glossary v{GLOSSARY_VERSION}, {PARAMETER_COUNT} parameters. Exports are
        byte-compatible with the current upload pipeline.
      </footer>
    </div>
  );
}
