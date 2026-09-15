/**
 * RSVP reading: words flashed one after another at fixation; QUEST varies
 * the word duration (targetDurationSec) to find the reading-speed threshold.
 * Parameter set from the RsvpAndCrowding example study.
 */
import { fmt, num } from "../spec";
import { DEFAULT_CORPUS } from "./reading";
import { compact, type Recipe } from "./types";

export const rsvpReading: Recipe = {
  id: "rsvp-reading",
  title: "RSVP reading",
  summary:
    "RSVP reading: words presented one at a time at fixation; QUEST varies word duration (targetDurationSec) for a reading-speed threshold.",
  keywords: [
    "RSVP",
    "rapid serial visual presentation",
    "word duration",
    "reading threshold",
    "flashed words",
    "serial words",
  ],
  conditionFields: [
    "wordsPerTrial",
    "sizeDeg",
    "corpus",
    "font",
    "trials",
    "eccentricityDeg",
    "side",
  ],
  // Modeled on the RSVP conditions of the RsvpAndCrowding example study;
  // response modes and the QUEST prior are left to the glossary.
  defaults: {
    trials: 35,
    font: "Roboto Mono",
    fontSource: "google",
    about: "RSVP reading speed measured with QUEST.",
  },
  conditionDefaults: {
    wordsPerTrial: 3,
    sizeDeg: 0.5,
    corpus: DEFAULT_CORPUS,
    eccentricityDeg: 0,
  },
  defaultConditions: [{}],
  hasTargetPosition: true,
  condition: (c) =>
    compact({
      targetKind: "rsvpReading",
      targetTask: "identify",
      thresholdParameter: "targetDurationSec",
      readingCorpus: c.corpus ?? DEFAULT_CORPUS,
      readingCorpusShuffleBool: "TRUE",
      readingSetSizeBy: "spacingDeg",
      readingSpacingDeg: fmt(num(c.sizeDeg) ?? 0.5),
      spacingRelationToSize: "typographic",
      rsvpReadingNumberOfWords: fmt(num(c.wordsPerTrial) ?? 3, 0),
      rsvpReadingNumberOfResponseOptions: "5",
      showCounterBool: "TRUE",
    }),
  rationale: [
    "QUEST varies the time each word is shown (targetDurationSec); the threshold is a reading speed",
    "3 words per trial, letter spacing 0.5 deg, text spaced typographically, as in the EasyEyes RSVP study",
    "words are drawn from a shuffled copy of the corpus so every trial is a fresh sequence; 5 response options per word",
    "35 trials per condition, trial counter shown",
  ],
  notes:
    "sizeDeg here is the letter spacing in deg (readingSpacingDeg). Needs a word list or story in EasyEyesResources/texts (readingCorpus). Peripheral RSVP: give eccentricityDeg/side.",
  example: {
    recipe: "rsvp-reading",
    name: "rsvp-speed",
    conditions: [{ wordsPerTrial: 3, sizeDeg: 0.5 }],
    trials: 35,
    trackDistance: true,
  },
};
