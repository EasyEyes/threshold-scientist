// The Study Builder (source/studio/builder): every recipe, across the spec
// variants scientists actually ask for, must produce a table the PRODUCTION
// compiler checks accept — with the real glossary. Knobs must keep a table
// compile-clean too. This is the guarantee that lets the assistant hand the
// model a compact spec instead of a table.

import { loadGlossaryForTests } from "../../threshold/tests/helpers/glossary";
import { runValidation } from "../studio/validation";
import { getEntry } from "../studio/glossary";
import { stateToMatrix } from "../studio/tableModel";
import {
  buildStudy,
  isBuildFailure,
  KNOBS,
  knobById,
  RECIPES,
  isKnobFailure,
} from "../studio/builder";

jest.setTimeout(60000);

beforeAll(async () => {
  await loadGlossaryForTests();
});

const errorsOf = (table) =>
  runValidation(stateToMatrix(table)).errors.filter((e) => e.kind === "error");

const describeErrors = (errors) =>
  errors
    .map((e) => `${e.name}: ${e.message.replace(/<[^>]+>/g, "")}`)
    .join("\n");

const build = (spec) => {
  const r = buildStudy(spec);
  if (isBuildFailure(r)) throw new Error(r.error);
  return r;
};

const expectClean = (table, label) => {
  const errors = errorsOf(table);
  if (errors.length)
    throw new Error(
      `${label}: ${errors.length} compiler error(s)\n${describeErrors(errors)}`,
    );
};

const cell = (table, name, ci) =>
  table.rows.find((r) => r.name === name)?.values[ci + 1];
const cellB = (table, name) =>
  table.rows.find((r) => r.name === name)?.values[0];

describe("the guard itself", () => {
  test("the real checks do reject a broken table", () => {
    const t = build({
      recipe: "letter-crowding",
      conditions: [
        {
          eccentricityDeg: 0,
          set: { spacingDirection: "radial", notAParameter: "1" },
        },
      ],
    }).table;
    const errors = errorsOf(t);
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(describeErrors(errors)).toMatch(/flanker|undefined at/i);
    expect(describeErrors(errors)).toMatch(/unrecognized/i);
  });
});

describe("recipes compile clean", () => {
  test.each(RECIPES.map((r) => [r.id, r]))("%s — defaults", (id, recipe) => {
    const r = build({ recipe: id });
    expectClean(r.table, `${id} defaults`);
    expect(r.name).toBe(id);
    // House rule: every template states paper as its distance-calibration method.
    expect(cellB(r.table, "_calibrateDistance")).toBe("paper");
  });

  // House rule (recipes/types.ts): every value a recipe writes is either from
  // a bundled example study or a glossary default a scientist expects to see;
  // categorical values must be ones the glossary lists, and every recipe
  // explains its non-obvious choices so the assistant can pass them on.
  test.each(RECIPES.map((r) => [r.id, r]))(
    "%s — values are glossary-legal and explained",
    (id, recipe) => {
      expect(Array.isArray(recipe.rationale)).toBe(true);
      expect(recipe.rationale.length).toBeGreaterThan(0);
      const t = build({ recipe: id }).table;
      for (const row of t.rows) {
        if (row.name.startsWith("_") || /^questionAndAnswer\d+$/.test(row.name))
          continue;
        const entry = getEntry(row.name);
        expect(entry).toBeDefined();
        const allowed = entry.categories;
        if (
          Array.isArray(allowed) &&
          allowed.length &&
          !["conditionName", "font", "fontCharacterSet"].includes(row.name)
        )
          for (const v of row.values.slice(1))
            if (v !== "") expect(allowed).toContain(v);
      }
      expect(build({ recipe: id }).summary).toContain("Choices to mention");
    },
  );

  test("distanceMethod in the spec overrides paper", () => {
    const r = build({
      recipe: "letter-acuity",
      trackDistance: true,
      distanceMethod: "blindspot",
    });
    expect(cellB(r.table, "_calibrateDistance")).toBe("blindspot");
    expectClean(r.table, "blindspot");
  });

  test.each(RECIPES.map((r) => [r.id, r]))(
    "%s — its own example",
    (id, recipe) => {
      const r = build(recipe.example);
      expectClean(r.table, `${id} example`);
    },
  );

  test("every recipe has the fields the builder relies on", () => {
    const ids = new Set();
    for (const r of RECIPES) {
      expect(r.id).toMatch(/^[a-z0-9-]+$/);
      expect(ids.has(r.id)).toBe(false);
      ids.add(r.id);
      expect(r.summary.length).toBeGreaterThan(20);
      expect(r.example.recipe).toBe(r.id);
      expect(Array.isArray(r.keywords)).toBe(true);
    }
  });
});

