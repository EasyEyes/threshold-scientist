/**
 * @file The measurement model behind the Test Font tool.
 *
 * `fontPixiMetricsString` decides the vertical band of the texture that PIXI
 * renders a text stim into. PIXI.TextMetrics.measureFont pixel-scans
 * METRICS_STRING + BASELINE_SYMBOL to get (ascent, descent); Text.updateText
 * then builds a texture of height ascent + descent + 2*padding with the
 * baseline at ascent + padding. Ink further from the baseline than that is
 * silently cut off, with no warning at run time.
 *
 * So the question "will this metrics string clip my stimuli?" is exactly
 * "is the metrics band, plus fontPadding, at least as tall as the ink of the
 * tallest and deepest string the experiment can display?". This module answers
 * both halves the way the run time actually computes them:
 *
 *   - the band, by replicating measureFont (pixel scan, appended "M", and the
 *     multipliers EasyEyes overrides in TextStim#getTextMetrics);
 *   - the ink, by scanning the pixels the browser actually rasterizes on a
 *     canvas carrying the stim's lang and dir.
 *
 * Both sides are pixel scans on purpose. measureText's tight bounding box is
 * far cheaper and is what the search below ranks candidates with, but it is
 * not always the ink: some CJK glyphs report a descent almost 0.1 em deeper
 * than anything they actually draw. Since what a short texture destroys is
 * rasterized ink, a verdict that mixed the two methods could contradict
 * itself — calling a string unsafe against ink that never appears.
 *
 * All results are in em (multiples of the font size), so they compare directly
 * against fontPadding, which the glossary also defines in em.
 */

/** PIXI appends this to METRICS_STRING before measuring (BASELINE_SYMBOL). */
const BASELINE_SYMBOL = "M";

// TextStim#getTextMetrics raises PIXI's defaults (1.4 and 2) to these, which
// is what keeps the measuring canvas tall enough for scripts whose ink far
// outruns the Latin em box. The scan can never report an ascent beyond
// BASELINE_MULTIPLIER * width("M"), so the values matter.
const BASELINE_MULTIPLIER = 8;
const HEIGHT_MULTIPLIER = 12;

/**
 * Nominal font size for the metrics scan. Results are converted to em, so this
 * only sets precision: the scan resolves to one pixel, and the band it yields
 * is compared against ink measured at INK_PX. Too coarse a scan makes a
 * recommendation look like it falls a hundredth of an em short of the ink it
 * was built from.
 */
const METRICS_PX = 200;
/** Font size for tight-bounding-box measurements, used to rank candidates. */
const INK_PX = 300;
/** Font size for pixel scans of displayed strings. */
const SCAN_PX = 200;
/**
 * Room the ink scan leaves around the baseline, in em. Nastaliq cascades run
 * past 2.5 em above the baseline, so the canvas has to be generous or it would
 * clip the very ink it is measuring.
 */
const SCAN_ASCENT_ROOM_EM = 5;
const SCAN_DESCENT_ROOM_EM = 3;
/** Browsers refuse canvases beyond roughly this on a side. */
const MAX_CANVAS_PX = 8192;

/** Ink extent above and below the baseline, in em. */
export interface Band {
  ascent: number;
  descent: number;
}

export interface MetricsBand extends Band {
  /** Font size the scan actually ran at; below METRICS_PX only when scaled. */
  measuredAtPx: number;
  /**
   * True when the metrics string is so long that measuring it at METRICS_PX
   * would overflow the canvas. PIXI has no such fallback: at a large enough
   * font size the same string breaks its measurement outright.
   */
  scaledDown: boolean;
}

const scratchContext = (): CanvasRenderingContext2D => {
  const canvas = document.createElement("canvas");
  return canvas.getContext("2d", {
    willReadFrequently: true,
  }) as CanvasRenderingContext2D;
};

const rowIsInked = (
  data: Uint8ClampedArray,
  rowStart: number,
  rowBytes: number,
): boolean => {
  // PIXI fills the canvas red and draws the text in black, then treats any
  // pixel whose red channel is not fully saturated as ink. Antialiasing
  // counts, which is why the band runs a hair wider than a tight bounding box.
  for (let i = 0; i < rowBytes; i += 4) {
    if (data[rowStart + i] !== 255) return true;
  }
  return false;
};

