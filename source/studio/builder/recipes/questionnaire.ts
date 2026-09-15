/**
 * Questionnaire only: one or more blocks of questions (questionAndAnswer01…),
 * no psychophysics. The questions come from the spec's questionsBefore /
 * questionsAfter; the builder writes the block. Use it for surveys,
 * demographics, handedness inventories, debrief questions.
 */
import type { Recipe } from "./types";

export const questionnaire: Recipe = {
  id: "questionnaire",
  title: "Questionnaire",
  summary:
    "Questions only (free text, yes/no, multiple choice), no stimuli — demographics, surveys, inventories.",
  keywords: [
    "questionnaire",
    "survey",
    "questions",
    "demographics",
    "age",
    "handedness",
    "inventory",
    "form",
  ],
  conditionFields: [],
  defaults: {
    about: "Questionnaire.",
    // Departs from the default (TRUE): nothing is drawn in deg, so measuring
    // the screen would only cost the participant a minute.
    screenSizeCalibration: false,
    questionsBefore: [
      { nickname: "AGE", question: "What is your age?" },
      {
        nickname: "GLASSES",
        question: "Do you wear glasses or contact lenses?",
        answers: ["Yes", "No"],
      },
    ],
  },
  conditionDefaults: {},
  defaultConditions: [],
  hasTargetPosition: false,
  condition: () => ({}),
  rationale: [
    "one block of questions, one trial; screen-size calibration is skipped because nothing is drawn in degrees",
  ],
  notes:
    "Put the questions in questionsBefore (or questionsAfter). Each question becomes one questionAndAnswerNN row; 2+ answers make it multiple choice, none makes it free text. Any other recipe accepts questionsBefore/questionsAfter too, so 'ask age and glasses first' is a field of that study's spec, not a separate build.",
  example: {
    recipe: "questionnaire",
    name: "intake-survey",
    questionsBefore: [
      { nickname: "AGE", question: "What is your age?" },
      {
        nickname: "GLASSES",
        question: "Do you wear glasses or contact lenses?",
        answers: ["Yes", "No"],
      },
      {
        nickname: "HAND",
        question: "Which hand do you write with?",
        answers: ["Left", "Right", "Either"],
      },
    ],
  },
};