describe("spec variants", () => {
  const variants = [
    [
      "crowding, sides and eccentricities, interleaved",
      {
        recipe: "letter-crowding",
        conditions: [
          { eccentricityDeg: 5, side: "left" },
          { eccentricityDeg: 5, side: "right" },
          { eccentricityDeg: 10, side: "left" },
          { eccentricityDeg: 10, side: "right" },
        ],
        trials: 40,
      },
    ],
    [
      "crowding at the fovea gets horizontal flankers",
      { recipe: "letter-crowding", conditions: [{ eccentricityDeg: 0 }] },
    ],
    [
      "crowding, tangential requested at the fovea maps to vertical",
      {
        recipe: "letter-crowding",
        conditions: [{ eccentricityDeg: 0, spacingDirection: "tangential" }],
      },
    ],
    [
      "crowding, vertical requested in the periphery maps to tangential",
      {
        recipe: "letter-crowding",
        conditions: [
          { eccentricityDeg: 8, side: "up", spacingDirection: "vertical" },
        ],
      },
    ],
    [
      "crowding with questions before and after, tracking, forms, id",
      {
        recipe: "letter-crowding",
        name: "full study",
        conditions: [
          { eccentricityDeg: 5, side: "right" },
          { eccentricityDeg: 10, side: "right" },
          { eccentricityDeg: 0, threshold: "targetSizeDeg" },
        ],
        trials: 35,
        blocks: "separate",
        questionsBefore: [
          { nickname: "AGE", question: "What is your age?" },
          {
            nickname: "GLASSES",
            question: "Do you wear glasses?",
            answers: ["Yes", "No"],
          },
        ],
        questionsAfter: [{ question: "Any comments?" }],
        screenSizeCalibration: true,
        trackDistance: true,
        distanceMethod: "creditCard",
        consentForm: "consent.pdf",
        debriefForm: "debrief.pdf",
        participantId: true,
        language: "it",
        recruitment: "Prolific",
        viewingDistanceCm: 60,
      },
    ],
    [
      "blocks bySide",
      {
        recipe: "letter-crowding",
        blocks: "bySide",
        conditions: [
          { eccentricityDeg: 5, side: "left" },
          { eccentricityDeg: 10, side: "right" },
          { eccentricityDeg: 10, side: "left" },
          { eccentricityDeg: 5, side: "right" },
        ],
      },
    ],
    [
      "blocks byEccentricity",
      {
        recipe: "letter-acuity",
        blocks: "byEccentricity",
        conditions: [
          { eccentricityDeg: 5, side: "left" },
          { eccentricityDeg: 10, side: "right" },
          { eccentricityDeg: 10, side: "left" },
          { eccentricityDeg: 5, side: "right" },
        ],
      },
    ],
    [
      "explicit blocks, out of order, made dense",
      {
        recipe: "letter-acuity",
        conditions: [
          { eccentricityDeg: 0, block: 7 },
          { eccentricityDeg: 5, block: 2 },
          { eccentricityDeg: 10, block: 7 },
        ],
      },
    ],
    [
      "numbers as strings",
      {
        recipe: "letter-crowding",
        trials: "20",
        conditions: [
          { eccentricityDeg: "7.5", side: "left", durationSec: "0.2" },
        ],
        viewingDistanceCm: "45",
        trackDistance: "true",
      },
    ],
    [
      "acuity near and far via set",
      {
        recipe: "letter-acuity",
        blocks: "separate",
        conditions: [
          { name: "near 40 cm", set: { viewingDistanceDesiredCm: "40" } },
          { name: "far 200 cm", set: { viewingDistanceDesiredCm: "200" } },
        ],
      },
    ],
    [
      "reading at three sizes",
      {
        recipe: "reading",
        blocks: "separate",
        conditions: [
          { sizeDeg: 0.5 },
          { sizeDeg: 1 },
          { sizeDeg: 2, pages: 6, comprehensionQuestions: 4 },
        ],
      },
    ],
    [
      "rsvp with more words, peripheral",
      {
        recipe: "rsvp-reading",
        conditions: [
          { wordsPerTrial: 3 },
          { wordsPerTrial: 5, eccentricityDeg: 5, side: "right" },
        ],
      },
    ],
    [
      "repeated letters with a sloan font file",
      {
        recipe: "repeated-letters",
        font: "Pelli.woff2",
        conditions: [{ characterSet: "123456789" }],
      },
    ],
    [
      "questionnaire with quiz-style correct answer",
      {
        recipe: "questionnaire",
        questionsBefore: [
          {
            nickname: "FRUIT",
            question: "Which is a fruit?",
            answers: ["house", "apple", "sky"],
            correct: "apple",
          },
          { question: "Describe your vision." },
        ],
      },
    ],
    [
      "setAll and set",
      {
        recipe: "letter-crowding",
        setAll: { showConditionNameBool: "TRUE" },
        set: { _needBrowser: "Chrome,Edge", _authorEmails: "a@b.edu" },
      },
    ],
  ];

  test.each(variants)("%s", (label, spec) => {
    const r = build(spec);
    expectClean(r.table, label);
    expect(r.summary).toContain(r.recipe.title);
  });

  test("color management: precision on, P3, colorimeter, contrasts in the names", () => {
    const r = build({
      recipe: "color-management",
      conditions: [
        { contrast: -1 },
        { contrast: -0.1 },
        { contrast: -0.03, eccentricityDeg: 5, side: "right" },
      ],
      colorSpace: "display-p3",
      colorimeter: true,
    });
    expectClean(r.table, "color management");
    expect(cellB(r.table, "_screenColorSpace")).toBe("display-p3");
    expect(cellB(r.table, "_screenFloat16Bool")).toBe("TRUE");
    expect(cellB(r.table, "_screenDitherBool")).toBe("TRUE");
    expect(cellB(r.table, "_screenMeasurePrecision")).toBe("test2Digits");
    expect(cellB(r.table, "_screenColorCheckBool")).toBe("TRUE");
    expect(cellB(r.table, "_needColorimeterBool")).toBe("TRUE");
    expect(cell(r.table, "screenColorRGBA", 0)).toBe("0.5, 0.5, 0.5, 1");
    expect(cell(r.table, "targetContrast", 1)).toBe("-0.1");
    expect(cell(r.table, "thresholdParameter", 1)).toBe("targetSizeDeg");
    // Fainter letters get a larger acuity prior.
    expect(Number(cell(r.table, "thresholdGuess", 1))).toBeGreaterThan(
      Number(cell(r.table, "thresholdGuess", 0)),
    );
    expect(cell(r.table, "conditionName", 1)).toBe(
      "acuity fovea contrast -0.1",
    );
    expect(cell(r.table, "conditionName", 2)).toBe(
      "acuity 5deg right contrast -0.03",
    );
    // The display fields work on any recipe.
    const crowd = build({
      recipe: "letter-crowding",
      highPrecision: true,
      colorSpace: "display-p3",
    });
    expectClean(crowd.table, "crowding in P3");
    expect(cellB(crowd.table, "_screenDitherBool")).toBe("TRUE");
    expect(cellB(crowd.table, "_screenColorSpace")).toBe("display-p3");
    expect(cellB(crowd.table, "_screenMeasurePrecision")).toBeUndefined();
    // The precision test on its own brings float16 with it (compiler rule).
    const test8 = build({ recipe: "letter-acuity", measurePrecision: true });
    expectClean(test8.table, "precision test alone");
    expect(cellB(test8.table, "_screenFloat16Bool")).toBe("TRUE");
  });

  test("sound threshold: calibration, masker, noise, identify, headphones, folders reported", () => {
    const r = build({
      recipe: "sound-threshold",
      conditions: [
        { name: "tone alone", soundFolder: "Tones" },
        {
          soundFolder: "Tones",
          maskerFolder: "Melodies",
          maskerDBSPL: 45,
          noiseDBSPL: 10,
        },
        { soundFolder: "Words", task: "identify" },
      ],
      blocks: "separate",
    });
    expectClean(r.table, "sound threshold");
    expect(cellB(r.table, "_calibrateSound1000HzBool")).toBe("TRUE");
    expect(cellB(r.table, "_calibrateSoundAllHzBool")).toBe("TRUE");
    expect(cell(r.table, "targetKind", 0)).toBe("sound");
    expect(cell(r.table, "targetTask", 0)).toBe("detect");
    expect(cell(r.table, "thresholdGamma", 0)).toBe("0.5");
    expect(cell(r.table, "thresholdParameter", 0)).toBe("targetSoundDBSPL");
    expect(cell(r.table, "needSoundOutput", 0)).toBe("loudspeakers");
    expect(cell(r.table, "calibrateScreenSizeBool", 0)).toBe("FALSE");
    expect(cell(r.table, "maskerSoundFolder", 1)).toBe("Melodies");
    expect(cell(r.table, "maskerSoundDBSPL", 1)).toBe("45");
    expect(cell(r.table, "targetSoundNoiseDBSPL", 1)).toBe("10");
    expect(cell(r.table, "conditionName", 1)).toBe("sound in Melodies");
    expect(cell(r.table, "targetTask", 2)).toBe("identify");
    expect(cell(r.table, "thresholdGamma", 2)).toBe("");
    expect(cell(r.table, "conditionName", 2)).toBe("sound identify");
    expect(cell(r.table, "block", 2)).toBe("3");
    expect(r.notes.join(" ")).toMatch(/sound folder Tones\.zip/);
    expect(r.notes.join(" ")).toMatch(/sound folder Melodies\.zip/);
    const quiet = build({
      recipe: "sound-threshold",
      soundCalibration: false,
      soundOutput: "headphones",
    });
    expectClean(quiet.table, "sound uncalibrated");
    expect(cellB(quiet.table, "_calibrateSound1000HzBool")).toBe("FALSE");
    expect(cell(quiet.table, "needSoundOutput", 0)).toBe("headphones");
  });

  test("shape: crowding at 5 and 10 deg right, questions first", () => {
    const r = build({
      recipe: "letter-crowding",
      name: "Sloan crowding",
      conditions: [
        { eccentricityDeg: 5, side: "right" },
        { eccentricityDeg: 10, side: "right" },
      ],
      trials: 35,
      questionsBefore: [
        { nickname: "AGE", question: "What is your age?" },
        {
          nickname: "GLASSES",
          question: "Do you wear glasses?",
          answers: ["Yes", "No"],
        },
      ],
      trackDistance: true,
    });
    const t = r.table;
    expect(r.name).toBe("Sloan-crowding");
    expect(t.conditionCount).toBe(3);
    // Column C is the questionnaire, its own block.
    expect(cell(t, "block", 0)).toBe("1");
    expect(cell(t, "targetTask", 0)).toBe("questionAndAnswer");
    expect(cell(t, "questionAndAnswer01", 0)).toBe("AGE||What is your age?");
    expect(cell(t, "questionAndAnswer02", 0)).toBe(
      "GLASSES||Do you wear glasses?|Yes|No",
    );
    // D and E interleave in block 2.
    expect(cell(t, "block", 1)).toBe("2");
    expect(cell(t, "block", 2)).toBe("2");
    expect(cell(t, "targetEccentricityXDeg", 1)).toBe("5");
    expect(cell(t, "targetEccentricityXDeg", 2)).toBe("10");
    expect(cell(t, "conditionName", 1)).toBe("crowding 5deg right");
    expect(cell(t, "conditionTrials", 2)).toBe("35");
    expect(cell(t, "spacingDirection", 1)).toBe("radial");
    expect(cell(t, "calibrateDistanceBool", 1)).toBe("TRUE");
    // Rows alphabetical, underscore first.
    const names = t.rows.map((x) => x.name.toLowerCase());
    expect([...names].sort()).toEqual(names);
    expectClean(t, "shape");
  });

  test("fovea crowding uses horizontal flankers; left is negative x", () => {
    const t = build({
      recipe: "letter-crowding",
      conditions: [
        { eccentricityDeg: 0 },
        { eccentricityDeg: -5 },
        { eccentricityDeg: 3, side: "up" },
      ],
    }).table;
    expect(cell(t, "spacingDirection", 0)).toBe("horizontal");
    expect(cell(t, "targetEccentricityXDeg", 1)).toBe("-5");
    expect(cell(t, "conditionName", 1)).toBe("crowding 5deg left");
    expect(cell(t, "targetEccentricityYDeg", 2)).toBe("3");
    expect(cell(t, "conditionName", 2)).toBe("crowding 3deg up");
  });

  test("unknown recipe and empty studies are refused", () => {
    expect(buildStudy({ recipe: "nope" })).toMatchObject({
      error: expect.stringContaining("letter-crowding"),
    });
    expect(
      buildStudy({ recipe: "questionnaire", questionsBefore: [] }),
    ).toMatchObject({
      error: expect.stringContaining("at least one"),
    });
  });

  test("fields a recipe does not read are reported, not silently dropped", () => {
    const r = build({ recipe: "letter-acuity", conditions: [{ sizeDeg: 2 }] });
    expect(r.notes.join(" ")).toContain("sizeDeg");
  });
});

