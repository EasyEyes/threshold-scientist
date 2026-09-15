/**
 * Knobs — the deterministic skills behind a scientist's ask.
 *
 * "Make it 10 degrees", "add a tangential condition", "ask their age
 * first", "track viewing distance": each is a knob. The model's job is
 * only to recognize which knob and with what arguments; the knob then
 * applies the EasyEyes parameters, with their formats and the rules that
 * tie them together (a target moved to the fovea needs horizontal
 * flankers; a new column needs a block number that keeps the sequence
 * legal; a questionnaire needs its own block). Knobs work on any table —
 * built by a recipe, imported, or hand-written — and are pure functions.
 *
 * Adding a knob: append a Knob to KNOBS. Its `args` describe the arguments
 * for the model (the apply_knobs tool description is generated from them);
 * `apply` returns the new table, the parameters it touched, and one line
 * for the log — or an error string when the ask cannot be applied.
 */
import {
  alphabeticalInsertIndex,
  newId,
  type Row,
  type TableState,
} from "../tableModel";
import {
  DEFAULT_DISTANCE_METHOD,
  bool,
  fmt,
  legalSpacingDirection,
  num,
  positionTag,
  questionCell,
  questionParam,
  resolvePosition,
  sideOf,
  type QuestionSpec,
  type Side,
  type SpacingDirection,
} from "./spec";
import { displayParams, grayRGBA, inferFontSource } from "./build";
import { acuityGuessDeg } from "./recipes/letterAcuity";
import { crowdingGuessDeg } from "./recipes/letterCrowding";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface KnobArg {
  name: string;
  /** For the model: what to pass. */
  description: string;
  required?: boolean;
}

export type KnobArgs = Record<string, unknown>;

export interface KnobSuccess {
  table: TableState;
  /** Parameters touched (for the grid's highlight and the log). */
  changed: string[];
  /** One line for the activity log. */
  note: string;
}

export interface KnobFailure {
  error: string;
}

export type KnobResult = KnobSuccess | KnobFailure;

export const isKnobFailure = (r: KnobResult): r is KnobFailure => "error" in r;

export interface Knob {
  id: string;
  /** One sentence for the model: when to use it. */
  summary: string;
  args: KnobArg[];
  apply: (table: TableState, args: KnobArgs) => KnobResult;
}

/* ------------------------------------------------------------------ */
/* Table helpers (pure)                                                */
/* ------------------------------------------------------------------ */

const COLUMNS_ARG: KnobArg = {
  name: "columns",
  description:
    "Which conditions: spreadsheet letters ('C','D'), conditionName values, or omit for all conditions.",
};

const clone = (t: TableState): TableState => ({
  conditionCount: t.conditionCount,
  rows: t.rows.map((r) => ({ ...r, values: [...r.values] })),
});

const rowOf = (t: TableState, name: string): Row | undefined =>
  t.rows.find((r) => r.name === name);

/** Value of `name` in condition ci (0-based; values[ci + 1]). */
const get = (t: TableState, name: string, ci: number): string =>
  rowOf(t, name)?.values[ci + 1] ?? "";

const getB = (t: TableState, name: string): string =>
  rowOf(t, name)?.values[0] ?? "";

/** Sets `name` in condition ci, creating the row (alphabetically) if needed. */
function set(t: TableState, name: string, ci: number, value: string): void {
  let row = rowOf(t, name);
  if (!row) {
    row = {
      id: newId(),
      name,
      values: new Array<string>(t.conditionCount + 1).fill(""),
    };
    t.rows.splice(alphabeticalInsertIndex(t.rows, name), 0, row);
  }
  while (row.values.length < t.conditionCount + 1) row.values.push("");
  row.values[ci + 1] = value;
}

function setB(t: TableState, name: string, value: string): void {
  let row = rowOf(t, name);
  if (!row) {
    row = {
      id: newId(),
      name,
      values: new Array<string>(t.conditionCount + 1).fill(""),
    };
    t.rows.splice(alphabeticalInsertIndex(t.rows, name), 0, row);
  }
  row.values[0] = value;
}

function removeRow(t: TableState, name: string): boolean {
  const i = t.rows.findIndex((r) => r.name === name);
  if (i < 0) return false;
  t.rows.splice(i, 1);
  return true;
}

/** Drops rows that are now empty in every column (after removing values). */
function dropEmptyRows(t: TableState): void {
  t.rows = t.rows.filter((r) => r.values.some((v) => v.trim() !== ""));
}

const letterToCi = (letter: string): number | null => {
  const s = letter.trim().toUpperCase();
  if (!/^[A-Z]{1,2}$/.test(s)) return null;
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n >= 3 ? n - 3 : null;
};

