// The Studio resource panel (source/studio/resources.ts checkResources): which
// files the table references, and exactly what the compiler's own presence
// checks will say about them against the pool a compile would have
// (EasyEyesResources listings + files dropped in the Studio).
import { loadGlossaryForTests } from "../../threshold/tests/helpers/glossary";
import { ExperimentTable } from "../../threshold/preprocess/experimentTable";
import {
  readyResourceListings,
  settledResourceCatalog,
} from "../../threshold/preprocess/resourceCatalog";
import { runValidation } from "../studio/validation";
import {
  checkResources,
  paramsReferencing,
  userResourceStatus,
  RESOURCE_TYPE_OF_KIND,
  resourceTypeLabel,
} from "../studio/resources";

jest.setTimeout(60000);
beforeAll(() => loadGlossaryForTests());

/** Per-condition rows: [name, "", ...conditions]; colB rows: [name, value, ...]. */
const table = (...rows) => rows;
const row = (name, ...conditions) => [name, "", ...conditions];
const colB = (name, value, conditions = 2) => [
  name,
  value,
  ...Array(conditions).fill(""),
];

const run = (matrix, catalog, dropped = []) =>
  checkResources(matrix, new ExperimentTable(matrix), catalog, dropped);
/** The Studio's real path: validation hands over the pre-cleaned rows. */
const runFromRaw = (matrix, catalog, dropped = []) => {
  const v = runValidation(matrix);
  return checkResources(v.data, v.table, catalog, dropped);
};

const ready = (names = {}) =>
  settledResourceCatalog(readyResourceListings(names));
const failed = (type) => {
  const listings = readyResourceListings();
  listings[type] = { kind: "failed", error: new Error("403 Forbidden") };
  return settledResourceCatalog(listings);
};

const filenames = (report) => report.needed.map((n) => n.filename);
const byFile = (report, filename) =>
  report.needed.find((n) => n.filename === filename);
const errorNames = (report) => report.errors.map((e) => e.name);

describe("checkResources: guards", () => {
  it("reports nothing without a table, and does not complain about it", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const empty = { needed: [], errors: [] };
    expect(checkResources(null, null, ready(), [])).toEqual(empty);
    const matrix = table(row("block", "1", "1"));
    expect(checkResources(matrix, null, ready(), [])).toEqual(empty);
    expect(
      checkResources(null, new ExperimentTable(matrix), ready(), []),
    ).toEqual(empty);
    // No table is the normal state before the first edit, not a problem.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("never throws on a malformed table mid-edit", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    const matrix = [
      row("block", "1", "1"),
      row("font", "Sloan.woff2", "Sloan.woff2"),
      // A non-string cell the extractors cannot read: the panel must survive.
      ["fontSource", "", 5, 5],
    ];
    const report = run(matrix, ready());
    expect(report.errors).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      "[EasyEyes Studio] resource check skipped:",
      expect.any(TypeError),
    );
    // Nothing was collected before the throw, and nothing is reported.
    expect(report).toEqual({ needed: [], errors: [] });
    warn.mockRestore();
  });
});