/**
 * The band PIXI would derive from `metricsString` for `fontFamily`, in em.
 *
 * Note the two details that make this differ from simply measuring the
 * string: PIXI appends "M", so a metrics string can never buy a band shorter
 * than a Latin capital; and the scan is clamped to BASELINE_MULTIPLIER *
 * width("M") above the baseline.
 */
export const measurePixiMetricsBand = (
  fontFamily: string,
  metricsString: string,
): MetricsBand => {
  const ctx = scratchContext();
  const probe = metricsString + BASELINE_SYMBOL;

  let px = METRICS_PX;
  const setFont = () => {
    ctx.font = `${px}px "${fontFamily}"`;
  };
  setFont();
  let width = Math.ceil(ctx.measureText(probe).width);
  let baselineWidth = Math.ceil(ctx.measureText(BASELINE_SYMBOL).width);

  const overflow = Math.max(
    width,
    Math.ceil(HEIGHT_MULTIPLIER * baselineWidth),
  );
  const scaledDown = overflow > MAX_CANVAS_PX;
  if (scaledDown) {
    px = Math.max(8, Math.floor((px * MAX_CANVAS_PX) / overflow));
    setFont();
    width = Math.ceil(ctx.measureText(probe).width);
    baselineWidth = Math.ceil(ctx.measureText(BASELINE_SYMBOL).width);
  }

  const height = Math.ceil(HEIGHT_MULTIPLIER * baselineWidth);
  if (width === 0 || height === 0) {
    return { ascent: 0, descent: 0, measuredAtPx: px, scaledDown };
  }
  const baseline = (baselineWidth * BASELINE_MULTIPLIER) | 0;

  ctx.canvas.width = width;
  ctx.canvas.height = height;
  setFont();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#f00";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#000";
  ctx.fillText(probe, 0, baseline);

  const { data } = ctx.getImageData(0, 0, width, height);
  const rowBytes = width * 4;

  let firstInkedRow = baseline;
  for (let row = 0; row < baseline; row++) {
    if (rowIsInked(data, row * rowBytes, rowBytes)) {
      firstInkedRow = row;
      break;
    }
  }
  let lastInkedRow = baseline;
  for (let row = height - 1; row >= baseline; row--) {
    if (rowIsInked(data, row * rowBytes, rowBytes)) {
      lastInkedRow = row + 1;
      break;
    }
  }

  return {
    ascent: (baseline - firstInkedRow) / px,
    descent: (lastInkedRow - baseline) / px,
    measuredAtPx: px,
    scaledDown,
  };
};

const languageContext = (
  fontFamily: string,
  language: string,
  direction: "ltr" | "rtl",
  px: number,
  willReadFrequently = false,
): CanvasRenderingContext2D => {
  const canvas = document.createElement("canvas");
  canvas.setAttribute("lang", language);
  canvas.setAttribute("dir", direction);
  const ctx = canvas.getContext("2d", {
    willReadFrequently,
  }) as CanvasRenderingContext2D;
  if ("lang" in ctx) (ctx as unknown as { lang: string }).lang = language;
  ctx.direction = direction;
  ctx.textBaseline = "alphabetic";
  ctx.font = `${px}px "${fontFamily}"`;
  return ctx;
};

/**
 * Tight bounding boxes for displayed strings, on a canvas carrying the stim's
 * lang and dir so the browser shapes the text as it will on screen.
 *
 * Cheap but not authoritative: see the note at the top of this file. The
 * search uses it to rank hundreds of thousands of candidates; the handful that
 * survive are re-measured with InkScanner.
 */
export class InkMeasurer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly px: number;

  constructor(
    fontFamily: string,
    language: string,
    direction: "ltr" | "rtl",
    px: number = INK_PX,
  ) {
    this.px = px;
    this.ctx = languageContext(fontFamily, language, direction, px);
  }

  measure(text: string): Band {
    const m = this.ctx.measureText(text);
    return {
      ascent: m.actualBoundingBoxAscent / this.px,
      descent: m.actualBoundingBoxDescent / this.px,
    };
  }
}

