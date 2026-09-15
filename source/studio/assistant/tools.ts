/**
 * The assistant's tools: what the model may do to the Studio, and the code
 * that does it.
 *
 * Everything the model changes goes through here, as pure functions on the
 * table model — the model never writes the grid; it proposes operations,
 * this file applies them and answers with what the compiler's own checks
 * (validation.ts, resources.ts) then say. That closed loop is the design:
 * the model does not need to know every EasyEyes rule, because every edit is
 * validated with the real rules and the verdict goes straight back to it.
 *
 * Guards that keep the model honest live here too: a parameter name that is
 * not in the glossary is refused (with near matches), resource files must
 * exist in EasyEyesResources or among the dropped files, and any question
 * for the scientist ends the turn (ask_user) instead of being guessed.
 */
import Papa from "papaparse";
import type { GlossaryEntry } from "../../components/types";
import type { EasyEyesError } from "../validation";
import type { NeededResource, UserResources } from "../resources";
import { existsInUserResources, RESOURCE_TYPE_LABELS } from "../resources";
import { resolveEntry, suggestibleEntries } from "../glossary";
import { categoryOf } from "../categories";
import { EXAMPLES } from "../examples";
import { TEMPLATES } from "../templates";
import { parseCsvString } from "../fileImport";
import {
  buildStudy,
  isBuildFailure,
  isKnobFailure,
  knobById,
  KNOBS,
  RECIPES,
  STUDY_SCHEMA,
} from "../builder";
import {
  alphabeticalInsertIndex,
  columnDisabledBy,
  isCommentName,
  matrixToState,
  newId,
  stateToMatrix,
  stripCommentPrefix,
  toggleConditionEnabled,
  type Row,
  type TableState,
} from "../tableModel";

/* ------------------------------------------------------------------ */
/* Context and outcomes                                                */
/* ------------------------------------------------------------------ */

export interface CheckReport {
  errors: EasyEyesError[];
  resourceErrors: EasyEyesError[];
  needed: NeededResource[];
}

export interface AssistantContext {
  table: TableState;
  name: string;
  signedIn: boolean;
  userResources: UserResources | null;
  /** Names of the files dropped in the Studio this session. */
  droppedFileNames: string[];
  /**
   * What the scientist last clicked in the grid: a parameter row, and the
   * column letter when it was a cell — "this cell" in their messages.
   */
  focus: GridFocus | null;
  /** The compiler's checks on a candidate table (StudioPanel supplies it). */
  check: (table: TableState) => CheckReport;
}

/** The grid's selection: a row, plus a column letter when a cell has focus. */
export interface GridFocus {
  parameter: string;
  /** Spreadsheet letter (B, C, …); null when only the row is selected. */
  column: string | null;
}

export const describeFocus = (focus: GridFocus | null): string =>
  focus === null
    ? "none"
    : focus.column === null
    ? `row ${focus.parameter}`
    : `cell ${focus.parameter} in column ${focus.column}`;

/**
 * What a table-changing tool did, as data for the pane's result card (the
 * model gets the same facts as text in `result`).
 */
export interface ToolReport {
  kind: "built" | "edited";
  /** "Letter crowding" for a build; what was edited otherwise. */
  title: string;
  /** One clause per edit ("QUEST varies spacingDeg in D, E"). */
  steps: string[];
  /** Why the built table says what it says (recipe rationale). */
  rationale: string[];
  changed: string[];
  /** The compiler's verdict on the resulting table. */
  check: CheckReport;
}

export interface ToolOutcome {
  /** Handed back to the model as the tool_result. */
  result: string;
  isError?: boolean;
  /** Set when the tool changed the table / the experiment name. */
  table?: TableState;
  name?: string;
  /** Parameters touched, for the grid to highlight. */
  changedParams?: string[];
  /** The table was built anew: the grid reveals it cell by cell. */
  reveal?: boolean;
  /** ask_user: the turn ends and the scientist answers. */
  ask?: { question: string; options: string[] };
  /** One line for the chat's activity log ("Edited 6 cells · 0 errors"). */
  activity: string;
  /** For the result card, when the table changed. */
  report?: ToolReport;
}

