/**
 * @file The Test Font panel: pick a font, pick a language, find out whether
 * EasyEyes will render it intact.
 *
 * It answers the three questions a scientist has about a font before they
 * commit an experiment to it:
 *   - will the glyphs be clipped, and what `fontPixiMetricsString` prevents it;
 *   - does the font actually support the language, per shaperglot;
 *   - will Chrome's shaper accept the font's layout tables at all.
 */

import {
  InkMeasurer,
  InkScanner,
  bandCovers,
  charactersOf,
  findWorstCases,
  judgeClipping,
  measurePixiMetricsBand,
  type Band,
  type WorstCaseReport,
} from "./pixiMetrics";
import {
  loadFontFromFile,
  loadFontFromResources,
  looksLikeFontFile,
  type LoadedFont,
} from "./fontSources";
import {
  reportCoverage,
  reportLanguageSupport,
  reportShaping,
} from "./fontReports";
import {
  findTestFontLanguage,
  testFontLanguages,
  type TestFontLanguage,
} from "./languages";
import {
  fontPixiMetricsStringForLanguage,
  glossaryFontPixiMetricsStringDefault,
} from "../../../threshold/preprocess/fontPixiMetricsStringDefault";
import { getTestFontContext } from "./testFontContext";

const DEFAULT_LANGUAGE_CODE = "en";
/** PIXI's own metrics string, used when nothing else is available. */
const PIXI_FALLBACK_METRICS_STRING = "|ÉqÅ";

const element = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const em = (value: number): string => value.toFixed(2);