describe("checkResources: fonts", () => {
  it("lists only fontSource=file fonts, and reports the missing ones as the compiler does", () => {
    const matrix = table(
      row("block", "1", "1", "1"),
      row("font", "Sloan.woff2", "Roboto", "Inter"),
      row("fontSource", "file", "google", "file"),
    );
    const report = run(matrix, ready({ fonts: ["Sloan.woff2"] }));
    expect(filenames(report)).toEqual(["Inter", "Sloan.woff2"]);
    expect(byFile(report, "Sloan.woff2")).toEqual({
      kind: "font",
      filename: "Sloan.woff2",
      params: ["font"],
    });
    // Roboto is a google font: not a repo file, so it is not listed either.
    expect(byFile(report, "Roboto")).toBeUndefined();
    expect(errorNames(report)).toEqual(["Font file not found"]);
    expect(report.errors[0].parameters).toEqual(["font"]);
    expect(report.errors[0].message).toContain("Inter");
  });

  it("tags a font used by both font and instructionFont with both parameters", () => {
    const matrix = table(
      row("block", "1", "1"),
      row("font", "Sloan.woff2", "Sloan.woff2"),
      row("fontSource", "file", "file"),
      row("instructionFont", "Verdana", "Sloan.woff2"),
      row("instructionFontSource", "browser", "file"),
    );
    const report = run(matrix, ready({ fonts: ["Sloan.woff2"] }));
    expect(byFile(report, "Sloan.woff2").params).toEqual([
      "font",
      "instructionFont",
    ]);
    expect(report.errors).toEqual([]);
  });

  it("lists an instruction-only file font under instructionFont only", () => {
    const matrix = table(
      row("block", "1", "1"),
      row("font", "Sloan.woff2", "Sloan.woff2"),
      row("fontSource", "file", "file"),
      row("instructionFont", "Georgia", "Georgia"),
      row("instructionFontSource", "file", "file"),
    );
    const report = run(matrix, ready({ fonts: ["Sloan.woff2"] }));
    expect(byFile(report, "Georgia").params).toEqual(["instructionFont"]);
    expect(byFile(report, "Sloan.woff2").params).toEqual(["font"]);
    expect(errorNames(report)).toEqual(["Font file not found"]);
    expect(report.errors[0].message).toContain("Georgia");
  });

  it("includes the glossary's default font when a file-source cell is blank", () => {
    const defaultFont = "Roboto Mono"; // glossary default for font
    const matrix = table(
      row("block", "1", "1"),
      row("font", "", "Sloan.woff2"),
      row("fontSource", "file", "file"),
    );
    const report = run(matrix, ready({ fonts: ["Sloan.woff2"] }));
    expect(filenames(report)).toEqual(["Roboto Mono", "Sloan.woff2"]);
    expect(report.errors[0].message).toContain("Roboto Mono");
  });

  it("ignores fonts of disabled conditions", () => {
    const matrix = table(
      row("block", "1", "1", "1"),
      row("font", "Sloan.woff2", "Courier", "Inter"),
      row("fontSource", "file", "file", "file"),
      row("conditionEnabledBool", "", "FALSE", ""),
      row("conditionTrials", "35", "35", "0"),
    );
    // The Studio receives the rows after the compiler dropped the disabled
    // columns (C=enabled, D=conditionEnabledBool FALSE, E=conditionTrials 0).
    const report = runFromRaw(matrix, ready({ fonts: ["Sloan.woff2"] }));
    expect(filenames(report)).toEqual(["Sloan.woff2"]);
    expect(report.errors).toEqual([]);
  });

  it("says unverified, not missing, when the font listing failed", () => {
    const matrix = table(
      row("block", "1", "1"),
      row("font", "Sloan.woff2", "Courier"),
      row("fontSource", "file", "file"),
    );
    const report = run(matrix, failed("fonts"));
    expect(errorNames(report)).toEqual(["Resource list unavailable"]);
    // Either font parameter could be the one naming the file.
    expect(report.errors[0].parameters).toEqual(["font", "instructionFont"]);
    expect(report.errors[0].message).toContain("Sloan.woff2");
    expect(report.errors[0].message).toContain("Courier");
  });

  it("a file dropped in the Studio satisfies the check, even when the listing failed", () => {
    const matrix = table(
      row("block", "1", "1"),
      row("font", "Sloan.woff2", "Sloan.woff2"),
      row("fontSource", "file", "file"),
    );
    const dropped = [new File(["x"], "Sloan.woff2")];
    expect(run(matrix, failed("fonts"), dropped).errors).toEqual([]);
    expect(run(matrix, ready(), dropped).errors).toEqual([]);
    // Still unverified for a font that was not dropped.
    const other = table(
      row("block", "1", "1"),
      row("font", "Sloan.woff2", "Other.woff2"),
      row("fontSource", "file", "file"),
    );
    expect(run(other, failed("fonts"), dropped).errors[0].message).toContain(
      "Other.woff2",
    );
  });
});