/**
 * The ink a string actually rasterizes, found by drawing it and scanning for
 * pixels, which is what a too-short texture destroys.
 *
 * Same red-background trick as PIXI's measureFont, on a canvas roomy enough
 * that the measurement itself can never be the thing doing the clipping.
 */
export class InkScanner {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly px: number;
  private readonly baseline: number;
  private readonly height: number;

  constructor(
    fontFamily: string,
    language: string,
    direction: "ltr" | "rtl",
    px: number = SCAN_PX,
  ) {
    this.px = px;
    this.baseline = Math.ceil(SCAN_ASCENT_ROOM_EM * px);
    this.height = this.baseline + Math.ceil(SCAN_DESCENT_ROOM_EM * px);
    this.ctx = languageContext(fontFamily, language, direction, px, true);
  }

  scan(text: string): Band {
    const ctx = this.ctx;
    const font = ctx.font;
    const direction = ctx.direction;
    // A margin on both sides: glyphs may overhang their advance width, and in
    // an rtl run the text is laid out leftwards from the drawing origin.
    const margin = Math.ceil(this.px * 2);
    const width = Math.ceil(ctx.measureText(text).width) + 2 * margin;
    // Resizing the canvas resets every context attribute, so restore the ones
    // that decide how the text is shaped and placed.
    ctx.canvas.width = width;
    ctx.canvas.height = this.height;
    ctx.font = font;
    ctx.direction = direction;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "center";
    ctx.fillStyle = "#f00";
    ctx.fillRect(0, 0, width, this.height);
    ctx.fillStyle = "#000";
    ctx.fillText(text, width / 2, this.baseline);

    const { data } = ctx.getImageData(0, 0, width, this.height);
    const rowBytes = width * 4;
    let firstInkedRow = this.baseline;
    for (let row = 0; row < this.baseline; row++) {
      if (rowIsInked(data, row * rowBytes, rowBytes)) {
        firstInkedRow = row;
        break;
      }
    }
    let lastInkedRow = this.baseline;
    for (let row = this.height - 1; row >= this.baseline; row--) {
      if (rowIsInked(data, row * rowBytes, rowBytes)) {
        lastInkedRow = row + 1;
        break;
      }
    }
    return {
      ascent: (this.baseline - firstInkedRow) / this.px,
      descent: (lastInkedRow - this.baseline) / this.px,
    };
  }
}

export interface Extreme {
  text: string;
  value: number;
}

export interface WorstCaseReport {
  /** Triplet of distinct characters whose ink reaches highest, and how high. */
  worstAscent: Extreme;
  /** Triplet of distinct characters whose ink reaches deepest. */
  worstDescent: Extreme;
  /** Tallest single character, for acuity-style isolated presentation. */
  worstSingleAscent: Extreme;
  /** Deepest single character. */
  worstSingleDescent: Extreme;
  /** A metrics string built from the extremes above. */
  recommended: string;
  /** True when every ordered triplet was measured, false when the search
   *  pruned candidates because the character set was too large. */
  exhaustive: boolean;
  stringsMeasured: number;
}

/**
 * Every ordered triplet is measured when there are few enough of them to get
 * through in a few seconds behind a progress bar. This covers the alphabets
 * psychophysics actually uses — Latin at 52 characters, Urdu at 39 — so the
 * common case gets an exact answer rather than a heuristic one.
 */
const EXHAUSTIVE_TRIPLET_BUDGET = 300000;
/** Characters considered as pair members once the set is too big to exhaust. */
const PAIR_POOL_MAX = 120;
/** Pairs carried forward into the triplet stage, per direction. */
const BEAM_WIDTH = 40;
/** Characters used to extend a surviving pair into a triplet. */
const EXTENSION_MAX = 200;
/** Strings measured between yields, so the UI can paint a progress bar. */
const YIELD_INTERVAL = 4000;
/**
 * Candidates per direction carried from the bounding-box search into the
 * pixel scan. More than one because the two measurements can rank candidates
 * differently, so the bounding box's winner is not always the scan's.
 */
const CONFIRM_COUNT = 12;

/** The highest-scoring few entries offered to it, without keeping the rest. */
class TopList {
  private entries: Extreme[] = [];
  private threshold = -Infinity;

  constructor(private readonly limit: number) {}

