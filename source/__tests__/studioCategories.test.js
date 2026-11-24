// The Studio catalog's parameter groups (source/studio/categories.ts) and its
// view of the glossary registry (source/studio/glossary.ts): the rules that
// sort parameters into categories, the recommendations per experiment kind,
// and the version-keyed memoization that keeps them fresh.
import { loadGlossaryForTests } from "../../threshold/tests/helpers/glossary";
import {
  getGlossary,
  initGlossary,
} from "../../threshold/parameters/glossaryRegistry";
import {
  categoryOf,
  categoryOfEntry,
  getCategories,
  getPresetRecommendations,
  recommendedFor,
} from "../studio/categories";
import {
  glossaryVersion,
  isGlossaryReady,
  memoByVersion,
  parameterCount,
  resolveEntry,
  suggestibleEntries,
  superMatchingEntryFor,
} from "../studio/glossary";

jest.setTimeout(60000);

const entry = (name, type = "text") => ({ name, type });

describe("categoryOf: naming rules, first match wins", () => {
  it.each([
    ["_calibrateSoundSimulateLoudspeaker", "Calibration"], // before Sound
    ["_calibrateDistance", "Calibration"],
    ["calibrate", "Calibration"],
    ["_needPhoneBool", "Requirements (needs)"],
    ["_prolificInternalName", "Prolific recruitment"],
    ["_pavloviaNewExperimentBool", "Saving & logging"],
    ["_saveToDropboxBool", "Saving & logging"],
    ["saveAs", "Saving & logging"],
    ["_logTrialsBool", "Saving & logging"],
    ["_participants", "Saving & logging"],
    ["_session", "Saving & logging"],
    ["_language", "Language & phrases"],
    ["_phrasesSpreadsheet", "Language & phrases"],
    ["internationalPhraseName", "Language & phrases"],
    ["_timeout", "Timeouts"],
    ["_authors", "Study info & forms"],
    ["_about", "Study info & forms"],
    ["_date", "Study info & forms"],
    ["inviteResearcher", "Study info & forms"],
    ["_text", "Study info & forms"],
    ["_consentForm", "Study info & forms"],
    ["_debriefForm", "Study info & forms"],
    ["notes", "Study info & forms"],
    ["_work", "Study info & forms"],
    ["_can", "Study info & forms"],
    ["_debug", "Debugging & simulation"],
    ["simulate", "Debugging & simulation"],
    ["screenshot", "Debugging & simulation"],
    ["error", "Debugging & simulation"],
    ["_track", "Debugging & simulation"],
    ["_daisy", "Debugging & simulation"],
    ["showImage", "Images"], // image, before the show rule
    ["targetImageFolder", "Images"],
    ["maskerSoundFolder", "Sound"],
    ["targetSoundDBSPL", "Sound"],
    ["vocoder", "Sound"],
    ["movieComputeJS", "Movies"],
    ["readingCorpus", "Reading"],
    ["rsvpReadingSpeed", "RSVP reading"],
    ["questionAndAnswer01", "Questions & surveys"],
    ["_question", "Questions & surveys"],
    ["font", "Fonts"],
    ["fontSource", "Fonts"],
    ["EasyEyesLettersVersion", "Fonts"],
    ["instructionFont", "Instructions"],
    ["targetKind", "Target & stimulus"],
    ["thresholdParameter", "Threshold (QUEST)"],
    ["spacingDeg", "Crowding & spacing"],
    ["flankerCharacterSet", "Crowding & spacing"],
    ["showClick", "Display & feedback"],
    ["_showMouse", "Display & feedback"],
    ["markFixation", "Fixation & markers"],
    ["fixationColor", "Fixation & markers"],
    ["responseOvershoot", "Response & breaks"],
    ["_keyboard", "Response & breaks"],
    ["takeBreak", "Response & breaks"],
    ["block", "Blocks & conditions"],
    ["conditionTrials", "Blocks & conditions"],
    ["shuffleBlocks", "Blocks & conditions"],
    ["_viewingDistanceCm", "Screen & viewing"],
    ["screen", "Screen & viewing"],
    ["flip", "Screen & viewing"],
    ["set", "Screen & viewing"],
    ["measure", "Screen & viewing"],
    ["_anythingElse", "Experiment-wide (other)"],
    ["about", "Other"],
    ["zzz", "Other"],
    ["", "Other"],
  ])("%s → %s", (name, category) => {
    expect(categoryOf(name)).toBe(category);
  });

  it("matches case-insensitively, also for the debugging rule", () => {
    expect(categoryOf("SimulateObserver")).toBe("Debugging & simulation");
    expect(categoryOf("ERROR")).toBe("Debugging & simulation");
    expect(categoryOf("SOUND")).toBe("Sound");
  });
});