describe("checkResources: forms, texts, phrases, images, code", () => {
  const matrix = table(
    row("block", "1", "1"),
    colB("_consentForm", "consent.md"),
    colB("_debriefForm", "debrief.pdf"),
    row("readingCorpus", "corpusA.txt", "corpusB.txt"),
    row("readingCorpusFoils", "corpusB.txt", "corpusA.txt"),
    row("showImage", "fixation.png", "fixation.png"),
    colB("_languagePhrasesSpreadsheet", "en.phrases.xlsx"),
    colB("_phrasesSpreadsheet", "named.phrases.xlsx"),
    row("movieComputeJS", "helper.js", "helper.js"),
  );

  it("collects every referenced file once, with the parameters that name it", () => {
    const report = run(matrix, ready());
    expect(report.needed).toEqual([
      { kind: "form", filename: "consent.md", params: ["_consentForm"] },
      {
        kind: "text",
        filename: "corpusA.txt",
        params: ["readingCorpus", "readingCorpusFoils"],
      },
      {
        kind: "text",
        filename: "corpusB.txt",
        params: ["readingCorpus", "readingCorpusFoils"],
      },
      { kind: "form", filename: "debrief.pdf", params: ["_debriefForm"] },
      {
        kind: "phrases",
        filename: "en.phrases.xlsx",
        params: ["_languagePhrasesSpreadsheet"],
      },
      { kind: "image", filename: "fixation.png", params: ["showImage"] },
      { kind: "code", filename: "helper.js", params: ["movieComputeJS"] },
      {
        kind: "phrases",
        filename: "named.phrases.xlsx",
        params: ["_phrasesSpreadsheet"],
      },
    ]);
    expect(errorNames(report).sort()).toEqual(
      [
        "Form file is missing",
        "Form file is missing",
        "Text file is missing",
        "Text file is missing",
        "Image file not found",
        "Phrase file is missing",
        "Phrase file is missing",
        "JavaScript code file is missing",
      ].sort(),
    );
  });

  it("reports nothing when every file is available", () => {
    const report = run(
      matrix,
      ready({
        forms: ["consent.md", "debrief.pdf"],
        texts: ["corpusA.txt", "corpusB.txt"],
        images: ["fixation.png"],
        phrases: ["en.phrases.xlsx", "named.phrases.xlsx"],
        code: ["helper.js"],
      }),
    );
    expect(report.errors).toEqual([]);
  });

  it("parameters of each error name the table parameter", () => {
    const report = run(matrix, ready());
    const paramsOf = (name) =>
      report.errors.filter((e) => e.name === name).map((e) => e.parameters);
    expect(paramsOf("Form file is missing")).toEqual([
      ["_consentForm"],
      ["_debriefForm"],
    ]);
    expect(paramsOf("Text file is missing")).toEqual([
      ["readingCorpus"],
      ["readingCorpusFoils"],
    ]);
    expect(paramsOf("Phrase file is missing")).toEqual([
      ["_languagePhrasesSpreadsheet"],
      ["_phrasesSpreadsheet"],
    ]);
  });

  it("a form requested in a condition column, not column B, is not a form", () => {
    // getFormNames reads column B only, as the compiler does.
    const m = table(row("block", "1", "1"), [
      "_consentForm",
      "",
      "consent.md",
      "consent.md",
    ]);
    expect(run(m, ready()).needed).toEqual([]);
  });

  it("drops empty, duplicate and still-symbolic corpus names", () => {
    const m = table(
      row("block", "1", "1", "1"),
      row("readingCorpus", "a.txt", "~corpus", "a.txt"),
      row("readingCorpusFoils", "", "Ⓛfoils", ""),
    );
    const report = run(m, ready({ texts: ["a.txt"] }));
    expect(report.needed).toEqual([
      { kind: "text", filename: "a.txt", params: ["readingCorpus"] },
    ]);
    expect(report.errors).toEqual([]);
  });
});

