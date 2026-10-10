/**
 * Feasibility check: will this study's stimuli fit the participant's screen,
 * and is the threshold measurable there?
 *
 * The runtime decides this trial by trial and never says no: restrictLevel
 * (threshold/components/bounding.js) caps QUEST's requested level so the
 * stimulus fits the screen and the font limits, so an unreachable threshold
 * is silently measured as the cap. This skill runs the same geometry ahead
 * of time, for a few typical screens or the scientist's own, and reports
 * the testable range of the threshold parameter against the expected
 * threshold. The model explains the verdict; the arithmetic is here.
 *
 * Geometry mirrored from the runtime:
 * - xyPxOfDeg (components/utils.js): px from fixation = pxPerCm ×
 *   viewingDistanceCm × tan(deg), along the direction of the point.
 * - fixation at screen center (fixationLocationStrategy centerFixation,
 *   fixationOriginXYScreen 0.5, 0.5; both honored when set).
 * - lower bound (letter.js:36): target px ≥ targetMinPhysicalPx / dpr.
 * - upper bound (fontMaxPhysicalPx.js getMaxNominalFontSizePx): height px ≤
 *   fontMaxPhysicalPx / dpr / (1 + fontPadding), and ≤ fontMaxPx.
 * - fit: the stimulus rect, scaled by fontBoundingScalar, inside the screen
 *   (restrictSizeDeg / restrictSpacingDeg; isRectInRect).
 * Simplifications, stated to the model: letters are assumed square (the
 * runtime measures the font); spacingSymmetry treated as screen; typographic
 * spacing approximated as three letters in a row.
 */
import { acuityGuessDeg } from "../builder/recipes/letterAcuity";
import { crowdingGuessDeg } from "../builder/recipes/letterCrowding";
import type { TableState } from "../tableModel";
import {
  columnLetter,
  DURATION_RULE,
  effective,
  effectiveBool,
  effectiveNum,
  effectiveWide,
  enabledConditions,
  estimateDurationSec,
} from "./effective";
import type { SystemBlock } from "./prompt";
import type { Skill } from "./skills";
import type { AssistantContext, ToolOutcome } from "./tools";

export const FEASIBILITY_TRIGGER = "/feasibility";

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

export interface Screen {
  name: string;
  /** CSS px, as the runtime sees them. */
  widthPx: number;
  heightPx: number;
  widthCm: number;
  heightCm: number;
  devicePixelRatio: number;
}

/** Typical participant screens; CSS px at the usual scaling. */
export const SCREENS: readonly Screen[] = [
  {
    name: "13-inch laptop",
    widthPx: 1440,
    heightPx: 900,
    widthCm: 28.6,
    heightCm: 17.9,
    devicePixelRatio: 2,
  },
  {
    name: "15-inch laptop",
    widthPx: 1536,
    heightPx: 864,
    widthCm: 34.5,
    heightCm: 19.4,
    devicePixelRatio: 1.25,
  },
  {
    name: "24-inch monitor",
    widthPx: 1920,
    heightPx: 1080,
    widthCm: 53.1,
    heightCm: 29.9,
    devicePixelRatio: 1,
  },
  {
    name: "27-inch monitor",
    widthPx: 2560,
    heightPx: 1440,
    widthCm: 59.7,
    heightCm: 33.6,
    devicePixelRatio: 1,
  },
];

/** A preset by name, or by its size alone ("13", '13"', "15 inch laptop"). */
export const screenByName = (name: string): Screen | undefined => {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = norm(name);
  const exact = SCREENS.find((s) => norm(s.name) === key);
  if (exact) return exact;
  const inches = name.match(/\d+/)?.[0];
  return inches
    ? SCREENS.find((s) => s.name.startsWith(`${inches}-`))
    : undefined;
};

const pxPerCmOf = (s: Screen): number => s.widthPx / s.widthCm;

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

export type XY = [number, number];