describe("categories over the real glossary", () => {
  let data;
  beforeAll(async () => {
    data = await loadGlossaryForTests();
  });

  it("partitions the suggestible parameters into alphabetically named groups", () => {
    const categories = getCategories();
    const names = categories.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const all = categories.flatMap((c) => c.entries.map((e) => e.name));
    expect(all.sort()).toEqual(
      suggestibleEntries()
        .map((e) => e.name)
        .sort(),
    );
    for (const c of categories) {
      expect(c.entries.length).toBeGreaterThan(0);
      expect(c.entries.map((e) => e.name)).toEqual(
        c.entries.map((e) => e.name).sort((a, b) => a.localeCompare(b)),
      );
      for (const e of c.entries) {
        expect(e.type).not.toBe("obsolete");
        expect(categoryOf(e.name)).toBe(c.name);
      }
    }
    // Members of groups the recommendations draw from.
    const byName = Object.fromEntries(categories.map((c) => [c.name, c]));
    expect(byName["Fonts"].entries.map((e) => e.name)).toContain("font");
    expect(byName["Reading"].entries.map((e) => e.name)).toContain(
      "readingCorpus",
    );
    expect(byName["Blocks & conditions"].entries.map((e) => e.name)).toContain(
      "block",
    );
  });

  it("recommends the categories of the experiment's target kinds and tasks", () => {
    const r = recommendedFor(["letter"], []);
    expect(r.label).toBe("For letter");
    expect(r.entries.map((e) => e.name)).toEqual(
      r.entries.map((e) => e.name).sort((a, b) => a.localeCompare(b)),
    );
    const categoriesOf = new Set(r.entries.map((e) => categoryOf(e.name)));
    expect(categoriesOf).toEqual(
      new Set([
        "Crowding & spacing",
        "Target & stimulus",
        "Threshold (QUEST)",
        "Fonts",
      ]),
    );
    expect(r.entries.map((e) => e.name)).toContain("font");
  });

  it("combines kinds and tasks, deduplicates kinds, and names the group", () => {
    const r = recommendedFor(
      ["reading", "reading", "sound"],
      ["questionAndAnswer"],
    );
    expect(r.label).toBe("For reading + sound");
    const categoriesOf = new Set(r.entries.map((e) => categoryOf(e.name)));
    expect(categoriesOf).toEqual(
      new Set([
        "Reading",
        "Fonts",
        "Sound",
        "Threshold (QUEST)",
        "Questions & surveys",
      ]),
    );
    // An entry shared by kinds appears once.
    const names = r.entries.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("falls back to 'this experiment' when only tasks are known, and to null when nothing is", () => {
    expect(recommendedFor([], ["questionAnswer"]).label).toBe(
      "For this experiment",
    );
    expect(
      recommendedFor([], ["questionAnswer"]).entries.length,
    ).toBeGreaterThan(0);
    expect(recommendedFor([], [])).toBeNull();
    expect(recommendedFor(["", " "], [])).toBeNull();
    expect(recommendedFor(["spaceship"], [])).toBeNull();
  });

  it("pins reading and sound groups that never repeat an entry", () => {
    const presets = getPresetRecommendations();
    expect(presets.map((p) => p.label)).toEqual(["For reading", "For sound"]);
    for (const p of presets) {
      const names = p.entries.map((e) => e.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names).toEqual(names.sort((a, b) => a.localeCompare(b)));
    }
    expect(presets[0].entries.map((e) => e.name)).toContain("readingCorpus");
    expect(presets[1].entries.map((e) => e.name)).toContain(
      "maskerSoundFolder",
    );
  });

  it("categoryOfEntry tells known from unknown parameters", () => {
    expect(categoryOfEntry("font")).toBe("Fonts");
    expect(categoryOfEntry("noSuchParameter")).toBeNull();
  });
});

describe("glossary.ts", () => {
  it("reports the registry's version, size and readiness", async () => {
    const data = await loadGlossaryForTests();
    expect(isGlossaryReady()).toBe(true);
    expect(glossaryVersion()).toBe(data.version);
    expect(parameterCount()).toBe(Object.keys(data.glossary).length);
    expect(suggestibleEntries().every((e) => e.type !== "obsolete")).toBe(true);
    expect(suggestibleEntries().map((e) => e.name)).toEqual(
      suggestibleEntries()
        .map((e) => e.name)
        .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    );
  });

  it("resolves a super-matching name to its pattern's entry", async () => {
    await loadGlossaryForTests();
    expect(superMatchingEntryFor("questionAndAnswer01")).toBe(
      resolveEntry("questionAndAnswer@@"),
    );
    expect(superMatchingEntryFor("questionAnswer99")).toBe(
      resolveEntry("questionAnswer@@"),
    );
    // Exactly as many extra characters as there are @s.
    expect(superMatchingEntryFor("questionAndAnswer1")).toBeUndefined();
    expect(superMatchingEntryFor("questionAndAnswer")).toBeUndefined();
    expect(superMatchingEntryFor("myquestionAndAnswer01")).toBeUndefined();
    expect(superMatchingEntryFor("font")).toBeUndefined();
    // resolveEntry prefers the exact entry.
    expect(resolveEntry("font").name).toBe("font");
    expect(resolveEntry("nope")).toBeUndefined();
  });

  it("is not ready until a glossary is initialized", () => {
    jest.resetModules();
    jest.doMock("../../threshold/parameters/glossaryRegistry", () => ({
      getGlossary: () => {
        throw new Error("getGlossary() called before initGlossary()");
      },
      getGlossaryVersion: () => null,
      getSuperMatchingParams: () => [],
    }));
    try {
      const { isGlossaryReady: notReady } = require("../studio/glossary");
      expect(notReady()).toBe(false);
    } finally {
      jest.dontMock("../../threshold/parameters/glossaryRegistry");
      jest.resetModules();
    }
  });
});

describe("memoByVersion", () => {
  const registry = (version) => ({
    version,
    glossary: { font: entry("font"), block: entry("block", "integer") },
    glossaryFull: [],
    superMatchingParams: [],
  });
  afterEach(() => initGlossary(registry("1")));

  it("computes once per glossary version and recomputes when it changes", () => {
    initGlossary(registry("1"));
    const compute = jest.fn(() => suggestibleEntries().map((e) => e.name));
    const memo = memoByVersion(compute);
    expect(memo()).toEqual(["block", "font"]);
    expect(memo()).toEqual(["block", "font"]);
    expect(compute).toHaveBeenCalledTimes(1);
    expect(memo()).toBe(memo()); // the very same value, not a copy

    initGlossary(registry("2"));
    expect(memo()).toEqual(["block", "font"]);
    expect(compute).toHaveBeenCalledTimes(2);

    // A registry re-initialized with the same version keeps the cache.
    initGlossary(registry("2"));
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("memoizes each derived list independently", () => {
    initGlossary(registry("1"));
    const a = memoByVersion(() => Math.random());
    const b = memoByVersion(() => Math.random());
    const firstA = a();
    expect(a()).toBe(firstA);
    const firstB = b();
    expect(b()).toBe(firstB);
    initGlossary(registry("9"));
    expect(a()).not.toBe(firstA);
    expect(b()).not.toBe(firstB);
  });

  it("keys on the version only, so derived lists follow a re-initialized registry", () => {
    initGlossary(registry("1"));
    const names = memoByVersion(() => Object.keys(getGlossary()));
    expect(names().sort()).toEqual(["block", "font"]);
    initGlossary({
      version: "3",
      glossary: { font: entry("font"), zebra: entry("zebra") },
      glossaryFull: [],
      superMatchingParams: [],
    });
    expect(names().sort()).toEqual(["font", "zebra"]);
    expect(getCategories().map((c) => c.name)).toEqual(["Fonts", "Other"]);
    // "For reading" keeps its Fonts; "For sound" has nothing left to draw on.
    expect(getPresetRecommendations()[0].entries).toEqual([entry("font")]);
    expect(getPresetRecommendations()[1].entries).toEqual([]);
  });
});