export const buildTestFontPanel = (): HTMLElement => {
  const root = element("div", "test-font");

  let font: LoadedFont | null = null;
  let language: TestFontLanguage =
    findTestFontLanguage(DEFAULT_LANGUAGE_CODE) ?? testFontLanguages()[0];
  let worstCases: WorstCaseReport | null = null;
  /** The character set the worstCases above were searched over. */
  let searchedCharacterSet = "";
  let characterSetIsCustom = false;

  /* ------------------------------ font source ----------------------------- */

  const sourceSection = element("div", "test-font-section");
  sourceSection.appendChild(element("h3", undefined, "1. Choose a font"));

  const sourceRow = element("div", "test-font-row");

  const resourcesLabel = element("label", "test-font-field");
  resourcesLabel.appendChild(
    element("span", "test-font-label", "From your EasyEyesResources"),
  );
  const fontSelect = element("select", "test-font-select");
  resourcesLabel.appendChild(fontSelect);
  sourceRow.appendChild(resourcesLabel);

  const localLabel = element("label", "test-font-field");
  localLabel.appendChild(
    element("span", "test-font-label", "Or from your computer"),
  );
  const fileInput = element("input", "test-font-file");
  fileInput.type = "file";
  fileInput.accept = ".ttf,.otf,.woff,.woff2,.ttc";
  localLabel.appendChild(fileInput);
  sourceRow.appendChild(localLabel);

  sourceSection.appendChild(sourceRow);
  sourceSection.appendChild(
    element(
      "p",
      "test-font-note",
      "A font you choose from your computer is read and measured in this browser only. EasyEyes does not upload it, add it to EasyEyesResources, or save it anywhere.",
    ),
  );
  const fontStatus = element("div", "test-font-status");
  sourceSection.appendChild(fontStatus);
  root.appendChild(sourceSection);

  /* -------------------------------- settings ------------------------------ */

  const settingsSection = element("div", "test-font-section");
  settingsSection.appendChild(
    element("h3", undefined, "2. Describe how you will use it"),
  );

  const settingsRow = element("div", "test-font-row");

  const languageLabel = element("label", "test-font-field");
  languageLabel.appendChild(element("span", "test-font-label", "fontLanguage"));
  const languageSelect = element("select", "test-font-select");
  for (const candidate of testFontLanguages()) {
    const option = element(
      "option",
      undefined,
      `${candidate.name} (${candidate.code})`,
    );
    option.value = candidate.code;
    if (candidate.code === language.code) option.selected = true;
    languageSelect.appendChild(option);
  }
  languageLabel.appendChild(languageSelect);
  settingsRow.appendChild(languageLabel);

  const paddingLabel = element(
    "label",
    "test-font-field test-font-field-narrow",
  );
  paddingLabel.appendChild(element("span", "test-font-label", "fontPadding"));
  const paddingInput = element("input", "test-font-input");
  paddingInput.type = "number";
  paddingInput.step = "0.05";
  paddingInput.min = "0";
  paddingInput.value = "0";
  paddingLabel.appendChild(paddingInput);
  settingsRow.appendChild(paddingLabel);

  settingsSection.appendChild(settingsRow);

  const characterSetLabel = element("label", "test-font-field");
  characterSetLabel.appendChild(
    element("span", "test-font-label", "fontCharacterSet"),
  );
  const characterSetInput = element("textarea", "test-font-textarea");
  characterSetInput.rows = 3;
  characterSetInput.spellcheck = false;
  characterSetLabel.appendChild(characterSetInput);
  settingsSection.appendChild(characterSetLabel);
  settingsSection.appendChild(
    element(
      "p",
      "test-font-note",
      "The characters your experiment can display. Replace this starting alphabet with the fontCharacterSet from your own experiment.",
    ),
  );

  const analyzeButton = element(
    "button",
    "test-font-button test-font-button-primary",
    "Test this font",
  );
  analyzeButton.type = "button";
  settingsSection.appendChild(analyzeButton);

  const progress = element("div", "test-font-progress");
  const progressBar = element("div", "test-font-progress-bar");
  progress.appendChild(progressBar);
  progress.style.display = "none";
  settingsSection.appendChild(progress);

  root.appendChild(settingsSection);

  /* -------------------------------- results ------------------------------- */

  const reportSection = element("div", "test-font-section test-font-hidden");
  reportSection.appendChild(element("h3", undefined, "Font report"));
  const reportBody = element("div");
  reportSection.appendChild(reportBody);
  root.appendChild(reportSection);

  const metricsSection = element("div", "test-font-section test-font-hidden");
  const metricsHeading = element("h3", undefined, "fontPixiMetricsString");
  const verdictBadge = element("span", "test-font-badge test-font-verdict");
  metricsHeading.appendChild(verdictBadge);
  metricsSection.appendChild(metricsHeading);
  metricsSection.appendChild(
    element(
      "p",
      "test-font-note",
      "This string sets the vertical band of the texture PIXI draws your text into. Ink above or below the band is silently cut off. Edit it to test your own candidate; leave it empty to see what EasyEyes falls back to.",
    ),
  );

  const metricsRow = element("div", "test-font-row");
  const metricsFieldLabel = element("label", "test-font-field");
  metricsFieldLabel.appendChild(
    element("span", "test-font-label", "Metrics string to test"),
  );
  const metricsInput = element("input", "test-font-input test-font-sample");
  metricsInput.type = "text";
  metricsInput.spellcheck = false;
  metricsFieldLabel.appendChild(metricsInput);
  metricsRow.appendChild(metricsFieldLabel);
  metricsSection.appendChild(metricsRow);

  const metricsBody = element("div");
  metricsSection.appendChild(metricsBody);
  root.appendChild(metricsSection);

  /* ------------------------------- behaviour ------------------------------ */

  const applyLanguage = (next: TestFontLanguage) => {
    language = next;
    if (!characterSetIsCustom) characterSetInput.value = next.characterSet;
    characterSetInput.setAttribute("lang", next.code);
    characterSetInput.setAttribute("dir", next.direction);
    metricsInput.setAttribute("lang", next.code);
    metricsInput.setAttribute("dir", next.direction);
    metricsInput.value = fontPixiMetricsStringForLanguage(
      next.code,
      glossaryFontPixiMetricsStringDefault(),
    );
  };

  const sampleFontFamily = (): string =>
    font ? `"${font.family}", sans-serif` : "sans-serif";

  const applyFontToSamples = () => {
    characterSetInput.style.fontFamily = sampleFontFamily();
    metricsInput.style.fontFamily = sampleFontFamily();
  };

  const setFontStatus = (text: string, kind: "ok" | "bad" | "busy") => {
    fontStatus.textContent = text;
    fontStatus.className = `test-font-status test-font-status-${kind}`;
  };

  const useFont = async (load: () => Promise<LoadedFont>) => {
    setFontStatus("Loading font…", "busy");
    analyzeButton.disabled = true;
    try {
      font = await load();
      worstCases = null;
      searchedCharacterSet = "";
      reportSection.classList.add("test-font-hidden");
      metricsSection.classList.add("test-font-hidden");
      applyFontToSamples();
      setFontStatus(
        `Loaded ${font.fileName} (${Math.round(
          font.bytes.byteLength / 1024,
        )} kB)${
          font.origin === "local" ? ", from your computer, not saved" : ""
        }.`,
        "ok",
      );
    } catch (error) {
      font = null;
      setFontStatus(
        error instanceof Error ? error.message : String(error),
        "bad",
      );
    } finally {
      analyzeButton.disabled = false;
    }
  };

  fontSelect.addEventListener("change", () => {
    if (!fontSelect.value) return;
    fileInput.value = "";
    void useFont(() => loadFontFromResources(fontSelect.value));
  });

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!looksLikeFontFile(file.name)) {
      setFontStatus(
        `"${file.name}" is not a font file. Choose a .ttf, .otf, .woff, or .woff2 file.`,
        "bad",
      );
      return;
    }
    fontSelect.value = "";
    void useFont(() => loadFontFromFile(file));
  });

  languageSelect.addEventListener("change", () => {
    const next = findTestFontLanguage(languageSelect.value);
    if (!next) return;
    applyLanguage(next);
    if (worstCases) void renderMetrics();
  });

  characterSetInput.addEventListener("input", () => {
    characterSetIsCustom = true;
  });

  // Re-measuring on every keystroke means a fresh pixel scan of a canvas that
  // can be thousands of pixels wide, so wait for a pause in typing.
  let rerenderTimer: ReturnType<typeof setTimeout> | null = null;
  const rerenderSoon = () => {
    if (!worstCases) return;
    if (rerenderTimer !== null) clearTimeout(rerenderTimer);
    rerenderTimer = setTimeout(() => void renderMetrics(), 150);
  };

  paddingInput.addEventListener("input", rerenderSoon);
  metricsInput.addEventListener("input", rerenderSoon);

  analyzeButton.addEventListener("click", () => void analyze());

  /* -------------------------------- reports ------------------------------- */

  const renderReports = async () => {
    if (!font) return;
    reportSection.classList.remove("test-font-hidden");
    reportBody.replaceChildren(
      element("p", "test-font-note", "Checking the font…"),
    );

    const characterSet = characterSetInput.value;
    const [support, coverage, shaping] = await Promise.all([
      reportLanguageSupport(font.bytes, language.shaperglotId),
      characterSet.trim()
        ? reportCoverage(font.bytes, characterSet)
        : Promise.resolve(null),
      reportShaping(font.bytes),
    ]);

    const rows = element("div", "test-font-checks");

    const badgeText = {
      pass: "PASS",
      warn: "WARN",
      fail: "FAIL",
      unknown: "n/a",
    };

    const addCheck = (
      state: keyof typeof badgeText,
      title: string,
      detail: string,
      extra?: string[],
    ) => {
      const row = element("div", "test-font-check");
      row.appendChild(
        element("span", `test-font-badge ${state}`, badgeText[state]),
      );
      const body = element("div");
      body.appendChild(element("strong", undefined, title));
      body.appendChild(element("div", "test-font-note", detail));
      for (const line of extra ?? []) {
        body.appendChild(element("div", "test-font-problem", line));
      }
      row.appendChild(body);
      rows.appendChild(row);
    };

    if (!support) {
      addCheck(
        "unknown",
        `Language support for ${language.name}`,
        "The shaperglot check could not run in this browser, so the compiler will skip it too.",
      );
    } else if (!support.ok) {
      addCheck(
        "unknown",
        `Language support for ${language.name}`,
        support.error ??
          `shaperglot has no checks defined for ${language.shaperglotId}.`,
      );
    } else {
      addCheck(
        support.supported
          ? support.supportLevel === "Incomplete"
            ? "warn"
            : "pass"
          : "fail",
        `Language support for ${language.name} (${language.shaperglotId})`,
        `shaperglot rates this font "${support.supportLevel}". ${support.summary}`.trim(),
        support.problems,
      );
    }

    if (coverage) {
      if (!coverage.ok) {
        addCheck(
          "unknown",
          "fontCharacterSet coverage",
          coverage.error ?? "The coverage check could not run.",
        );
      } else if (coverage.supported) {
        addCheck(
          "pass",
          "fontCharacterSet coverage",
          "The font can shape every character in your fontCharacterSet.",
        );
      } else {
        addCheck(
          "fail",
          "fontCharacterSet coverage",
          `${coverage.missingCharacters.length} character${
            coverage.missingCharacters.length === 1 ? "" : "s"
          } in your fontCharacterSet are missing from the font: ${coverage.missingCharacters.join(
            " ",
          )}`,
        );
      }
    }

    if (!shaping) {
      addCheck(
        "unknown",
        "OpenType layout tables",
        "HarfBuzz could not read this font in the browser.",
      );
    } else if (shaping.rejectedTables.length === 0) {
      addCheck(
        "pass",
        "OpenType layout tables",
        "Chrome's shaper accepts this font's layout tables.",
      );
    } else {
      addCheck(
        "fail",
        "OpenType layout tables",
        `Chrome's shaper rejects this font's ${shaping.rejectedTables.join(
          " and ",
        )} table, discarding all of its glyph substitution. Cursive joining and ligatures will be wrong for participants on Chrome, Edge, and Firefox, even though the font may look correct on a Mac. The compiler will refuse this font.`,
      );
    }

    const shaperglotLink = element("p", "test-font-note");
    shaperglotLink.innerHTML =
      'Language support is judged by <a href="https://github.com/googlefonts/shaperglot" target="_blank" rel="noopener">Google\'s shaperglot</a>, the same check the compiler runs.';
    rows.appendChild(shaperglotLink);

    reportBody.replaceChildren(rows);
  };

  /* -------------------------- clipping and metrics ------------------------ */

  const effectiveMetricsString = (): { text: string; label: string } => {
    const tested = metricsInput.value;
    if (tested.trim() !== "") return { text: tested, label: `"${tested}"` };
    const characterSet = characterSetInput.value;
    if (characterSet.trim() !== "") {
      return {
        text: characterSet,
        label: "empty, so EasyEyes uses your whole fontCharacterSet",
      };
    }
    return {
      text: PIXI_FALLBACK_METRICS_STRING,
      label: `empty, so PIXI uses its own "${PIXI_FALLBACK_METRICS_STRING}"`,
    };
  };

  const numbersTable = (
    tested: Band,
    padding: number,
    required: Band,
    recommended: Band,
    overflowTop: number,
    overflowBottom: number,
    testedLabel: string,
  ): HTMLElement => {
    const table = element("table", "test-font-numbers");
    const head = element("tr");
    for (const heading of [
      "",
      `tested: ${testedLabel}`,
      "tested + fontPadding",
      "required by your alphabet",
      "recommended string",
    ]) {
      head.appendChild(element("th", undefined, heading));
    }
    table.appendChild(head);

    const addRow = (
      name: string,
      testedValue: number,
      paddedValue: number,
      requiredValue: number,
      recommendedValue: number,
      overflow: number,
    ) => {
      const row = element("tr");
      row.appendChild(element("th", undefined, name));
      row.appendChild(element("td", undefined, em(testedValue)));
      row.appendChild(
        element("td", overflow > 0.005 ? "bad" : "ok", em(paddedValue)),
      );
      row.appendChild(element("td", undefined, em(requiredValue)));
      row.appendChild(element("td", undefined, em(recommendedValue)));
      table.appendChild(row);
    };

    addRow(
      "ascent (em)",
      tested.ascent,
      tested.ascent + padding,
      required.ascent,
      recommended.ascent,
      overflowTop,
    );
    addRow(
      "descent (em)",
      tested.descent,
      tested.descent + padding,
      required.descent,
      recommended.descent,
      overflowBottom,
    );
    return table;
  };

  const drawIllustration = (
    testedBand: Band,
    padding: number,
    required: Band,
    report: WorstCaseReport,
  ): HTMLCanvasElement => {
    const canvas = element("canvas", "test-font-canvas");
    const size = 120;
    const width = 900;
    const marginTop = 26;
    const marginBottom = 34;
    const ascentPx =
      Math.max(required.ascent, testedBand.ascent + padding) * size;
    const descentPx =
      Math.max(required.descent, testedBand.descent + padding) * size;
    canvas.width = width;
    canvas.height = Math.ceil(marginTop + ascentPx + descentPx + marginBottom);
    canvas.setAttribute("lang", language.code);
    canvas.setAttribute("dir", language.direction);

    const g = canvas.getContext("2d") as CanvasRenderingContext2D;
    if ("lang" in g) (g as unknown as { lang: string }).lang = language.code;
    g.direction = language.direction;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, canvas.width, canvas.height);

    const baselineY = marginTop + ascentPx;
    const topY = baselineY - (testedBand.ascent + padding) * size;
    const bottomY = baselineY + (testedBand.descent + padding) * size;

    const setSampleFont = () => {
      g.font = `${size}px "${font?.family ?? "sans-serif"}"`;
      g.textAlign = "center";
    };
    setSampleFont();
    g.fillStyle = "#111";
    const slots: [string, number][] =
      report.worstAscent.text === report.worstDescent.text
        ? [[report.worstAscent.text, width / 2]]
        : [
            [report.worstAscent.text, width * 0.3],
            [report.worstDescent.text, width * 0.72],
          ];
    for (const [text, x] of slots) g.fillText(text, x, baselineY);

    g.fillStyle = "rgba(220, 38, 38, 0.28)";
    if (topY > 0) g.fillRect(0, 0, width, topY);
    if (bottomY < canvas.height)
      g.fillRect(0, bottomY, width, canvas.height - bottomY);

    const line = (y: number, color: string, dash: number[], label: string) => {
      g.save();
      g.strokeStyle = color;
      g.setLineDash(dash);
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(width, y);
      g.stroke();
      g.setLineDash([]);
      g.font = "12px sans-serif";
      g.textAlign = "left";
      // The canvas is rtl so the sample shapes correctly, but these captions
      // are English and would otherwise be reordered around their numbers.
      g.direction = "ltr";
      g.fillStyle = color;
      g.fillText(label, 6, y - 4);
      g.restore();
      setSampleFont();
    };
    line(
      topY,
      "#b91c1c",
      [6, 4],
      `texture top = metrics ascent + fontPadding (${em(
        testedBand.ascent + padding,
      )} em)`,
    );
    line(
      bottomY,
      "#b91c1c",
      [6, 4],
      `texture bottom = metrics descent + fontPadding (${em(
        testedBand.descent + padding,
      )} em)`,
    );
    line(baselineY, "#2563eb", [], "baseline");

    g.save();
    g.font = "12px sans-serif";
    g.fillStyle = "#555";
    g.textAlign = "center";
    g.direction = "ltr";
    if (slots.length === 2) {
      g.fillText(
        `tallest: ${report.worstAscent.text} (${em(
          report.worstAscent.value,
        )} em up)`,
        width * 0.3,
        canvas.height - 10,
      );
      g.fillText(
        `deepest: ${report.worstDescent.text} (${em(
          report.worstDescent.value,
        )} em down)`,
        width * 0.72,
        canvas.height - 10,
      );
    } else {
      g.fillText(
        `tallest and deepest: ${report.worstAscent.text}`,
        width / 2,
        canvas.height - 10,
      );
    }
    g.restore();
    return canvas;
  };

  const renderMetrics = async () => {
    if (!font || !worstCases) return;
    metricsSection.classList.remove("test-font-hidden");

    const padding = Number.parseFloat(paddingInput.value) || 0;
    const { text: effective, label } = effectiveMetricsString();
    const testedBand = measurePixiMetricsBand(font.family, effective);
    const recommendedBand = measurePixiMetricsBand(
      font.family,
      worstCases.recommended,
    );
    const verdict = judgeClipping(testedBand, padding, worstCases);

    verdictBadge.className = `test-font-badge test-font-verdict ${
      verdict.clips ? "fail" : verdict.marginal ? "warn" : "pass"
    }`;
    if (verdict.clips) {
      const edges = [
        verdict.overflowTop > 0.005 ? "top" : "",
        verdict.overflowBottom > 0.005 ? "bottom" : "",
      ].filter(Boolean);
      verdictBadge.textContent = `CLIPS ${edges.join(" and ")}`;
    } else {
      verdictBadge.textContent = verdict.marginal
        ? "SAFE, under 0.1 em to spare"
        : "SAFE";
    }

    const body = element("div");
    body.appendChild(
      numbersTable(
        testedBand,
        padding,
        verdict.required,
        recommendedBand,
        verdict.overflowTop,
        verdict.overflowBottom,
        label,
      ),
    );

    const slack = Math.min(-verdict.overflowTop, -verdict.overflowBottom);
    const summary = element("p", "test-font-note");
    summary.textContent = verdict.clips
      ? `The texture is ${em(
          Math.max(verdict.overflowTop, verdict.overflowBottom),
        )} em too short. That much ink is cut off every time the worst case comes up, with no warning at run time.`
      : slack < 0.005
      ? "The texture covers the worst case with no measurable room to spare."
      : `The texture clears the worst case by ${em(slack)} em.`;
    body.appendChild(summary);

    body.appendChild(
      drawIllustration(testedBand, padding, verdict.required, worstCases),
    );

    const recommendationCovers = bandCovers(recommendedBand, verdict.required);
    const recommendation = element(
      "div",
      recommendationCovers
        ? "test-font-fix"
        : "test-font-fix test-font-fix-partial",
    );
    const recommendationText = element("span");
    recommendationText.append(
      "Recommended: ",
      element(
        "code",
        undefined,
        `fontPixiMetricsString = ${worstCases.recommended}`,
      ),
      recommendationCovers
        ? ` — the measured worst cases themselves, so the band covers them by construction (${em(
            recommendedBand.ascent,
          )} up, ${em(recommendedBand.descent)} down).`
        : ` — the measured worst cases themselves, but their band (${em(
            recommendedBand.ascent,
          )} up, ${em(
            recommendedBand.descent,
          )} down) still falls short of what your alphabet needs. That happens when characters are missing from the font, since PIXI measures the metrics string on a canvas with no language tag and may substitute a different fallback font than the one your text is drawn with. Fix the coverage problem above first.`,
    );
    recommendation.appendChild(recommendationText);

    const useButton = element("button", "test-font-button", "Test this");
    useButton.type = "button";
    useButton.addEventListener("click", () => {
      metricsInput.value = worstCases!.recommended;
      void renderMetrics();
    });
    recommendation.appendChild(useButton);

    const copyButton = element("button", "test-font-button", "Copy");
    copyButton.type = "button";
    copyButton.addEventListener("click", () => {
      void navigator.clipboard
        .writeText(worstCases!.recommended)
        .then(() => {
          copyButton.textContent = "Copied";
          setTimeout(() => (copyButton.textContent = "Copy"), 1500);
        })
        .catch(() => (copyButton.textContent = "Copy failed"));
    });
    recommendation.appendChild(copyButton);
    body.appendChild(recommendation);

    const caveats: string[] = [];
    if (!worstCases.exhaustive) {
      caveats.push(
        `Your fontCharacterSet has ${
          charactersOf(searchedCharacterSet).length
        } characters, too many to try every triplet, so the search kept the most extreme candidates at each step. The worst case could be slightly worse than shown.`,
      );
    }
    if (testedBand.scaledDown) {
      caveats.push(
        "This metrics string is long enough that measuring it overflows a canvas at full size. PIXI has no fallback for that, so at a large font size the run-time measurement of this string may fail outright. A short string naming only the extremes avoids the problem.",
      );
    }
    if (caveats.length) {
      const list = element("ul", "test-font-caveats");
      for (const caveat of caveats)
        list.appendChild(element("li", undefined, caveat));
      body.appendChild(list);
    }

    metricsBody.replaceChildren(body);
  };

  const analyze = async () => {
    if (!font) {
      setFontStatus("Choose a font first.", "bad");
      return;
    }
    const characters = charactersOf(characterSetInput.value);
    if (characters.length < 3) {
      setFontStatus(
        "Enter at least three characters in fontCharacterSet, so triplets can be built from it.",
        "bad",
      );
      return;
    }

    analyzeButton.disabled = true;
    progress.style.display = "";
    progressBar.style.width = "0%";
    metricsSection.classList.add("test-font-hidden");

    void renderReports();

    try {
      const measurer = new InkMeasurer(
        font.family,
        language.code,
        language.direction,
      );
      const scanner = new InkScanner(
        font.family,
        language.code,
        language.direction,
      );
      worstCases = await findWorstCases(
        measurer,
        scanner,
        characters,
        (fraction) => {
          progressBar.style.width = `${Math.round(fraction * 100)}%`;
        },
      );
      searchedCharacterSet = characterSetInput.value;
      await renderMetrics();
    } finally {
      progress.style.display = "none";
      analyzeButton.disabled = false;
    }
  };

  /* ------------------------------ initial state --------------------------- */

  const { fonts, resourcesLoaded, signedIn } = getTestFontContext();
  const placeholder = element(
    "option",
    undefined,
    !signedIn
      ? "Sign in to list your fonts"
      : !resourcesLoaded
      ? "Listing your fonts…"
      : fonts.length
      ? "Choose a font…"
      : "No fonts in EasyEyesResources",
  );
  placeholder.value = "";
  fontSelect.appendChild(placeholder);
  for (const name of fonts) {
    const option = element("option", undefined, name);
    option.value = name;
    fontSelect.appendChild(option);
  }
  fontSelect.disabled = fonts.length === 0;

  applyLanguage(language);
  applyFontToSamples();
  setFontStatus("No font chosen yet.", "busy");

  return root;
};
