// The Feasibility check and Methods draft skills (source/studio/assistant):
// deterministic tools over the table, resolved against the REAL glossary and
// run on tables the Study Builder's recipes produce.

import { loadGlossaryForTests } from "../../threshold/tests/helpers/glossary";
import { buildStudy, isBuildFailure } from "../studio/builder";
import { matrixToState } from "../studio/tableModel";
import {
  effective,
  effectiveWide,
  enabledConditions,
  estimateDurationSec,
  columnLetter,
} from "../studio/assistant/effective";
import {
  SCREENS,
  screenByName,
  xyPxOfDeg,
  screenSpanDeg,
  conditionGeometry,
  isSkipped,
  testableRange,
  checkOnScreen,
  feasibilityReport,
  feasibilitySkill,
} from "../studio/assistant/feasibilitySkill";
import {
  studyFacts,
  methodsSkill,
  composeMethods,
  methodsDocument,
  renderMethodsHtml,
  bracketedBlanks,
  METHODS_SECTIONS,
} from "../studio/assistant/methodsSkill";
import {
  SKILLS,
  MENU_SKILLS,
  parseSkillTrigger,
  runMessage,
} from "../studio/assistant/skills";

jest.setTimeout(60000);

beforeAll(async () => {
  await loadGlossaryForTests();
});

const build = (spec) => {
  const r = buildStudy(spec);
  if (isBuildFailure(r)) throw new Error(r.error);
  return r.table;
};

const crowding = (conditions, extra = {}) =>
  build({
    recipe: "letter-crowding",
    name: "crowding-test",
    conditions,
    blocks: "separate",
    trials: 35,
    ...extra,
  });

const ctx = (table, name = "t") => ({
  table,
  name,
  signedIn: true,
  userResources: null,
  droppedFileNames: [],
  focus: null,
  check: () => ({ errors: [], resourceErrors: [], needed: [] }),
});

/* ------------------------------------------------------------------ */
/* effective values                                                    */
/* ------------------------------------------------------------------ */

describe("effective", () => {
  test("cell, column B, glossary default, none", () => {
    const t = matrixToState([
      ["block", "", "1", "2"],
      ["conditionTrials", "", "35", "35"],
      ["viewingDistanceDesiredCm", "70", "", "40"],
      ["conditionName", "", "", ""],
    ]);
    expect(effective(t, "viewingDistanceDesiredCm", 0)).toEqual({
      value: "70",
      source: "experiment",
    });
    expect(effective(t, "viewingDistanceDesiredCm", 1)).toEqual({
      value: "40",
      source: "cell",
    });
    expect(effective(t, "thresholdBeta", 0)).toEqual({
      value: "2.3",
      source: "default",
    });
    expect(effective(t, "conditionName", 0).source).toBe("none");
    expect(effectiveWide(t, "_language").value).toBe("en");
  });

  test("skips commented rows and disabled columns", () => {
    const t = matrixToState([
      ["block", "", "1", "1", "2"],
      ["conditionTrials", "", "35", "0", "35"],
      ["%targetSizeDeg", "", "9", "9", "9"],
    ]);
    expect(effective(t, "targetSizeDeg", 0)).toEqual({
      value: "2",
      source: "default",
    });
    expect(enabledConditions(t)).toEqual([0, 2]);
    expect(columnLetter(0)).toBe("C");
    expect(columnLetter(24)).toBe("AA");
  });

  test("duration follows the compiler's rule of thumb", () => {
    const t = crowding([{ eccentricityDeg: 5, side: "right" }]);
    // 35 identify trials × 6 s + 4 s screen-size calibration + 10 s blind
    // spot: getDuration.ts counts the blind-spot step whenever the table has
    // no calibrateBlindSpotBool row, as the compiler's own estimate does.
    expect(estimateDurationSec(t)).toBe(35 * 6 + 4 + 10);
  });
});

/* ------------------------------------------------------------------ */
/* feasibility geometry                                                */
/* ------------------------------------------------------------------ */