describe("knobs keep the table clean", () => {
  const base = () =>
    build({
      recipe: "letter-crowding",
      conditions: [
        { eccentricityDeg: 5, side: "right" },
        { eccentricityDeg: 10, side: "right" },
      ],
    }).table;

  const turn = (table, id, args) => {
    const r = knobById(id).apply(table, args);
    if (isKnobFailure(r)) throw new Error(`${id}: ${r.error}`);
    return r;
  };

  test("every knob has an id, summary and args", () => {
    for (const k of KNOBS) {
      expect(k.id).toMatch(/^[a-z_]+$/);
      expect(k.summary.length).toBeGreaterThan(10);
      expect(Array.isArray(k.args)).toBe(true);
    }
  });

  test("set_eccentricity to the fovea fixes the flankers", () => {
    const r = turn(base(), "set_eccentricity", {
      columns: ["C"],
      eccentricityDeg: 0,
    });
    expect(cell(r.table, "targetEccentricityXDeg", 0)).toBe("0");
    expect(cell(r.table, "spacingDirection", 0)).toBe("horizontal");
    expect(cell(r.table, "spacingDirection", 1)).toBe("radial");
    expect(r.changed).toContain("spacingDirection");
    expectClean(r.table, "set_eccentricity fovea");
  });

  test("set_eccentricity by condition name, to the left", () => {
    const r = turn(base(), "set_eccentricity", {
      columns: ["crowding 10deg right"],
      eccentricityDeg: 12,
      side: "left",
    });
    expect(cell(r.table, "targetEccentricityXDeg", 1)).toBe("-12");
    expectClean(r.table, "set_eccentricity left");
  });

  test("set_trials all", () => {
    const r = turn(base(), "set_trials", { trials: 50 });
    expect(cell(r.table, "conditionTrials", 0)).toBe("50");
    expect(cell(r.table, "conditionTrials", 1)).toBe("50");
    expectClean(r.table, "set_trials");
  });

  test("set_blocks separate then interleaved", () => {
    let r = turn(base(), "set_blocks", { mode: "separate" });
    expect([cell(r.table, "block", 0), cell(r.table, "block", 1)]).toEqual([
      "1",
      "2",
    ]);
    expectClean(r.table, "separate");
    r = turn(r.table, "set_blocks", { mode: "interleaved" });
    expect([cell(r.table, "block", 0), cell(r.table, "block", 1)]).toEqual([
      "1",
      "1",
    ]);
    expectClean(r.table, "interleaved");
  });

  test("add_condition copies, moves and names", () => {
    const r = turn(base(), "add_condition", {
      copyOf: "C",
      eccentricityDeg: 5,
      side: "left",
      spacingDirection: "tangential",
    });
    expect(r.table.conditionCount).toBe(3);
    expect(cell(r.table, "targetEccentricityXDeg", 1)).toBe("-5");
    expect(cell(r.table, "spacingDirection", 1)).toBe("tangential");
    expect(cell(r.table, "conditionName", 1)).toBe(
      "crowding 5deg left tangential",
    );
    expect(cell(r.table, "block", 1)).toBe("1");
    expectClean(r.table, "add_condition");
  });

  test("add_condition in a new block does not split the source block", () => {
    const r = turn(base(), "add_condition", {
      copyOf: "C",
      eccentricityDeg: 20,
      newBlock: true,
    });
    expect(r.table.conditionCount).toBe(3);
    expect([0, 1, 2].map((ci) => cell(r.table, "block", ci))).toEqual([
      "1",
      "1",
      "2",
    ]);
    expect(cell(r.table, "targetEccentricityXDeg", 2)).toBe("20");
    expectClean(r.table, "add_condition newBlock");
  });

  test("remove_condition renumbers", () => {
    const three = turn(base(), "set_blocks", { mode: "separate" }).table;
    const r = turn(three, "remove_condition", { columns: ["C"] });
    expect(r.table.conditionCount).toBe(1);
    expect(cell(r.table, "block", 0)).toBe("1");
    expectClean(r.table, "remove_condition");
  });

  test("mirror_conditions", () => {
    const r = turn(base(), "mirror_conditions", {});
    expect(r.table.conditionCount).toBe(4);
    expect(
      [0, 1, 2, 3].map((ci) => cell(r.table, "targetEccentricityXDeg", ci)),
    ).toEqual(["5", "-5", "10", "-10"]);
    expect(cell(r.table, "conditionName", 1)).toBe("crowding 5deg left");
    expectClean(r.table, "mirror");
  });

  test("add_questions before and after", () => {
    let r = turn(base(), "add_questions", {
      questions: [
        { nickname: "AGE", question: "Age?" },
        { question: "Glasses?", answers: ["Yes", "No"] },
      ],
    });
    expect(r.table.conditionCount).toBe(3);
    expect(cell(r.table, "block", 0)).toBe("1");
    expect(cell(r.table, "targetTask", 0)).toBe("questionAndAnswer");
    expect(cell(r.table, "questionAndAnswer02", 0)).toBe("Q2||Glasses?|Yes|No");
    expect([1, 2].map((ci) => cell(r.table, "block", ci))).toEqual(["2", "2"]);
    expectClean(r.table, "questions before");
    r = turn(r.table, "add_questions", {
      position: "after",
      questions: [{ question: "Comments?" }],
    });
    expect(cell(r.table, "block", 3)).toBe("3");
    expectClean(r.table, "questions after");
  });

  test("set_threshold to acuity and back re-derives the QUEST guess", () => {
    const crowdingGuess = cell(base(), "thresholdGuess", 1);
    let r = turn(base(), "set_threshold", { parameter: "targetSizeDeg" });
    expect(cell(r.table, "spacingRelationToSize", 0)).toBe("none");
    expect(cell(r.table, "thresholdGuess", 1)).not.toBe(crowdingGuess);
    expect(r.changed).toContain("thresholdGuess");
    expectClean(r.table, "acuity");
    r = turn(r.table, "set_threshold", { parameter: "spacingDeg" });
    expect(cell(r.table, "spacingRelationToSize", 0)).toBe("ratio");
    expect(cell(r.table, "thresholdGuess", 1)).toBe(crowdingGuess);
    expectClean(r.table, "crowding again");
  });

  test("set_eccentricity re-derives the QUEST guess", () => {
    const before = cell(base(), "thresholdGuess", 1);
    const r = turn(base(), "set_eccentricity", {
      columns: ["D"],
      eccentricityDeg: 20,
      side: "right",
    });
    expect(Number(cell(r.table, "thresholdGuess", 1))).toBeGreaterThan(
      Number(before),
    );
    expectClean(r.table, "set_eccentricity guess");
  });

  test("set_font infers the source; calibration, forms, id, language, about, viewing distance", () => {
    let t = turn(base(), "set_font", {
      font: "Sloan.woff2",
      characterSet: "DHKNORSVZ",
    }).table;
    expect(cell(t, "fontSource", 0)).toBe("file");
    t = turn(t, "set_font", { font: "Roboto Mono" }).table;
    expect(cell(t, "fontSource", 1)).toBe("google");
    t = turn(t, "set_calibration", {
      screenSize: true,
      trackDistance: true,
      distanceMethod: "creditCard",
    }).table;
    expect(cell(t, "calibrateDistanceBool", 1)).toBe("TRUE");
    expect(cellB(t, "_calibrateDistance")).toBe("creditCard");
    // A table that never stated a method gets paper when tracking is turned on.
    const bare = {
      ...t,
      rows: t.rows.filter((r) => r.name !== "_calibrateDistance"),
    };
    expect(
      cellB(
        turn(bare, "set_calibration", { trackDistance: true }).table,
        "_calibrateDistance",
      ),
    ).toBe("paper");
    t = turn(t, "set_forms", {
      consent: "consent.pdf",
      debrief: "debrief.pdf",
    }).table;
    t = turn(t, "set_participant_id", { enabled: true }).table;
    t = turn(t, "set_language", { code: "de" }).table;
    t = turn(t, "set_recruitment", { service: "Prolific" }).table;
    t = turn(t, "set_about", { about: "A study.", authors: "A; B" }).table;
    t = turn(t, "set_viewing_distance", { cm: 70 }).table;
    t = turn(t, "set_duration", { sec: 0.2 }).table;
    t = turn(t, "set_character_set", { characters: "DHKNORSVZ" }).table;
    t = turn(t, "set_spacing_direction", { direction: "tangential" }).table;
    t = turn(t, "rename_condition", { column: "C", name: "first" }).table;
    t = turn(t, "set_for_all", {
      parameter: "showConditionNameBool",
      value: "TRUE",
    }).table;
    t = turn(t, "set_for_all", {
      parameter: "_needBrowser",
      value: "Chrome",
    }).table;
    expect(cellB(t, "_language")).toBe("de");
    expect(cell(t, "conditionName", 0)).toBe("first");
    expect(cell(t, "spacingDirection", 0)).toBe("tangential");
    expectClean(t, "many knobs");
  });

  test("set_display on any table; set_sound on a sound table", () => {
    let t = turn(base(), "set_display", {
      colorSpace: "display-p3",
      highPrecision: true,
      backgroundGray: 0.5,
    }).table;
    expect(cellB(t, "_screenColorSpace")).toBe("display-p3");
    expect(cellB(t, "_screenFloat16Bool")).toBe("TRUE");
    expect(cellB(t, "_screenDitherBool")).toBe("TRUE");
    expect(cell(t, "screenColorRGBA", 1)).toBe("0.5, 0.5, 0.5, 1");
    t = turn(t, "set_display", { measurePrecision: true }).table;
    expect(cellB(t, "_screenMeasurePrecision")).toBe("test2Digits");
    // The precision test needs float16: turning precision off turns the test off too.
    t = turn(t, "set_display", { highPrecision: false }).table;
    expect(cellB(t, "_screenFloat16Bool")).toBe("FALSE");
    expect(cellB(t, "_screenMeasurePrecision")).toBe("assume8Bit");
    // …and asking for the test on an 8-bit table turns float16 on.
    t = turn(t, "set_display", { measurePrecision: true }).table;
    expect(cellB(t, "_screenFloat16Bool")).toBe("TRUE");
    expectClean(t, "display knobs");
    expect(
      knobById("set_display").apply(base(), { colorSpace: "cmyk" }),
    ).toMatchObject({ error: expect.any(String) });

    let s = build({ recipe: "sound-threshold" }).table;
    s = turn(s, "set_sound", { columns: ["C"], maskerFolder: "Babble" }).table;
    expect(cell(s, "maskerSoundFolder", 0)).toBe("Babble");
    expect(cell(s, "maskerSoundDBSPL", 0)).toBe("40");
    s = turn(s, "set_sound", {
      columns: ["D"],
      maskerFolder: "",
      task: "identify",
      soundOutput: "headphones",
    }).table;
    expect(cell(s, "maskerSoundFolder", 1)).toBe("");
    expect(cell(s, "maskerSoundDBSPL", 1)).toBe("");
    expect(cell(s, "targetTask", 1)).toBe("identify");
    expect(cell(s, "thresholdGamma", 1)).toBe("");
    expect(cell(s, "needSoundOutput", 1)).toBe("headphones");
    expect(cell(s, "needSoundOutput", 0)).toBe("headphones"); // one value per block
    s = turn(s, "set_sound", { soundCalibration: false, noiseDBSPL: 20 }).table;
    expect(cellB(s, "_calibrateSoundAllHzBool")).toBe("FALSE");
    expect(cell(s, "targetSoundNoiseDBSPL", 0)).toBe("20");
    expectClean(s, "sound knobs");
    expect(knobById("set_sound").apply(s, {})).toMatchObject({
      error: expect.any(String),
    });
  });

  test("bad arguments are errors, not crashes", () => {
    expect(knobById("set_trials").apply(base(), {})).toMatchObject({
      error: expect.any(String),
    });
    expect(
      knobById("set_eccentricity").apply(base(), { columns: ["Z"] }),
    ).toMatchObject({
      error: expect.stringContaining("No condition"),
    });
    expect(
      knobById("remove_condition").apply(base(), { columns: ["C", "D"] }),
    ).toMatchObject({
      error: expect.stringContaining("every"),
    });
    expect(
      knobById("set_blocks").apply(base(), { mode: "weird" }),
    ).toMatchObject({ error: expect.any(String) });
  });
});