export interface Rect {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

const tand = (deg: number): number => Math.tan((deg * Math.PI) / 180);
const atand = (x: number): number => (Math.atan(x) * 180) / Math.PI;

/** Runtime xyPxOfDeg with the nearest point at fixation. */
export function xyPxOfDeg(
  [x, y]: XY,
  pxPerCm: number,
  viewingDistanceCm: number,
): XY {
  const r = Math.hypot(x, y);
  if (r === 0) return [0, 0];
  if (r >= 89) return [Math.sign(x) * Infinity, Math.sign(y) * Infinity];
  const rPx = pxPerCm * viewingDistanceCm * tand(r);
  return [(rPx * x) / r, (rPx * y) / r];
}

/** Half-angles of the screen at fixation: how far the screen reaches, in deg. */
export function screenSpanDeg(
  screen: Screen,
  viewingDistanceCm: number,
): { width: number; height: number } {
  const k = pxPerCmOf(screen) * viewingDistanceCm;
  return {
    width: 2 * atand(screen.widthPx / 2 / k),
    height: 2 * atand(screen.heightPx / 2 / k),
  };
}

const union = (a: Rect, b: Rect): Rect => ({
  left: Math.min(a.left, b.left),
  right: Math.max(a.right, b.right),
  bottom: Math.min(a.bottom, b.bottom),
  top: Math.max(a.top, b.top),
});

const inside = (inner: Rect, outer: Rect): boolean =>
  inner.left >= outer.left &&
  inner.right <= outer.right &&
  inner.bottom >= outer.bottom &&
  inner.top <= outer.top;

/** A square letter of `sizeDeg` centered at `center` deg, projected to px. */
export function letterRectPx(
  center: XY,
  sizeDeg: number,
  pxPerCm: number,
  viewingDistanceCm: number,
): Rect {
  const h = sizeDeg / 2;
  const corners: XY[] = [
    [center[0] - h, center[1] - h],
    [center[0] + h, center[1] - h],
    [center[0] - h, center[1] + h],
    [center[0] + h, center[1] + h],
  ].map((c) => xyPxOfDeg(c as XY, pxPerCm, viewingDistanceCm));
  return {
    left: Math.min(...corners.map((c) => c[0])),
    right: Math.max(...corners.map((c) => c[0])),
    bottom: Math.min(...corners.map((c) => c[1])),
    top: Math.max(...corners.map((c) => c[1])),
  };
}

/* ------------------------------------------------------------------ */
/* A condition's geometry, read from the table                         */
/* ------------------------------------------------------------------ */

export interface ConditionGeometry {
  ci: number;
  letter: string;
  conditionName: string;
  block: string;
  targetXYDeg: XY;
  /** "spacingDeg", "targetSizeDeg", or anything else (fixed stimulus). */
  thresholdParameter: string;
  spacingDirection: string;
  spacingRelationToSize: string;
  spacingOverSizeRatio: number;
  targetSizeDeg: number;
  spacingDeg: number;
  sizeIsHeight: boolean;
  targetMinPhysicalPx: number;
  fontMaxPhysicalPx: number;
  fontMaxPx: number;
  fontPadding: number;
  fontBoundingScalar: number;
  fixationOrigin: XY;
  viewingDistanceCm: number;
  needScreenWidthDeg: number;
  needScreenHeightDeg: number;
  /** Expected threshold and where the number comes from. */
  guess: { value: number; from: string } | null;
}

export interface Skipped {
  ci: number;
  letter: string;
  reason: string;
}

const parsePair = (s: string, fallback: XY): XY => {
  const parts = s
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  return parts.length === 2 && parts.every(Number.isFinite)
    ? [parts[0], parts[1]]
    : fallback;
};

export function conditionGeometry(
  t: TableState,
  ci: number,
  viewingDistanceOverride?: number,
): ConditionGeometry | Skipped {
  const letter = columnLetter(ci);
  const kind = effective(t, "targetKind", ci).value || "letter";
  if (kind !== "letter")
    return { ci, letter, reason: `targetKind ${kind} is not checked` };
  const task = effective(t, "targetTask", ci).value;
  if (task && task !== "identify" && task !== "detect")
    return { ci, letter, reason: `targetTask ${task} is not checked` };

  const thresholdParameter = effective(t, "thresholdParameter", ci).value;
  const x = effectiveNum(t, "targetEccentricityXDeg", ci) ?? 0;
  const y = effectiveNum(t, "targetEccentricityYDeg", ci) ?? 0;
  const ecc = Math.hypot(x, y);
  const guessRow = t.rows.find((r) => r.name === "thresholdGuess");
  const guessCell = guessRow ? effective(t, "thresholdGuess", ci) : null;
  let guess: ConditionGeometry["guess"] = null;
  if (guessCell && guessCell.source !== "default") {
    const v = Number(guessCell.value);
    if (Number.isFinite(v) && v > 0)
      guess = { value: v, from: "thresholdGuess" };
  }
  if (!guess && thresholdParameter === "spacingDeg")
    guess = {
      value: crowdingGuessDeg(ecc),
      from: "Bouma's law, 0.3 × (eccentricity + 0.15) deg",
    };
  if (!guess && thresholdParameter === "targetSizeDeg")
    guess = {
      value: acuityGuessDeg(ecc),
      from: "acuity rule of thumb, 0.1 deg + 0.05 deg per deg of eccentricity",
    };

  return {
    ci,
    letter,
    conditionName: effective(t, "conditionName", ci).value,
    block: effective(t, "block", ci).value,
    targetXYDeg: [x, y],
    thresholdParameter,
    spacingDirection: effective(t, "spacingDirection", ci).value || "radial",
    spacingRelationToSize:
      effective(t, "spacingRelationToSize", ci).value || "ratio",
    spacingOverSizeRatio: effectiveNum(t, "spacingOverSizeRatio", ci) ?? 1.4,
    targetSizeDeg: effectiveNum(t, "targetSizeDeg", ci) ?? 2,
    spacingDeg: effectiveNum(t, "spacingDeg", ci) ?? 2,
    sizeIsHeight: effectiveBool(t, "targetSizeIsHeightBool", ci),
    targetMinPhysicalPx: effectiveNum(t, "targetMinPhysicalPx", ci) ?? 8,
    fontMaxPhysicalPx: effectiveNum(t, "fontMaxPhysicalPx", ci) ?? 2000,
    fontMaxPx: effectiveNum(t, "fontMaxPx", ci) ?? 1000,
    fontPadding: effectiveNum(t, "fontPadding", ci) ?? 0.2,
    fontBoundingScalar: effectiveNum(t, "fontBoundingScalar", ci) ?? 1,
    fixationOrigin: parsePair(
      effective(t, "fixationOriginXYScreen", ci).value,
      [0.5, 0.5],
    ),
    viewingDistanceCm:
      viewingDistanceOverride ??
      effectiveNum(t, "viewingDistanceDesiredCm", ci) ??
      50,
    needScreenWidthDeg: effectiveNum(t, "needScreenWidthDeg", ci) ?? 0,
    needScreenHeightDeg: effectiveNum(t, "needScreenHeightDeg", ci) ?? 0,
    guess,
  };
}

export const isSkipped = (g: ConditionGeometry | Skipped): g is Skipped =>
  "reason" in g;

/* ------------------------------------------------------------------ */
/* Stimulus layout and bounds                                          */
/* ------------------------------------------------------------------ */

/** Size and spacing (deg) when the threshold parameter is at `value`. */
export function sizeAndSpacing(
  g: ConditionGeometry,
  value: number,
): { sizeDeg: number; spacingDeg: number; flankers: boolean } {
  if (g.thresholdParameter === "targetSizeDeg")
    return { sizeDeg: value, spacingDeg: 0, flankers: false };
  if (g.thresholdParameter === "spacingDeg") {
    const sizeDeg =
      g.spacingRelationToSize === "none"
        ? g.targetSizeDeg
        : value / g.spacingOverSizeRatio;
    return { sizeDeg, spacingDeg: value, flankers: true };
  }
  return {
    sizeDeg: g.targetSizeDeg,
    spacingDeg: g.spacingDeg,
    flankers: g.spacingRelationToSize !== "none",
  };
}

/** Centers of target and flankers, in deg. */
export function letterCenters(
  g: ConditionGeometry,
  spacingDeg: number,
  flankers: boolean,
): XY[] {
  const [x, y] = g.targetXYDeg;
  if (!flankers) return [[x, y]];
  const r = Math.hypot(x, y);
  const u: XY = r === 0 ? [1, 0] : [x / r, y / r];
  const v: XY = [-u[1], u[0]];
  const along = (d: XY): XY[] => [
    [x - spacingDeg * d[0], y - spacingDeg * d[1]],
    [x + spacingDeg * d[0], y + spacingDeg * d[1]],
  ];
  const dir = g.spacingDirection;
  const out: XY[] = [[x, y]];
  if (dir === "radial" || dir === "radialAndTangential") out.push(...along(u));
  if (dir === "tangential" || dir === "radialAndTangential")
    out.push(...along(v));
  if (dir === "horizontal" || dir === "horizontalAndVertical")
    out.push(...along([1, 0]));
  if (dir === "vertical" || dir === "horizontalAndVertical")
    out.push(...along([0, 1]));
  if (out.length === 1) out.push(...along(u));
  return out;
}

export interface Layout {
  /** Whole stimulus, px from fixation, after fontBoundingScalar. */
  rect: Rect;
  targetWidthPx: number;
  targetHeightPx: number;
}

export function layoutPx(
  g: ConditionGeometry,
  value: number,
  pxPerCm: number,
): Layout {
  const { sizeDeg, spacingDeg, flankers } = sizeAndSpacing(g, value);
  const centers = letterCenters(g, spacingDeg, flankers);
  const d = g.viewingDistanceCm;
  const rects = centers.map((c) => letterRectPx(c, sizeDeg, pxPerCm, d));
  let rect = rects.reduce(union);
  if (g.fontBoundingScalar !== 1) {
    const cx = (rect.left + rect.right) / 2;
    const cy = (rect.bottom + rect.top) / 2;
    const hw = ((rect.right - rect.left) / 2) * g.fontBoundingScalar;
    const hh = ((rect.top - rect.bottom) / 2) * g.fontBoundingScalar;
    rect = { left: cx - hw, right: cx + hw, bottom: cy - hh, top: cy + hh };
  }
  return {
    rect,
    targetWidthPx: rects[0].right - rects[0].left,
    targetHeightPx: rects[0].top - rects[0].bottom,
  };
}

/** The screen as a rect in px from fixation (y up). */
export function screenRectPx(g: ConditionGeometry, s: Screen): Rect {
  const fx = (g.fixationOrigin[0] - 0.5) * s.widthPx;
  const fy = (g.fixationOrigin[1] - 0.5) * s.heightPx;
  return {
    left: -s.widthPx / 2 - fx,
    right: s.widthPx / 2 - fx,
    bottom: -s.heightPx / 2 - fy,
    top: s.heightPx / 2 - fy,
  };
}

const maxHeightPx = (g: ConditionGeometry, s: Screen): number =>
  Math.min(
    g.fontMaxPx,
    g.fontMaxPhysicalPx / s.devicePixelRatio / (1 + g.fontPadding),
  );

const minTargetPx = (g: ConditionGeometry, s: Screen): number =>
  g.targetMinPhysicalPx / s.devicePixelRatio;

/** Both runtime bounds at `value`: big enough, and fits. */
export function bounds(
  g: ConditionGeometry,
  s: Screen,
  value: number,
): { bigEnough: boolean; fits: boolean } {
  const l = layoutPx(g, value, pxPerCmOf(s));
  const px = g.sizeIsHeight ? l.targetHeightPx : l.targetWidthPx;
  return {
    bigEnough: px >= minTargetPx(g, s),
    fits:
      inside(l.rect, screenRectPx(g, s)) &&
      l.targetHeightPx <= maxHeightPx(g, s),
  };
}

const LOG_MIN = -3;
const LOG_MAX = 3;

/**
 * Bisection on log10(value) for the edge of a monotone predicate.
 * `increasing`: true when the predicate holds for large values.
 */
function edge(ok: (v: number) => boolean, increasing: boolean): number | null {
  const lo0 = ok(10 ** LOG_MIN);
  const hi0 = ok(10 ** LOG_MAX);
  if (increasing) {
    if (!hi0) return null;
    if (lo0) return 10 ** LOG_MIN;
  } else {
    if (!lo0) return null;
    if (hi0) return 10 ** LOG_MAX;
  }
  let lo = LOG_MIN;
  let hi = LOG_MAX;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const pass = ok(10 ** mid);
    if (pass === increasing) hi = mid;
    else lo = mid;
  }
  return 10 ** (increasing ? hi : lo);
}

