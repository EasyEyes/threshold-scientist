/**
 * Repeated-letters crowding (Regan's repeat-letter format): the screen is
 * filled with lines of two alternating target letters; the observer reports
 * both. Tolerant of poor fixation, so used for foveal crowding in patients
 * and children. Parameter set from the RsvpAndCrowding example study.
 */
import { fmt, legalSpacingDirection } from "../spec";
import { crowdingGuessDeg } from "./letterCrowding";
import { compact, type Recipe } from "./types";

export const repeatedLetters: Recipe = {
  id: "repeated-letters",
  title: "Repeated-letters crowding",
  summary:
    "Foveal crowding with the repeat-letter format: lines of two alternating letters fill the screen, the observer reports both; QUEST varies spacing.",
  keywords: [
    "repeated letters",
    "repeat letter",
    "Regan",
    "foveal crowding",
    "nystagmus",
    "children",
    "patients",
    "amblyopia",
  ],
  conditionFields: [
    "eccentricityDeg",
    "side",
    "trials",
    "durationSec",
    "characterSet",
    "font",
  ],
  // Modeled on the "Foveal crowding repeated letters" condition of the
  // RsvpAndCrowding example study.
  defaults: {
    trials: 35,
    font: "Roboto Mono",
    fontSource: "google",
    characterSet: "123456789",
    about: "Foveal crowding with repeated letters.",
  },
  conditionDefaults: { eccentricityDeg: 0, durationSec: 0.2 },
  defaultConditions: [{ eccentricityDeg: 0 }],
  hasTargetPosition: true,
  condition: (c) =>
    compact({
      targetKind: "repeatedLetters",
      targetTask: "identify",
      thresholdParameter: "spacingDeg",
      spacingDirection: legalSpacingDirection("horizontal", c.x, c.y),
      spacingRelationToSize: "ratio",
      spacingOverSizeRatio: "1.4",
      targetRepeatsMaxLines: "3",
      thresholdGuess: fmt(
        crowdingGuessDeg(Math.max(Math.abs(c.x), Math.abs(c.y))),
        2,
      ),
      showCounterBool: "TRUE",
    }),
  rationale: [
    "digits 1–9 as the character set, as in the EasyEyes repeated-letters study (the Pelli font file is used when it is in your resources)",
    "two letters alternate along horizontal lines that fill the screen (up to 3 lines), so fixation does not matter — the point of the format",
    "spacing follows size at 1.4; 200 ms because two letters are reported per trial",
    "35 trials per condition, trial counter shown",
  ],
  notes:
    "Digits 1–9 by default (the Pelli font needs Pelli.woff2 in EasyEyesResources). Each presentation yields two responses.",
  example: {
    recipe: "repeated-letters",
    name: "repeated-letters-fovea",
    conditions: [{ eccentricityDeg: 0 }],
    trials: 35,
  },
};
