/**
 * The Study Builder: StudySpec → TableState, deterministically and at once.
 *
 * The recipe says what makes a condition this kind of study; this file adds
 * what every study shares — block numbers, condition names and trial
 * counts, fonts, calibration, questionnaire blocks, forms, participant IDs —
 * and lays the rows out as the Studio's table (alphabetical rows, underscore
 * parameters in column B, one column per condition, columns in block order).
 *
 * Nothing here consults the glossary or the compiler: the output is handed
 * to the compiler's checks by the caller (the assistant's build_study tool),
 * and the recipe test proves every recipe compiles clean.
 */
import { matrixToState, type TableState } from "../tableModel";
import {
  recipeById,
  recipeIds,
  type Recipe,
  type ResolvedCondition,
} from "./recipes";
import type { ParamValues } from "./recipes/types";
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
  type ConditionSpec,
  type FontSource,
  type QuestionSpec,
  type StudySpec,
} from "./spec";

export interface BuildResult {
  table: TableState;
  name: string;
  recipe: Recipe;
  /** One paragraph for the model and the activity log. */
  summary: string;
  /** Things worth telling the model: ignored fields, files the table names. */
  notes: string[];
}

export interface BuildFailure {
  error: string;
}

export const isBuildFailure = (
  r: BuildResult | BuildFailure,
): r is BuildFailure => "error" in r;

/* ------------------------------------------------------------------ */
/* Small shared rules                                                  */
/* ------------------------------------------------------------------ */

const FONT_FILE = /\.(woff2?|otf|ttf)$/i;

/** A font named as a file is fontSource file; anything else, google. */
export const inferFontSource = (
  font: string | undefined,
): FontSource | undefined =>
  font === undefined || font === ""
    ? undefined
    : FONT_FILE.test(font)
    ? "file"
    : "google";

export const sanitizeName = (
  raw: string | undefined,
  fallback: string,
): string => {
  const clean = (raw ?? "")
    .trim()
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return clean || fallback;
};

const TRUE_FALSE = (b: boolean) => (b ? "TRUE" : "FALSE");

/** Lowercase compare, as the compiler's alphabetical check does. */
const byParameterName = (a: string, b: string): number => {
  const x = a.toLowerCase(),
    y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
};

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

interface Column {
  /** Per-condition parameter values (before block is known). */
  params: ParamValues;
  /** Grouping key for block assignment; null = question block. */
  groupKey: string | null;
  explicitBlock?: number;
  /** For the summary. */
  label: string;
}

const conditionLabel = (recipe: Recipe): string =>
  recipe.conditionLabel ??
  recipe.title.replace(/^Letter\s+/i, "").toLowerCase();

function resolveCondition(
  given: ConditionSpec,
  index: number,
  recipe: Recipe,
): ResolvedCondition {
  const merged: ConditionSpec = { ...recipe.conditionDefaults, ...given };
  // Coerce numerics the model may have sent as strings.
  for (const k of [
    "eccentricityDeg",
    "xDeg",
    "yDeg",
    "trials",
    "block",
    "durationSec",
    "sizeDeg",
    "pages",
    "linesPerPage",
    "lineLengthCharacters",
    "comprehensionQuestions",
    "wordsPerTrial",
    "contrast",
    "maskerDBSPL",
    "noiseDBSPL",
  ] as const) {
    if (merged[k] !== undefined) {
      const n = num(merged[k]);
      if (n === undefined) delete merged[k];
      else (merged as Record<string, unknown>)[k] = n;
    }
  }
  const { x, y } = recipe.hasTargetPosition
    ? resolvePosition(
        merged,
        num(recipe.conditionDefaults.eccentricityDeg) ?? 0,
      )
    : { x: 0, y: 0 };
  return { ...merged, x, y, positionTag: positionTag(x, y), index };
}

function autoName(
  c: ResolvedCondition,
  recipe: Recipe,
  spec: StudySpec,
): string {
  const bits = [conditionLabel(recipe)];
  if (recipe.hasTargetPosition) bits.push(c.positionTag);
  else if (c.sizeDeg !== undefined) bits.push(`${fmt(c.sizeDeg)}deg`);
  if (
    c.spacingDirection &&
    c.spacingDirection !== legalSpacingDirection(undefined, c.x, c.y)
  )
    bits.push(legalSpacingDirection(c.spacingDirection, c.x, c.y));
  if (c.font && c.font !== spec.font) bits.push(c.font.replace(FONT_FILE, ""));
  if (c.contrast !== undefined && recipe.conditionFields.includes("contrast"))
    bits.push(`contrast ${fmt(c.contrast, 4)}`);
  if (c.maskerFolder) bits.push(`in ${c.maskerFolder}`);
  if (c.task === "identify") bits.push("identify");
  return bits.join(" ");
}