/** Testable range of the threshold parameter on this screen, or null. */
export function testableRange(
  g: ConditionGeometry,
  s: Screen,
): { minDeg: number; maxDeg: number } | null {
  const minDeg = edge((v) => bounds(g, s, v).bigEnough, true);
  const maxDeg = edge((v) => bounds(g, s, v).fits, false);
  if (minDeg === null || maxDeg === null || minDeg > maxDeg) return null;
  return { minDeg, maxDeg };
}

/* ------------------------------------------------------------------ */
/* Verdicts                                                            */
/* ------------------------------------------------------------------ */

export type Verdict =
  | "OK"
  | "TIGHT"
  | "OUT OF RANGE"
  | "NOT TESTABLE"
  | "OFF SCREEN"
  | "SCREEN TOO SMALL"
  | "FITS"
  | "DOES NOT FIT";

/** QUEST needs room around the expected threshold: 4× either way. */
export const MARGIN_LOG10 = Math.log10(4);

export interface ScreenResult {
  screen: Screen;
  spanDeg: { width: number; height: number };
  targetPx: XY;
  targetOnScreen: boolean;
  range: { minDeg: number; maxDeg: number } | null;
  verdict: Verdict;
  note: string;
}

export function checkOnScreen(g: ConditionGeometry, s: Screen): ScreenResult {
  const pxPerCm = pxPerCmOf(s);
  const spanDeg = screenSpanDeg(s, g.viewingDistanceCm);
  const targetPx = xyPxOfDeg(g.targetXYDeg, pxPerCm, g.viewingDistanceCm);
  const screenRect = screenRectPx(g, s);
  const targetOnScreen =
    targetPx[0] >= screenRect.left &&
    targetPx[0] <= screenRect.right &&
    targetPx[1] >= screenRect.bottom &&
    targetPx[1] <= screenRect.top;
  const base = { screen: s, spanDeg, targetPx, targetOnScreen };

  if (
    g.needScreenWidthDeg > spanDeg.width ||
    g.needScreenHeightDeg > spanDeg.height
  )
    return {
      ...base,
      range: null,
      verdict: "SCREEN TOO SMALL",
      note: `needScreenWidthDeg ${g.needScreenWidthDeg} × needScreenHeightDeg ${
        g.needScreenHeightDeg
      }, screen spans ${f1(spanDeg.width)} × ${f1(spanDeg.height)} deg at ${
        g.viewingDistanceCm
      } cm; the device-compatibility page rejects it`,
    };
  if (!targetOnScreen)
    return {
      ...base,
      range: null,
      verdict: "OFF SCREEN",
      note: `target center at ${f1(g.targetXYDeg[0])}, ${f1(
        g.targetXYDeg[1],
      )} deg lands ${cmOf(
        targetPx,
        pxPerCm,
      )} from fixation; screen reaches ±${f1(
        spanDeg.width / 2,
      )} deg horizontally, ±${f1(spanDeg.height / 2)} deg vertically`,
    };

  const quest =
    g.thresholdParameter === "spacingDeg" ||
    g.thresholdParameter === "targetSizeDeg";
  if (!quest) {
    const b = bounds(g, s, 0);
    const ok = b.fits && b.bigEnough;
    return {
      ...base,
      range: null,
      verdict: ok ? "FITS" : "DOES NOT FIT",
      note: ok
        ? `fixed stimulus (targetSizeDeg ${g.targetSizeDeg}${
            sizeAndSpacing(g, 0).flankers ? `, spacingDeg ${g.spacingDeg}` : ""
          }) fits`
        : b.fits
        ? `target below targetMinPhysicalPx ${g.targetMinPhysicalPx}`
        : `stimulus runs off the screen or over fontMaxPhysicalPx; the runtime will shrink it`,
    };
  }

  const range = testableRange(g, s);
  if (!range)
    return {
      ...base,
      range: null,
      verdict: "NOT TESTABLE",
      note: `no ${g.thresholdParameter} is both ≥ targetMinPhysicalPx ${g.targetMinPhysicalPx} and on screen`,
    };
  const rangeText = `testable ${g.thresholdParameter} ${f2(range.minDeg)}–${f2(
    range.maxDeg,
  )} deg`;
  if (!g.guess)
    return {
      ...base,
      range,
      verdict: "OK",
      note: `${rangeText}; no expected threshold to compare`,
    };
  const v = g.guess.value;
  const below = Math.log10(v / range.minDeg);
  const above = Math.log10(range.maxDeg / v);
  if (v > range.maxDeg)
    return {
      ...base,
      range,
      verdict: "OUT OF RANGE",
      note: `${rangeText}; expected ${f2(v)} (${
        g.guess.from
      }) is above it, so the stimulus would not fit at threshold and QUEST would measure the cap`,
    };
  if (v < range.minDeg)
    return {
      ...base,
      range,
      verdict: "OUT OF RANGE",
      note: `${rangeText}; expected ${f2(v)} (${
        g.guess.from
      }) is below it, so letters at threshold would have fewer than targetMinPhysicalPx ${
        g.targetMinPhysicalPx
      } pixels and the runtime would hold them at that floor`,
    };
  if (below < MARGIN_LOG10 || above < MARGIN_LOG10)
    return {
      ...base,
      range,
      verdict: "TIGHT",
      note: `${rangeText}; expected ${f2(v)} (${g.guess.from}) has only ${f1(
        10 ** Math.min(below, above),
      )}× room ${below < above ? "below" : "above"}; QUEST wants about 4×`,
    };
  return {
    ...base,
    range,
    verdict: "OK",
    note: `${rangeText}; expected ${f2(v)} (${
      g.guess.from
    }) sits inside with room both ways`,
  };
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

const f1 = (n: number): string => Number(n.toFixed(1)).toString();
const f2 = (n: number): string => Number(n.toFixed(n < 1 ? 3 : 2)).toString();
const cmOf = (px: XY, pxPerCm: number): string =>
  `${f1(Math.hypot(px[0], px[1]) / pxPerCm)} cm`;

const RANK: Record<Verdict, number> = {
  OK: 0,
  FITS: 0,
  TIGHT: 1,
  "OUT OF RANGE": 2,
  "DOES NOT FIT": 2,
  "NOT TESTABLE": 3,
  "OFF SCREEN": 3,
  "SCREEN TOO SMALL": 3,
};

const worst = (vs: Verdict[]): Verdict =>
  vs.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "OK" as Verdict);

