/**
 * Letter acuity: a single letter; QUEST varies its size (targetSizeDeg).
 * No flankers (spacingRelationToSize none), so eccentricity is free.
 */
import { fmt } from "../spec";
import { compact, type Recipe } from "./types";

/** Acuity prior: ≈ 0.1 deg letters at the fovea, growing ~0.05 deg per deg. */
export const acuityGuessDeg = (eccentricityDeg: number): number =>
  0.1 + 0.05 * eccentricityDeg;

export const letterAcuity: Recipe = {
  id: "letter-acuity",
  title: "Letter acuity",
  summary:
    "Acuity: a single letter whose size (targetSizeDeg) QUEST varies to find the smallest identifiable size. Foveal by default.",
  keywords: [
    "acuity",
    "visual acuity",
    "letter size",
    "eye chart",
    "Snellen",
    "logMAR",
    "resolution",
    "Sloan",
    "optotype",
  ],
  conditionFields: [
    "eccentricityDeg",
    "side",
    "trials",
    "durationSec",
    "characterSet",
    "font",
  ],
  // Modeled on the AcuityNearAndFar example study.
  defaults: {
    trials: 35,
    font: "Roboto Mono",
    fontSource: "google",
    characterSet: "DHKNORSVZ",
    about: "Letter acuity measured with QUEST.",
  },
  conditionDefaults: { eccentricityDeg: 0, durationSec: 0.15 },
  defaultConditions: [{ eccentricityDeg: 0 }],
  hasTargetPosition: true,
  condition: (c) => {
    const e = Math.max(Math.abs(c.x), Math.abs(c.y));
    return compact({
      targetKind: "letter",
      targetTask: "identify",
      thresholdParameter: "targetSizeDeg",
      spacingRelationToSize: "none",
      thresholdGuess: fmt(acuityGuessDeg(e), 2),
      showCounterBool: "TRUE",
    });
  },
  rationale: [
    "fontCharacterSet DHKNORSVZ is the Sloan letter set, the standard optotypes for acuity (Google font Roboto Mono; Sloan.woff2 is used when it is in your resources)",
    "spacingRelationToSize none: a single letter, no flankers, so size is the only thing QUEST varies",
    "thresholdGuess ≈ 0.1 deg at the fovea plus 0.05 deg per degree of eccentricity",
    "150 ms presentation, 35 trials per condition, trial counter shown",
  ],
  notes:
    "Acuity has no flankers, so spacingDirection does not apply. Near/far acuity is the same recipe with a different viewingDistanceCm per condition (use set: {viewingDistanceDesiredCm}). 'Sloan' is satisfied by the default Sloan letter set DHKNORSVZ; use the Sloan.woff2 font file only when the resource report shows it present — build first, never ask about the font before building.",
  example: {
    recipe: "letter-acuity",
    name: "acuity-fovea-periphery",
    conditions: [
      { eccentricityDeg: 0 },
      { eccentricityDeg: 5, side: "right" },
      { eccentricityDeg: 10, side: "right" },
    ],
    blocks: "separate",
    trials: 35,
  },
};
