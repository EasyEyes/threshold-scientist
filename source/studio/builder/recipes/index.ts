/**
 * The recipe registry. To add a kind of study: write recipes/<name>.ts
 * exporting a Recipe, import it here, add it to RECIPES. That is all — the
 * builder, the assistant's build_study tool, its prompt reference and the
 * recipe test all read this list.
 */
import { colorManagement } from "./colorManagement";
import { letterAcuity } from "./letterAcuity";
import { letterCrowding } from "./letterCrowding";
import { questionnaire } from "./questionnaire";
import { reading } from "./reading";
import { repeatedLetters } from "./repeatedLetters";
import { rsvpReading } from "./rsvpReading";
import { soundThreshold } from "./soundThreshold";
import type { Recipe } from "./types";

export type { ParamValues, Recipe, ResolvedCondition } from "./types";

export const RECIPES: readonly Recipe[] = [
  letterCrowding,
  letterAcuity,
  repeatedLetters,
  reading,
  rsvpReading,
  colorManagement,
  soundThreshold,
  questionnaire,
];

export const recipeById = (id: string): Recipe | undefined => {
  const key = (id ?? "").trim().toLowerCase();
  return RECIPES.find((r) => r.id === key);
};

export const recipeIds = (): string[] => RECIPES.map((r) => r.id);

/** The recipe reference the model reads: what each is, its knobs, an example spec. */
export const describeRecipes = (): string =>
  RECIPES.map((r) => {
    const defaults = Object.entries(r.defaults)
      .filter(([, v]) => v !== undefined && typeof v !== "object")
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    const cond = Object.entries(r.conditionDefaults)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    return [
      `### ${r.id} — ${r.title}`,
      r.summary,
      `Matches: ${r.keywords.join(", ")}.`,
      r.conditionFields.length
        ? `Condition fields it reads: ${r.conditionFields.join(", ")}.`
        : "No experimental conditions; the questions are the study.",
      defaults
        ? `Defaults: ${defaults}${cond ? `; per condition ${cond}` : ""}.`
        : "",
      r.notes ?? "",
      `Example: ${JSON.stringify(r.example)}`,
    ]
      .filter(Boolean)
      .join("\n");
  }).join("\n\n");