export interface FeasibilityInput {
  screens?: unknown;
  screen?: unknown;
  viewingDistanceCm?: unknown;
  conditions?: unknown;
}

function parseScreen(raw: unknown): Screen | string {
  if (typeof raw === "string") {
    const s = screenByName(raw);
    return (
      s ??
      `unknown screen "${raw}"; presets: ${SCREENS.map((p) => p.name).join(
        ", ",
      )}`
    );
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const n = (k: string) => Number(o[k]);
    const dims = ["widthPx", "heightPx", "widthCm", "heightCm"];
    if (dims.some((k) => !Number.isFinite(n(k)) || n(k) <= 0))
      return `screen needs positive widthPx, heightPx, widthCm, heightCm`;
    return {
      name: typeof o.name === "string" && o.name ? o.name : "your screen",
      widthPx: n("widthPx"),
      heightPx: n("heightPx"),
      widthCm: n("widthCm"),
      heightCm: n("heightCm"),
      devicePixelRatio:
        Number.isFinite(n("devicePixelRatio")) && n("devicePixelRatio") > 0
          ? n("devicePixelRatio")
          : 1,
    };
  }
  return "screen must be a preset name or {widthPx, heightPx, widthCm, heightCm}";
}

const describeScreen = (s: Screen): string =>
  `${s.name}: ${s.widthPx}×${s.heightPx} px, ${s.widthCm}×${
    s.heightCm
  } cm, ${f1(pxPerCmOf(s))} px/cm, devicePixelRatio ${s.devicePixelRatio}`;