export const ciToLetter = (ci: number): string => {
  let n = ci + 3;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const isQuestionColumn = (t: TableState, ci: number): boolean =>
  get(t, "targetTask", ci) === "questionAndAnswer" ||
  get(t, "targetTask", ci) === "questionAnswer" ||
  t.rows.some(
    (r) =>
      /^question(And)?Answer\d\d$/.test(r.name) &&
      (r.values[ci + 1] ?? "") !== "",
  );

/**
 * Resolves the `columns` argument to condition indices. Accepts letters,
 * conditionName values (case-insensitive), 1-based numbers, "all", or
 * nothing (= every experimental condition; question blocks excluded when
 * `skipQuestions`).
 */
function resolveColumns(
  t: TableState,
  raw: unknown,
  skipQuestions = true,
): { cis: number[] } | { error: string } {
  const all = Array.from({ length: t.conditionCount }, (_, i) => i);
  const list = Array.isArray(raw)
    ? raw.map((x) => String(x ?? "").trim()).filter(Boolean)
    : typeof raw === "string" &&
      raw.trim() &&
      raw.trim().toLowerCase() !== "all"
    ? [raw.trim()]
    : [];
  if (!list.length)
    return {
      cis: skipQuestions ? all.filter((ci) => !isQuestionColumn(t, ci)) : all,
    };
  const cis: number[] = [];
  const names = rowOf(t, "conditionName")?.values ?? [];
  for (const item of list) {
    const letter = letterToCi(item);
    if (letter !== null && letter < t.conditionCount) {
      cis.push(letter);
      continue;
    }
    const byName = names.findIndex(
      (v, i) => i >= 1 && v.trim().toLowerCase() === item.toLowerCase(),
    );
    if (byName >= 1) {
      cis.push(byName - 1);
      continue;
    }
    const n = Number(item);
    if (Number.isInteger(n) && n >= 1 && n <= t.conditionCount) {
      cis.push(n - 1);
      continue;
    }
    return {
      error: `No condition "${item}". Columns are C…${ciToLetter(
        t.conditionCount - 1,
      )}; names: ${names.slice(1).filter(Boolean).join(", ") || "none"}.`,
    };
  }
  return { cis: [...new Set(cis)].sort((a, b) => a - b) };
}

const letters = (cis: number[]): string => cis.map(ciToLetter).join(", ");

/**
 * Block numbers must start at 1 and rise by 0 or 1 across the columns. This
 * keeps each column's grouping (equal raw values stay in one block) and
 * renumbers densely. Question columns are forced into a block of their own.
 */
function normalizeBlocks(t: TableState): void {
  if (t.conditionCount === 0) return;
  let next = 1;
  let prevRaw: string | null = null;
  let prevQuestion = false;
  for (let ci = 0; ci < t.conditionCount; ci++) {
    const raw = get(t, "block", ci).trim();
    const question = isQuestionColumn(t, ci);
    const sameAsPrev =
      ci > 0 && !question && !prevQuestion && raw !== "" && raw === prevRaw;
    if (ci > 0 && !sameAsPrev) next++;
    set(t, "block", ci, String(next));
    prevRaw = raw;
    prevQuestion = question;
  }
}

/** Inserts a new condition column after index `after` (or at the end), copying column `from` when given. */
function insertColumn(
  t: TableState,
  after: number | null,
  from: number | null,
): number {
  const at = after === null ? t.conditionCount : after + 1;
  for (const r of t.rows) {
    while (r.values.length < t.conditionCount + 1) r.values.push("");
    const v =
      from === null || r.name.startsWith("_") ? "" : r.values[from + 1] ?? "";
    r.values.splice(at + 1, 0, v);
  }
  t.conditionCount++;
  return at;
}

function deleteColumns(t: TableState, cis: number[]): void {
  const drop = new Set(cis.map((ci) => ci + 1));
  for (const r of t.rows) r.values = r.values.filter((_, vi) => !drop.has(vi));
  t.conditionCount -= cis.length;
}

const position = (t: TableState, ci: number) => ({
  x: Number(get(t, "targetEccentricityXDeg", ci) || 0),
  y: Number(get(t, "targetEccentricityYDeg", ci) || 0),
});

/**
 * After a target moves or the threshold changes: letter conditions whose
 * QUEST parameter is spacingDeg need a flanker direction that exists at the
 * target's position (fovea ↔ horizontal family, periphery ↔ radial family).
 */
function reconcileFlankers(
  t: TableState,
  ci: number,
  changed: Set<string>,
): void {
  if (get(t, "thresholdParameter", ci) !== "spacingDeg") return;
  if ((get(t, "targetKind", ci) || "letter") !== "letter") return;
  const { x, y } = position(t, ci);
  const current = (get(t, "spacingDirection", ci) ||
    "radial") as SpacingDirection;
  const legal = legalSpacingDirection(current, x, y);
  if (legal !== current || get(t, "spacingDirection", ci) === "") {
    set(t, "spacingDirection", ci, legal);
    changed.add("spacingDirection");
  }
}

/**
 * QUEST's prior depends on what is measured and where: after the target
 * moves or the threshold parameter changes, a letter condition's
 * thresholdGuess is re-derived (Bouma for spacing, an acuity curve for size).
 */
function reconcileGuess(t: TableState, ci: number, changed: Set<string>): void {
  if ((get(t, "targetKind", ci) || "letter") !== "letter") return;
  const { x, y } = position(t, ci);
  const e = Math.max(Math.abs(x), Math.abs(y));
  const tp = get(t, "thresholdParameter", ci);
  const guess =
    tp === "spacingDeg"
      ? crowdingGuessDeg(e)
      : tp === "targetSizeDeg"
      ? acuityGuessDeg(e)
      : null;
  if (guess === null) return;
  const value = fmt(guess, 2);
  if (get(t, "thresholdGuess", ci) !== value) {
    set(t, "thresholdGuess", ci, value);
    changed.add("thresholdGuess");
  }
}

const POSITION_TAG =
  /(\d+(\.\d+)?deg (left|right|up|down)( \([^)]*\))?|\bfovea\b)/i;

/**
 * A name for a copied condition: its source's name with the position tag
 * replaced (or appended) and, when the flankers were the point of the copy,
 * the direction appended. Unique against the other names.
 */
function derivedName(
  t: TableState,
  ci: number,
  mentionDirection: boolean,
): string {
  const base = get(t, "conditionName", ci).trim() || "condition";
  let name = base;
  if (rowOf(t, "targetEccentricityXDeg")) {
    const { x, y } = position(t, ci);
    const tag = positionTag(x, y);
    name = POSITION_TAG.test(base)
      ? base.replace(POSITION_TAG, tag)
      : `${base} ${tag}`;
  }
  if (mentionDirection) {
    const d = get(t, "spacingDirection", ci);
    if (d && !name.includes(d)) name = `${name} ${d}`;
  }
  const others = (rowOf(t, "conditionName")?.values ?? []).filter(
    (_, vi) => vi !== ci + 1,
  );
  let unique = name;
  for (let n = 2; others.includes(unique); n++) unique = `${name} ${n}`;
  return unique;
}

