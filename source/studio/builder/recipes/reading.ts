/**
 * Ordinary reading: pages of text from a corpus, read at the participant's
 * pace, followed by comprehension questions. Reading speed is the measure.
 * Mirrors the bundled readingExperiment example.
 */
import { fmt, num } from "../spec";
import { compact, type Recipe } from "./types";

export const DEFAULT_CORPUS = "the-phantom-tollbooth.txt";

/** Integer cell, or blank (glossary default) when the spec gave nothing. */
const numOr = (v: unknown): string | undefined => {
  const n = num(v);
  return n === undefined ? undefined : fmt(n, 0);
};

export const reading: Recipe = {
  id: "reading",
  title: "Reading speed",
  summary:
    "Reading: pages of a text corpus at a set letter size, timed, with multiple-choice comprehension questions after.",
  keywords: [
    "reading",
    "reading speed",
    "words per minute",
    "passage",
    "corpus",
    "comprehension",
    "page",
    "print size",
  ],
  conditionFields: [
    "sizeDeg",
    "pages",
    "linesPerPage",
    "lineLengthCharacters",
    "comprehensionQuestions",
    "corpus",
    "font",
    "trials",
  ],
  // Modeled on the bundled readingExperiment example. Its 0.8 line spacing
  // and hard-coded readingFirstFewWords are left to the glossary defaults
  // (1.2 and "start of the corpus").
  defaults: {
    trials: 1,
    font: "Roboto Mono",
    fontSource: "google",
    about: "Reading speed at one or more print sizes.",
  },
  conditionDefaults: {
    sizeDeg: 1,
    pages: 4,
    linesPerPage: 12,
    lineLengthCharacters: 57,
    comprehensionQuestions: 3,
    corpus: DEFAULT_CORPUS,
  },
  defaultConditions: [{ sizeDeg: 1 }],
  hasTargetPosition: false,
  condition: (c) =>
    compact({
      targetKind: "reading",
      targetTask: "identify",
      thresholdParameter: "targetSizeDeg",
      readingCorpus: c.corpus ?? DEFAULT_CORPUS,
      readingSetSizeBy: "nominalDeg",
      readingNominalSizeDeg: fmt(num(c.sizeDeg) ?? 1),
      readingPages: numOr(c.pages) ?? "4",
      readingLinesPerPage: numOr(c.linesPerPage) ?? "12",
      readingLineLength: numOr(c.lineLengthCharacters) ?? "57",
      readingLineLengthUnit: "character",
      readingNumberOfQuestions: numOr(c.comprehensionQuestions) ?? "3",
      showCounterBool: "TRUE",
    }),
  rationale: [
    "print size is set as nominal size in deg (readingSetSizeBy nominalDeg), 1 deg by default",
    "4 pages of 12 lines, 57 characters a line, as in the EasyEyes reading example (the glossary default would read the whole corpus)",
    "3 comprehension questions after the passage; the corpus must be a text file in your resources",
  ],
  notes:
    "Each condition is one passage at one size; one 'trial' reads all its pages. readingCorpus must be a text file in EasyEyesResources/texts — check the resource report and ask which corpus if the default is missing. Several print sizes = several conditions with different sizeDeg, usually blocks 'separate'.",
  example: {
    recipe: "reading",
    name: "reading-sizes",
    conditions: [{ sizeDeg: 0.5 }, { sizeDeg: 1 }, { sizeDeg: 2 }],
    blocks: "separate",
  },
};
