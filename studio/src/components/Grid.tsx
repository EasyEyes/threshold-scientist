import { useEffect, useRef, useState } from "react";
import { isCommentName, stripCommentPrefix, type TableState } from "../tableModel";
import { resolveEntry } from "../glossary";
import { EditableCell } from "./EditableCell";
import { ParamAutocomplete } from "./ParamAutocomplete";
import { conditionIndexToColumnName } from "../../../threshold/preprocess/utils";

interface Props {
  table: TableState;
  problemParams: Map<string, "error" | "warning">;
  selectedParam: string | null;
  flashParam: string | null;
  onSelectParam: (name: string) => void;
  onCellChange: (rowId: number, valueIndex: number, value: string) => void;
  onRenameRow: (rowId: number, name: string) => void;
  onDeleteRow: (rowId: number) => void;
  onAddParam: (name: string) => void;
  onOpenCatalog: () => void;
  onAddCondition: () => void;
  onDeleteCondition: (conditionIndex: number) => void;
}

export function Grid({
  table,
  problemParams,
  selectedParam,
  flashParam,
  onSelectParam,
  onCellChange,
  onRenameRow,
  onDeleteRow,
  onAddParam,
  onOpenCatalog,
  onAddCondition,
  onDeleteCondition,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);

  useEffect(() => {
    if (!flashParam || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-param="${CSS.escape(flashParam)}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [flashParam]);

  const existingNames = new Set(table.rows.map((r) => r.name));

  return (
    <div className="grid-wrap" ref={containerRef}>
      <table className="grid">
        <thead>
          <tr>
            <th className="col-param">Parameter</th>
            <th className="col-value">
              <div className="cond-head">
                <span>Experiment</span>
                <span className="col-letter">B</span>
              </div>
            </th>
            {Array.from({ length: table.conditionCount }, (_, ci) => (
              <th key={ci} className="col-value">
                <div className="cond-head">
                  <span>Condition {ci + 1}</span>
                  <span className="col-letter">
                    {conditionIndexToColumnName(ci)}
                  </span>
                  {table.conditionCount > 1 && (
                    <button
                      className="icon-btn"
                      title={`Delete condition ${ci + 1}`}
                      onClick={() => onDeleteCondition(ci)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </th>
            ))}
            <th className="col-add">
              <button
                className="add-cond-btn"
                onClick={onAddCondition}
                title="Add a condition column"
              >
                + condition
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => {
            const isComment = isCommentName(row.name);
            const entry = resolveEntry(row.name);
            const isUnderscore = row.name.startsWith("_");
            const unknown = !isComment && row.name !== "" && !entry;
            const problem = problemParams.get(row.name);
            const rowCls = [
              problem === "error"
                ? "row-error"
                : problem === "warning"
                  ? "row-warning"
                  : "",
              flashParam === row.name ? "row-flash" : "",
              selectedParam === row.name ? "row-selected" : "",
              isComment ? "row-comment" : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <tr key={row.id} className={rowCls} data-param={row.name}>
                <td className="col-param">
                  <div className="param-cell">
                    {editingRowId === row.id ? (
                      <input
                        className="param-rename"
                        autoFocus
                        defaultValue={row.name}
                        spellCheck={false}
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v && v !== row.name) onRenameRow(row.id, v);
                          setEditingRowId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                          if (e.key === "Escape") setEditingRowId(null);
                        }}
                      />
                    ) : (
                      <button
                        className={`param-name${unknown ? " unknown" : ""}${
                          isComment ? " comment" : ""
                        }`}
                        title={
                          (isComment
                            ? "Commented out — the compiler skips this row"
                            : unknown
                              ? "Unknown parameter (not in glossary)"
                              : entry?.type) + " — double-click to rename"
                        }
                        onClick={() => onSelectParam(row.name)}
                        onDoubleClick={() => setEditingRowId(row.id)}
                      >
                        {row.name || "(unnamed)"}
                      </button>
                    )}
                    <button
                      className={`icon-btn comment-btn row-delete${isComment ? " on" : ""}`}
                      title={
                        isComment
                          ? "Uncomment — include this row again"
                          : "Comment out — the compiler will skip this row"
                      }
                      onClick={() =>
                        onRenameRow(
                          row.id,
                          isComment
                            ? stripCommentPrefix(row.name)
                            : `%${row.name}`,
                        )
                      }
                    >
                      %
                    </button>
                    <button
                      className="icon-btn row-delete"
                      title="Delete this parameter"
                      onClick={() => onDeleteRow(row.id)}
                    >
                      ✕
                    </button>
                  </div>
                </td>
                <td className="col-value">
                  <EditableCell
                    entry={entry}
                    value={row.values[0] ?? ""}
                    offConvention={!isComment && !isUnderscore}
                    offConventionHint={`Column B is reserved for experiment-wide (underscore) parameters; ${
                      row.name || "this parameter"
                    } takes its values in the condition columns (C on).`}
                    onChange={(v) => onCellChange(row.id, 0, v)}
                  />
                </td>
                {Array.from({ length: table.conditionCount }, (_, ci) => (
                  <td key={ci} className="col-value">
                    <EditableCell
                      entry={entry}
                      value={row.values[ci + 1] ?? ""}
                      // _about is the compiler's one unregulated underscore
                      // param — extra cells are tolerated, so don't lock it.
                      // Commented rows are inert, so nothing is locked.
                      offConvention={
                        !isComment && isUnderscore && row.name !== "_about"
                      }
                      offConventionHint={`${row.name} is experiment-wide: its single value in column B applies to every condition, so this cell must stay blank.`}
                      onChange={(v) => onCellChange(row.id, ci + 1, v)}
                    />
                  </td>
                ))}
                <td className="col-add" />
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={table.conditionCount + 3}>
              <div className="add-row">
                <ParamAutocomplete
                  existingNames={existingNames}
                  onAdd={onAddParam}
                />
                <button className="button-easyeyes button-green" onClick={onOpenCatalog}>
                  Browse by category…
                </button>
              </div>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
