/**
 * The Study Builder: recipes (kinds of study), the spec the model writes,
 * the deterministic build from spec to table, and knobs (deterministic
 * edits behind common asks). See README.md in this folder.
 */
export * from "./spec";
export {
  buildStudy,
  isBuildFailure,
  inferFontSource,
  sanitizeName,
} from "./build";
export type { BuildResult, BuildFailure } from "./build";
export { RECIPES, recipeById, recipeIds, describeRecipes } from "./recipes";
export type { Recipe, ResolvedCondition, ParamValues } from "./recipes";
export {
  KNOBS,
  knobById,
  describeKnobs,
  isKnobFailure,
  ciToLetter,
} from "./knobs";
export type {
  Knob,
  KnobArg,
  KnobArgs,
  KnobResult,
  KnobSuccess,
  KnobFailure,
} from "./knobs";
