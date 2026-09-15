/**
 * A recipe is one kind of study the builder knows how to write: a fixed,
 * known-good parameter set plus the few things that vary per condition.
 *
 * Adding a recipe = one file in this folder that exports a `Recipe`, plus a
 * line in index.ts. The builder (../build.ts) adds everything recipes share
 * — block numbers, conditionName, conditionTrials, fonts, calibration,
 * questionnaire blocks, forms — so a recipe only says what makes it itself.
 * The recipe test (source/__tests__/studioBuilder.test.js) runs every recipe
 * through the real compiler checks, so a new recipe is verified the moment
 * it is registered.
 *
 * House rule — a recipe is the ideal parameter set for its kind of study,
 * not a bare minimum and not an invention. Every value is either taken from
 * a bundled example study (threshold/examples/tables: RsvpAndCrowding,
 * AcuityNearAndFar, readingExperiment, minimalExperiment) or is the glossary
 * default written out because a scientist expects to see and tweak it there
 * (trials, duration, spacing ratio, flanker direction…). Values a scientist
 * rarely touches (QUEST beta/delta, response modes, fixation marks) are left
 * to the glossary. Each non-obvious choice is stated in `rationale`, which
 * the builder puts in its summary so the assistant can tell the scientist
 * why the table says what it says (e.g. that DHKNORSVZ is the Sloan set).
 * The compile test runs every recipe under the real checks and glossary.
 */
import type { ConditionSpec, StudySpec } from "../spec";

/** Parameter name → cell value. */
export type ParamValues = Record<string, string>;

/** A condition after defaults are merged and the position is resolved. */
export interface ResolvedCondition extends ConditionSpec {
  /** Resolved target position (deg). */
  x: number;
  y: number;
  /** Position in words — "5deg right", "fovea" — for condition names. */
  positionTag: string;
  /** Index among the experimental conditions, 0-based. */
  index: number;
}

export interface Recipe {
  /** Stable id the model uses: lowercase, hyphenated. */
  id: string;
  title: string;
  /** The word generated condition names start with (default: the title, minus "Letter"). */
  conditionLabel?: string;
  /** One sentence: what is measured and how. Shown to the model and in the UI. */
  summary: string;
  /** Words a scientist might use for this kind of study (matching aid). */
  keywords: string[];
  /**
   * The condition fields this recipe actually reads (the model is told
   * these are the knobs for the recipe; others are ignored or generic).
   */
  conditionFields: (keyof ConditionSpec)[];
  /** Study-level defaults (trials, font, characterSet, …). */
  defaults: Partial<Omit<StudySpec, "recipe" | "conditions">>;
  /** Per-condition defaults (eccentricityDeg, durationSec, …). */
  conditionDefaults: Partial<ConditionSpec>;
  /** Used when the spec gives no conditions. */
  defaultConditions: ConditionSpec[];
  /** Does the recipe place a target at an eccentricity (writes targetEccentricity*)? */
  hasTargetPosition: boolean;
  /** Extra experiment-wide (column B) parameters, beyond the builder's. */
  experiment?: (spec: StudySpec) => ParamValues;
  /** The parameters that make one condition this kind of study. */
  condition: (c: ResolvedCondition, spec: StudySpec) => ParamValues;
  /** Short prose for the model: conventions, what needs a resource file, gotchas. */
  notes?: string;
  /**
   * Why the table says what it says — one short clause per non-obvious
   * choice ("DHKNORSVZ: the Sloan letters"). Goes into the build summary so
   * the scientist hears the reasoning, not just the values.
   */
  rationale: string[];
  /** A realistic spec, shown to the model as the worked example. */
  example: StudySpec;
}

/** Drop empty values so the table stays lean (empty cell = glossary default). */
export const compact = (v: Record<string, string | undefined>): ParamValues => {
  const out: ParamValues = {};
  for (const [k, val] of Object.entries(v))
    if (val !== undefined && val !== null && String(val) !== "")
      out[k] = String(val);
  return out;
};