const describeCondition = (g: ConditionGeometry): string => {
  const [x, y] = g.targetXYDeg;
  const where =
    x === 0 && y === 0
      ? "at fixation"
      : `at ${f1(x)}, ${f1(y)} deg (${f1(Math.hypot(x, y))} deg ${sideOf(
          x,
          y,
        )})`;
  const quest =
    g.thresholdParameter === "spacingDeg"
      ? `QUEST varies spacingDeg, flankers ${
          g.spacingDirection
        }, spacingRelationToSize ${g.spacingRelationToSize}${
          g.spacingRelationToSize === "none"
            ? `, targetSizeDeg ${g.targetSizeDeg}`
            : `, spacingOverSizeRatio ${g.spacingOverSizeRatio}`
        }`
      : g.thresholdParameter === "targetSizeDeg"
      ? "QUEST varies targetSizeDeg, single letter"
      : g.thresholdParameter
      ? `thresholdParameter ${g.thresholdParameter}, letter geometry fixed`
      : "no thresholdParameter, letter geometry fixed";
  const name = g.conditionName ? ` "${g.conditionName}"` : "";
  return `Column ${g.letter}${name} (block ${
    g.block || "?"
  }) — target ${where}; ${quest}; viewing distance ${g.viewingDistanceCm} cm`;
};

