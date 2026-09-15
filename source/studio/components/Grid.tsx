import { useEffect, useRef, useState, type CSSProperties } from "react";
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

/**
 * Rows to light up. `params` is in grid order and each row starts its flash
 * a beat after the previous one, so a batch of edits runs down the table
 * like a wave; `gen` changes every time so the same rows can flash again.
 */
export interface RowFlash {
  params: string[];
  gen: number;
}
/** Mirror of the CSS: flash length, per-row stagger, and its cap. */
export const FLASH_MS = 1600;
export const FLASH_STAGGER_MS = 55;
export const FLASH_STAGGER_CAP = 24;

/**
 * A whole new table (the assistant built a study): every cell arrives in
 * turn, row by row and column by column, so the scientist watches the
 * table being written rather than appearing. `gen` restarts the animation.
 */
export interface TableReveal {
  gen: number;
}
/** Mirror of the CSS: per-row and per-column delay, cell animation, row cap. */
export const REVEAL_ROW_MS = 26;
export const REVEAL_COL_MS = 60;
export const REVEAL_CELL_MS = 480;
export const REVEAL_ROW_CAP = 45;
export const revealDurationMs = (rows: number, conditions: number): number =>
  Math.min(rows, REVEAL_ROW_CAP) * REVEAL_ROW_MS +
  (conditions + 1) * REVEAL_COL_MS +
  REVEAL_CELL_MS +
  120;

interface Props {
  table: TableState;
  problemParams: Map<string, "error" | "warning">;
  selectedParam: string | null;
  flash: RowFlash | null;
  reveal: TableReveal | null;
  onSelectParam: (name: string) => void;
  /**
   * A value cell took focus (click or Tab): its row's parameter and value
   * index (0 = column B, 1 = column C, …). Lets the assistant know "this
   * cell". Selecting the row is still the parameter name's click.
   */
  onFocusCell?: (name: string, valueIndex: number) => void;
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
  flash,
  reveal,
  onSelectParam,
  onFocusCell,
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

  const flashIndex = new Map<string, number>();
  flash?.params.forEach((p, i) => flashIndex.set(p, i));

  useEffect(() => {
    const first = flash?.params[0];
    if (!first || !containerRef.current) return;
    const el = containerRef.current.querySelector(
      `[data-param="${CSS.escape(first)}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [flash]);

  // A revealed table is read from the top.
  useEffect(() => {
    if (reveal && containerRef.current)
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [reveal]);

  const tableCls = reveal
    ? `grid grid-reveal grid-reveal-${reveal.gen % 2}`
    : "grid";
  const cellStyle = (ri: number, ci: number): CSSProperties | undefined =>
    reveal
      ? ({
          "--ri": Math.min(ri, REVEAL_ROW_CAP),
          "--ci": ci,
        } as CSSProperties)
      : undefined;

  return (
    <div className="grid-wrap" ref={containerRef}>
      <table className={tableCls}>
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
          {table.rows.map((row, ri) => {
            const isComment = isCommentName(row.name);
            const entry = resolveEntry(row.name);
            const isUnderscore = row.name.startsWith("_");
            const unknown = !isComment && row.name !== "" && !entry;
            const problem = problemParams.get(row.name);
            const fi = flashIndex.get(row.name);
            const rowCls = [
              problem === "error"
                ? "row-error"
                : problem === "warning"
                ? "row-warning"
                : "",
              fi !== undefined
                ? `row-flash row-flash-${(flash?.gen ?? 0) % 2}`
                : "",
              selectedParam === row.name ? "row-selected" : "",
              isComment ? "row-comment" : "",
            ]
              .filter(Boolean)
              .join(" ");
            const rowStyle =
              fi !== undefined
                ? ({
                    "--flash-i": Math.min(fi, FLASH_STAGGER_CAP),
                  } as CSSProperties)
                : undefined;
            return (
              <tr
                key={row.id}
                className={rowCls}
                style={rowStyle}
                data-param={row.name}
              >
                <td className="col-param filled" style={cellStyle(ri, 0)}>
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
                <td
                  className={`col-value${row.values[0] ? " filled" : ""}`}
                  style={cellStyle(ri, 1)}
                  onFocus={() => onFocusCell?.(row.name, 0)}
                >
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
                    }${row.values[ci + 1] ? " filled" : ""}`}
                    style={cellStyle(ri, ci + 2)}
                    onFocus={() => onFocusCell?.(row.name, ci + 1)}
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