describe("checkResources: sound and image folders, responses", () => {
  it("sound folders are requested as <name>.zip, per parameter", () => {
    const matrix = table(
      row("block", "1", "1"),
      row("targetKind", "sound", "sound"),
      row("maskerSoundFolder", "noise", "noise"),
      row("targetSoundFolder", "speech", "speech"),
    );
    const report = run(matrix, ready({ folders: ["speech.zip"] }));
    expect(byFile(report, "noise.zip")).toEqual({
      kind: "sound folder",
      filename: "noise.zip",
      params: ["maskerSoundFolder"],
    });
    expect(byFile(report, "speech.zip").params).toEqual(["targetSoundFolder"]);
    expect(errorNames(report)).toEqual(["Sound folder is missing"]);
    expect(report.errors[0].parameters).toEqual(["maskerSoundFolder"]);
    expect(report.errors[0].message).toContain("noise.zip");
  });

  it("the same folder used as masker and target is listed once with both parameters", () => {
    const matrix = table(
      row("block", "1"),
      row("targetKind", "sound"),
      row("maskerSoundFolder", "noise"),
      row("targetSoundFolder", "noise"),
    );
    const report = run(matrix, ready({ folders: ["noise.zip"] }));
    expect(byFile(report, "noise.zip").params).toEqual([
      "maskerSoundFolder",
      "targetSoundFolder",
    ]);
    expect(report.errors).toEqual([]);
  });

  it("a folder present unzipped, not as .zip, is missing", () => {
    const matrix = table(
      row("block", "1"),
      row("targetKind", "sound"),
      row("targetSoundFolder", "speech"),
    );
    expect(errorNames(run(matrix, ready({ folders: ["speech"] })))).toEqual([
      "Sound folder is missing",
    ]);
  });

  it("image folders are requested as <name>.zip", () => {
    const matrix = table(
      row("block", "1", "1"),
      row("targetKind", "image", "image"),
      row("targetImageFolder", "animals", "faces"),
    );
    const report = run(matrix, ready({ folders: ["animals.zip"] }));
    expect(byFile(report, "animals.zip")).toEqual({
      kind: "image folder",
      filename: "animals.zip",
      params: ["targetImageFolder"],
    });
    expect(byFile(report, "faces.zip").params).toEqual(["targetImageFolder"]);
    expect(errorNames(report)).toEqual(["Image folder is missing"]);
    expect(report.errors[0].parameters).toEqual(["targetImageFolder"]);
  });

  it("an image folder of a disabled condition is not requested", () => {
    const matrix = table(
      row("block", "1", "1"),
      row("targetKind", "image", "image"),
      row("targetImageFolder", "animals", "faces"),
      row("conditionEnabledBool", "", "FALSE"),
    );
    // Disabled columns are dropped before the resource checks, as in a compile.
    expect(filenames(runFromRaw(matrix, ready()))).toEqual(["animals.zip"]);
    expect(
      runFromRaw(matrix, ready({ folders: ["animals.zip"] })).errors,
    ).toEqual([]);
  });

  it("impulse and frequency responses name the simulate parameter that uses them", () => {
    const matrix = table(
      row("block", "1", "1"),
      [
        "_calibrateSoundSimulateLoudspeaker",
        "spk.gainVTime.xlsx",
        "",
        "spk2.gainVTime.csv",
      ],
      [
        "_calibrateSoundSimulateMicrophone",
        "mic.gainVFreq.xlsx",
        "mic.gainVTime.xlsx",
        "",
      ],
    );
    const report = run(
      matrix,
      ready({
        impulseResponses: ["spk.gainVTime.xlsx", "mic.gainVTime.xlsx"],
        frequencyResponses: ["mic.gainVFreq.xlsx"],
      }),
    );
    expect(byFile(report, "spk.gainVTime.xlsx").kind).toBe("impulse response");
    expect(byFile(report, "mic.gainVFreq.xlsx").kind).toBe(
      "frequency response",
    );
    expect(byFile(report, "spk.gainVTime.xlsx").params).toEqual([
      "_calibrateSoundSimulateLoudspeaker",
    ]);
    expect(byFile(report, "spk2.gainVTime.csv").params).toEqual([
      "_calibrateSoundSimulateLoudspeaker",
    ]);
    expect(byFile(report, "mic.gainVTime.xlsx").params).toEqual([
      "_calibrateSoundSimulateMicrophone",
    ]);
    expect(byFile(report, "mic.gainVFreq.xlsx").params).toEqual([
      "_calibrateSoundSimulateMicrophone",
    ]);
    expect(errorNames(report)).toEqual(["Impulse response file is missing"]);
    expect(report.errors[0].message).toContain("spk2.gainVTime.csv");
    expect(report.errors[0].parameters).toEqual(["impulse response files"]);
  });

  it("reports a missing frequency response, with the compiler's parameter", () => {
    const matrix = table(row("block", "1"), [
      "_calibrateSoundSimulateMicrophone",
      "mic.gainVFreq.xlsx",
      "",
    ]);
    const report = run(matrix, ready());
    expect(errorNames(report)).toEqual(["Frequency response file is missing"]);
    expect(report.errors[0].parameters).toEqual(["frequency response files"]);
    expect(report.errors[0].message).toContain("mic.gainVFreq.xlsx");
  });

  it("a target sound folder alone is checked too", () => {
    const matrix = table(
      row("block", "1"),
      row("targetKind", "sound"),
      row("targetSoundFolder", "speech"),
    );
    const report = run(matrix, ready());
    expect(errorNames(report)).toEqual(["Sound folder is missing"]);
    expect(report.errors[0].parameters).toEqual(["targetSoundFolder"]);
    expect(byFile(report, "speech.zip").kind).toBe("sound folder");
  });

  it("phrase file names are matched without surrounding whitespace", () => {
    const matrix = table(
      row("block", "1", "1"),
      colB("_languagePhrasesSpreadsheet", " en.phrases.xlsx "),
      colB("_phrasesSpreadsheet", " named.phrases.xlsx"),
    );
    const report = run(
      matrix,
      ready({ phrases: ["en.phrases.xlsx", "named.phrases.xlsx"] }),
    );
    expect(report.errors).toEqual([]);
    expect(filenames(report)).toEqual([
      "en.phrases.xlsx",
      "named.phrases.xlsx",
    ]);
    expect(byFile(report, "en.phrases.xlsx").kind).toBe("phrases");
  });

  it("a response file named without the .gainVTime/.gainVFreq suffix is not a response", () => {
    const matrix = table(row("block", "1"), [
      "_calibrateSoundSimulateLoudspeaker",
      "spk.xlsx",
      "",
    ]);
    expect(run(matrix, ready()).needed).toEqual([]);
  });

  it("unverified responses when their listing failed", () => {
    const matrix = table(row("block", "1"), [
      "_calibrateSoundSimulateLoudspeaker",
      "spk.gainVTime.xlsx",
      "",
    ]);
    const report = run(matrix, failed("impulseResponses"));
    expect(errorNames(report)).toEqual(["Resource list unavailable"]);
    expect(report.errors[0].message).toContain("impulseResponses");
  });
});

