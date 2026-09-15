/**
 * StudySpec — the compact description of a study that the assistant writes
 * and the builder (build.ts) expands into a full EasyEyes table.
 *
 * The point of the spec is speed: the model interprets the scientist's
 * request into a few dozen tokens of intent ("letter crowding, 5 and 10 deg
 * right, 35 trials, ask age first, track distance"), and pure code does the
 * hundreds of cells deterministically, using the recipe's known-good
 * parameter set. The model never types a table.
 *
 * Everything here is optional except `recipe`; the recipe supplies defaults
 * for whatever is left out. Field names are what the model sees, so they
 * are plain words, not EasyEyes parameter names — the mapping to parameters
 * happens in the recipes and in build.ts.
 */

export type Side = "left" | "right" | "up" | "down" | "fovea";

export type FontSource = "google" | "file" | "browser" | "adobe" | "morisawa";

export type SpacingDirection =
  | "horizontal"
  | "vertical"
  | "horizontalAndVertical"
  | "radial"
  | "tangential"
  | "radialAndTangential";

export type ThresholdParameter =
  | "spacingDeg"
  | "targetSizeDeg"
  | "targetDurationSec"
  | "targetEccentricityXDeg"
  | "targetContrast";

export type BlockMode =
  | "interleaved"
  | "separate"
  | "bySide"
  | "byEccentricity";

export type DistanceMethod =
  | "paper"
  | "creditCard"
  | "blindspot"
  | "object"
  | "typical";

export type ColorSpace = "srgb" | "display-p3";

export type SoundOutput = "loudspeakers" | "headphones";

export type SoundTask = "detect" | "identify";

/** The distance-calibration method every template writes unless told otherwise. */
export const DEFAULT_DISTANCE_METHOD: DistanceMethod = "paper";

/** One condition (one column C, D, … of the table). */
export interface ConditionSpec {
  /** conditionName; generated from the other fields when omitted. */
  name?: string;
  /**
   * Target eccentricity in deg. Magnitude; `side` gives the axis and sign.
   * A signed value without a side is honored on the horizontal axis
   * (-5 = 5 deg left). 0 = fovea.
   */
  eccentricityDeg?: number;
  /** Where the target sits relative to fixation. Default right (fovea when eccentricityDeg is 0). */
  side?: Side;
  /** Explicit target position; overrides eccentricityDeg/side when given. */
  xDeg?: number;
  yDeg?: number;
  /** conditionTrials for this condition (default: the study's `trials`). */
  trials?: number;
  /** Explicit block number; otherwise blocks follow the study's `blocks` mode. */
  block?: number;
  /** targetDurationSec. */
  durationSec?: number;
  /** fontCharacterSet, e.g. "DHKNORSVZ" (Sloan) or "abcdefghijklmnopqrstuvwxyz". */
  characterSet?: string;
  /** font (and its source) for this condition only. */
  font?: string;
  fontSource?: FontSource;
  /** Letter recipes: flanker arrangement. Default radial (horizontal at the fovea). */
  spacingDirection?: SpacingDirection;
  /** What QUEST varies. Recipes pick the right one; override only when asked. */
  threshold?: ThresholdParameter;
  /** Reading recipes: readingNominalSizeDeg — nominal letter size in deg. */
  sizeDeg?: number;
  /** Reading: readingPages. */
  pages?: number;
  /** Reading: readingLinesPerPage. */
  linesPerPage?: number;
  /** Reading: readingLineLength in characters. */
  lineLengthCharacters?: number;
  /** Reading: readingNumberOfQuestions — comprehension questions after the passage. */
  comprehensionQuestions?: number;
  /** Reading / RSVP: readingCorpus — a text file in the scientist's EasyEyesResources. */
  corpus?: string;
  /** RSVP: rsvpReadingNumberOfWords per trial. */
  wordsPerTrial?: number;
  /**
   * targetContrast. Letters: Weber contrast, -1 black on the background,
   * +1 white, small magnitudes faint (needs the high-precision display).
   */
  contrast?: number;
  /** Sound: targetSoundFolder — a zip of sound files in EasyEyesResources/folders. */
  soundFolder?: string;
  /** Sound: maskerSoundFolder, played with the target (melody, babble, notched noise…). */
  maskerFolder?: string;
  /** Sound: maskerSoundDBSPL. */
  maskerDBSPL?: number;
  /** Sound: targetSoundNoiseDBSPL — white noise added to the target. */
  noiseDBSPL?: number;
  /** Sound: detect (was the target there? yes/no) or identify (which sound?). */
  task?: SoundTask;
  /** Any EasyEyes parameter → value for this condition, applied last. */
  set?: Record<string, string>;
}