const sideOf = (x: number, y: number): string => {
  if (Math.abs(x) >= Math.abs(y)) return x > 0 ? "right" : "left";
  return y > 0 ? "up" : "down";
};

/** The whole check as text for the model. */
export function feasibilityReport(
  table: TableState,
  name: string,
  input: FeasibilityInput = {},
): { text: string; isError: boolean; verdict: Verdict } {
  const screens: Screen[] = [];
  const problems: string[] = [];
  const rawScreens: unknown[] = Array.isArray(input.screens)
    ? input.screens
    : input.screens !== undefined
    ? [input.screens]
    : [];
  if (input.screen !== undefined) rawScreens.push(input.screen);
  for (const raw of rawScreens) {
    const s = parseScreen(raw);
    if (typeof s === "string") problems.push(s);
    else screens.push(s);
  }
  if (problems.length && screens.length === 0)
    return { text: problems.join("\n"), isError: true, verdict: "OK" };
  if (screens.length === 0) screens.push(...SCREENS);

  let distance: number | undefined;
  if (input.viewingDistanceCm !== undefined) {
    const d = Number(input.viewingDistanceCm);
    if (!Number.isFinite(d) || d <= 0)
      return {
        text: "viewingDistanceCm must be a positive number",
        isError: true,
        verdict: "OK",
      };
    distance = d;
  }

  let cis = enabledConditions(table);
  if (Array.isArray(input.conditions) && input.conditions.length) {
    const wanted = new Set(
      input.conditions.map((c) => String(c).trim().toUpperCase()),
    );
    cis = cis.filter((ci) => wanted.has(columnLetter(ci)));
    if (cis.length === 0)
      return {
        text: `No enabled condition matches ${[...wanted].join(", ")}.`,
        isError: true,
        verdict: "OK",
      };
  }

  const lines: string[] = [];
  const title = name ? `FEASIBILITY — ${name}` : "FEASIBILITY";
  lines.push(title);
  lines.push(
    "Assumptions: fixation at the screen point fixationOriginXYScreen names (default center); letters square (the runtime measures the font); spacingSymmetry as screen; nominal font size ≈ letter height. Bounds are the runtime's: target ≥ targetMinPhysicalPx/devicePixelRatio, height ≤ fontMaxPhysicalPx/devicePixelRatio/(1+fontPadding) and ≤ fontMaxPx, whole stimulus on screen (bounding.js restrictLevel caps QUEST silently otherwise). Expected thresholds are priors, not data.",
  );
  if (problems.length) lines.push(`Ignored: ${problems.join("; ")}`);
  lines.push("Screens:");
  for (const s of screens) lines.push(`  ${describeScreen(s)}`);

  const verdicts: Verdict[] = [];
  let checked = 0;
  const skipped: Skipped[] = [];
  for (const ci of cis) {
    const g = conditionGeometry(table, ci, distance);
    if (isSkipped(g)) {
      skipped.push(g);
      continue;
    }
    checked++;
    lines.push("");
    lines.push(describeCondition(g));
    const results = screens.map((s) => checkOnScreen(g, s));
    for (const r of results) {
      const span = `screen ${f1(r.spanDeg.width)} × ${f1(
        r.spanDeg.height,
      )} deg`;
      const target =
        g.targetXYDeg[0] === 0 && g.targetXYDeg[1] === 0
          ? ""
          : `, target ${cmOf(r.targetPx, pxPerCmOf(r.screen))} from fixation`;
      lines.push(
        `  ${r.screen.name}: ${span}${target}; ${r.note} → ${r.verdict}`,
      );
    }
    const v = worst(results.map((r) => r.verdict));
    verdicts.push(v);
    lines.push(`  Verdict: ${v}`);
  }
  if (skipped.length) {
    lines.push("");
    lines.push(
      `Skipped: ${skipped
        .map((s) => `column ${s.letter} (${s.reason})`)
        .join(", ")}`,
    );
  }
  if (checked === 0) {
    lines.push("");
    lines.push(
      "No letter condition to check. The geometry check covers targetKind letter with targetTask identify or detect.",
    );
  }

  const sec = estimateDurationSec(table);
  const minutes = effectiveWide(table, "_online2Minutes");
  const participants = effectiveWide(table, "_online2Participants");
  lines.push("");
  lines.push(
    `Session: about ${Math.max(
      1,
      Math.round(sec / 60),
    )} min (${DURATION_RULE}); _online2Minutes ${minutes.value || "0"}${
      minutes.source === "default" ? " (default)" : ""
    }; _online2Participants ${participants.value || "1"}${
      participants.source === "default" ? " (default)" : ""
    }.`,
  );
  const overall = worst(verdicts);
  lines.push(`Overall: ${checked ? overall : "nothing checked"}`);
  return { text: lines.join("\n"), isError: false, verdict: overall };
}