function experimentalColumn(
  c: ResolvedCondition,
  recipe: Recipe,
  spec: StudySpec,
  name: string,
): Column {
  const p: ParamValues = { ...recipe.condition(c, spec) };
  if (c.threshold) p.thresholdParameter = c.threshold;
  p.conditionName = name;
  const trials = num(c.trials) ?? num(spec.trials);
  if (trials !== undefined)
    p.conditionTrials = fmt(Math.max(1, Math.round(trials)), 0);
  const font = c.font ?? spec.font;
  if (font) {
    p.font = font;
    const source =
      c.fontSource ??
      (c.font ? undefined : spec.fontSource) ??
      inferFontSource(font);
    if (source) p.fontSource = source;
  }
  const chars = c.characterSet ?? spec.characterSet;
  if (chars) p.fontCharacterSet = chars;
  if (c.durationSec !== undefined) p.targetDurationSec = fmt(c.durationSec);
  if (recipe.hasTargetPosition) {
    p.targetEccentricityXDeg = fmt(c.x);
    p.targetEccentricityYDeg = fmt(c.y);
  }
  applyCommonConditionParams(p, spec);
  if (c.set)
    for (const [k, v] of Object.entries(c.set)) p[k.trim()] = String(v);
  return {
    params: p,
    groupKey: groupKeyFor(c, spec),
    explicitBlock: num(c.block),
    label: name,
  };
}

/** screenColorRGBA for a gray level (clamped to 0–1). */
export const grayRGBA = (gray: number): string => {
  const g = fmt(Math.min(1, Math.max(0, gray)), 4);
  return `${g}, ${g}, ${g}, 1`;
};

function applyCommonConditionParams(p: ParamValues, spec: StudySpec): void {
  const screen = bool(spec.screenSizeCalibration);
  if (screen !== undefined) p.calibrateScreenSizeBool = TRUE_FALSE(screen);
  if (bool(spec.trackDistance) === true) p.calibrateDistanceBool = "TRUE";
  const vd = num(spec.viewingDistanceCm);
  if (vd !== undefined) p.viewingDistanceDesiredCm = fmt(vd);
  const gray = num(spec.backgroundGray);
  if (gray !== undefined) p.screenColorRGBA = grayRGBA(gray);
  if (spec.soundOutput) p.needSoundOutput = spec.soundOutput;
  if (spec.setAll)
    for (const [k, v] of Object.entries(spec.setAll)) p[k.trim()] = String(v);
}

function groupKeyFor(c: ResolvedCondition, spec: StudySpec): string {
  switch (spec.blocks) {
    case "separate":
      return `c${c.index}`;
    case "bySide":
      return `side:${sideOf(c.x, c.y)}`;
    case "byEccentricity":
      return `ecc:${fmt(Math.max(Math.abs(c.x), Math.abs(c.y)))}`;
    case "interleaved":
    default:
      return "all";
  }
}

function questionColumn(
  questions: QuestionSpec[],
  name: string,
  spec: StudySpec,
): Column {
  const p: ParamValues = {
    conditionName: name,
    conditionTrials: "1",
    targetTask: "questionAndAnswer",
  };
  questions.forEach((q, i) => {
    p[questionParam(i)] = questionCell(q, i);
  });
  const font = spec.font;
  if (font) {
    p.font = font;
    const source = spec.fontSource ?? inferFontSource(font);
    if (source) p.fontSource = source;
  }
  applyCommonConditionParams(p, spec);
  return { params: p, groupKey: null, label: name };
}

/* ------------------------------------------------------------------ */
/* Blocks                                                              */
/* ------------------------------------------------------------------ */

/**
 * Orders the experimental columns and gives each a block number: explicit
 * block numbers (when every condition has one) are honored and made dense;
 * otherwise the study's block mode groups them, in order of first
 * appearance. Returns the columns in block order with `block` filled in.
 */
function assignBlocks(columns: Column[], firstBlock: number): Column[] {
  if (!columns.length) return [];
  const explicit = columns.every((c) => c.explicitBlock !== undefined);
  const keyed = columns.map((c, i) => ({
    c,
    i,
    key: explicit ? String(c.explicitBlock) : c.groupKey ?? `c${i}`,
  }));
  const order: string[] = [];
  if (explicit) {
    const uniq = [...new Set(keyed.map((k) => Number(k.key)))].sort(
      (a, b) => a - b,
    );
    order.push(...uniq.map(String));
  } else for (const k of keyed) if (!order.includes(k.key)) order.push(k.key);
  const rank = new Map(order.map((k, i) => [k, i]));
  return keyed
    .sort((a, b) => rank.get(a.key)! - rank.get(b.key)! || a.i - b.i)
    .map(({ c, key }) => ({
      ...c,
      params: { ...c.params, block: String(firstBlock + rank.get(key)!) },
    }));
}