describe("feasibility geometry", () => {
  test("xyPxOfDeg matches the runtime formula", () => {
    const pxPerCm = 50;
    const d = 50;
    const [x, y] = xyPxOfDeg([10, 0], pxPerCm, d);
    expect(x).toBeCloseTo(pxPerCm * d * Math.tan((10 * Math.PI) / 180), 6);
    expect(y).toBe(0);
    expect(xyPxOfDeg([0, 0], pxPerCm, d)).toEqual([0, 0]);
    const [dx, dy] = xyPxOfDeg([3, 4], pxPerCm, d);
    expect(dx / dy).toBeCloseTo(0.75, 6);
  });

  test("a 13-inch laptop at 50 cm spans about 32 × 20 deg", () => {
    const span = screenSpanDeg(screenByName("13-inch laptop"), 50);
    expect(span.width).toBeGreaterThan(30);
    expect(span.width).toBeLessThan(34);
    expect(span.height).toBeGreaterThan(19);
    expect(span.height).toBeLessThan(22);
  });

  test("screen presets resolve by name or size", () => {
    expect(screenByName("27-inch monitor").widthPx).toBe(2560);
    expect(screenByName('13"').name).toBe("13-inch laptop");
    expect(screenByName("15 inch laptop").name).toBe("15-inch laptop");
    expect(screenByName("projector")).toBeUndefined();
    expect(SCREENS).toHaveLength(4);
  });

  test("reads a crowding condition's geometry with defaults", () => {
    const t = crowding([{ eccentricityDeg: 5, side: "right" }]);
    const g = conditionGeometry(t, 0);
    expect(isSkipped(g)).toBe(false);
    expect(g.targetXYDeg).toEqual([5, 0]);
    expect(g.thresholdParameter).toBe("spacingDeg");
    expect(g.spacingRelationToSize).toBe("ratio");
    expect(g.spacingOverSizeRatio).toBe(1.4);
    expect(g.viewingDistanceCm).toBe(50);
    expect(g.targetMinPhysicalPx).toBe(8);
    expect(g.fontMaxPhysicalPx).toBe(2000);
    expect(g.guess.from).toBe("thresholdGuess");
    expect(g.guess.value).toBeCloseTo(0.3 * 5.15, 1);
  });

  test("testable range widens with a bigger screen and a shorter distance", () => {
    const t = crowding([{ eccentricityDeg: 10, side: "right" }]);
    const g = conditionGeometry(t, 0);
    const small = testableRange(g, screenByName("13-inch laptop"));
    const big = testableRange(g, screenByName("27-inch monitor"));
    expect(small.minDeg).toBeLessThan(small.maxDeg);
    expect(big.maxDeg).toBeGreaterThan(small.maxDeg);
    const near = testableRange(
      conditionGeometry(t, 0, 30),
      screenByName("13-inch laptop"),
    );
    expect(near.maxDeg).toBeGreaterThan(small.maxDeg);
  });

  test("verdicts: 5 deg OK, fovea pixel-limited, far periphery off a laptop, huge need rejects", () => {
    const t = crowding([
      { eccentricityDeg: 5, side: "right" },
      { eccentricityDeg: 0 },
      { eccentricityDeg: 20, side: "right" },
    ]);
    const laptop = screenByName("13-inch laptop");
    expect(checkOnScreen(conditionGeometry(t, 0), laptop).verdict).toBe("OK");
    // Foveal crowding at 50 cm: expected spacing 0.15 deg means letters of
    // 0.107 deg ≈ 4.7 CSS px against a floor of 8 physical px / dpr 2 = 4 px.
    const fovea = checkOnScreen(conditionGeometry(t, 1), laptop);
    expect(fovea.verdict).toBe("TIGHT");
    expect(fovea.note).toContain("room below");
    // At 2 m the same condition has room: 4× more px per deg.
    expect(checkOnScreen(conditionGeometry(t, 1, 200), laptop).verdict).toBe(
      "OK",
    );
    // 20 deg at 50 cm is 18 cm from center; a 13-inch screen reaches 14 cm.
    const far = checkOnScreen(conditionGeometry(t, 2), laptop);
    expect(far.verdict).toBe("OFF SCREEN");
    const g = { ...conditionGeometry(t, 0), needScreenWidthDeg: 60 };
    expect(checkOnScreen(g, laptop).verdict).toBe("SCREEN TOO SMALL");
  });

  test("the cap: 10 deg right on a 13-inch laptop is tight above, fine on a 27-inch", () => {
    const t = crowding([{ eccentricityDeg: 10, side: "right" }]);
    const g = conditionGeometry(t, 0);
    const small = checkOnScreen(g, screenByName("13-inch laptop"));
    expect(small.verdict).toBe("TIGHT");
    expect(small.note).toContain("room above");
    expect(checkOnScreen(g, screenByName("27-inch monitor")).verdict).toBe(
      "OK",
    );
  });

  test("acuity at the fovea: single letter, floor from targetMinPhysicalPx", () => {
    const t = build({
      recipe: "letter-acuity",
      name: "acuity",
      conditions: [{ eccentricityDeg: 0 }],
      blocks: "separate",
      trials: 35,
    });
    const g = conditionGeometry(t, 0);
    expect(g.thresholdParameter).toBe("targetSizeDeg");
    const laptop = screenByName("13-inch laptop");
    const r = testableRange(g, laptop);
    // 8 physical px / dpr 2 = 4 CSS px wide ≈ 0.09 deg at 50 px/cm, 50 cm.
    expect(r.minDeg).toBeCloseTo(
      (Math.atan(4 / (laptop.widthPx / laptop.widthCm) / 50) * 180) / Math.PI,
      2,
    );
    // Expected 0.1 deg against that floor: 20/20 letters need distance.
    expect(checkOnScreen(g, laptop).verdict).toBe("TIGHT");
    expect(checkOnScreen(conditionGeometry(t, 0, 300), laptop).verdict).toBe(
      "OK",
    );
  });
});

