/**
 * Letter crowding: a target letter between two flankers; QUEST varies the
 * center-to-center spacing (spacingDeg) to find the crowding distance.
 * Radial flankers in the periphery, horizontal at the fovea (the compiler
 * requires that pairing).
 */
import { fmt, legalSpacingDirection } from "../spec";
import { compact, type Recipe } from "./types";

/** Bouma's law as a QUEST prior: critical spacing ≈ 0.3 (ecc + 0.15) deg. */
export const crowdingGuessDeg = (eccentricityDeg: number): number =>
  Math.max(0.15, 0.3 * (eccentricityDeg + 0.15));

export const letterCrowding: Recipe = {
  id: "letter-crowding",
  title: "Letter crowding",
  summary:
    "Crowding distance: a letter flanked by two others; QUEST varies the target–flanker spacing (spacingDeg). Peripheral by default.",
  keywords: [
    "crowding",
    "spacing",
    "Bouma",
    "flankers",
    "critical spacing",
    "peripheral",
    "letters",
    "Sloan",
    "radial",
    "tangential",
  ],
  conditionFields: [
    "eccentricityDeg",
    "side",
    "spacingDirection",
    "trials",
    "durationSec",
    "characterSet",
    "font",
    "threshold",
  ],
  // Modeled on the peripheral-crowding conditions of the RsvpAndCrowding
  // example study; QUEST tuning (beta, delta) is left to the glossary.
  defaults: {
    trials: 35,
    font: "Roboto Mono",
    fontSource: "google",
    characterSet: "DHKNORSVZ",
    about: "Letter crowding measured with QUEST.",
  },
  conditionDefaults: { eccentricityDeg: 5, durationSec: 0.15 },
  defaultConditions: [
    { eccentricityDeg: 5, side: "left" },
    { eccentricityDeg: 5, side: "right" },
  ],
  hasTargetPosition: true,
  condition: (c) => {
    const e = Math.max(Math.abs(c.x), Math.abs(c.y));
    return compact({
      targetKind: "letter",
      targetTask: "identify",
      thresholdParameter: c.threshold ?? "spacingDeg",
      spacingDirection: legalSpacingDirection(c.spacingDirection, c.x, c.y),
      spacingRelationToSize: "ratio",
      spacingOverSizeRatio: "1.4",
      thresholdGuess: fmt(crowdingGuessDeg(e), 2),
      showCounterBool: "TRUE",
    });
  },
  rationale: [
    "fontCharacterSet DHKNORSVZ is the Sloan letter set, the standard optotypes for acuity and crowding (in the Google font Roboto Mono; the Sloan.woff2 file is used when it is in your resources)",
    "flankers are radial in the periphery (crowding is strongest along the radial line), horizontal at the fovea",
    "spacingOverSizeRatio 1.4: letter size follows spacing at the usual 1.4 ratio, so spacing is the one thing QUEST varies",
    "thresholdGuess follows Bouma's law, 0.3 × (eccentricity + 0.15) deg",
    "150 ms presentation, 35 trials per condition, trial counter shown",
  ],
  notes:
    "Default flankers are radial; tangential, or horizontal/vertical at the fovea, are the usual variants. 'Sloan' in a request is satisfied by the default: the Sloan letter set DHKNORSVZ in the Google font. Use the Sloan font file itself (font Sloan.woff2, fontSource file) only when the resource report already shows it present — build first, never ask about the font before building.",
  example: {
    recipe: "letter-crowding",
    name: "crowding-5-10",
    conditions: [
      { eccentricityDeg: 5, side: "right" },
      { eccentricityDeg: 10, side: "right" },
      { eccentricityDeg: 5, side: "right", spacingDirection: "tangential" },
    ],
    trials: 35,
    trackDistance: true,
  },
};