/* ------------------------------------------------------------------ */
/* Skill                                                               */
/* ------------------------------------------------------------------ */

export const FEASIBILITY_TOOLS = [
  {
    name: "check_feasibility",
    description:
      "Check whether the table's letter conditions fit a participant's screen and whether each QUEST threshold is measurable there: runs the runtime's geometry (px per deg from viewing distance, screen fit, targetMinPhysicalPx, fontMaxPhysicalPx) for typical screens or the scientist's own, and reports the testable range of the threshold parameter against the expected threshold, plus the session-length estimate. Read-only. Call it before answering any question about screen size, viewing distance, eccentricity reach, how large or small the stimulus can get, or whether the design is realistic.",
    input_schema: {
      type: "object",
      properties: {
        screens: {
          type: "array",
          items: { type: "string" },
          description:
            'Preset names to check, any of: "13-inch laptop", "15-inch laptop", "24-inch monitor", "27-inch monitor". Default: all four.',
        },
        screen: {
          type: "object",
          description:
            "The scientist's own screen, when they gave it: {name?, widthPx, heightPx, widthCm, heightCm, devicePixelRatio?}. widthPx/heightPx are CSS px (the browser's reported resolution), devicePixelRatio defaults to 1 (2 for Retina laptops).",
          properties: {
            name: { type: "string" },
            widthPx: { type: "number" },
            heightPx: { type: "number" },
            widthCm: { type: "number" },
            heightCm: { type: "number" },
            devicePixelRatio: { type: "number" },
          },
        },
        viewingDistanceCm: {
          type: "number",
          description:
            "Try a viewing distance other than the table's viewingDistanceDesiredCm, e.g. to see whether moving closer or farther fixes a verdict. Does not change the table.",
        },
        conditions: {
          type: "array",
          items: { type: "string" },
          description:
            "Column letters to check (C, D, …). Default: all enabled.",
        },
      },
    },
  },
] as const;