  add(text: string, value: number): void {
    if (this.entries.length >= this.limit && value <= this.threshold) return;
    this.entries.push({ text, value });
    this.entries.sort((a, b) => b.value - a.value);
    if (this.entries.length > this.limit) this.entries.length = this.limit;
    this.threshold = this.entries[this.entries.length - 1].value;
  }

  get texts(): string[] {
    return this.entries.map((entry) => entry.text);
  }
}

const yieldToUi = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 0));

/** Unique, non-whitespace characters of `characterSet`, by code point. */
export const charactersOf = (characterSet: string): string[] => {
  const seen = new Set<string>();
  for (const character of Array.from(characterSet)) {
    if (/\s/.test(character)) continue;
    seen.add(character);
  }
  return Array.from(seen);
};

const topBy = (
  scored: { text: string; value: number }[],
  count: number,
): string[] =>
  [...scored]
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
    .map((entry) => entry.text);

/**
 * Search for the tallest and deepest strings the experiment could display.
 *
 * EasyEyes samples a target and two flankers without replacement, so the
 * worst case for crowding is an ordered triplet of three distinct characters.
 * In joining scripts the extremes come from those three-letter cascades, which
 * no isolated letter and no single word anticipates — which is the whole
 * reason a hand-picked metrics string tends to clip.
 *
 * `onProgress` receives a fraction in [0, 1].
 */
export const findWorstCases = async (
  measurer: InkMeasurer,
  scanner: InkScanner,
  characters: string[],
  onProgress?: (fraction: number) => void,
): Promise<WorstCaseReport> => {
  const n = characters.length;
  let measured = 0;
  let sinceYield = 0;
  let estimatedTotal = 1;

  const tick = async () => {
    measured++;
    sinceYield++;
    if (sinceYield >= YIELD_INTERVAL) {
      sinceYield = 0;
      onProgress?.(Math.min(0.99, measured / estimatedTotal));
      await yieldToUi();
    }
  };

  const tallestTriplets = new TopList(CONFIRM_COUNT);
  const deepestTriplets = new TopList(CONFIRM_COUNT);
  const consider = (text: string, band: Band) => {
    tallestTriplets.add(text, band.ascent);
    deepestTriplets.add(text, band.descent);
  };

  // Isolated characters: the acuity case, and the seed for a pruned search.
  const singleAscents: { text: string; value: number }[] = [];
  const singleDescents: { text: string; value: number }[] = [];
  const tallestSingles = new TopList(CONFIRM_COUNT);
  const deepestSingles = new TopList(CONFIRM_COUNT);
  for (const character of characters) {
    const band = measurer.measure(character);
    singleAscents.push({ text: character, value: band.ascent });
    singleDescents.push({ text: character, value: band.descent });
    tallestSingles.add(character, band.ascent);
    deepestSingles.add(character, band.descent);
    await tick();
  }

  const tripletCount = n * (n - 1) * (n - 2);
  const exhaustive = tripletCount <= EXHAUSTIVE_TRIPLET_BUDGET;

  if (exhaustive) {
    estimatedTotal = n + Math.max(1, tripletCount);
    for (const a of characters) {
      for (const b of characters) {
        if (b === a) continue;
        for (const c of characters) {
          if (c === a || c === b) continue;
          const text = a + b + c;
          consider(text, measurer.measure(text));
          await tick();
        }
      }
    }
  } else {
    const pool =
      n <= PAIR_POOL_MAX
        ? characters
        : Array.from(
            new Set([
              ...topBy(singleAscents, PAIR_POOL_MAX / 2),
              ...topBy(singleDescents, PAIR_POOL_MAX / 2),
            ]),
          );
    const extenders =
      n <= EXTENSION_MAX
        ? characters
        : Array.from(
            new Set([
              ...topBy(singleAscents, EXTENSION_MAX / 2),
              ...topBy(singleDescents, EXTENSION_MAX / 2),
            ]),
          );
    estimatedTotal =
      n +
      pool.length * (pool.length - 1) +
      2 * BEAM_WIDTH * 2 * extenders.length;

    const pairAscents: { text: string; value: number }[] = [];
    const pairDescents: { text: string; value: number }[] = [];
    for (const a of pool) {
      for (const b of pool) {
        if (b === a) continue;
        const text = a + b;
        const band = measurer.measure(text);
        pairAscents.push({ text, value: band.ascent });
        pairDescents.push({ text, value: band.descent });
        await tick();
      }
    }

    const survivors = Array.from(
      new Set([
        ...topBy(pairAscents, BEAM_WIDTH),
        ...topBy(pairDescents, BEAM_WIDTH),
      ]),
    );
    for (const pair of survivors) {
      const [first, second] = Array.from(pair);
      for (const character of extenders) {
        if (character === first || character === second) continue;
        for (const text of [character + pair, pair + character]) {
          consider(text, measurer.measure(text));
          await tick();
        }
      }
    }
  }

  // The bounding box got us a shortlist; the pixel scan decides. Scanning is
  // far too slow for the search itself, but a couple of dozen strings is
  // nothing, and it is the measurement that matches what the texture holds.
  const winnerBy = (
    candidates: string[],
    edge: (band: Band) => number,
  ): Extreme => {
    const best: Extreme = { text: "", value: -Infinity };
    for (const text of candidates) {
      const value = edge(scanner.scan(text));
      if (value > best.value) {
        best.value = value;
        best.text = text;
      }
    }
    return best;
  };

  const worstAscent = winnerBy(tallestTriplets.texts, (band) => band.ascent);
  const worstDescent = winnerBy(deepestTriplets.texts, (band) => band.descent);
  const worstSingleAscent = winnerBy(
    tallestSingles.texts,
    (band) => band.ascent,
  );
  const worstSingleDescent = winnerBy(
    deepestSingles.texts,
    (band) => band.descent,
  );

  // Isolated characters can outreach every triplet (a tall letter loses height
  // in its joined form), so fold them into the recommendation when they do.
  const parts = [worstAscent.text, worstDescent.text];
  if (worstSingleAscent.value > worstAscent.value)
    parts.push(worstSingleAscent.text);
  if (worstSingleDescent.value > worstDescent.value)
    parts.push(worstSingleDescent.text);
  const recommended = Array.from(new Set(parts.filter(Boolean))).join(" ");

  onProgress?.(1);
  return {
    worstAscent,
    worstDescent,
    worstSingleAscent,
    worstSingleDescent,
    recommended,
    exhaustive,
    stringsMeasured: measured,
  };
};