/* ------------------------------------------------------------------ */
/* Experiment-wide rows                                                */
/* ------------------------------------------------------------------ */

function experimentParams(spec: StudySpec, recipe: Recipe): ParamValues {
  const p: ParamValues = {};
  if (spec.about) p._about = spec.about;
  if (spec.authors) p._authors = spec.authors;
  if (spec.consentForm) p._consentForm = spec.consentForm;
  if (spec.debriefForm) p._debriefForm = spec.debriefForm;
  if (bool(spec.participantId) === true) {
    p._participantIDGetBool = "TRUE";
    p._participantIDPutBool = "TRUE";
  }
  if (spec.language) p._language = spec.language;
  if (spec.recruitment === "Prolific")
    p._online1RecruitmentService = "Prolific";
  // Every template states its distance-calibration method; paper is the
  // house method unless the spec names another.
  p._calibrateDistance = spec.distanceMethod || DEFAULT_DISTANCE_METHOD;
  Object.assign(p, displayParams(spec));
  if (recipe.experiment) Object.assign(p, recipe.experiment(spec));
  if (spec.set)
    for (const [k, v] of Object.entries(spec.set)) {
      const key = k.trim();
      if (key) p[key] = String(v);
    }
  return p;
}

/**
 * The display's color-management parameters, from the spec's plain fields.
 * Available to every recipe ("run it in display-p3 with high precision");
 * the color-management recipe turns them on by default.
 */
export function displayParams(spec: StudySpec): ParamValues {
  const p: ParamValues = {};
  if (spec.colorSpace) p._screenColorSpace = spec.colorSpace;
  const precise = bool(spec.highPrecision);
  if (precise !== undefined) {
    p._screenFloat16Bool = TRUE_FALSE(precise);
    p._screenDitherBool = TRUE_FALSE(precise);
  }
  const measure = bool(spec.measurePrecision);
  if (measure !== undefined)
    p._screenMeasurePrecision = measure ? "test2Digits" : "assume8Bit";
  // Compiler rule: the precision test draws sub-8-bit steps, so it needs the
  // float16 path whatever highPrecision said.
  if (measure) p._screenFloat16Bool = "TRUE";
  const colorimeter = bool(spec.colorimeter);
  if (colorimeter !== undefined) {
    p._screenColorCheckBool = TRUE_FALSE(colorimeter);
    p._needColorimeterBool = TRUE_FALSE(colorimeter);
  }
  return p;
}

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

function toMatrix(experiment: ParamValues, columns: Column[]): string[][] {
  const names = new Set<string>(Object.keys(experiment));
  for (const c of columns) for (const k of Object.keys(c.params)) names.add(k);
  return [...names].sort(byParameterName).map((name) => {
    if (name.startsWith("_")) {
      // Underscore parameters live in B; one given per condition moves there.
      const b =
        experiment[name] ??
        columns.find((c) => c.params[name])?.params[name] ??
        "";
      return [name, b, ...columns.map(() => "")];
    }
    // A non-underscore parameter given as experiment-wide (spec.set) applies
    // to every condition that does not set it.
    const wide = experiment[name];
    return [name, "", ...columns.map((c) => c.params[name] ?? wide ?? "")];
  });
}

const asArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Fields on a ConditionSpec that only some recipes read. */
const RECIPE_SPECIFIC_FIELDS: (keyof ConditionSpec)[] = [
  "eccentricityDeg",
  "side",
  "xDeg",
  "yDeg",
  "spacingDirection",
  "threshold",
  "sizeDeg",
  "pages",
  "linesPerPage",
  "lineLengthCharacters",
  "comprehensionQuestions",
  "corpus",
  "wordsPerTrial",
  "durationSec",
  "characterSet",
  "contrast",
  "soundFolder",
  "maskerFolder",
  "maskerDBSPL",
  "noiseDBSPL",
  "task",
];