/** Block → condition names, in table order — the study's shape at a glance. */
export function tableOutline(
  t: TableState,
): { block: string; conditions: string[] }[] {
  const blocks = t.rows.find((r) => r.name === "block")?.values ?? [];
  const names = t.rows.find((r) => r.name === "conditionName")?.values ?? [];
  const out: { block: string; conditions: string[] }[] = [];
  for (let ci = 0; ci < t.conditionCount; ci++) {
    const b = (blocks[ci + 1] ?? "").trim() || "?";
    const label =
      (names[ci + 1] ?? "").trim() || `Column ${valueIndexToLetter(ci + 1)}`;
    const last = out[out.length - 1];
    if (last && last.block === b) last.conditions.push(label);
    else out.push({ block: b, conditions: [label] });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Tool definitions (Anthropic Messages API format)                    */
/* ------------------------------------------------------------------ */

const EDIT_OPERATIONS = [
  "set",
  "set_row",
  "remove",
  "rename",
  "comment",
  "uncomment",
  "add_column",
  "remove_column",
  "disable_column",
  "enable_column",
] as const;
type EditOpName = (typeof EDIT_OPERATIONS)[number];

export interface EditOperation {
  op: EditOpName;
  parameter?: string;
  column?: string;
  value?: string;
  values?: string[];
  new_name?: string;
  copy_of?: string;
}

export const ASSISTANT_TOOLS = [
  {
    name: "build_study",
    description:
      "Build a complete study from a compact spec — THE way to start a new experiment (it replaces the table). Choose the recipe, list the conditions, and put everything the scientist asked for in the spec (trials, blocks, questions before/after, calibration, forms, font, language…): the builder writes every parameter with the right values and formats, then returns the table and the compiler's checks. When the scientist named no positions or conditions, omit `conditions` altogether: the recipe's default conditions are its standard layout (crowding: 5 deg left and right). Leave condition `name`s out — the builder generates descriptive ones ('crowding 5deg left', 'acuity fovea contrast -0.1') — unless the scientist dictated names. Screen-size calibration (credit card) is not distance calibration: distanceMethod stays paper unless the scientist names a distance method. Recipes: " +
      RECIPES.map((r) => `${r.id} (${r.title})`).join(", ") +
      ". The spec's fields and each recipe's knobs are in the RECIPES section of your instructions.",
    input_schema: {
      type: "object",
      properties: { spec: STUDY_SCHEMA },
      required: ["spec"],
    },
  },
  {
    name: "apply_knobs",
    description:
      "Change the current table through knobs — deterministic edits behind common asks: move the target (set_eccentricity), trials, blocks, add / mirror / remove a condition, font, character set, duration, what QUEST varies, flankers, viewing distance, calibration, display color management (set_display: color space, float16 + dither, precision test, colorimeter, background gray), sound (set_sound: calibration, output, folders, masker, noise, task), a questionnaire block, forms, participant ID, language, recruitment, description, rename, or set_for_all for any parameter. Knobs run in order, each seeing the table the previous one left, and know the parameter formats and the rules that tie parameters together; prefer them to edit_table. Put structural knobs (add / mirror / remove a condition, set_blocks) before value knobs (trials, font…), or omit `columns` so a value knob reaches every condition. The knobs and their args are listed in the KNOBS section of your instructions. Returns the new table and the compiler's checks.",
    input_schema: {
      type: "object",
      properties: {
        knobs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              knob: { type: "string", enum: KNOBS.map((k) => k.id) },
              args: { type: "object" },
            },
            required: ["knob"],
          },
        },
      },
      required: ["knobs"],
    },
  },
  {
    name: "lookup_parameters",
    description:
      "Full glossary entries for parameter names: type, default, allowed values, explanation, example. The glossary index in your instructions is usually enough to set a parameter; use this only when it is not (exact value format, subtle semantics) or when a compiler error names one. Unknown names come back with near matches.",
    input_schema: {
      type: "object",
      properties: {
        names: {
          type: "array",
          items: { type: "string" },
          description: "Exact parameter names (case-sensitive), up to 12.",
        },
      },
      required: ["names"],
    },
  },
  {
    name: "search_parameters",
    description:
      "Find parameters by topic or words in their name or explanation (e.g. 'eccentricity', 'consent form', 'trials per block'). Returns up to 30 names with type, default and a one-line explanation.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to look for." },
        category: {
          type: "string",
          description:
            "Optional Studio category to restrict to, e.g. 'Fonts', 'Reading', 'Threshold (QUEST)', 'Crowding & spacing', 'Blocks & conditions'.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_table",
    description:
      "The current experiment table as csv, with the compiler's checks and the resource report. The table is also given with each of the scientist's messages; call this only after edits if you need the whole table again.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "start_from",
    description:
      "Replace the whole table with a bundled template or example table. Only when no recipe fits (build_study is the normal way to start); tools in one message run in order, so an edit_table can follow in the same message. Templates: " +
      Object.keys(TEMPLATES)
        .map((k) => `'${k}'`)
        .join(", ") +
      ". Example tables: " +
      Object.keys(EXAMPLES)
        .map((k) => `'${k}'`)
        .join(", ") +
      ". Returns the new table and its checks.",
    input_schema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["template", "example"] },
        name: { type: "string", description: "Exact template/example name." },
      },
      required: ["source", "name"],
    },
  },
  {
    name: "edit_table",
    description:
      "Cell-level edits for what no knob covers (use apply_knobs first). Applies the operations, then runs the compiler's checks and returns them. Columns are spreadsheet letters: B holds the single value of experiment-wide (underscore) parameters; C, D, … are the conditions. Operations (fields per op): " +
      "set {parameter, column, value} — set one cell, adding the parameter row if absent (a column past the last one is created); " +
      "set_row {parameter, values} — values for B, C, D, … in order (use '' for B on non-underscore parameters); " +
      "remove {parameter}; rename {parameter, new_name}; comment {parameter} / uncomment {parameter} — the compiler skips %-commented rows; " +
      "add_column {copy_of?} — new condition column, optionally a copy of column copy_of; remove_column {column}; " +
      "disable_column {column} / enable_column {column} — via conditionEnabledBool, the compiler drops disabled columns. " +
      "Parameter names must exist in the glossary; unknown ones are refused with suggestions. Put every operation for the request in ONE call (a refused operation does not stop the others); prefer set_row over many set calls.",
    input_schema: {
      type: "object",
      properties: {
        operations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              op: { type: "string", enum: [...EDIT_OPERATIONS] },
              parameter: { type: "string" },
              column: { type: "string", description: "Letter, e.g. 'C'." },
              value: { type: "string" },
              values: { type: "array", items: { type: "string" } },
              new_name: { type: "string" },
              copy_of: { type: "string" },
            },
            required: ["op"],
          },
        },
      },
      required: ["operations"],
    },
  },
  {
    name: "list_resources",
    description:
      "The files the scientist has in EasyEyesResources (fonts, forms, texts, phrases, images, folders, code, …) plus files dropped in the Studio. Resource parameters (font with fontSource file, _consentForm, readingCorpus, …) may only name files from this list; if the file you need is not here, ask_user which to use or whether to switch (e.g. fontSource google).",
    input_schema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          description:
            "Optional folder: fonts, forms, texts, phrases, images, folders, code, impulseResponses, frequencyResponses, targetSoundLists.",
        },
      },
    },
  },
  {
    name: "ask_user",
    description:
      "Ask the scientist one question when a real choice is theirs to make (which font, how many trials, eccentricity, consent form…) and the answer changes the table. Offer options when you can; the reply arrives as the tool result. Ask one question per call and never guess resource files.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Optional short choices shown as buttons (2–6).",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "set_experiment_name",
    description:
      "Set the experiment's name (used for the compiled experiment and exported files). Letters, digits, hyphens and underscores.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const stripHtml = (s: string): string =>
  s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

const firstSentence = (s: string, max = 160): string => {
  const plain = stripHtml(s);
  const m = plain.match(/^.*?[.!?](\s|$)/);
  const out = (m ? m[0] : plain).trim();
  return out.length > max ? out.slice(0, max - 1) + "…" : out;
};

/** "B" → 0, "C" → 1, … (index into Row.values). Null when not a column. */
export const letterToValueIndex = (letter: string): number | null => {
  const s = (letter ?? "").trim().toUpperCase();
  if (!/^[A-Z]{1,2}$/.test(s)) return null;
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n >= 2 ? n - 2 : null;
};

/** 0 → "B", 1 → "C", … */
export const valueIndexToLetter = (vi: number): string => {
  let n = vi + 2;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const levenshtein = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  const prev = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[n];
};

/** Glossary names near a misspelt or invented one. */
export function similarParameterNames(name: string, limit = 5): string[] {
  const key = name.toLowerCase();
  return suggestibleEntries()
    .map((e) => {
      const lower = e.name.toLowerCase();
      const score =
        lower === key
          ? 0
          : lower.includes(key) || key.includes(lower)
          ? 1
          : 2 + levenshtein(lower, key) / Math.max(lower.length, key.length);
      return { name: e.name, score };
    })
    .filter((x) => x.score < 2.6)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((x) => x.name);
}

const describeEntry = (e: GlossaryEntry): string => {
  const lines = [`${e.name} — type ${e.type}; category ${categoryOf(e.name)}`];
  if (e.default !== "") lines.push(`  default: ${e.default}`);
  if (e.categories?.length)
    lines.push(`  allowed values: ${e.categories.join(", ")}`);
  if (e.example) lines.push(`  example: ${e.example}`);
  const explanation = stripHtml(e.explanation);
  lines.push(
    `  ${
      explanation.length > 1500 ? explanation.slice(0, 1499) + "…" : explanation
    }`,
  );
  return lines.join("\n");
};

export const tableToCsv = (t: TableState): string =>
  Papa.unparse(stateToMatrix(t), { newline: "\n" });

const errorLine = (e: EasyEyesError): string => {
  const who = e.parameters?.length ? ` [${e.parameters.join(", ")}]` : "";
  const hint = e.hint ? ` Hint: ${stripHtml(e.hint)}` : "";
  return `- ${e.kind.toUpperCase()}${who} ${e.name}: ${stripHtml(
    e.message,
  )}${hint}`;
};

/** The compiler's verdict, as the model reads it. */
export function describeChecks(
  report: CheckReport,
  ctx: Pick<
    AssistantContext,
    "userResources" | "droppedFileNames" | "signedIn"
  >,
): string {
  const errors = report.errors.filter((e) => e.kind === "error");
  const warnings = report.errors.filter((e) => e.kind === "warning");
  const out: string[] = [];
  out.push(
    `Compiler checks: ${errors.length} error${
      errors.length === 1 ? "" : "s"
    }, ${warnings.length} warning${warnings.length === 1 ? "" : "s"}${
      errors.length === 0 ? " — the table would compile" : ""
    }`,
  );
  for (const e of [...errors, ...warnings].slice(0, 25)) out.push(errorLine(e));
  if (errors.length + warnings.length > 25)
    out.push(`- … ${errors.length + warnings.length - 25} more`);

  if (report.needed.length) {
    out.push("Resources the table names:");
    for (const n of report.needed) {
      const present =
        existsInUserResources(n, ctx.userResources) ||
        ctx.droppedFileNames.includes(n.filename);
      out.push(
        `- ${n.kind} ${n.filename} (${n.params.join(", ")}): ${
          present
            ? "present"
            : ctx.signedIn
            ? "MISSING from EasyEyesResources"
            : "cannot check (not signed in)"
        }`,
      );
    }
  }
  return out.join("\n");
}

const tableAndChecks = (t: TableState, ctx: AssistantContext): string =>
  `Table (csv):\n${tableToCsv(t)}\n\n${describeChecks(ctx.check(t), ctx)}`;

/* ------------------------------------------------------------------ */
/* edit_table                                                          */
/* ------------------------------------------------------------------ */

export interface EditResult {
  table: TableState;
  changed: string[];
  /** Operations that were refused, with the reason (the rest applied). */
  refused: string[];
  applied: number;
}

const blankValues = (n: number): string[] => new Array<string>(n).fill("");

const findActive = (rows: Row[], name: string): number =>
  rows.findIndex((r) => r.name === name);

/** Adds condition columns up to and including value index `vi`. */
const ensureWidth = (t: TableState, vi: number): TableState => {
  if (vi <= t.conditionCount) return t;
  const conditionCount = vi;
  return {
    conditionCount,
    rows: t.rows.map((r) => {
      const values = [...r.values];
      while (values.length < conditionCount + 1) values.push("");
      return { ...r, values };
    }),
  };
};

const insertRow = (
  t: TableState,
  name: string,
  values: string[],
): TableState => {
  const rows = [...t.rows];
  const padded = [...values];
  while (padded.length < t.conditionCount + 1) padded.push("");
  rows.splice(alphabeticalInsertIndex(rows, name), 0, {
    id: newId(),
    name,
    values: padded.slice(0, t.conditionCount + 1),
  });
  return { ...t, rows };
};

const knownParameter = (name: string): boolean =>
  !!resolveEntry(stripCommentPrefix(name));

const refuseUnknown = (name: string): string => {
  const near = similarParameterNames(stripCommentPrefix(name));
  return `"${name}" is not a glossary parameter${
    near.length ? `; did you mean ${near.join(", ")}?` : "."
  }`;
};

/** Applies the operations in order; refused ones are reported, not fatal. */
export function applyEdits(
  table: TableState,
  operations: EditOperation[],
): EditResult {
  let t: TableState = { ...table, rows: [...table.rows] };
  const changed = new Set<string>();
  const refused: string[] = [];
  let applied = 0;

  operations.forEach((raw, i) => {
    const op = raw?.op;
    const where = `operation ${i + 1} (${op ?? "?"})`;
    const refuse = (why: string) => refused.push(`${where}: ${why}`);
    const param = (raw?.parameter ?? "").trim();
    const needParam = () => {
      if (!param) refuse("needs a parameter");
      return !!param;
    };

    switch (op) {
      case "set": {
        if (!needParam()) return;
        const vi = letterToValueIndex(raw.column ?? "");
        if (vi === null)
          return refuse(
            `column "${raw.column ?? ""}" is not a letter from B on`,
          );
        if (!isCommentName(param) && !knownParameter(param))
          return refuse(refuseUnknown(param));
        t = ensureWidth(t, vi);
        const idx = findActive(t.rows, param);
        const value = String(raw.value ?? "");
        if (idx < 0) {
          const values = blankValues(t.conditionCount + 1);
          values[vi] = value;
          t = insertRow(t, param, values);
        } else {
          const row = t.rows[idx];
          const values = [...row.values];
          while (values.length < t.conditionCount + 1) values.push("");
          values[vi] = value;
          t.rows[idx] = { ...row, values };
        }
        changed.add(param);
        applied++;
        return;
      }
      case "set_row": {
        if (!needParam()) return;
        if (!Array.isArray(raw.values)) return refuse("needs values[]");
        if (!isCommentName(param) && !knownParameter(param))
          return refuse(refuseUnknown(param));
        const values = raw.values.map((v) => String(v ?? ""));
        t = ensureWidth(t, values.length - 1);
        const idx = findActive(t.rows, param);
        if (idx < 0) t = insertRow(t, param, values);
        else {
          const padded = [...values];
          while (padded.length < t.conditionCount + 1) padded.push("");
          t.rows[idx] = { ...t.rows[idx], values: padded };
        }
        changed.add(param);
        applied++;
        return;
      }
      case "remove": {
        if (!needParam()) return;
        const idx = findActive(t.rows, param);
        if (idx < 0) return refuse(`no row named "${param}"`);
        t.rows.splice(idx, 1);
        changed.add(param);
        applied++;
        return;
      }
      case "rename": {
        if (!needParam()) return;
        const newName = (raw.new_name ?? "").trim();
        if (!newName) return refuse("needs new_name");
        if (!isCommentName(newName) && !knownParameter(newName))
          return refuse(refuseUnknown(newName));
        const idx = findActive(t.rows, param);
        if (idx < 0) return refuse(`no row named "${param}"`);
        const row = t.rows[idx];
        t.rows.splice(idx, 1);
        t.rows.splice(alphabeticalInsertIndex(t.rows, newName), 0, {
          ...row,
          name: newName,
        });
        changed.add(newName);
        applied++;
        return;
      }
      case "comment":
      case "uncomment": {
        if (!needParam()) return;
        const commented = op === "comment";
        const current = commented
          ? param
          : isCommentName(param)
          ? param
          : `%${param}`;
        const idx = findActive(t.rows, current);
        if (idx < 0) return refuse(`no row named "${current}"`);
        const row = t.rows[idx];
        const newName = commented
          ? `%${stripCommentPrefix(row.name)}`
          : stripCommentPrefix(row.name);
        if (!commented && findActive(t.rows, newName) >= 0)
          return refuse(`"${newName}" already has an active row`);
        t.rows[idx] = { ...row, name: newName };
        changed.add(newName);
        applied++;
        return;
      }
      case "add_column": {
        const from = raw.copy_of ? letterToValueIndex(raw.copy_of) : null;
        if (
          raw.copy_of &&
          (from === null || from === 0 || from > t.conditionCount)
        )
          return refuse(`copy_of "${raw.copy_of}" is not a condition column`);
        const conditionCount = t.conditionCount + 1;
        t = {
          conditionCount,
          rows: t.rows.map((r) => {
            const values = [...r.values];
            while (values.length < t.conditionCount + 1) values.push("");
            values.push(from ? values[from] ?? "" : "");
            return { ...r, values };
          }),
        };
        applied++;
        return;
      }
      case "remove_column": {
        const vi = letterToValueIndex(raw.column ?? "");
        if (vi === null || vi === 0 || vi > t.conditionCount)
          return refuse(
            `column "${raw.column ?? ""}" is not a condition column`,
          );
        if (t.conditionCount <= 1)
          return refuse("the last condition column stays");
        t = {
          conditionCount: t.conditionCount - 1,
          rows: t.rows.map((r) => ({
            ...r,
            values: r.values.filter((_, k) => k !== vi),
          })),
        };
        applied++;
        return;
      }
      case "disable_column":
      case "enable_column": {
        const vi = letterToValueIndex(raw.column ?? "");
        if (vi === null || vi === 0 || vi > t.conditionCount)
          return refuse(
            `column "${raw.column ?? ""}" is not a condition column`,
          );
        const ci = vi - 1;
        const disabled = columnDisabledBy(t, ci) === "conditionEnabledBool";
        const wantDisabled = op === "disable_column";
        if (disabled !== wantDisabled) t = toggleConditionEnabled(t, ci);
        changed.add("conditionEnabledBool");
        applied++;
        return;
      }
      default:
        refuse(`unknown operation; use one of ${EDIT_OPERATIONS.join(", ")}`);
    }
  });

  return { table: t, changed: [...changed], refused, applied };
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];

export function runTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AssistantContext,
): ToolOutcome {
  switch (name) {
    case "build_study": {
      const spec = (input.spec ?? input) as unknown;
      const built = buildStudy(spec);
      if (isBuildFailure(built))
        return {
          result: built.error,
          isError: true,
          activity: "Build — refused",
        };
      const report = ctx.check(built.table);
      const errors = report.errors.filter((e) => e.kind === "error").length;
      const lines = [
        `Built: ${built.summary}`,
        ...built.notes.map((n) => `Note: ${n}`),
        "",
        `Table (csv):\n${tableToCsv(built.table)}`,
        "",
        describeChecks(report, ctx),
      ];
      const conditionCount = built.table.conditionCount;
      return {
        result: lines.join("\n"),
        table: built.table,
        name: built.name,
        changedParams: built.table.rows.map((r) => r.name),
        reveal: true,
        activity: `Built ${built.recipe.title.toLowerCase()} — ${conditionCount} condition${
          conditionCount === 1 ? "" : "s"
        }, ${built.table.rows.length} parameters · ${errors} error${
          errors === 1 ? "" : "s"
        }`,
        report: {
          kind: "built",
          title: built.recipe.title,
          steps: [],
          rationale: built.recipe.rationale,
          changed: built.table.rows.map((r) => r.name),
          check: report,
        },
      };
    }
    case "apply_knobs": {
      const list = Array.isArray(input.knobs)
        ? (input.knobs as { knob?: unknown; args?: unknown }[])
        : [];
      if (!list.length)
        return { result: "No knobs given.", isError: true, activity: "Knobs" };
      let table = ctx.table;
      const changed = new Set<string>();
      const lines: string[] = [];
      const notes: string[] = [];
      let applied = 0;
      list.forEach((item, i) => {
        const id = String(item?.knob ?? "").trim();
        const knob = knobById(id);
        const where = `knob ${i + 1} (${id || "?"})`;
        if (!knob) {
          lines.push(
            `- refused ${where}: unknown knob; use one of ${KNOBS.map(
              (k) => k.id,
            ).join(", ")}`,
          );
          return;
        }
        const args =
          item?.args && typeof item.args === "object"
            ? (item.args as Record<string, unknown>)
            : {};
        // Parameter names the knob would write must be glossary names.
        const named: string[] = [];
        if (id === "set_for_all") named.push(String(args.parameter ?? ""));
        if (args.set && typeof args.set === "object")
          named.push(...Object.keys(args.set as Record<string, unknown>));
        const unknown = named
          .map((n) => n.trim())
          .filter((n) => n && !isCommentName(n) && !knownParameter(n));
        if (unknown.length) {
          lines.push(
            `- refused ${where}: ${unknown.map(refuseUnknown).join("; ")}`,
          );
          return;
        }
        const r = knob.apply(table, args);
        if (isKnobFailure(r)) {
          lines.push(`- refused ${where}: ${r.error}`);
          return;
        }
        table = r.table;
        r.changed.forEach((p) => changed.add(p));
        notes.push(r.note);
        lines.push(`- ${id}: ${r.note}`);
        applied++;
      });
      const report = ctx.check(table);
      const errors = report.errors.filter((e) => e.kind === "error").length;
      const head = `${applied} knob${applied === 1 ? "" : "s"} applied${
        applied < list.length ? `, ${list.length - applied} refused` : ""
      }.`;
      return {
        result: [
          head,
          ...lines,
          "",
          ...(applied ? [`Table (csv):\n${tableToCsv(table)}`, ""] : []),
          describeChecks(report, ctx),
        ].join("\n"),
        table: applied ? table : undefined,
        changedParams: [...changed],
        isError: applied === 0,
        activity: applied
          ? `${notes.join(" · ")} · ${errors} error${errors === 1 ? "" : "s"}`
          : "Knobs — nothing applied",
        report: applied
          ? {
              kind: "edited",
              title: "Edited",
              steps: notes,
              rationale: [],
              changed: [...changed],
              check: report,
            }
          : undefined,
      };
    }
    case "lookup_parameters": {
      const names = asStringArray(input.names).slice(0, 12);
      if (!names.length)
        return { result: "No names given.", isError: true, activity: "Lookup" };
      const parts = names.map((n) => {
        const e = resolveEntry(stripCommentPrefix(n));
        return e ? describeEntry(e) : `${n} — UNKNOWN: ${refuseUnknown(n)}`;
      });
      return {
        result: parts.join("\n\n"),
        activity: `Looked up ${names.length} parameter${
          names.length === 1 ? "" : "s"
        }`,
      };
    }
    case "search_parameters": {
      const query = String(input.query ?? "").trim();
      const category = String(input.category ?? "")
        .trim()
        .toLowerCase();
      if (!query)
        return { result: "Empty query.", isError: true, activity: "Search" };
      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = suggestibleEntries()
        .filter(
          (e) => !category || categoryOf(e.name).toLowerCase() === category,
        )
        .map((e) => {
          const lname = e.name.toLowerCase();
          const text = stripHtml(e.explanation).toLowerCase();
          let score = 0;
          for (const tkn of tokens) {
            if (lname.includes(tkn)) score += 3;
            if (text.includes(tkn)) score += 1;
          }
          if (lname.includes(query.toLowerCase())) score += 4;
          return { e, score };
        })
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name))
        .slice(0, 30);
      if (!hits.length)
        return {
          result: `No parameter matches "${query}". Try other words, or search_parameters by category.`,
          activity: `Searched “${query}” — nothing`,
        };
      return {
        result: hits
          .map(
            ({ e }) =>
              `${e.name} (${e.type}${
                e.default !== "" ? `; default ${e.default}` : ""
              }) — ${firstSentence(e.explanation)}`,
          )
          .join("\n"),
        activity: `Searched “${query}” — ${hits.length} match${
          hits.length === 1 ? "" : "es"
        }`,
      };
    }
    case "get_table":
      return {
        result: `Experiment name: ${ctx.name}\n${tableAndChecks(
          ctx.table,
          ctx,
        )}`,
        activity: "Read the table",
      };
    case "start_from": {
      const source = String(input.source ?? "");
      const which = String(input.name ?? "").trim();
      let matrix: string[][] | null = null;
      if (source === "template" && TEMPLATES[which])
        matrix = TEMPLATES[which]();
      else if (source === "example" && EXAMPLES[which])
        matrix = parseCsvString(EXAMPLES[which]);
      if (!matrix)
        return {
          result: `No ${
            source || "template/example"
          } named "${which}". Templates: ${Object.keys(TEMPLATES).join(
            ", ",
          )}. Examples: ${Object.keys(EXAMPLES).join(", ")}.`,
          isError: true,
          activity: "Start from — not found",
        };
      const table = matrixToState(matrix);
      const check = ctx.check(table);
      return {
        result: `Table replaced with ${source} "${which}".\nTable (csv):\n${tableToCsv(
          table,
        )}\n\n${describeChecks(check, ctx)}`,
        table,
        changedParams: table.rows.map((r) => r.name),
        reveal: true,
        activity: `Started from ${source} “${which}”`,
        report: {
          kind: "built",
          title: `${source === "template" ? "Template" : "Example"} “${which}”`,
          steps: [],
          rationale: [],
          changed: table.rows.map((r) => r.name),
          check,
        },
      };
    }
    case "edit_table": {
      const operations = Array.isArray(input.operations)
        ? (input.operations as EditOperation[])
        : [];
      if (!operations.length)
        return {
          result: "No operations given.",
          isError: true,
          activity: "Edit",
        };
      const r = applyEdits(ctx.table, operations);
      const lines: string[] = [];
      lines.push(
        `${r.applied} operation${r.applied === 1 ? "" : "s"} applied${
          r.refused.length ? `, ${r.refused.length} refused` : ""
        }.`,
      );
      for (const why of r.refused) lines.push(`- refused ${why}`);
      const report = ctx.check(r.table);
      lines.push("", describeChecks(report, ctx));
      const errors = report.errors.filter((e) => e.kind === "error").length;
      return {
        result: lines.join("\n"),
        table: r.applied ? r.table : undefined,
        changedParams: r.changed,
        isError: r.applied === 0,
        activity: `Edited the table (${r.applied} change${
          r.applied === 1 ? "" : "s"
        }) · ${errors} error${errors === 1 ? "" : "s"}`,
        report: r.applied
          ? {
              kind: "edited",
              title: "Edited",
              steps: [
                `${r.applied} cell edit${
                  r.applied === 1 ? "" : "s"
                }: ${r.changed.join(", ")}`,
              ],
              rationale: [],
              changed: r.changed,
              check: report,
            }
          : undefined,
      };
    }
    case "list_resources": {
      const kind = String(input.kind ?? "").trim();
      if (!ctx.signedIn)
        return {
          result:
            "Not signed in: EasyEyesResources cannot be read. Files dropped in the Studio: " +
            (ctx.droppedFileNames.join(", ") || "none") +
            ". Ask the scientist which files they have, or choose options that need no file (e.g. fontSource google).",
          activity: "Listed resources (signed out)",
        };
      const res = ctx.userResources ?? {};
      const folders = Object.keys(RESOURCE_TYPE_LABELS).filter(
        (f) => !kind || f === kind,
      );
      if (!folders.length)
        return {
          result: `Unknown folder "${kind}". Folders: ${Object.keys(
            RESOURCE_TYPE_LABELS,
          ).join(", ")}.`,
          isError: true,
          activity: "Listed resources — unknown folder",
        };
      const lines = folders.map((f) => {
        const files = res[f] ?? [];
        return `${f} (${files.length}): ${
          files.length ? files.join(", ") : "none"
        }`;
      });
      if (ctx.droppedFileNames.length)
        lines.push(`dropped in the Studio: ${ctx.droppedFileNames.join(", ")}`);
      return {
        result: lines.join("\n"),
        activity: kind ? `Listed ${kind}` : "Listed EasyEyesResources",
      };
    }
    case "ask_user": {
      const question = String(input.question ?? "").trim();
      if (!question)
        return { result: "Empty question.", isError: true, activity: "Ask" };
      return {
        result: "(waiting for the scientist)",
        ask: { question, options: asStringArray(input.options).slice(0, 6) },
        activity: "Asked a question",
      };
    }
    case "set_experiment_name": {
      const raw = String(input.name ?? "").trim();
      const clean = raw
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      if (!clean)
        return { result: "Empty name.", isError: true, activity: "Name" };
      return {
        result: `Experiment name is now "${clean}".`,
        name: clean,
        activity: `Named it “${clean}”`,
      };
    }
    default:
      return {
        result: `Unknown tool "${name}".`,
        isError: true,
        activity: `Unknown tool ${name}`,
      };
  }
}