describe("checkResources: ordering", () => {
  it("sorts the checklist by file name, case-insensitively", () => {
    const matrix = table(
      row("block", "1"),
      row("font", "zeta.woff2"),
      row("fontSource", "file"),
      row("showImage", "Alpha.png"),
      row("movieComputeJS", "beta.js"),
    );
    const report = run(matrix, ready());
    expect(filenames(report)).toEqual(["Alpha.png", "beta.js", "zeta.woff2"]);
  });
});

describe("userResourceStatus", () => {
  const catalog = settledResourceCatalog(
    readyResourceListings({ fonts: ["Sloan.woff2"] }),
  );
  const font = (filename) => ({ kind: "font", filename, params: [] });

  it("is local when dropped, else remote or missing on a ready listing", () => {
    expect(userResourceStatus(font("Sloan.woff2"), catalog)).toBe("remote");
    expect(userResourceStatus(font("Other.woff2"), catalog)).toBe("missing");
    expect(
      userResourceStatus(font("Other.woff2"), catalog, ["Other.woff2"]),
    ).toBe("local");
  });

  it("is unverified when the listing is not ready, unless dropped", () => {
    const f = failed("fonts");
    expect(userResourceStatus(font("Sloan.woff2"), f)).toBe("unverified");
    expect(userResourceStatus(font("Sloan.woff2"), f, ["Sloan.woff2"])).toBe(
      "local",
    );
    expect(userResourceStatus(font("Sloan.woff2"), { kind: "idle" })).toBe(
      "unverified",
    );
    expect(userResourceStatus(font("Sloan.woff2"), { kind: "loading" })).toBe(
      "unverified",
    );
    expect(
      userResourceStatus(font("Sloan.woff2"), {
        kind: "failed",
        error: new Error("x"),
      }),
    ).toBe("unverified");
  });

  it("looks up each kind in its own EasyEyesResources folder", () => {
    expect(RESOURCE_TYPE_OF_KIND).toEqual({
      font: "fonts",
      form: "forms",
      text: "texts",
      phrases: "phrases",
      image: "images",
      "impulse response": "impulseResponses",
      "frequency response": "frequencyResponses",
      "sound folder": "folders",
      "image folder": "folders",
      code: "code",
    });
    const c = settledResourceCatalog(
      readyResourceListings({ folders: ["noise.zip"] }),
    );
    expect(
      userResourceStatus(
        { kind: "sound folder", filename: "noise.zip", params: [] },
        c,
      ),
    ).toBe("remote");
    expect(
      userResourceStatus(
        { kind: "font", filename: "noise.zip", params: [] },
        c,
      ),
    ).toBe("missing");
    expect(resourceTypeLabel("fonts")).toBe("Fonts");
    expect(resourceTypeLabel("forms")).toBe("Forms");
    expect(resourceTypeLabel("texts")).toBe("Texts");
    expect(resourceTypeLabel("folders")).toBe("Folders");
    expect(resourceTypeLabel("images")).toBe("Images");
    expect(resourceTypeLabel("code")).toBe("Code");
    expect(resourceTypeLabel("impulseResponses")).toBe("Impulse responses");
    expect(resourceTypeLabel("frequencyResponses")).toBe("Frequency responses");
    expect(resourceTypeLabel("targetSoundLists")).toBe("Target sound lists");
    expect(resourceTypeLabel("phrases")).toBe("Phrases");
  });
});

describe("paramsReferencing", () => {
  it("returns the parameters of the needed entries of that type naming the file", () => {
    const needed = [
      { kind: "font", filename: "X.ttf", params: ["font"] },
      { kind: "font", filename: "Y.ttf", params: ["instructionFont"] },
      { kind: "code", filename: "X.ttf", params: ["movieComputeJS"] },
    ];
    expect(paramsReferencing("fonts", "X.ttf", needed)).toEqual(["font"]);
    expect(paramsReferencing("fonts", "Y.ttf", needed)).toEqual([
      "instructionFont",
    ]);
    expect(paramsReferencing("code", "X.ttf", needed)).toEqual([
      "movieComputeJS",
    ]);
    expect(paramsReferencing("forms", "X.ttf", needed)).toEqual([]);
    expect(paramsReferencing("fonts", "Z.ttf", needed)).toEqual([]);
  });
});