const ok = (
  table: TableState,
  changed: Iterable<string>,
  note: string,
): KnobSuccess => ({
  table,
  changed: [...new Set(changed)],
  note,
});

const SIDES: Side[] = ["left", "right", "up", "down", "fovea"];

/* ------------------------------------------------------------------ */
/* The knobs                                                           */
/* ------------------------------------------------------------------ */

export const KNOBS: readonly Knob[] = [
  {
    id: "set_eccentricity",
    summary:
      "Move the target: eccentricity in deg plus a side (left/right/up/down/fovea), or explicit xDeg/yDeg. Fixes the flanker direction for the new position.",
    args: [
      COLUMNS_ARG,
      { name: "eccentricityDeg", description: "Magnitude in deg; 0 = fovea." },
      {
        name: "side",
        description: "left | right | up | down | fovea (default right).",
      },
      {
        name: "xDeg",
        description: "Explicit horizontal position (overrides the above).",
      },
      { name: "yDeg", description: "Explicit vertical position." },
    ],
    apply: (table, a) => {
      const cols = resolveColumns(table, a.columns);
      if ("error" in cols) return cols;
      const side =
        typeof a.side === "string" && SIDES.includes(a.side as Side)
          ? (a.side as Side)
          : undefined;
      if (
        num(a.eccentricityDeg) === undefined &&
        num(a.xDeg) === undefined &&
        num(a.yDeg) === undefined &&
        !side
      )
        return {
          error:
            "set_eccentricity needs eccentricityDeg (and side) or xDeg/yDeg.",
        };
      const t = clone(table);
      const changed = new Set<string>([
        "targetEccentricityXDeg",
        "targetEccentricityYDeg",
      ]);
      let tag = "";
      for (const ci of cols.cis) {
        const current = position(t, ci);
        const e =
          num(a.eccentricityDeg) ??
          Math.max(Math.abs(current.x), Math.abs(current.y));
        const { x, y } = resolvePosition(
          { eccentricityDeg: e, side, xDeg: num(a.xDeg), yDeg: num(a.yDeg) },
          e,
        );
        set(t, "targetEccentricityXDeg", ci, fmt(x));
        set(t, "targetEccentricityYDeg", ci, fmt(y));
        reconcileFlankers(t, ci, changed);
        reconcileGuess(t, ci, changed);
        tag = positionTag(x, y);
      }
      return ok(t, changed, `Target at ${tag} in ${letters(cols.cis)}`);
    },
  },
  {
    id: "set_trials",
    summary: "Set conditionTrials for some or all conditions.",
    args: [
      COLUMNS_ARG,
      { name: "trials", description: "Trials per condition.", required: true },
    ],
    apply: (table, a) => {
      const n = num(a.trials);
      if (n === undefined || n < 1)
        return { error: "set_trials needs trials ≥ 1." };
      const cols = resolveColumns(table, a.columns);
      if ("error" in cols) return cols;
      const t = clone(table);
      for (const ci of cols.cis)
        set(t, "conditionTrials", ci, fmt(Math.round(n), 0));
      return ok(
        t,
        ["conditionTrials"],
        `${fmt(Math.round(n), 0)} trials in ${letters(cols.cis)}`,
      );
    },
  },
  {
    id: "set_blocks",
    summary:
      "Regroup conditions into blocks: interleaved (all in one block), separate (one block each), bySide, byEccentricity. Questionnaire columns keep their own blocks.",
    args: [
      {
        name: "mode",
        description: "interleaved | separate | bySide | byEccentricity",
        required: true,
      },
    ],
    apply: (table, a) => {
      const mode = String(a.mode ?? "");
      if (
        !["interleaved", "separate", "bySide", "byEccentricity"].includes(mode)
      )
        return {
          error:
            "set_blocks mode must be interleaved, separate, bySide or byEccentricity.",
        };
      const t = clone(table);
      // Group the experimental columns; question columns stay where they are.
      const key = (ci: number): string => {
        const { x, y } = position(t, ci);
        if (mode === "separate") return `c${ci}`;
        if (mode === "bySide") return `side:${sideOf(x, y)}`;
        if (mode === "byEccentricity")
          return `ecc:${fmt(Math.max(Math.abs(x), Math.abs(y)))}`;
        return "all";
      };
      const order: number[] = [];
      const groups = new Map<string, number[]>();
      for (let ci = 0; ci < t.conditionCount; ci++) {
        const k = isQuestionColumn(t, ci) ? `q${ci}` : key(ci);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(ci);
      }
      for (const cis of groups.values()) order.push(...cis);
      // Reorder columns to make groups contiguous, then number the groups.
      for (const r of t.rows) {
        while (r.values.length < t.conditionCount + 1) r.values.push("");
        const vals = order.map((ci) => r.values[ci + 1]);
        r.values = [r.values[0], ...vals];
      }
      let b = 0;
      let k = 0;
      for (const cis of groups.values()) {
        b++;
        for (let i = 0; i < cis.length; i++) set(t, "block", k++, String(b));
      }
      return ok(t, ["block"], `${b} block${b === 1 ? "" : "s"} (${mode})`);
    },
  },
  {
    id: "add_condition",
    summary:
      "Add a condition as a copy of an existing one (default: the last experimental one) with changes: eccentricityDeg/side, trials, spacingDirection, threshold, name, and any parameter via set. Goes in the same block as its source unless newBlock is true.",
    args: [
      {
        name: "copyOf",
        description: "Letter or conditionName of the condition to copy.",
      },
      { name: "name", description: "conditionName for the new condition." },
      { name: "eccentricityDeg", description: "deg; 0 = fovea." },
      { name: "side", description: "left | right | up | down | fovea." },
      { name: "trials", description: "conditionTrials." },
      {
        name: "spacingDirection",
        description: "radial | tangential | horizontal | vertical …",
      },
      {
        name: "threshold",
        description: "spacingDeg | targetSizeDeg | targetDurationSec …",
      },
      {
        name: "newBlock",
        description: "true to put it in a new block right after its source.",
      },
      {
        name: "set",
        description:
          "Object of parameter → value applied to the new condition.",
      },
    ],
    apply: (table, a) => {
      const t = clone(table);
      let from: number | null = null;
      if (a.copyOf !== undefined && a.copyOf !== "") {
        const cols = resolveColumns(t, [a.copyOf], false);
        if ("error" in cols) return cols;
        from = cols.cis[0];
      } else {
        for (let ci = t.conditionCount - 1; ci >= 0; ci--)
          if (!isQuestionColumn(t, ci)) {
            from = ci;
            break;
          }
      }
      // A new block goes after the whole block the source belongs to, so the
      // source block is not split in two.
      let after = from;
      const newBlock = bool(a.newBlock) === true;
      if (newBlock && from !== null) {
        const raw = get(t, "block", from);
        while (
          after !== null &&
          after + 1 < t.conditionCount &&
          get(t, "block", after + 1) === raw
        )
          after++;
      }
      const at = insertColumn(t, after, from);
      const changed = new Set<string>(["block", "conditionName"]);
      if (newBlock) set(t, "block", at, `${get(t, "block", from ?? at)}.5`);
      const side =
        typeof a.side === "string" && SIDES.includes(a.side as Side)
          ? (a.side as Side)
          : undefined;
      if (num(a.eccentricityDeg) !== undefined || side) {
        const cur = position(t, at);
        const e =
          num(a.eccentricityDeg) ?? Math.max(Math.abs(cur.x), Math.abs(cur.y));
        const { x, y } = resolvePosition({ eccentricityDeg: e, side }, e);
        set(t, "targetEccentricityXDeg", at, fmt(x));
        set(t, "targetEccentricityYDeg", at, fmt(y));
        changed.add("targetEccentricityXDeg").add("targetEccentricityYDeg");
      }
      if (num(a.trials) !== undefined) {
        set(
          t,
          "conditionTrials",
          at,
          fmt(Math.max(1, Math.round(num(a.trials)!)), 0),
        );
        changed.add("conditionTrials");
      }
      if (typeof a.threshold === "string" && a.threshold) {
        set(t, "thresholdParameter", at, a.threshold);
        changed.add("thresholdParameter");
      }
      if (typeof a.spacingDirection === "string" && a.spacingDirection) {
        const { x, y } = position(t, at);
        set(
          t,
          "spacingDirection",
          at,
          legalSpacingDirection(a.spacingDirection as SpacingDirection, x, y),
        );
        changed.add("spacingDirection");
      }
      reconcileFlankers(t, at, changed);
      reconcileGuess(t, at, changed);
      if (a.set && typeof a.set === "object")
        for (const [k, v] of Object.entries(a.set as Record<string, unknown>)) {
          set(t, k.trim(), at, String(v ?? ""));
          changed.add(k.trim());
        }
      const name =
        typeof a.name === "string" && a.name.trim()
          ? a.name.trim()
          : derivedName(t, at, typeof a.spacingDirection === "string");
      set(t, "conditionName", at, name);
      normalizeBlocks(t);
      return ok(
        t,
        changed,
        `Added condition "${name}" as column ${ciToLetter(at)}`,
      );
    },
  },
  {
    id: "remove_condition",
    summary: "Delete conditions (columns); block numbers are renumbered.",
    args: [{ ...COLUMNS_ARG, required: true }],
    apply: (table, a) => {
      if (a.columns === undefined)
        return { error: "remove_condition needs columns." };
      const cols = resolveColumns(table, a.columns, false);
      if ("error" in cols) return cols;
      if (cols.cis.length >= table.conditionCount)
        return { error: "Cannot remove every condition." };
      const t = clone(table);
      deleteColumns(t, cols.cis);
      dropEmptyRows(t);
      normalizeBlocks(t);
      return ok(t, ["block"], `Removed ${letters(cols.cis)}`);
    },
  },
  {
    id: "mirror_conditions",
    summary:
      "For each chosen peripheral condition add its mirror image on the other side (left ↔ right, up ↔ down), in the same block, right after it.",
    args: [COLUMNS_ARG],
    apply: (table, a) => {
      const cols = resolveColumns(table, a.columns);
      if ("error" in cols) return cols;
      const t = clone(table);
      let added = 0;
      // Right to left so inserting does not shift the indices still to visit.
      for (const ci of [...cols.cis].reverse()) {
        const { x, y } = position(t, ci);
        if (x === 0 && y === 0) continue;
        const at = insertColumn(t, ci, ci);
        set(t, "targetEccentricityXDeg", at, fmt(-x));
        set(t, "targetEccentricityYDeg", at, fmt(-y));
        const swapped = get(t, "conditionName", ci)
          .replace(/\bleft\b/i, "\u0000")
          .replace(/\bright\b/i, "left")
          .replace(/\u0000/g, "right")
          .replace(/\bup\b/i, "\u0001")
          .replace(/\bdown\b/i, "up")
          .replace(/\u0001/g, "down");
        set(
          t,
          "conditionName",
          at,
          swapped === get(t, "conditionName", ci)
            ? `${swapped} mirror`
            : swapped,
        );
        added++;
      }
      if (!added)
        return {
          error:
            "No peripheral condition to mirror (all targets are at the fovea).",
        };
      normalizeBlocks(t);
      return ok(
        t,
        [
          "targetEccentricityXDeg",
          "targetEccentricityYDeg",
          "conditionName",
          "block",
        ],
        `Mirrored ${added} condition${added === 1 ? "" : "s"}`,
      );
    },
  },
  {
    id: "set_font",
    summary:
      "Set the font (and fontSource: a file name like Sloan.woff2 means file, otherwise google) for some or all conditions.",
    args: [
      COLUMNS_ARG,
      {
        name: "font",
        description:
          "Google font name or a font file in EasyEyesResources/fonts.",
        required: true,
      },
      {
        name: "fontSource",
        description:
          "google | file | browser | adobe | morisawa (inferred when omitted).",
      },
      {
        name: "characterSet",
        description: "Optional fontCharacterSet to set alongside.",
      },
    ],
    apply: (table, a) => {
      const font = String(a.font ?? "").trim();
      if (!font) return { error: "set_font needs font." };
      const cols = resolveColumns(table, a.columns, false);
      if ("error" in cols) return cols;
      const source =
        String(a.fontSource ?? "").trim() || inferFontSource(font) || "google";
      const t = clone(table);
      const changed = ["font", "fontSource"];
      for (const ci of cols.cis) {
        set(t, "font", ci, font);
        set(t, "fontSource", ci, source);
        if (typeof a.characterSet === "string" && a.characterSet) {
          set(t, "fontCharacterSet", ci, a.characterSet);
          changed.push("fontCharacterSet");
        }
      }
      return ok(t, changed, `Font ${font} (${source}) in ${letters(cols.cis)}`);
    },
  },
  {
    id: "set_character_set",
    summary: "Set fontCharacterSet (the letters the target is drawn from).",
    args: [
      COLUMNS_ARG,
      { name: "characters", description: "e.g. DHKNORSVZ", required: true },
    ],
    apply: (table, a) => {
      const chars = String(a.characters ?? "").trim();
      if (!chars) return { error: "set_character_set needs characters." };
      const cols = resolveColumns(table, a.columns);
      if ("error" in cols) return cols;
      const t = clone(table);
      for (const ci of cols.cis) set(t, "fontCharacterSet", ci, chars);
      return ok(
        t,
        ["fontCharacterSet"],
        `Character set ${chars} in ${letters(cols.cis)}`,
      );
    },
  },
  {
    id: "set_duration",
    summary: "Set targetDurationSec (how long the target is shown).",
    args: [
      COLUMNS_ARG,
      { name: "sec", description: "Seconds.", required: true },
    ],
    apply: (table, a) => {
      const s = num(a.sec);
      if (s === undefined || s <= 0)
        return { error: "set_duration needs sec > 0." };
      const cols = resolveColumns(table, a.columns);
      if ("error" in cols) return cols;
      const t = clone(table);
      for (const ci of cols.cis) set(t, "targetDurationSec", ci, fmt(s));
      return ok(
        t,
        ["targetDurationSec"],
        `Duration ${fmt(s)} s in ${letters(cols.cis)}`,
      );
    },
  },
  {
    id: "set_threshold",
    summary:
      "Change what QUEST varies (thresholdParameter): spacingDeg (crowding), targetSizeDeg (acuity), targetDurationSec… Keeps spacingRelationToSize and the flanker direction consistent.",
    args: [
      COLUMNS_ARG,
      {
        name: "parameter",
        description:
          "spacingDeg | targetSizeDeg | targetDurationSec | targetEccentricityXDeg | targetContrast",
        required: true,
      },
    ],
    apply: (table, a) => {
      const p = String(a.parameter ?? "").trim();
      if (!p) return { error: "set_threshold needs parameter." };
      const cols = resolveColumns(table, a.columns);
      if ("error" in cols) return cols;
      const t = clone(table);
      const changed = new Set<string>(["thresholdParameter"]);
      for (const ci of cols.cis) {
        set(t, "thresholdParameter", ci, p);
        if (p === "targetSizeDeg" && get(t, "targetKind", ci) === "letter") {
          set(t, "spacingRelationToSize", ci, "none");
          changed.add("spacingRelationToSize");
        }
        if (p === "spacingDeg") {
          if (get(t, "spacingRelationToSize", ci) === "none") {
            set(t, "spacingRelationToSize", ci, "ratio");
            changed.add("spacingRelationToSize");
          }
          reconcileFlankers(t, ci, changed);
        }
        reconcileGuess(t, ci, changed);
      }
      return ok(t, changed, `QUEST varies ${p} in ${letters(cols.cis)}`);
    },
  },
  {
    id: "set_spacing_direction",
    summary:
      "Flanker arrangement for crowding: radial | tangential | radialAndTangential (periphery), horizontal | vertical | horizontalAndVertical (fovea). Mapped to the legal family for each target's position.",
    args: [
      COLUMNS_ARG,
      { name: "direction", description: "See summary.", required: true },
    ],
    apply: (table, a) => {
      const d = String(a.direction ?? "").trim() as SpacingDirection;
      if (!d) return { error: "set_spacing_direction needs direction." };
      const cols = resolveColumns(table, a.columns);
      if ("error" in cols) return cols;
      const t = clone(table);
      for (const ci of cols.cis) {
        const { x, y } = position(t, ci);
        set(t, "spacingDirection", ci, legalSpacingDirection(d, x, y));
      }
      return ok(
        t,
        ["spacingDirection"],
        `Flankers ${d} in ${letters(cols.cis)}`,
      );
    },
  },
  {
    id: "set_viewing_distance",
    summary: "Set viewingDistanceDesiredCm.",
    args: [
      COLUMNS_ARG,
      { name: "cm", description: "Centimetres.", required: true },
    ],
    apply: (table, a) => {
      const cm = num(a.cm);
      if (cm === undefined || cm <= 0)
        return { error: "set_viewing_distance needs cm > 0." };
      const cols = resolveColumns(table, a.columns, false);
      if ("error" in cols) return cols;
      const t = clone(table);
      for (const ci of cols.cis)
        set(t, "viewingDistanceDesiredCm", ci, fmt(cm));
      return ok(
        t,
        ["viewingDistanceDesiredCm"],
        `Viewing distance ${fmt(cm)} cm in ${letters(cols.cis)}`,
      );
    },
  },
  {
    id: "set_calibration",
    summary:
      "Calibration: screenSize (credit-card screen measurement, calibrateScreenSizeBool), trackDistance (webcam viewing-distance tracking, calibrateDistanceBool), distanceMethod (_calibrateDistance; paper is the house default and is written whenever tracking is turned on).",
    args: [
      { name: "screenSize", description: "true/false." },
      { name: "trackDistance", description: "true/false." },
      {
        name: "distanceMethod",
        description:
          "paper (default) | creditCard | blindspot | object | typical — only when the scientist asks for another method.",
      },
    ],
    apply: (table, a) => {
      const screen = bool(a.screenSize);
      const track = bool(a.trackDistance);
      let method = String(a.distanceMethod ?? "").trim();
      if (screen === undefined && track === undefined && !method)
        return {
          error:
            "set_calibration needs screenSize, trackDistance or distanceMethod.",
        };
      const t = clone(table);
      // Turning tracking on in a table that never stated its method: paper.
      if (track === true && !method && !getB(t, "_calibrateDistance"))
        method = DEFAULT_DISTANCE_METHOD;
      const changed: string[] = [];
      const bits: string[] = [];
      for (let ci = 0; ci < t.conditionCount; ci++) {
        if (screen !== undefined)
          set(t, "calibrateScreenSizeBool", ci, screen ? "TRUE" : "FALSE");
        if (track !== undefined)
          set(t, "calibrateDistanceBool", ci, track ? "TRUE" : "FALSE");
      }
      if (screen !== undefined) {
        changed.push("calibrateScreenSizeBool");
        bits.push(`screen size ${screen ? "on" : "off"}`);
      }
      if (track !== undefined) {
        changed.push("calibrateDistanceBool");
        bits.push(`distance tracking ${track ? "on" : "off"}`);
      }
      if (method) {
        setB(t, "_calibrateDistance", method);
        changed.push("_calibrateDistance");
        bits.push(`method ${method}`);
      }
      return ok(t, changed, `Calibration: ${bits.join(", ")}`);
    },
  },
  {
    id: "set_display",
    summary:
      "Display color management, for any study: colorSpace (_screenColorSpace srgb | display-p3), highPrecision (_screenFloat16Bool + _screenDitherBool), measurePrecision (_screenMeasurePrecision test2Digits | assume8Bit), colorimeter (_screenColorCheckBool + _needColorimeterBool, needs a CRS ColorCAL), backgroundGray (screenColorRGBA gray 0–1 in every chosen condition).",
    args: [
      COLUMNS_ARG,
      { name: "colorSpace", description: "srgb | display-p3." },
      {
        name: "highPrecision",
        description:
          "true/false — float16 render path plus noisy-bit dithering.",
      },
      {
        name: "measurePrecision",
        description: "true/false — perceptual bit-depth test before block 1.",
      },
      {
        name: "colorimeter",
        description: "true/false — photometer check; only with the hardware.",
      },
      { name: "backgroundGray", description: "0–1; 0.5 = mid gray." },
    ],
    apply: (table, a) => {
      const space = String(a.colorSpace ?? "")
        .trim()
        .toLowerCase();
      if (space && space !== "srgb" && space !== "display-p3")
        return {
          error: `colorSpace must be srgb or display-p3, not "${space}".`,
        };
      const wide = displayParams({
        recipe: "",
        colorSpace: (space || undefined) as "srgb" | "display-p3" | undefined,
        highPrecision: bool(a.highPrecision),
        measurePrecision: bool(a.measurePrecision),
        colorimeter: bool(a.colorimeter),
      });
      const gray = num(a.backgroundGray);
      if (!Object.keys(wide).length && gray === undefined)
        return {
          error:
            "set_display needs colorSpace, highPrecision, measurePrecision, colorimeter or backgroundGray.",
        };
      const t = clone(table);
      const changed: string[] = [];
      const bits: string[] = [];
      for (const [k, v] of Object.entries(wide)) {
        setB(t, k, v);
        changed.push(k);
        bits.push(`${k} ${v}`);
      }
      // Compiler rule: a precision test needs the float16 path. Turning
      // float16 off therefore also turns a test off.
      const testing = /^test/.test(getB(t, "_screenMeasurePrecision"));
      if (testing && getB(t, "_screenFloat16Bool") !== "TRUE") {
        if (bool(a.highPrecision) === false) {
          setB(t, "_screenMeasurePrecision", "assume8Bit");
          changed.push("_screenMeasurePrecision");
          bits.push("precision test off (needs float16)");
        } else {
          setB(t, "_screenFloat16Bool", "TRUE");
          changed.push("_screenFloat16Bool");
          bits.push("_screenFloat16Bool TRUE (the precision test needs it)");
        }
      }
      if (gray !== undefined) {
        const cols = resolveColumns(table, a.columns);
        if ("error" in cols) return cols;
        for (const ci of cols.cis)
          set(t, "screenColorRGBA", ci, grayRGBA(gray));
        changed.push("screenColorRGBA");
        bits.push(`background gray ${fmt(gray)} in ${letters(cols.cis)}`);
      }
      return ok(t, changed, `Display: ${bits.join(", ")}`);
    },
  },
  {
    id: "set_sound",
    summary:
      "Sound studies: soundCalibration (_calibrateSound1000HzBool + _calibrateSoundAllHzBool), soundOutput (needSoundOutput loudspeakers | headphones), and per condition soundFolder (targetSoundFolder), maskerFolder (maskerSoundFolder; '' removes the masker), maskerDBSPL, noiseDBSPL (targetSoundNoiseDBSPL), task (detect | identify, with thresholdGamma 0.5 for detect).",
    args: [
      COLUMNS_ARG,
      { name: "soundCalibration", description: "true/false." },
      {
        name: "soundOutput",
        description:
          "loudspeakers | headphones — set in every condition (the compiler wants one value per block).",
      },
      {
        name: "soundFolder",
        description: "Zip name in EasyEyesResources/folders, without .zip.",
      },
      {
        name: "maskerFolder",
        description: "Zip name; '' to remove the masker.",
      },
      { name: "maskerDBSPL", description: "Masker level, dB SPL." },
      {
        name: "noiseDBSPL",
        description: "White-noise level under the target, dB SPL.",
      },
      { name: "task", description: "detect | identify." },
    ],
    apply: (table, a) => {
      const calibrate = bool(a.soundCalibration);
      const output = String(a.soundOutput ?? "")
        .trim()
        .toLowerCase();
      if (output && output !== "loudspeakers" && output !== "headphones")
        return {
          error: `soundOutput must be loudspeakers or headphones, not "${output}".`,
        };
      const folder =
        a.soundFolder === undefined ? undefined : String(a.soundFolder).trim();
      const masker =
        a.maskerFolder === undefined
          ? undefined
          : String(a.maskerFolder).trim();
      const maskerDb = num(a.maskerDBSPL);
      const noiseDb = num(a.noiseDBSPL);
      const task = String(a.task ?? "")
        .trim()
        .toLowerCase();
      if (task && task !== "detect" && task !== "identify")
        return { error: `task must be detect or identify, not "${task}".` };
      if (
        calibrate === undefined &&
        !output &&
        folder === undefined &&
        masker === undefined &&
        maskerDb === undefined &&
        noiseDb === undefined &&
        !task
      )
        return { error: "set_sound needs at least one argument." };
      const t = clone(table);
      const changed: string[] = [];
      const bits: string[] = [];
      if (calibrate !== undefined) {
        setB(t, "_calibrateSound1000HzBool", calibrate ? "TRUE" : "FALSE");
        setB(t, "_calibrateSoundAllHzBool", calibrate ? "TRUE" : "FALSE");
        changed.push("_calibrateSound1000HzBool", "_calibrateSoundAllHzBool");
        bits.push(`calibration ${calibrate ? "on" : "off"}`);
      }
      const cols = resolveColumns(table, a.columns);
      if ("error" in cols) return cols;
      // needSoundOutput must agree within a block: set it everywhere.
      if (output)
        for (let ci = 0; ci < t.conditionCount; ci++)
          set(t, "needSoundOutput", ci, output);
      for (const ci of cols.cis) {
        if (folder !== undefined) set(t, "targetSoundFolder", ci, folder);
        if (masker !== undefined) {
          set(t, "maskerSoundFolder", ci, masker);
          if (masker === "") set(t, "maskerSoundDBSPL", ci, "");
          else if (maskerDb === undefined && !get(t, "maskerSoundDBSPL", ci))
            set(t, "maskerSoundDBSPL", ci, "40");
        }
        if (maskerDb !== undefined)
          set(t, "maskerSoundDBSPL", ci, fmt(maskerDb));
        if (noiseDb !== undefined)
          set(t, "targetSoundNoiseDBSPL", ci, fmt(noiseDb));
        if (task) {
          set(t, "targetTask", ci, task);
          set(t, "thresholdGamma", ci, task === "detect" ? "0.5" : "");
        }
      }
      if (output) {
        changed.push("needSoundOutput");
        bits.push(output);
      }
      if (folder !== undefined) {
        changed.push("targetSoundFolder");
        bits.push(`target folder ${folder || "(cleared)"}`);
      }
      if (masker !== undefined) {
        changed.push("maskerSoundFolder", "maskerSoundDBSPL");
        bits.push(masker ? `masker ${masker}` : "no masker");
      }
      if (maskerDb !== undefined) {
        changed.push("maskerSoundDBSPL");
        bits.push(`masker ${fmt(maskerDb)} dB SPL`);
      }
      if (noiseDb !== undefined) {
        changed.push("targetSoundNoiseDBSPL");
        bits.push(`noise ${fmt(noiseDb)} dB SPL`);
      }
      if (task) {
        changed.push("targetTask", "thresholdGamma");
        bits.push(task);
      }
      dropEmptyRows(t);
      return ok(
        t,
        [...new Set(changed)],
        `Sound: ${bits.join(", ")} in ${letters(cols.cis)}`,
      );
    },
  },
  {
    id: "add_questions",
    summary:
      "Add a questionnaire block (questionAndAnswer01…): before the first block or after the last. Each question: {nickname?, question, answers?[], correct?}; 2+ answers = multiple choice, none = free text.",
    args: [
      {
        name: "questions",
        description: "Array of {nickname, question, answers, correct}.",
        required: true,
      },
      { name: "position", description: "before | after (default before)." },
    ],
    apply: (table, a) => {
      const qs = (Array.isArray(a.questions) ? a.questions : []).filter(
        (q): q is QuestionSpec =>
          !!q &&
          typeof q === "object" &&
          typeof (q as QuestionSpec).question === "string" &&
          (q as QuestionSpec).question.trim() !== "",
      );
      if (!qs.length)
        return {
          error: "add_questions needs questions[] with a question each.",
        };
      const before = String(a.position ?? "before") !== "after";
      const t = clone(table);
      const at = insertColumn(t, before ? -1 : null, null);
      set(
        t,
        "conditionName",
        at,
        before ? "questions before" : "questions after",
      );
      set(t, "conditionTrials", at, "1");
      set(t, "targetTask", at, "questionAndAnswer");
      // Match the study's font so the block renders like the rest.
      const fontFrom = before ? 1 : at - 1;
      if (
        fontFrom >= 0 &&
        fontFrom < t.conditionCount &&
        get(t, "font", fontFrom)
      ) {
        set(t, "font", at, get(t, "font", fontFrom));
        set(t, "fontSource", at, get(t, "fontSource", fontFrom));
      }
      const changed = [
        "block",
        "conditionName",
        "conditionTrials",
        "targetTask",
      ];
      qs.forEach((q, i) => {
        set(t, questionParam(i), at, questionCell(q, i));
        changed.push(questionParam(i));
      });
      set(t, "block", at, before ? "0" : "999999");
      normalizeBlocks(t);
      return ok(
        t,
        changed,
        `${qs.length} question${qs.length === 1 ? "" : "s"} ${
          before ? "before" : "after"
        } the experiment`,
      );
    },
  },
  {
    id: "set_forms",
    summary:
      "Consent and debrief forms (_consentForm, _debriefForm): file names in EasyEyesResources/forms.",
    args: [
      { name: "consent", description: "e.g. consent.pdf" },
      { name: "debrief", description: "e.g. debrief.pdf" },
    ],
    apply: (table, a) => {
      const consent = String(a.consent ?? "").trim();
      const debrief = String(a.debrief ?? "").trim();
      if (!consent && !debrief)
        return { error: "set_forms needs consent and/or debrief." };
      const t = clone(table);
      const changed: string[] = [];
      if (consent) {
        setB(t, "_consentForm", consent);
        changed.push("_consentForm");
      }
      if (debrief) {
        setB(t, "_debriefForm", debrief);
        changed.push("_debriefForm");
      }
      return ok(
        t,
        changed,
        `Forms: ${[consent, debrief].filter(Boolean).join(", ")}`,
      );
    },
  },
  {
    id: "set_participant_id",
    summary:
      "Multi-session studies: ask for / save an EasyEyesID (_participantIDGetBool, _participantIDPutBool).",
    args: [{ name: "enabled", description: "true/false", required: true }],
    apply: (table, a) => {
      const on = bool(a.enabled);
      if (on === undefined)
        return { error: "set_participant_id needs enabled true/false." };
      const t = clone(table);
      if (on) {
        setB(t, "_participantIDGetBool", "TRUE");
        setB(t, "_participantIDPutBool", "TRUE");
      } else {
        removeRow(t, "_participantIDGetBool");
        removeRow(t, "_participantIDPutBool");
      }
      return ok(
        t,
        ["_participantIDGetBool", "_participantIDPutBool"],
        `Participant ID ${on ? "on" : "off"}`,
      );
    },
  },
  {
    id: "set_language",
    summary:
      "Instruction language (_language), BCP 47 code: en, it, fr, de, es, ar, ja, zh-CN…",
    args: [{ name: "code", description: "Language code.", required: true }],
    apply: (table, a) => {
      const code = String(a.code ?? "").trim();
      if (!code) return { error: "set_language needs code." };
      const t = clone(table);
      setB(t, "_language", code);
      return ok(t, ["_language"], `Language ${code}`);
    },
  },
  {
    id: "set_recruitment",
    summary:
      "Online recruitment (_online1RecruitmentService): Prolific or none.",
    args: [{ name: "service", description: "Prolific | none", required: true }],
    apply: (table, a) => {
      const s = String(a.service ?? "").trim();
      if (!s) return { error: "set_recruitment needs service." };
      const t = clone(table);
      setB(t, "_online1RecruitmentService", s);
      return ok(t, ["_online1RecruitmentService"], `Recruitment ${s}`);
    },
  },
  {
    id: "set_about",
    summary: "Describe the study (_about) and/or its authors (_authors).",
    args: [
      { name: "about", description: "One or two sentences." },
      { name: "authors", description: "Names, semicolon-separated." },
    ],
    apply: (table, a) => {
      const about = String(a.about ?? "").trim();
      const authors = String(a.authors ?? "").trim();
      if (!about && !authors)
        return { error: "set_about needs about and/or authors." };
      const t = clone(table);
      const changed: string[] = [];
      if (about) {
        setB(t, "_about", about);
        changed.push("_about");
      }
      if (authors) {
        setB(t, "_authors", authors);
        changed.push("_authors");
      }
      return ok(t, changed, "Updated the study description");
    },
  },
  {
    id: "rename_condition",
    summary: "Set conditionName of one condition.",
    args: [
      {
        name: "column",
        description: "Letter or current conditionName.",
        required: true,
      },
      { name: "name", description: "New conditionName.", required: true },
    ],
    apply: (table, a) => {
      const name = String(a.name ?? "").trim();
      if (!name) return { error: "rename_condition needs name." };
      const cols = resolveColumns(table, [a.column], false);
      if ("error" in cols) return cols;
      const t = clone(table);
      set(t, "conditionName", cols.cis[0], name);
      return ok(
        t,
        ["conditionName"],
        `Renamed ${ciToLetter(cols.cis[0])} to "${name}"`,
      );
    },
  },
  {
    id: "set_for_all",
    summary:
      "Set one parameter to one value in every chosen condition (or in column B for an underscore parameter). The generic knob when no specific one fits.",
    args: [
      COLUMNS_ARG,
      {
        name: "parameter",
        description: "Exact glossary name.",
        required: true,
      },
      {
        name: "value",
        description: "The value; '' clears it.",
        required: true,
      },
    ],
    apply: (table, a) => {
      const p = String(a.parameter ?? "").trim();
      if (!p) return { error: "set_for_all needs parameter." };
      const value = String(a.value ?? "");
      const t = clone(table);
      if (p.startsWith("_")) {
        setB(t, p, value);
        if (value === "") dropEmptyRows(t);
        return ok(t, [p], `${p} = ${value || "(cleared)"}`);
      }
      const cols = resolveColumns(table, a.columns, false);
      if ("error" in cols) return cols;
      for (const ci of cols.cis) set(t, p, ci, value);
      if (value === "") dropEmptyRows(t);
      return ok(
        t,
        [p],
        `${p} = ${value || "(cleared)"} in ${letters(cols.cis)}`,
      );
    },
  },
];

export const knobById = (id: string): Knob | undefined =>
  KNOBS.find((k) => k.id === (id ?? "").trim());

/** The knob reference the model reads: id, when, arguments. */
export const describeKnobs = (): string =>
  KNOBS.map(
    (k) =>
      `- ${k.id}: ${k.summary}\n  args: ${k.args
        .map((x) => `${x.name}${x.required ? "*" : ""} — ${x.description}`)
        .join("; ")}`,
  ).join("\n");
