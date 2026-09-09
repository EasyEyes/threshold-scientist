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

export function emptyTable(): TableState {
  return {
    rows: [{ id: newId(), name: "block", values: ["", "1"] }],
    conditionCount: 1,
  };
}