/* ------------------------------------------------------------------ */
/* feasibility report and skill                                        */
/* ------------------------------------------------------------------ */

describe("feasibility report", () => {
  test("covers each condition on each screen with an overall verdict", () => {
    const t = crowding([
      { eccentricityDeg: 5, side: "right" },
      { eccentricityDeg: 5, side: "left" },
    ]);
    const r = feasibilityReport(t, "crowding-test");
    expect(r.isError).toBe(false);
    expect(r.text).toContain("FEASIBILITY — crowding-test");
    expect(r.text).toContain("Column C");
    expect(r.text).toContain("Column D");
    for (const s of SCREENS) expect(r.text).toContain(`${s.name}:`);
    expect(r.text).toMatch(/Session: about \d+ min/);
    expect(r.text).toMatch(/Overall: (OK|TIGHT)/);
  });

  test("honors screen, viewingDistanceCm and conditions inputs", () => {
    const t = crowding([
      { eccentricityDeg: 5, side: "right" },
      { eccentricityDeg: 10, side: "right" },
    ]);
    const r = feasibilityReport(t, "x", {
      screen: {
        name: "lab monitor",
        widthPx: 1920,
        heightPx: 1080,
        widthCm: 60,
        heightCm: 34,
      },
      viewingDistanceCm: 40,
      conditions: ["d"],
    });
    expect(r.text).toContain("lab monitor:");
    expect(r.text).not.toContain("13-inch laptop:");
    expect(r.text).not.toContain("Column C");
    expect(r.text).toContain("Column D");
    expect(r.text).toContain("viewing distance 40 cm");
  });

  test("rejects bad input and unknown presets", () => {
    const t = crowding([{ eccentricityDeg: 5, side: "right" }]);
    expect(feasibilityReport(t, "x", { screens: ["projector"] }).isError).toBe(
      true,
    );
    expect(feasibilityReport(t, "x", { viewingDistanceCm: -3 }).isError).toBe(
      true,
    );
    expect(feasibilityReport(t, "x", { conditions: ["Z"] }).isError).toBe(true);
    // One bad preset among good ones is reported, not fatal.
    const r = feasibilityReport(t, "x", {
      screens: ["projector", "24-inch monitor"],
    });
    expect(r.isError).toBe(false);
    expect(r.text).toContain("Ignored:");
  });

  test("skips non-letter conditions and says so", () => {
    const t = matrixToState([
      ["block", "", "1"],
      ["conditionTrials", "", "10"],
      ["targetKind", "", "reading"],
    ]);
    const r = feasibilityReport(t, "reading");
    expect(r.text).toContain("Skipped: column C (targetKind reading");
    expect(r.text).toContain("No letter condition to check");
  });

  test("runs as a skill tool", async () => {
    const t = crowding([{ eccentricityDeg: 5, side: "right" }]);
    const out = await feasibilitySkill.run(
      "check_feasibility",
      {},
      ctx(t, "crowding-test"),
    );
    expect(out.isError).toBeFalsy();
    expect(out.result).toContain("FEASIBILITY — crowding-test");
    expect(out.activity).toMatch(/^Checked feasibility · /);
    expect(out.table).toBeUndefined();
    const bad = await feasibilitySkill.run("nope", {}, ctx(t));
    expect(bad.isError).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* methods writer                                                      */
/* ------------------------------------------------------------------ */

describe("methods writer", () => {
  test("study_facts resolves defaults and groups by block", () => {
    const t = crowding([
      { eccentricityDeg: 5, side: "right" },
      { eccentricityDeg: 10, side: "right" },
    ]);
    const text = studyFacts(t, "crowding-test");
    expect(text).toContain("STUDY FACTS — crowding-test");
    expect(text).toContain("Block 1 — one condition (C), 35 trials");
    expect(text).toContain("Block 2 — one condition (D), 35 trials");
    expect(text).toContain("Column C — target 5 deg right");
    expect(text).toContain("thresholdBeta 2.3*");
    expect(text).toContain("viewingDistanceDesiredCm 50*");
    expect(text).toContain("thresholdParameter spacingDeg");
    expect(text).toContain("spacingOverSizeRatio 1.4");
    expect(text).not.toContain("spacingOverSizeRatio 1.4*");
    expect(text).toContain("calibrateScreenSizeBool TRUE*");
    expect(text).toMatch(/estimated session \d+ min/);
    // Nothing with no value at all appears.
    expect(text).not.toMatch(/\bconditionName\s*;/);
  });

  test("interleaved blocks and disabled columns", () => {
    const t = crowding(
      [
        { eccentricityDeg: 5, side: "right" },
        { eccentricityDeg: 5, side: "left" },
      ],
      { blocks: "interleaved" },
    );
    const rows = t.rows.slice();
    rows.push({
      id: 9999,
      name: "conditionEnabledBool",
      values: ["", "", "FALSE"],
    });
    const text = studyFacts({ ...t, rows }, "x");
    expect(text).toContain("Block 1 — one condition (C), 35 trials");
    expect(text).toContain("1 disabled column omitted");
  });

  test("reading conditions report reading parameters", () => {
    const t = matrixToState([
      ["block", "", "1"],
      ["conditionTrials", "", "4"],
      ["targetKind", "", "reading"],
      ["readingCorpus", "", "book.txt"],
      ["readingPages", "", "4"],
    ]);
    const text = studyFacts(t, "reading");
    expect(text).toContain("readingCorpus book.txt");
    expect(text).toContain("readingLinesPerPage 4*");
    expect(text).not.toContain("spacingDirection");
  });

  test("runs as a skill tool", async () => {
    const t = crowding([{ eccentricityDeg: 5, side: "right" }]);
    const out = await methodsSkill.run(
      "study_facts",
      {},
      ctx(t, "crowding-test"),
    );
    expect(out.isError).toBeFalsy();
    expect(out.result).toContain("STUDY FACTS — crowding-test");
    expect(out.table).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* methods document                                                    */
/* ------------------------------------------------------------------ */

const SECTIONS = {
  participants:
    "[N] observers ([age range]) with [normal or corrected-to-normal vision] took part after giving informed consent. The study was approved by [ethics approval].",
  apparatus:
    "The experiment ran in the participant's web browser using EasyEyes. Each participant calibrated screen size by matching an on-screen rectangle to a credit card. The nominal viewing distance was 50 cm.",
  stimuli:
    "Stimuli were Sloan letters (DHKNORSVZ) in Roboto Mono, black on a light gray background, presented for 150 ms at 5 deg in the right visual field (Table 1).",
  procedure:
    "Each trial began with a fixation cross. The participant clicked the cross, the stimulus appeared briefly, and the participant identified the target letter. QUEST varied the spacing to estimate the 70% correct threshold over 35 trials per condition.",
  analysis:
    "The dependent measure was the crowding distance in deg, estimated as QUEST's final threshold estimate, analyzed in log units.",
};

const FIXED_DATE = new Date(2026, 9, 10);

describe("methods document", () => {
  test("the model: title block, note, five sections in order, Table 1, blanks, colophon", () => {
    const t = crowding([
      { eccentricityDeg: 5, side: "right" },
      { eccentricityDeg: 10, side: "right" },
    ]);
    const doc = methodsDocument(t, "crowding-test", SECTIONS, FIXED_DATE);
    expect(doc.title).toBe("crowding-test");
    expect(doc.authors).toBe("");
    expect(doc.about).toBe("Letter crowding measured with QUEST.");
    expect(doc.note).toContain(
      "from the experiment file “crowding-test” on October 10, 2026",
    );
    expect(doc.sections.map((s) => s.heading)).toEqual([
      "Participants",
      "Apparatus",
      "Stimuli",
      "Procedure",
      "Design and analysis",
    ]);
    expect(doc.sections[0].paragraphs).toEqual([SECTIONS.participants]);
    expect(doc.table.head).toEqual([
      "Block",
      "Condition",
      "Target",
      "Task",
      "Eccentricity x, y (deg)",
      "Varied by QUEST",
      "Flankers",
      "Duration (s)",
      "Trials",
      "Distance (cm)",
    ]);
    expect(doc.table.rows).toEqual([
      [
        "1",
        "crowding 5deg right",
        "letter",
        "identify",
        "5, 0",
        "spacing (deg)",
        "radial",
        "0.15",
        "35",
        "50",
      ],
      [
        "2",
        "crowding 10deg right",
        "letter",
        "identify",
        "10, 0",
        "spacing (deg)",
        "radial",
        "0.15",
        "35",
        "50",
      ],
    ]);
    expect(doc.blanks).toEqual([
      "Authors",
      "Affiliations",
      "N",
      "age range",
      "normal or corrected-to-normal vision",
      "ethics approval",
    ]);
    expect(doc.colophon).toMatch(
      /^Draft · EasyEyes Studio · crowding-test · 2 conditions in 2 blocks · estimated session \d+ min · October 10, 2026$/,
    );
    expect(METHODS_SECTIONS).toEqual([
      "participants",
      "apparatus",
      "stimuli",
      "procedure",
      "analysis",
    ]);
  });

  test("the page: self-contained HTML in a fixed order, with blanks marked", () => {
    const t = crowding([{ eccentricityDeg: 5, side: "right" }]);
    const html = composeMethods(t, "crowding-test", SECTIONS, FIXED_DATE);
    const order = [
      "<!doctype html>",
      "<style>",
      "@media print",
      '<article class="page">',
      '<p class="kicker">Methods · Draft</p>',
      "<h1>crowding-test</h1>",
      '<p class="authors"><mark class="blank">[Authors]</mark></p>',
      '<p class="affiliations"><mark class="blank">[Affiliations]</mark></p>',
      '<p class="about">Letter crowding measured with QUEST.</p>',
      '<p class="note">Draft generated by EasyEyes Studio',
      "<h2>Methods</h2>",
      "<h3>Participants</h3>",
      '<p><mark class="blank">[N]</mark> observers (<mark class="blank">[age range]</mark>)',
      "<h3>Apparatus</h3>",
      "<h3>Stimuli</h3>",
      "<h3>Procedure</h3>",
      "<h3>Design and analysis</h3>",
      '<figure class="table">',
      "<figcaption><b>Table 1.</b> Conditions of the experiment, by block.",
      '<th class="num">Block</th><th>Condition</th>',
      '<tr><td class="num">1</td><td>crowding 5deg right</td><td>letter</td><td>identify</td><td class="num">5, 0</td><td>spacing (deg)</td><td>radial</td><td class="num">0.15</td><td class="num">35</td><td class="num">50</td></tr>',
      '<section class="todo">',
      "<li>Authors</li><li>Affiliations</li><li>N</li>",
      '<p class="check">Then read the draft against the experiment file',
      "<footer>Draft · EasyEyes Studio · crowding-test · 1 condition in 1 block",
      "</html>",
    ];
    let pos = -1;
    for (const needle of order) {
      const at = html.indexOf(needle, pos + 1);
      if (at <= pos) throw new Error(`Out of order or missing: ${needle}`);
      pos = at;
    }
    // No external resources: the file stands alone.
    expect(html).not.toMatch(/<link|<script|src=/);
  });

  test("escapes the scientist's text and marks empty cells", () => {
    const t = matrixToState([
      ["block", "", "1"],
      ["conditionTrials", "", "4"],
      ["conditionName", "", 'a<b & "c"'],
      ["targetKind", "", "reading"],
      ["readingCorpus", "", "book.txt"],
    ]);
    const html = composeMethods(
      t,
      "x",
      {
        ...SECTIONS,
        stimuli: "Text with <tags> & ampersands; see Table 1 for [the corpus].",
      },
      FIXED_DATE,
    );
    expect(html).toContain("<td>a&lt;b &amp; &quot;c&quot;</td>");
    expect(html).toContain("Text with &lt;tags&gt; &amp; ampersands");
    expect(html).toContain('<td class="num none">—</td>');
    expect(html).toContain("<li>the corpus</li>");
  });

  test("uses the authors and title; a single-letter acuity row", () => {
    const t = build({
      recipe: "letter-acuity",
      name: "acuity",
      conditions: [{ eccentricityDeg: 0 }],
      blocks: "separate",
      trials: 40,
    });
    const rows = [
      ...t.rows,
      { id: 9001, name: "_authors", values: ["A. Author; B. Author", ""] },
      { id: 9002, name: "_authorAffiliations", values: ["NYU", ""] },
    ];
    const doc = methodsDocument(
      { ...t, rows },
      "acuity",
      { ...SECTIONS, title: "Foveal letter acuity" },
      FIXED_DATE,
    );
    expect(doc.title).toBe("Foveal letter acuity");
    expect(doc.authors).toBe("A. Author; B. Author");
    expect(doc.blanks).not.toContain("Authors");
    expect(doc.table.rows).toEqual([
      [
        "1",
        "acuity fovea",
        "letter",
        "identify",
        "0, 0",
        "letter size (deg)",
        "none",
        "0.15",
        "40",
        "50",
      ],
    ]);
    const html = renderMethodsHtml(doc);
    expect(html).toContain(
      "<title>Foveal letter acuity — Methods (draft)</title>",
    );
    expect(html).toContain('<p class="authors">A. Author; B. Author</p>');
  });

  test("strips stray headings from the model's prose and splits paragraphs", () => {
    const t = crowding([{ eccentricityDeg: 5, side: "right" }]);
    const doc = methodsDocument(
      t,
      "x",
      {
        ...SECTIONS,
        participants: `### Participants\n\n[N] participants took part.\nThey were paid.\n\nA second paragraph, with [N] again and [age range].`,
      },
      FIXED_DATE,
    );
    expect(doc.sections[0].paragraphs).toEqual([
      "[N] participants took part. They were paid.",
      "A second paragraph, with [N] again and [age range].",
    ]);
    expect(doc.blanks).toEqual(["Authors", "Affiliations", "N", "age range"]);
    expect(bracketedBlanks("[a] and [b] and [a]")).toEqual(["a", "b"]);
  });

  test("write_methods returns the file; refuses missing sections", async () => {
    const t = crowding([{ eccentricityDeg: 5, side: "right" }]);
    const out = await methodsSkill.run(
      "write_methods",
      SECTIONS,
      ctx(t, "Crowding Test"),
    );
    expect(out.isError).toBeFalsy();
    expect(out.file.name).toBe("crowding-test-methods-draft.html");
    expect(out.file.mime).toBe("text/html");
    expect(out.file.title).toBe("Methods draft — Crowding Test");
    // Authors, affiliations, and the four bracketed blanks in the prose.
    expect(out.file.subtitle).toMatch(
      /^\d+ words · 6 blanks to complete · check before use$/,
    );
    expect(out.file.content).toContain("<h2>Methods</h2>");
    expect(out.result).toContain("do not repeat its text");
    expect(out.result).toContain("a draft to check");
    expect(out.table).toBeUndefined();

    const bad = await methodsSkill.run(
      "write_methods",
      { ...SECTIONS, stimuli: "short", analysis: undefined },
      ctx(t),
    );
    expect(bad.isError).toBe(true);
    expect(bad.result).toContain("stimuli, analysis");
    expect(bad.file).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/* registry                                                            */
/* ------------------------------------------------------------------ */

describe("skills registry", () => {
  test("both skills are registered with distinct triggers and tools", () => {
    const ids = SKILLS.map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining(["feasibility", "methods", "code"]),
    );
    const triggers = SKILLS.map((s) => s.trigger);
    expect(new Set(triggers).size).toBe(triggers.length);
    const tools = SKILLS.flatMap((s) => [...s.toolNames]);
    expect(new Set(tools).size).toBe(tools.length);
    expect(parseSkillTrigger("/feasibility will this fit?")).toEqual({
      text: "will this fit?",
      skill: feasibilitySkill,
    });
    expect(parseSkillTrigger("/methods").skill).toBe(methodsSkill);
  });

  test("the menu lists the runnable skills; code lookup stays trigger-only", () => {
    expect(MENU_SKILLS.map((s) => s.id)).toEqual(["feasibility", "methods"]);
    for (const s of MENU_SKILLS) expect(s.prompt).toBeTruthy();
    expect(SKILLS.find((s) => s.id === "code").menu).toBe(false);
  });

  test("Run sends the trigger with the prompt, or with the draft", () => {
    expect(runMessage(methodsSkill, "")).toBe(
      "/methods Draft the Methods section for this study.",
    );
    expect(runMessage(methodsSkill, " / ")).toBe(
      "/methods Draft the Methods section for this study.",
    );
    expect(runMessage(feasibilitySkill, "on a 27-inch monitor at 70 cm")).toBe(
      "/feasibility on a 27-inch monitor at 70 cm",
    );
    // What Run sends parses back to the skill and its prompt.
    const parsed = parseSkillTrigger(runMessage(feasibilitySkill, ""));
    expect(parsed.skill).toBe(feasibilitySkill);
    expect(parsed.text).toBe(feasibilitySkill.prompt);
  });

  test("system blocks are plain text", async () => {
    for (const s of [feasibilitySkill, methodsSkill]) {
      const b = await s.systemBlock();
      expect(b.type).toBe("text");
      expect(b.text).toContain("(on)");
      expect(b.cache_control).toBeUndefined();
    }
  });
});
