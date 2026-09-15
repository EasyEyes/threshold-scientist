/**
 * Sound threshold: a target sound (from the scientist's sound folder) is
 * played, alone or in a masker; QUEST varies its level (targetSoundDBSPL)
 * to find the detection (or identification) threshold in dB SPL. The
 * loudspeaker is calibrated first with the participant's smartphone or a
 * USB microphone (_calibrateSound1000HzBool, _calibrateSoundAllHzBool).
 *
 * Modeled on the InformationalMaskingMelody example study (tone in melody
 * vs. in notched noise, Pelli lab). Sound folders are zip archives in the
 * scientist's EasyEyesResources/folders; the table names them without
 * ".zip".
 */
import { bool, fmt } from "../spec";
import { compact, type Recipe } from "./types";

export const soundThreshold: Recipe = {
  id: "sound-threshold",
  title: "Sound threshold",
  conditionLabel: "sound",
  summary:
    "Auditory threshold: a target sound, alone or in a masker, at a level (targetSoundDBSPL) QUEST varies; yes/no detection by default. Loudspeaker calibrated with the participant's phone or USB mic.",
  keywords: [
    "sound",
    "audio",
    "auditory",
    "hearing",
    "tone",
    "melody",
    "noise",
    "masker",
    "masking",
    "informational masking",
    "dB SPL",
    "loudspeaker",
    "headphones",
    "speech in noise",
    "audiogram",
    "detection",
  ],
  conditionFields: [
    "soundFolder",
    "maskerFolder",
    "maskerDBSPL",
    "noiseDBSPL",
    "task",
    "trials",
  ],
  defaults: {
    trials: 50,
    soundCalibration: true,
    soundOutput: "loudspeakers",
    // Departs from the default (TRUE): nothing is drawn in deg.
    screenSizeCalibration: false,
    about: "Sound threshold measured with QUEST.",
  },
  conditionDefaults: {
    task: "detect",
    soundFolder: "IM_Target_Sounds",
    noiseDBSPL: 15,
  },
  defaultConditions: [
    { name: "target alone" },
    {
      name: "target in melody",
      maskerFolder: "IM_Melody_Masker_Sounds",
      maskerDBSPL: 40,
    },
  ],
  hasTargetPosition: false,
  experiment: (spec) => {
    const calibrate = bool(spec.soundCalibration) ?? true;
    return {
      _calibrateSound1000HzBool: calibrate ? "TRUE" : "FALSE",
      _calibrateSoundAllHzBool: calibrate ? "TRUE" : "FALSE",
    };
  },
  condition: (c) => {
    const task = c.task === "identify" ? "identify" : "detect";
    return compact({
      targetKind: "sound",
      targetTask: task,
      thresholdParameter: "targetSoundDBSPL",
      targetSoundFolder: c.soundFolder,
      maskerSoundFolder: c.maskerFolder,
      maskerSoundDBSPL: c.maskerFolder
        ? fmt(c.maskerDBSPL ?? 40)
        : c.maskerDBSPL !== undefined
        ? fmt(c.maskerDBSPL)
        : undefined,
      targetSoundNoiseDBSPL:
        c.noiseDBSPL !== undefined ? fmt(c.noiseDBSPL) : undefined,
      thresholdGuess: "100",
      thresholdGuessLogSd: "3",
      thresholdBeta: "2.5",
      thresholdDelta: "0.01",
      // Yes/no detection guesses right half the time; identification 1/N is
      // left to the glossary (filled in from the number of sounds).
      thresholdGamma: task === "detect" ? "0.5" : undefined,
      thresholdProportionCorrect: "0.707",
      responseClickedBool: "TRUE",
      responseTypedBool: "TRUE",
      responsePositiveFeedbackBool: "TRUE",
      responseNegativeFeedbackBool: "TRUE",
      showCounterBool: "TRUE",
    });
  },
  rationale: [
    "_calibrateSound1000HzBool and _calibrateSoundAllHzBool TRUE: the loudspeaker's gain at 1 kHz and its frequency response are measured with the participant's smartphone or a USB microphone before block 1, so targetSoundDBSPL is a real sound level; needSoundOutput loudspeakers because that is what can be calibrated",
    "targetTask detect with thresholdGamma 0.5: on each trial the target is played or not, at random, and the participant answers yes/no; thresholdProportionCorrect 0.707 is the usual yes/no criterion",
    "thresholdGuess 100 dB SPL with thresholdGuessLogSd 3 (thresholdBeta 2.5, thresholdDelta 0.01): a deliberately broad prior in level, from the InformationalMaskingMelody study",
    "targetSoundNoiseDBSPL 15: a faint white-noise floor under the target so that threshold is set by the noise, not by the computer's own hiss; maskerSoundDBSPL 40 when a masker folder is given",
    "targetSoundFolder and maskerSoundFolder name zip archives in the scientist's EasyEyesResources/folders (IM_Target_Sounds and IM_Melody_Masker_Sounds are the example study's); positive and negative feedback are on, as they work for sound tasks",
    "calibrateScreenSizeBool FALSE: nothing is drawn in degrees",
  ],
  notes:
    "Use for tones, melodies, speech in noise, audiograms, masking. Each condition names its soundFolder (the scientist's zip in EasyEyesResources/folders; use the name they give, else the example's) and optionally a maskerFolder with maskerDBSPL. task identify for 'which sound was it' (the options are the file names). Headphones (soundOutput headphones) when the two ears must differ; soundCalibration false only when the scientist says levels need not be calibrated. Build first; the resource report will say which folders are missing.",
  example: {
    recipe: "sound-threshold",
    name: "tone-in-melody",
    conditions: [
      { name: "tone alone", soundFolder: "IM_Target_Sounds" },
      {
        name: "tone in melody",
        soundFolder: "IM_Target_Sounds",
        maskerFolder: "IM_Melody_Masker_Sounds",
        maskerDBSPL: 40,
      },
      {
        name: "tone in notched noise",
        soundFolder: "IM_Target_Sounds",
        maskerFolder: "IM_Notched_Noise_Masker_Sounds",
        maskerDBSPL: 40,
      },
    ],
    blocks: "separate",
    trials: 50,
    soundCalibration: true,
    soundOutput: "loudspeakers",
  },
};