/** A question for a questionnaire block (questionAndAnswer01…). */
export interface QuestionSpec {
  /** Short data-column label, e.g. AGE, GLASSES. Generated when omitted. */
  nickname?: string;
  question: string;
  /** Multiple-choice answers (2+); omit for a free-text answer. */
  answers?: string[];
  /** The correct answer, when there is one (quiz-style). */
  correct?: string;
}

export interface StudySpec {
  /** Recipe id (see recipes/index.ts), e.g. "letter-crowding". */
  recipe: string;
  /** Experiment name (letters, digits, - and _). */
  name?: string;
  /** _about — one sentence describing the study. */
  about?: string;
  /** _authors. */
  authors?: string;
  /** Conditions; the recipe's default conditions when omitted. */
  conditions?: ConditionSpec[];
  /** conditionTrials for every condition that does not set its own. */
  trials?: number;
  /**
   * How conditions are grouped into blocks. interleaved (default): all in
   * one block. separate: one block each. bySide / byEccentricity: one block
   * per side / per eccentricity. Explicit ConditionSpec.block wins.
   */
  blocks?: BlockMode;
  /** Study-wide font (and source) for every condition that does not set its own. */
  font?: string;
  fontSource?: FontSource;
  /** Study-wide fontCharacterSet. */
  characterSet?: string;
  /** viewingDistanceDesiredCm for every condition. */
  viewingDistanceCm?: number;
  /** calibrateScreenSizeBool — measure the screen with a credit card (EasyEyes default TRUE). */
  screenSizeCalibration?: boolean;
  /** calibrateDistanceBool — webcam tracking of viewing distance. */
  trackDistance?: boolean;
  /** _calibrateDistance — how the initial distance is measured when tracking. */
  distanceMethod?: DistanceMethod;
  /** Questionnaire block before the first experimental block. */
  questionsBefore?: QuestionSpec[];
  /** Questionnaire block after the last experimental block. */
  questionsAfter?: QuestionSpec[];
  /** _consentForm / _debriefForm — files in EasyEyesResources/forms. */
  consentForm?: string;
  debriefForm?: string;
  /** _participantIDGetBool + _participantIDPutBool (multi-session studies). */
  participantId?: boolean;
  /** _language, BCP 47 code, e.g. "en", "it", "ar". */
  language?: string;
  /** _online1RecruitmentService. */
  recruitment?: "Prolific" | "none";
  /* Display color management (any recipe; the color-management recipe turns them on). */
  /** _screenColorSpace: srgb (default) or display-p3 (wide gamut). */
  colorSpace?: ColorSpace;
  /** _screenFloat16Bool + _screenDitherBool: a float pipeline and noisy-bit dithering, ~11-bit effective luminance steps. */
  highPrecision?: boolean;
  /** _screenMeasurePrecision test2Digits: measure the display's bit depth perceptually (7–12 bit) before block 1. */
  measurePrecision?: boolean;
  /** _screenColorCheckBool + _needColorimeterBool: photometer (CRS ColorCAL) check of color management before block 1. */
  colorimeter?: boolean;
  /** screenColorRGBA gray level 0–1 for every condition (0.5 = mid gray, the usual contrast background). */
  backgroundGray?: number;
  /* Sound (sound recipes). */
  /** _calibrateSound1000HzBool + _calibrateSoundAllHzBool: calibrate the loudspeaker with the participant's phone or USB mic. */
  soundCalibration?: boolean;
  /** needSoundOutput for every condition: loudspeakers | headphones. */
  soundOutput?: SoundOutput;
  /** Any experiment-wide (underscore) parameter → value, applied last. */
  set?: Record<string, string>;
  /** Any parameter → value applied to every condition, applied last. */
  setAll?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/* Resolution helpers shared by recipes, the builder and the knobs     */
/* ------------------------------------------------------------------ */

const isFinite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

/** Numbers may arrive as strings from the model; coerce, else undefined. */
export const num = (v: unknown): number | undefined => {
  if (isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

export const bool = (v: unknown): boolean | undefined => {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "yes") return true;
    if (s === "false" || s === "no") return false;
  }
  return undefined;
};

/** A number formatted the way the table wants it (no trailing zeros). */
export const fmt = (n: number, digits = 3): string => {
  const s = Number(n.toFixed(digits)).toString();
  return s === "-0" ? "0" : s;
};

/** Target position in deg from the spec's eccentricity + side (or x/y). */
export function resolvePosition(
  c: Pick<ConditionSpec, "eccentricityDeg" | "side" | "xDeg" | "yDeg">,
  defaultEccentricityDeg = 0,
): { x: number; y: number } {
  const x = num(c.xDeg);
  const y = num(c.yDeg);
  if (x !== undefined || y !== undefined) return { x: x ?? 0, y: y ?? 0 };
  const raw = num(c.eccentricityDeg) ?? defaultEccentricityDeg;
  const e = Math.abs(raw);
  const side: Side = c.side ?? (e === 0 ? "fovea" : raw < 0 ? "left" : "right");
  switch (side) {
    case "fovea":
      return { x: 0, y: 0 };
    case "left":
      return { x: -e, y: 0 };
    case "up":
      return { x: 0, y: e };
    case "down":
      return { x: 0, y: -e };
    case "right":
    default:
      return { x: e, y: 0 };
  }
}

export const sideOf = (x: number, y: number): Side =>
  x === 0 && y === 0
    ? "fovea"
    : Math.abs(x) >= Math.abs(y)
    ? x < 0
      ? "left"
      : "right"
    : y < 0
    ? "down"
    : "up";

/** "5deg right", "fovea", "3deg up" — the human tag used in condition names. */
export const positionTag = (x: number, y: number): string => {
  const side = sideOf(x, y);
  if (side === "fovea") return "fovea";
  const e = Math.max(Math.abs(x), Math.abs(y));
  const oblique = x !== 0 && y !== 0 ? ` (${fmt(x)},${fmt(y)})` : "";
  return `${fmt(e)}deg ${side}${oblique}`;
};

/**
 * The flanker arrangement the compiler accepts at a position: horizontal /
 * vertical only at the fovea, radial / tangential only in the periphery
 * (checkFlankerTypeDefinedAtLocation). Maps a requested direction onto the
 * legal family, keeping the requested one when it is already legal.
 */
export function legalSpacingDirection(
  requested: SpacingDirection | undefined,
  x: number,
  y: number,
): SpacingDirection {
  const fovea = x === 0 && y === 0;
  const fovealFamily: SpacingDirection[] = [
    "horizontal",
    "vertical",
    "horizontalAndVertical",
  ];
  if (fovea) {
    if (requested && fovealFamily.includes(requested)) return requested;
    if (requested === "tangential") return "vertical";
    if (requested === "radialAndTangential") return "horizontalAndVertical";
    return "horizontal";
  }
  if (requested && !fovealFamily.includes(requested)) return requested;
  if (requested === "vertical") return "tangential";
  if (requested === "horizontalAndVertical") return "radialAndTangential";
  return "radial";
}

/** The `questionAndAnswerNN` cell: nickname|correctAnswer|question|answers… */
export function questionCell(q: QuestionSpec, index: number): string {
  const clean = (s: string) =>
    s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const nickname =
    (q.nickname && clean(q.nickname).replace(/\s+/g, "_")) || `Q${index + 1}`;
  const answers = (q.answers ?? []).map(clean).filter(Boolean);
  const parts = [nickname, clean(q.correct ?? ""), clean(q.question)];
  // A single answer is an error in EasyEyes; two or more make it multiple choice.
  if (answers.length >= 2) parts.push(...answers);
  return parts.join("|");
}

/** The two-digit suffix of questionAndAnswerNN. */
export const questionParam = (index: number): string =>
  `questionAndAnswer${String(index + 1).padStart(2, "0")}`;

/* ------------------------------------------------------------------ */
/* The spec as the model reads it                                      */
/* ------------------------------------------------------------------ */

/** Compact field reference for the prompt. Keep in step with the types above. */
export const SPEC_REFERENCE = `build_study takes {spec}. All fields optional except recipe.
Study: recipe*, name, about, authors, conditions[], trials (per condition default), blocks (interleaved | separate | bySide | byEccentricity), font, fontSource (inferred: *.woff2/otf/ttf → file, else google), characterSet, viewingDistanceCm, screenSizeCalibration (credit card, EasyEyes default TRUE), trackDistance (webcam, calibrateDistanceBool), distanceMethod (_calibrateDistance; always written, paper by default — creditCard | blindspot | object only when asked), questionsBefore[], questionsAfter[], consentForm, debriefForm, participantId, language (en, it, ar…), recruitment (Prolific), display color management for any recipe: colorSpace (srgb | display-p3 → _screenColorSpace), highPrecision (_screenFloat16Bool + _screenDitherBool), measurePrecision (_screenMeasurePrecision test2Digits), colorimeter (_screenColorCheckBool + _needColorimeterBool), backgroundGray (0–1 → screenColorRGBA); sound recipes: soundCalibration (_calibrateSound1000HzBool + _calibrateSoundAllHzBool), soundOutput (loudspeakers | headphones → needSoundOutput); set {underscore parameter: value}, setAll {parameter: value for every condition}.
Condition: name, eccentricityDeg (magnitude; 0 = fovea; a negative value means left), side (left | right | up | down | fovea; default right), xDeg/yDeg (explicit), trials, block (explicit), durationSec, characterSet, font, fontSource, spacingDirection (radial | tangential | radialAndTangential in the periphery; horizontal | vertical | horizontalAndVertical at the fovea — the builder maps to the legal one), threshold (spacingDeg | targetSizeDeg | targetDurationSec…), contrast (targetContrast, letters: -1 black … small magnitudes faint), reading: sizeDeg, pages, linesPerPage, lineLengthCharacters, comprehensionQuestions, corpus; rsvp: wordsPerTrial, sizeDeg, corpus; sound: soundFolder (targetSoundFolder zip), maskerFolder, maskerDBSPL, noiseDBSPL, task (detect | identify); set {parameter: value}.
Question: nickname (data column label, e.g. AGE), question*, answers[] (2+ = multiple choice; none = free text), correct.
Condition names, block numbers, thresholdGuess and every fixed parameter are generated; give a name only when the scientist did.`;

/* ------------------------------------------------------------------ */
/* JSON schema of the spec, for the build_study tool                   */
/* ------------------------------------------------------------------ */

const numberish = { type: ["number", "string"] };
const stringMap = {
  type: "object",
  additionalProperties: { type: "string" },
};

export const CONDITION_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    eccentricityDeg: { ...numberish, description: "deg; 0 = fovea" },
    side: { type: "string", enum: ["left", "right", "up", "down", "fovea"] },
    xDeg: numberish,
    yDeg: numberish,
    trials: numberish,
    block: numberish,
    durationSec: numberish,
    characterSet: { type: "string" },
    font: { type: "string" },
    fontSource: {
      type: "string",
      enum: ["google", "file", "browser", "adobe", "morisawa"],
    },
    spacingDirection: {
      type: "string",
      enum: [
        "horizontal",
        "vertical",
        "horizontalAndVertical",
        "radial",
        "tangential",
        "radialAndTangential",
      ],
    },
    threshold: {
      type: "string",
      enum: [
        "spacingDeg",
        "targetSizeDeg",
        "targetDurationSec",
        "targetEccentricityXDeg",
        "targetContrast",
      ],
    },
    sizeDeg: numberish,
    pages: numberish,
    linesPerPage: numberish,
    lineLengthCharacters: numberish,
    comprehensionQuestions: numberish,
    corpus: { type: "string" },
    wordsPerTrial: numberish,
    contrast: numberish,
    soundFolder: { type: "string" },
    maskerFolder: { type: "string" },
    maskerDBSPL: numberish,
    noiseDBSPL: numberish,
    task: { type: "string", enum: ["detect", "identify"] },
    set: stringMap,
  },
} as const;

