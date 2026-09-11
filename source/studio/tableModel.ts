/**
 * The editable table model. Same shape as the spreadsheet:
 * each row is a parameter; values[0] is column B (experiment-wide),
 * values[1..conditionCount] are the per-condition columns (C, D, …).
 */

export interface Row {
  id: number;
  name: string;
  values: string[];
}

export interface TableState {
  rows: Row[];
  conditionCount: number;
}

let nextId = 1;
export const newId = (): number => nextId++;

export function matrixToState(matrix: string[][]): TableState {
  const width = Math.max(2, ...matrix.map((r) => r.length), 0);
  const conditionCount = Math.max(1, width - 2);
  const rows: Row[] = matrix
    .filter((r) => r.some((c) => (c ?? "").trim() !== ""))
    .map((r) => {
      const values = r.slice(1).map((v) => v ?? "");
      while (values.length < conditionCount + 1) values.push("");
      return { id: newId(), name: (r[0] ?? "").trim(), values };
    });
  return { rows, conditionCount };
}

export function stateToMatrix(s: TableState): string[][] {
  return s.rows.map((r) => [
    r.name,
    ...r.values.slice(0, s.conditionCount + 1),
  ]);
}

/** `%`-prefixed rows are comments: the compiler skips them entirely. */
export const isCommentName = (name: string): boolean => name.startsWith("%");

/** The parameter a commented row refers to: strip `%` and any spaces after. */
export const stripCommentPrefix = (name: string): string =>
  name.replace(/^%\s*/, "");

/**
 * Where to insert a new parameter so the table stays alphabetical.
 * Mirrors checkParametersAlphabetical: case-insensitive lowercase comparison.
 * Commented rows are compared by their underlying name so insertions land
 * next to them rather than always after.
 */
export function alphabeticalInsertIndex(rows: Row[], name: string): number {
  const key = stripCommentPrefix(name).toLowerCase();
  for (let i = 0; i < rows.length; i++)
    if (stripCommentPrefix(rows[i].name).toLowerCase() > key) return i;
  return rows.length;
}

/*
 * Disabling a column. The compiler's own switch: a column whose
 * conditionEnabledBool is FALSE (or whose conditionTrials is 0) is dropped
 * from the table before validation and compile
 * (main.ts filterDisabledConditionsFromParsed) — the column's counterpart of
 * a %-commented row. The Studio's column "%" toggles conditionEnabledBool.
 */
export const CONDITION_ENABLED_PARAM = "conditionEnabledBool";

const isFalse = (v: string | undefined) =>
  (v ?? "").trim().toUpperCase() === "FALSE";

const activeRow = (rows: Row[], name: string): Row | undefined =>
  rows.find((r) => r.name === name);

/** Why the compiler would drop column `ci` (0 = column C), or null. */
export function columnDisabledBy(
  s: TableState,
  ci: number,
): "conditionEnabledBool" | "conditionTrials" | null {
  if (isFalse(activeRow(s.rows, CONDITION_ENABLED_PARAM)?.values[ci + 1]))
    return "conditionEnabledBool";
  if (
    (activeRow(s.rows, "conditionTrials")?.values[ci + 1] ?? "").trim() === "0"
  )
    return "conditionTrials";
  return null;
}

/**
 * Flip conditionEnabledBool for column `ci`: FALSE to disable it, blank to
 * enable it again (blank is the default, TRUE). The row is added,
 * alphabetically, when the table has none, and removed again when enabling
 * leaves it entirely blank — so toggling a column and back leaves the table
 * exactly as it was.
 */
export function toggleConditionEnabled(s: TableState, ci: number): TableState {
  const disabling = !isFalse(
    activeRow(s.rows, CONDITION_ENABLED_PARAM)?.values[ci + 1],
  );
  const rows = [...s.rows];
  let idx = rows.findIndex((r) => r.name === CONDITION_ENABLED_PARAM);
  if (idx === -1) {
    if (!disabling) return s;
    idx = alphabeticalInsertIndex(rows, CONDITION_ENABLED_PARAM);
    rows.splice(idx, 0, {
      id: newId(),
      name: CONDITION_ENABLED_PARAM,
      values: new Array<string>(s.conditionCount + 1).fill(""),
    });
  }
  const values = [...rows[idx].values];
  while (values.length < s.conditionCount + 1) values.push("");
  values[ci + 1] = disabling ? "FALSE" : "";
  if (!disabling && values.every((v) => v.trim() === "")) rows.splice(idx, 1);
  else rows[idx] = { ...rows[idx], values };
  return { ...s, rows };
}

/**
 * What the compiler will skip, as positions in stateToMatrix's output:
 * %-commented rows (row indices) and disabled columns (column indices; C is
 * 2). The grid tints these, and the xlsx export fills them the same way.
 */
export function skippedCells(s: TableState): {
  rows: number[];
  columns: number[];
} {
  const rows: number[] = [];
  s.rows.forEach((r, i) => {
    if (isCommentName(r.name)) rows.push(i);
  });
  const columns: number[] = [];
  for (let ci = 0; ci < s.conditionCount; ci++)
    if (columnDisabledBy(s, ci)) columns.push(ci + 2);
  return { rows, columns };
}

export function emptyTable(): TableState {
  return {
    rows: [{ id: newId(), name: "block", values: ["", "1"] }],
    conditionCount: 1,
  };
}
