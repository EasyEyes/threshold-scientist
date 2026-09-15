/**
 * Color management: a study that runs the display at full color precision
 * and measures something that needs it — letter acuity at low contrast.
 *
 * EasyEyes' color-management parameters (all experiment-wide, column B):
 *   _screenColorSpace        srgb | display-p3 — how the canvas is tagged,
 *                            so the browser converts to the display's ICC
 *                            profile. Achromatic values are identical in
 *                            both, so grays are unaffected.
 *   _screenFloat16Bool       a 16-bit float render path (Chromium 122+),
 *                            removing the three 8-bit quantizations.
 *   _screenDitherBool        noisy-bit spatiotemporal dithering (Allard &
 *                            Faubert 2008): ±0.5 LSB noise per pixel per
 *                            frame, ~2–3 effective extra bits on an 8-bit
 *                            panel. Needs nothing special.
 *   _screenMeasurePrecision  assume8Bit | test1Digit | test2Digits — a
 *                            perceptual test of the display's bit depth
 *                            (7–12 bit) before block 1.
 *   _screenMeasurePrecisionBackground / FlickerBool / FlickerHz — that
 *                            test's background gray and optional flicker.
 *   _screenColorCheckBool    a CRS ColorCAL photometer check of color
 *                            management and precision (needs the device;
 *                            _needColorimeterBool requires it).
 * and per condition: screenColorRGBA (background), targetColorRGBA,
 * fontColorRGBA, markingColorRGBA, instructionFontColorRGBA, targetContrast.
 *
 * The spec exposes them as colorSpace, highPrecision, measurePrecision,
 * colorimeter, backgroundGray (any recipe — build.ts displayParams) and,
 * per condition, contrast. This recipe turns precision on and measures
 * acuity (targetSizeDeg by QUEST) at several fixed contrasts on a mid-gray
 * background: a low-contrast acuity study.
 */
import { fmt } from "../spec";
import { acuityGuessDeg } from "./letterAcuity";
import { compact, type Recipe } from "./types";

/** Acuity worsens as contrast falls: roughly size ∝ 1/√contrast. */
export const lowContrastGuessDeg = (
  eccentricityDeg: number,
  contrast: number | undefined,
): number => {
  const c = Math.min(1, Math.max(0.001, Math.abs(contrast ?? 1)));
  return acuityGuessDeg(eccentricityDeg) * Math.max(1, Math.sqrt(1 / c));
};

export const colorManagement: Recipe = {
  id: "color-management",
  title: "Color-managed low-contrast acuity",
  conditionLabel: "acuity",
  summary:
    "Display color management on (float16 + dither, precision test, color space) and letter acuity measured at fixed low contrasts on a mid-gray background.",
  keywords: [
    "color management",
    "colour",
    "color space",
    "display-p3",
    "P3",
    "sRGB",
    "gamma",
    "bit depth",
    "precision",
    "dither",
    "float16",
    "10-bit",
    "luminance",
    "contrast",
    "low contrast",
    "Pelli-Robson",
    "colorimeter",
    "ColorCAL",
    "photometer",
  ],
  conditionFields: [
    "contrast",
    "eccentricityDeg",
    "side",
    "trials",
    "durationSec",
    "characterSet",
    "font",
  ],
  defaults: {
    trials: 35,
    font: "Roboto Mono",
    fontSource: "google",
    characterSet: "DHKNORSVZ",
    colorSpace: "srgb",
    highPrecision: true,
    measurePrecision: true,
    colorimeter: false,
    backgroundGray: 0.5,
    about:
      "Letter acuity at low contrast on a color-managed, high-precision display.",
  },
  conditionDefaults: { eccentricityDeg: 0, durationSec: 0.15, contrast: -1 },
  defaultConditions: [
    { contrast: -1 },
    { contrast: -0.1 },
    { contrast: -0.03 },
  ],
  hasTargetPosition: true,
  condition: (c) => {
    const e = Math.max(Math.abs(c.x), Math.abs(c.y));
    const contrast = c.contrast ?? -1;
    return compact({
      targetKind: "letter",
      targetTask: "identify",
      thresholdParameter: "targetSizeDeg",
      spacingRelationToSize: "none",
      targetContrast: fmt(contrast, 4),
      thresholdGuess: fmt(lowContrastGuessDeg(e, contrast), 2),
      showCounterBool: "TRUE",
    });
  },
  rationale: [
    "_screenFloat16Bool and _screenDitherBool TRUE: a float render path plus noisy-bit dithering, so faint contrasts (0.03 is one part in 33, below an 8-bit step at mid gray) are shown as requested rather than snapped to the nearest of 256 levels",
    "_screenMeasurePrecision test2Digits: before block 1 the participant reads two digits drawn one luminance step above the background at 7–12 bit, which bounds the display's real precision (two digits make guessing 1%)",
    "_screenColorSpace srgb: grays are identical in srgb and display-p3, so P3 only matters for chromatic stimuli — ask for display-p3 when color is the point",
    "_screenColorCheckBool FALSE: the photometer check needs a CRS ColorCAL on USB; turn it (and _needColorimeterBool) on only for a calibrated lab machine",
    "screenColorRGBA 0.5 gray: contrast is defined against the background, and mid gray leaves room for both darker and lighter targets",
    "targetContrast is Weber contrast for letters, -1 a black letter, +1 white, -0.1 a faint dark letter; QUEST varies letter size (targetSizeDeg) at each fixed contrast, as EasyEyes does not yet run QUEST on contrast",
    "fontCharacterSet DHKNORSVZ is the Sloan letter set; thresholdGuess grows as 1/√contrast from the foveal acuity prior",
  ],
  notes:
    "Use for any request about color management, display precision, bit depth, dithering, P3/sRGB, or low-contrast stimuli. Conditions differ in contrast (negative = dark letter); eccentricity works as in letter-acuity. contrast cannot be the threshold field (not supported yet). The display fields (colorSpace, highPrecision, measurePrecision, colorimeter, backgroundGray) also work on every other recipe, e.g. crowding in display-p3 with high precision. colorimeter only when the scientist has the ColorCAL.",
  example: {
    recipe: "color-management",
    name: "low-contrast-acuity",
    conditions: [{ contrast: -1 }, { contrast: -0.1 }, { contrast: -0.03 }],
    colorSpace: "display-p3",
    highPrecision: true,
    measurePrecision: true,
    backgroundGray: 0.5,
    trials: 35,
  },
};