export const QUESTION_SCHEMA = {
  type: "object",
  properties: {
    nickname: { type: "string" },
    question: { type: "string" },
    answers: { type: "array", items: { type: "string" } },
    correct: { type: "string" },
  },
  required: ["question"],
} as const;

export const STUDY_SCHEMA = {
  type: "object",
  properties: {
    recipe: { type: "string" },
    name: { type: "string" },
    about: { type: "string" },
    authors: { type: "string" },
    conditions: { type: "array", items: CONDITION_SCHEMA },
    trials: numberish,
    blocks: {
      type: "string",
      enum: ["interleaved", "separate", "bySide", "byEccentricity"],
    },
    font: { type: "string" },
    fontSource: {
      type: "string",
      enum: ["google", "file", "browser", "adobe", "morisawa"],
    },
    characterSet: { type: "string" },
    viewingDistanceCm: numberish,
    screenSizeCalibration: { type: ["boolean", "string"] },
    trackDistance: { type: ["boolean", "string"] },
    distanceMethod: {
      type: "string",
      enum: ["paper", "creditCard", "blindspot", "object", "typical"],
    },
    questionsBefore: { type: "array", items: QUESTION_SCHEMA },
    questionsAfter: { type: "array", items: QUESTION_SCHEMA },
    consentForm: { type: "string" },
    debriefForm: { type: "string" },
    participantId: { type: ["boolean", "string"] },
    language: { type: "string" },
    recruitment: { type: "string", enum: ["Prolific", "none"] },
    colorSpace: { type: "string", enum: ["srgb", "display-p3"] },
    highPrecision: { type: ["boolean", "string"] },
    measurePrecision: { type: ["boolean", "string"] },
    colorimeter: { type: ["boolean", "string"] },
    backgroundGray: numberish,
    soundCalibration: { type: ["boolean", "string"] },
    soundOutput: { type: "string", enum: ["loudspeakers", "headphones"] },
    set: stringMap,
    setAll: stringMap,
  },
  required: ["recipe"],
} as const;
