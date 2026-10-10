/**
 * What a condition will actually run with: the cell, else the experiment-wide
 * column B, else the glossary default — the compiler's own precedence
 * (fillDefaults). The feasibility and methods skills read the table through
 * this so a blank cell never reads as "unset".
 */
import { EstimateDurationForScientistPage } from "../../../threshold/preprocess/getDuration";
import { resolveEntry } from "../glossary";
import {
  columnDisabledBy,
  isCommentName,
  stateToMatrix,
  type TableState,
} from "../tableModel";

export type ValueSource = "cell" | "experiment" | "default" | "none";

export interface Effective {
  value: string;
  source: ValueSource;
}

const rowOf = (t: TableState, name: string) =>
  t.rows.find((r) => r.name === name && !isCommentName(r.name));

/** Effective value of `name` for condition `ci` (0 = column C). */
export function effective(t: TableState, name: string, ci: number): Effective {
  const row = rowOf(t, name);
  const cell = (row?.values[ci + 1] ?? "").trim();
  if (cell !== "") return { value: cell, source: "cell" };
  const wide = (row?.values[0] ?? "").trim();
  if (wide !== "") return { value: wide, source: "experiment" };
  const def = (resolveEntry(name)?.default ?? "").trim();
  if (def !== "") return { value: def, source: "default" };
  return { value: "", source: "none" };
}

/** Experiment-wide value of `name`: column B, else the glossary default. */
export function effectiveWide(t: TableState, name: string): Effective {
  const wide = (rowOf(t, name)?.values[0] ?? "").trim();
  if (wide !== "") return { value: wide, source: "experiment" };
  const def = (resolveEntry(name)?.default ?? "").trim();
  if (def !== "") return { value: def, source: "default" };
  return { value: "", source: "none" };
}

export const effectiveNum = (
  t: TableState,
  name: string,
  ci: number,
): number | undefined => {
  const v = Number(effective(t, name, ci).value);
  return Number.isFinite(v) ? v : undefined;
};

export const effectiveBool = (
  t: TableState,
  name: string,
  ci: number,
): boolean => effective(t, name, ci).value.toUpperCase() === "TRUE";

/** Column indices (0 = C) the compiler will keep. */
export const enabledConditions = (t: TableState): number[] => {
  const out: number[] = [];
  for (let ci = 0; ci < t.conditionCount; ci++)
    if (!columnDisabledBy(t, ci)) out.push(ci);
  return out;
};

/** Spreadsheet letter for condition `ci` (0 = C). */
export const columnLetter = (ci: number): string => {
  let n = ci + 2;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
};

/**
 * The compiler's rule-of-thumb session length (getDuration.ts), in seconds:
 * 6 s per identify/detect trial, 3 s per questionAndAnswer, 4 s screen-size
 * calibration, 10 s blind spot, 20/40 s sound calibrations; reading by
 * questions and characters. Commented rows are dropped as the compiler does.
 */
export function estimateDurationSec(t: TableState): number {
  const data = stateToMatrix(t).filter((r) => !isCommentName(r[0] ?? ""));
  if (data.length === 0) return 0;
  const s = EstimateDurationForScientistPage({ data });
  return Number.isFinite(s) ? Math.max(0, s) : 0;
}

export const DURATION_RULE =
  "EasyEyes rule of thumb: 6 s per identify/detect trial, 3 s per question, 4 s screen-size calibration, 10 s blind-spot mapping, instructions not counted";