export function buildStudy(input: unknown): BuildResult | BuildFailure {
  const given = (
    input && typeof input === "object" ? input : {}
  ) as Partial<StudySpec>;
  const recipe = recipeById(String(given.recipe ?? ""));
  if (!recipe)
    return {
      error: `Unknown recipe "${
        given.recipe ?? ""
      }". Recipes: ${recipeIds().join(", ")}.`,
    };

  // Study-level defaults from the recipe, the spec on top.
  const spec: StudySpec = {
    ...recipe.defaults,
    ...given,
    recipe: recipe.id,
  } as StudySpec;
  for (const k of Object.keys(spec) as (keyof StudySpec)[])
    if (spec[k] === undefined || spec[k] === null) delete spec[k];

  const notes: string[] = [];
  const conditionSpecs = asArray<ConditionSpec>(given.conditions).length
    ? asArray<ConditionSpec>(given.conditions)
    : recipe.defaultConditions;

  // Fields the model set that this recipe does not read.
  const ignored = new Set<string>();
  for (const c of conditionSpecs)
    for (const f of RECIPE_SPECIFIC_FIELDS)
      if (c[f] !== undefined && !recipe.conditionFields.includes(f))
        ignored.add(f);
  if (ignored.size)
    notes.push(
      `Ignored condition fields not used by recipe ${recipe.id}: ${[
        ...ignored,
      ].join(", ")}.`,
    );

  const resolved = conditionSpecs.map((c, i) => resolveCondition(c, i, recipe));

  // Condition names: given, else generated; duplicates get a counter.
  const seen = new Map<string, number>();
  const names = resolved.map((c) => {
    const base = (c.name ?? "").trim() || autoName(c, recipe, spec);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} ${n}`;
  });

  const experimental = resolved.map((c, i) =>
    experimentalColumn(c, recipe, spec, names[i]),
  );
  const before = asArray<QuestionSpec>(spec.questionsBefore).filter(
    (q) => q && q.question,
  );
  const after = asArray<QuestionSpec>(spec.questionsAfter).filter(
    (q) => q && q.question,
  );

  if (!experimental.length && !before.length && !after.length)
    return {
      error: `Recipe ${recipe.id} needs at least one condition or some questions.`,
    };

  const columns: Column[] = [];
  let nextBlock = 1;
  if (before.length) {
    const q = questionColumn(
      before,
      experimental.length ? "questions before" : "questions",
      spec,
    );
    q.params.block = String(nextBlock);
    columns.push(q);
    nextBlock++;
  }
  const ordered = assignBlocks(experimental, nextBlock);
  columns.push(...ordered);
  if (ordered.length)
    nextBlock = Math.max(...ordered.map((c) => Number(c.params.block))) + 1;
  if (after.length) {
    const q = questionColumn(after, "questions after", spec);
    q.params.block = String(nextBlock);
    columns.push(q);
  }

  const experiment = experimentParams(spec, recipe);
  const table = matrixToState(toMatrix(experiment, columns));
  const name = sanitizeName(spec.name, recipe.id);

  // Files the table names, so the model checks the resource report.
  const files: string[] = [];
  for (const c of columns) {
    if (c.params.fontSource === "file" && c.params.font)
      files.push(`font ${c.params.font}`);
    if (c.params.readingCorpus) files.push(`text ${c.params.readingCorpus}`);
    if (c.params.targetSoundFolder)
      files.push(`sound folder ${c.params.targetSoundFolder}.zip`);
    if (c.params.maskerSoundFolder)
      files.push(`sound folder ${c.params.maskerSoundFolder}.zip`);
  }
  if (experiment._consentForm) files.push(`form ${experiment._consentForm}`);
  if (experiment._debriefForm) files.push(`form ${experiment._debriefForm}`);
  if (files.length)
    notes.push(
      `Resource files the table names (must exist in EasyEyesResources): ${[
        ...new Set(files),
      ].join(", ")}.`,
    );

  // Block by block, so the reader (the model included) sees the structure
  // and does not "fix" a layout that is already what was asked.
  const byBlock = new Map<string, string[]>();
  for (const c of columns) {
    const b = c.params.block;
    if (!byBlock.has(b)) byBlock.set(b, []);
    byBlock.get(b)!.push(c.label);
  }
  const blockLines = [...byBlock.entries()].map(
    ([b, labels]) =>
      `Block ${b}: ${labels.join(", ")}${
        labels.length > 1 ? " (interleaved)" : ""
      }`,
  );
  const summary =
    `${recipe.title}: ${experimental.length} condition${
      experimental.length === 1 ? "" : "s"
    }` +
    (before.length
      ? `, ${before.length} question${before.length === 1 ? "" : "s"} first`
      : "") +
    (after.length
      ? `, ${after.length} question${after.length === 1 ? "" : "s"} at the end`
      : "") +
    `, ${byBlock.size} block${byBlock.size === 1 ? "" : "s"}. ${blockLines.join(
      ". ",
    )}. ${table.rows.length} parameters.` +
    (recipe.rationale.length
      ? ` Choices to mention to the scientist when relevant: ${recipe.rationale.join(
          "; ",
        )}.`
      : "");

  return { table, name, recipe, summary, notes };
}