export const FEASIBILITY_TOOL_NAMES: ReadonlySet<string> = new Set(
  FEASIBILITY_TOOLS.map((t) => t.name),
);

export const FEASIBILITY_INSTRUCTIONS = `FEASIBILITY CHECK (on)
The scientist wants to know whether this study will work on real screens: does each stimulus fit, can QUEST reach the threshold, how long is a session. Call check_feasibility first and answer from its report, not from intuition. It runs the runtime's own geometry (px per deg = px/cm × viewing distance × tan deg; fixation at screen center; bounds targetMinPhysicalPx, fontMaxPhysicalPx, fontMaxPx, the screen edge) for four typical screens, or the one the scientist describes (pass screen when they name a monitor or give dimensions; pass viewingDistanceCm to try a different distance).
- Report the verdicts in plain words: which conditions are fine, which are tight, and why in one clause each (e.g. "at 10 deg right the outer flanker leaves a 13-inch laptop once spacing passes 3.9 deg, and the expected crowding distance is 3 deg, so QUEST has almost no room above"). Quote the testable range and the expected threshold with units.
- The runtime never refuses: when a level does not fit it shrinks the stimulus (bounding.js restrictLevel), so an out-of-range threshold is measured as the cap and the data look clean. Say this once when it matters.
- Remedies are table changes, name them as such: a shorter viewingDistanceDesiredCm (more deg per screen), a smaller eccentricity, flankers tangential instead of radial, a larger screen via needScreenWidthDeg (the compatibility page then rejects small screens), fixationRequestedOffscreenBool for the far periphery, a larger targetMinPhysicalPx only if the scientist wants more pixels per letter. Offer them; apply with the table tools only when the scientist asks.
- Keep the reply short: a sentence per condition, one for the session length, one for the remedy. No markdown, no lists. The check is read-only and never changes the table.`;

export const feasibilitySkillBlock = (): SystemBlock => ({
  type: "text",
  text: FEASIBILITY_INSTRUCTIONS,
});

export function runFeasibilityTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AssistantContext,
): ToolOutcome {
  if (name !== "check_feasibility")
    return {
      result: `Unknown tool ${name}`,
      isError: true,
      activity: `Unknown tool ${name}`,
    };
  const r = feasibilityReport(ctx.table, ctx.name, input as FeasibilityInput);
  return {
    result: r.text,
    isError: r.isError,
    activity: r.isError
      ? "Feasibility check: bad input"
      : `Checked feasibility · ${r.verdict}`,
  };
}

export const feasibilitySkill: Skill = {
  id: "feasibility",
  title: "Feasibility check",
  summary:
    "Will it work on a real screen? Checks each condition's stimulus against typical laptops and monitors at the table's viewing distance: fits, threshold reachable, session length.",
  trigger: FEASIBILITY_TRIGGER,
  prompt:
    "Check whether this study is feasible on typical screens: does each condition's stimulus fit, is each threshold reachable, and how long is a session? Tell me what to change if anything is tight.",
  tools: FEASIBILITY_TOOLS,
  toolNames: FEASIBILITY_TOOL_NAMES,
  systemBlock: async () => feasibilitySkillBlock(),
  run: async (name, input, ctx) => runFeasibilityTool(name, input, ctx),
};
