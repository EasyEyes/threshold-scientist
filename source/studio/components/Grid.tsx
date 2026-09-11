import { useEffect, useRef, useState } from "react";
import {
  columnDisabledBy,
  isCommentName,
  stripCommentPrefix,
  type TableState,
} from "../tableModel";
import { resolveEntry } from "../glossary";
import { EditableCell } from "./EditableCell";
import { toColumnName } from "../../../threshold/preprocess/utils";

/** Spreadsheet letter of value column `ci` (0 = C): A is the parameter, B experiment-wide. */
const columnLetter = (ci: number): string => toColumnName(ci + 3);

interface Props {
  table: TableState;
  problemParams: Map<string, "error" | "warning">;
  selectedParam: string | null;
  flashParam: string | null;
  onSelectParam: (name: string) => void;
  onCellChange: (rowId: number, valueIndex: number, value: string) => void;
  onRenameRow: (rowId: number, name: string) => void;
  onDeleteRow: (rowId: number) => void;
  onAddCondition: () => void;
  onDeleteCondition: (conditionIndex: number) => void;
  /** The column's "%": flips its conditionEnabledBool (tableModel.ts). */
  onToggleCondition: (conditionIndex: number) => void;
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
  onAddCondition,
  onDeleteCondition,
  onToggleCondition,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  // Columns the compiler will drop (conditionEnabledBool FALSE or
  // conditionTrials 0), shown muted like %-commented rows.
  const disabledBy = Array.from({ length: table.conditionCount }, (_, ci) =>
    columnDisabledBy(table, ci),
  );

  useEffect(() => {
    if (!flashParam || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-param="${CSS.escape(flashParam)}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [flashParam]);

  return (
    <div className="grid-wrap" ref={containerRef}>
      <table className="grid">
        <thead>
          <tr>
            <th className="col-param">Parameter</th>
            <th className="col-value">
              <div className="cond-head">
                <span>Column B</span>
                <span
                  className="col-letter"
                  title="Experiment-wide (underscore) parameters take their single value here"
                >
                  experiment
                </span>
              </div>
            </th>
            {/* Named by their spreadsheet column letter, as the compiler's
                error messages name them — "condition" means something else
                in EasyEyes (conditionName, the block/condition structure). */}
            {Array.from({ length: table.conditionCount }, (_, ci) => {
              const letter = columnLetter(ci);
              const disabled = disabledBy[ci];
              const byToggle = disabled === "conditionEnabledBool";
              return (
                <th
                  key={ci}
                  className={`col-value${disabled ? " col-disabled" : ""}`}
                >
                  <div className="cond-head">
                    <span
                      className="cond-label"
                      title={
                        disabled === "conditionTrials"
                          ? `Disabled: conditionTrials is 0 in column ${letter}, so the compiler drops it`
                          : byToggle
                          ? `Disabled: conditionEnabledBool is FALSE in column ${letter}, so the compiler drops it`
                          : undefined
                      }
                    >
                      Column {letter}
                    </span>
                    {/* The column's "%": like commenting out a row, but with
                        the compiler's own switch for columns. */}
                    <button
                      className={`icon-btn comment-btn${byToggle ? " on" : ""}`}
                      title={
                        byToggle
                          ? `Enable column ${letter} again (clears conditionEnabledBool)`
                          : `Disable column ${letter} — sets conditionEnabledBool FALSE, so the compiler skips it`
                      }
                      onClick={() => onToggleCondition(ci)}
                    >
                      %
                    </button>
                    {table.conditionCount > 1 && (
                      <button
                        className="icon-btn col-delete"
                        title={`Delete column ${letter}`}
                        onClick={() => onDeleteCondition(ci)}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </th>
              );
            })}
            <th className="col-add">
              <button
                className="add-cond-btn"
                onClick={onAddCondition}
                title="Add a column"
              >
                + column
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
                      className={`icon-btn comment-btn row-delete${
                        isComment ? " on" : ""
                      }`}
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
                    } takes its values in columns C on.`}
                    onChange={(v) => onCellChange(row.id, 0, v)}
                  />
                </td>
                {Array.from({ length: table.conditionCount }, (_, ci) => (
                  <td
                    key={ci}
                    className={`col-value${
                      disabledBy[ci] ? " col-disabled" : ""
                    }`}
                  >
                    <EditableCell
                      entry={entry}
                      value={row.values[ci + 1] ?? ""}
                      // _about is the compiler's one unregulated underscore
                      // param — extra cells are tolerated, so don't lock it.
                      // Commented rows are inert, so nothing is locked.
                      offConvention={
                        !isComment && isUnderscore && row.name !== "_about"
                      }
                      offConventionHint={`${row.name} is experiment-wide: its single value in column B applies to the whole experiment, so this cell must stay blank.`}
                      onChange={(v) => onCellChange(row.id, ci + 1, v)}
                    />
                  </td>
                ))}
                <td className="col-add" />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