export interface ClippingVerdict {
  /** Ink the texture must hold, in em: the worst case over triplets and singles. */
  required: Band;
  /** What the tested metrics string plus fontPadding actually provides. */
  provided: Band;
  /** Positive means ink is cut off, in em. */
  overflowTop: number;
  overflowBottom: number;
  clips: boolean;
  /** Safe, but with less than 0.1 em to spare. */
  marginal: boolean;
}

/** Em of slack below which a passing string is called marginal rather than safe. */
const MARGINAL_EM = 0.1;
/** Em of overflow ignored as measurement noise. */
const CLIP_EPSILON_EM = 0.005;

/** Whether `band` holds all of `required`, give or take measurement noise. */
export const bandCovers = (band: Band, required: Band): boolean =>
  band.ascent >= required.ascent - CLIP_EPSILON_EM &&
  band.descent >= required.descent - CLIP_EPSILON_EM;

export const judgeClipping = (
  metricsBand: Band,
  fontPadding: number,
  report: WorstCaseReport,
): ClippingVerdict => {
  const required: Band = {
    ascent: Math.max(report.worstAscent.value, report.worstSingleAscent.value),
    descent: Math.max(
      report.worstDescent.value,
      report.worstSingleDescent.value,
    ),
  };
  const provided: Band = {
    ascent: metricsBand.ascent + fontPadding,
    descent: metricsBand.descent + fontPadding,
  };
  const overflowTop = required.ascent - provided.ascent;
  const overflowBottom = required.descent - provided.descent;
  const clips =
    overflowTop > CLIP_EPSILON_EM || overflowBottom > CLIP_EPSILON_EM;
  return {
    required,
    provided,
    overflowTop,
    overflowBottom,
    clips,
    marginal:
      !clips && (overflowTop > -MARGINAL_EM || overflowBottom > -MARGINAL_EM),
  };
};
