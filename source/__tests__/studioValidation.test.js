// The Studio's live validation (source/studio/validation.ts): the compiler's
// own checks, run on the table as the scientist edits it, with the same
// pre-cleaning, tilde resolution and column bookkeeping a compile does.
import { loadGlossaryForTests } from "../../threshold/tests/helpers/glossary";
import { initPhrases } from "../../threshold/parameters/phrasesRegistry";
import { getEntry } from "../studio/glossary";
import {
  mirrorPreprocess,
  runValidation,
  toLanguageCode,
} from "../studio/validation";
import { conditionIndexToColumnName } from "../../threshold/preprocess/utils";

jest.setTimeout(60000);
beforeAll(() => loadGlossaryForTests());

const row = (name, ...conditions) => [name, "", ...conditions];
const colB = (name, value, conditions = 2) => [
  name,
  value,
  ...Array(conditions).fill(""),
];

/** A phrase table as parsePhraseFile builds it: keys lowercased. */
const phraseTable = (entries) =>
  new Map(entries.map(([k, m]) => [k.toLowerCase(), new Map(m)]));
const phraseSource = (fileName, table, codes) => ({
  fileName,
  origin: "dropped",
  sourceLanguageCode: "en",
  availableLanguageCodes: codes ?? [
    ...(table.values().next().value ?? new Map()).keys(),
  ],
  table,
});
/** Rows in the alphabetical order the compiler requires. */
const sorted = (...rows) =>
  [...rows].sort((a, b) =>
    a[0].toLowerCase().localeCompare(b[0].toLowerCase()),
  );
/** A minimal valid table with two conditions. */
const baseTable = () =>
  sorted(
    row("block", "1", "1"),
    row("targetKind", "letter", "letter"),
    row("targetTask", "identify", "identify"),
    row("thresholdParameter", "targetSizeDeg", "targetSizeDeg"),
  );
const errorsOf = (matrix, phrase, namedPhrase) =>
  runValidation(matrix, phrase, namedPhrase).errors;
const kinds = (errors) => errors.map((e) => e.kind);

describe("toLanguageCode", () => {
  afterEach(() => initPhrases({ version: "0", phrases: {} }));

  it("passes a supported code through and maps a full English name to it", () => {
    initPhrases({
      version: "1",
      phrases: {
        EE_LanguageEnglishName: { en: "English", fr: "French", de: "German" },
      },
    });
    expect(toLanguageCode("fr")).toBe("fr");
    expect(toLanguageCode("French")).toBe("fr");
    expect(toLanguageCode("GERMAN")).toBe("en"); // names are matched exactly
    expect(toLanguageCode("xx")).toBe("en");
    expect(toLanguageCode(undefined)).toBe("en");
    expect(toLanguageCode("")).toBe("en");
  });

  it("falls back to the glossary's language list when the phrases are not loaded", () => {
    // With no phrases initialized, readi18nPhrases throws; the glossary's
    // categories decide. Only codes pass; names cannot be mapped.
    expect(getEntry("_language").categories).toContain("fr");
    expect(toLanguageCode("fr")).toBe("fr");
    expect(toLanguageCode("French")).toBe("en");
    expect(toLanguageCode("xx")).toBe("en");
  });
});

describe("mirrorPreprocess", () => {
  it("drops %-commented rows, blank rows, shared trailing blanks, and trims names", () => {
    const matrix = [
      ["  block  ", "", "1", "1", ""],
      ["%oldRow", "", "x", "y", ""],
      ["  %indented comment", "", "", "", ""],
      ["", "", "", "", ""],
      ["font", "", "Sloan.woff2", "", ""],
    ];
    expect(mirrorPreprocess(matrix)).toEqual([
      ["block", "", "1", "1"],
      ["font", "", "Sloan.woff2", ""],
    ]);
  });

  it("keeps a blank cell that is not trailing in every row", () => {
    // The shortest run of trailing blanks is zero (row 2 ends in "1"), so no
    // column is cut — exactly the compiler's rule.
    const matrix = [
      ["block", "", "1", "", ""],
      ["font", "", "a", "b", "1"],
    ];
    expect(mirrorPreprocess(matrix)).toEqual(matrix);
  });

  it("trims every cell of the name column only, and keeps ragged rows ragged", () => {
    expect(
      mirrorPreprocess([
        [" block", " ", " 1 "],
        ["font\t", "", "Sloan.woff2", "x"],
      ]),
    ).toEqual([
      ["block", " ", " 1 "],
      ["font", "", "Sloan.woff2", "x"],
    ]);
  });

  it("drops only rows whose name STARTS with %", () => {
    expect(
      mirrorPreprocess([
        ["block", "", "1"],
        ["odd%name", "", "kept"], // the compiler keeps it (and reports it)
      ]),
    ).toEqual([
      ["block", "", "1"],
      ["odd%name", "", "kept"],
    ]);
  });

  it("returns an empty matrix for an all-comment table", () => {
    expect(
      mirrorPreprocess([
        ["%a", "", ""],
        ["%b", "", ""],
      ]),
    ).toEqual([]);
  });
});

describe("runValidation", () => {
  it("returns an empty, table-less result for an empty table", () => {
    expect(runValidation([])).toEqual({ errors: [], table: null, data: null });
    expect(runValidation([["%only a comment", "", ""]])).toEqual({
      errors: [],
      table: null,
      data: null,
    });
  });

  it("runs the compiler's checks: a missing block row is reported, not thrown", () => {
    const matrix = sorted(
      row("targetKind", "letter", "letter"),
      row("targetTask", "identify", "identify"),
      row("thresholdParameter", "targetSizeDeg", "targetSizeDeg"),
    );
    const { errors, table, data } = runValidation(matrix);
    expect(errors.map((e) => e.name)).toContain("Parameter is not present");
    expect(errors[0].parameters).toEqual(["block"]);
    expect(
      errors.every((e) => e.kind === "error" || e.kind === "warning"),
    ).toBe(true);
    expect(table).not.toBeNull();
    expect(data).toEqual(matrix);
  });

  it("accepts a minimal table with no errors", () => {
    const { errors, table, data } = runValidation(baseTable());
    expect(errors).toEqual([]);
    expect(table.params).toEqual([
      "block",
      "targetKind",
      "targetTask",
      "thresholdParameter",
    ]);
    expect(table.effectiveValues("targetKind")).toEqual(["letter", "letter"]);
    expect(data).toEqual(baseTable());
  });

  it("drops disabled columns from the working rows and keeps the spreadsheet's column letters in messages", () => {
    const matrix = sorted(
      row("block", "1", "1", "1"),
      row("targetKind", "letter", "letter", "letter"),
      row("targetTask", "identify", "identify", "identify"),
      row("conditionTrials", "0", "35", "35"),
      // Wrong type in the spreadsheet's column D, which is the first
      // condition once the disabled column C is dropped.
      row("targetSizeDeg", "1", "two", "1"),
      row(
        "thresholdParameter",
        "targetSizeDeg",
        "targetSizeDeg",
        "targetSizeDeg",
      ),
    );
    const { errors, table, data } = runValidation(matrix);
    expect(data.every((r) => r.length === 4)).toBe(true);
    expect(data.find((r) => r[0] === "targetSizeDeg")).toEqual([
      "targetSizeDeg",
      "",
      "two",
      "1",
    ]);
    expect(data.find((r) => r[0] === "conditionTrials")).toEqual([
      "conditionTrials",
      "",
      "35",
      "35",
    ]);
    expect(table.conditionCount).toBe(2);
    const wrongType = errors.find((e) =>
      e.parameters?.includes("targetSizeDeg"),
    );
    expect(wrongType).toBeDefined();
    expect(wrongType.hint).toContain("column D");
    expect(wrongType.hint).not.toContain("column C");
  });

  it("resolves ~, Ⓛ and Ⓝ symbols through the phrase tables, in the compiler's order", () => {
    const phrase = phraseSource(
      "en.phrases.xlsx",
      phraseTable([
        [
          "~intro",
          [
            ["en", "Hello"],
            ["fr", "Bonjour"],
          ],
        ],
        [
          "Ⓛgoodbye",
          [
            ["en", "Goodbye"],
            ["fr", "Au revoir"],
          ],
        ],
      ]),
    );
    const named = phraseSource(
      "named.phrases.xlsx",
      phraseTable([
        [
          "Ⓝthanks",
          [
            ["en", "Thanks"],
            ["fr", "Merci"],
          ],
        ],
      ]),
    );
    const matrix = sorted(
      ...baseTable(),
      colB("_languagePhrasesSpreadsheet", "en.phrases.xlsx"),
      colB("_phrasesSpreadsheet", "named.phrases.xlsx"),
      colB("_phrasesColumnName", "fr"),
      colB("_language", "fr"),
      // Whole-cell ~ and Ⓝ symbols; a Ⓛ symbol inside prose.
      row("conditionName", "~intro", "Ⓝthanks"),
      row("digits", "See Ⓛgoodbye.", "Ⓛgoodbye"),
    );
    const { errors, table } = runValidation(matrix, phrase, named);
    expect(errors).toEqual([]);
    expect(table.conditionValue("conditionName", 0)).toBe("Bonjour");
    expect(table.conditionValue("conditionName", 1)).toBe("Merci");
    expect(table.conditionValue("digits", 0)).toBe("See Au revoir.");
    expect(table.conditionValue("digits", 1)).toBe("Au revoir");
  });

  it("resolves the font row the resource checks read, so fonts never show a symbol", () => {
    const phrase = phraseSource(
      "en.phrases.xlsx",
      phraseTable([["~myfont", [["en", "Sloan.woff2"]]]]),
    );
    const matrix = sorted(
      ...baseTable(),
      colB("_languagePhrasesSpreadsheet", "en.phrases.xlsx"),
      row("font", "~myfont", "~myfont"),
      row("fontSource", "file", "file"),
    );
    const { data } = runValidation(matrix, phrase);
    expect(data.find((r) => r[0] === "font")).toEqual([
      "font",
      "",
      "Sloan.woff2",
      "Sloan.woff2",
    ]);
  });

  it("reports every unresolved symbol with its parameter, without phrase tables", () => {
    const matrix = sorted(
      ...baseTable(),
      row("conditionName", "~intro", "plain"),
      row("digits", "Ⓛbye", "Ⓝthanks"),
    );
    const errors = errorsOf(matrix);
    const symbolic = errors.filter(
      (e) => e.name === "Symbolic value requires phrase table",
    );
    expect(symbolic.map((e) => e.parameters[0]).sort()).toEqual([
      "conditionName",
      "digits",
      "digits",
    ]);
    expect(symbolic.map((e) => e.parameters[1]).sort()).toEqual([
      "_languagePhrasesSpreadsheet",
      "_languagePhrasesSpreadsheet",
      "_phrasesSpreadsheet",
    ]);
    // The compiler's missing-file style: no misleading "symbol not found" too.
    expect(
      errors.filter((e) => e.name === "Symbol not found in phrase table"),
    ).toEqual([]);
  });

  it("reports a symbol missing from the table and a language the table lacks", () => {
    const phrase = phraseSource(
      "en.phrases.xlsx",
      phraseTable([
        [
          "~intro",
          [
            ["en", "Hello"],
            ["fr", "Bonjour"],
          ],
        ],
      ]),
    );
    const matrix = sorted(
      ...baseTable(),
      colB("_languagePhrasesSpreadsheet", "en.phrases.xlsx"),
      colB("_language", "de"),
      row("conditionName", "~intro", "~missing"),
    );
    const errors = errorsOf(matrix, phrase);
    const notInTable = errors.find((e) => e.name === "Phrase column not found");
    expect(notInTable).toBeDefined();
    expect(notInTable.message).toContain("~intro");
    expect(notInTable.message).toContain("de");
    expect(notInTable.parameters).toEqual(["conditionName", "_language"]);
    const notFound = errors.find(
      (e) => e.name === "Symbol not found in phrase table",
    );
    expect(notFound.message).toContain("~missing");
    expect(notFound.parameters).toEqual(["conditionName"]);
  });

  it("resolves _language itself when it is a symbol", () => {
    // _language takes a code; a symbol naming the code is resolved in the
    // phrase file's source language first, and everything else then resolves
    // in that language.
    const phrase = phraseSource(
      "en.phrases.xlsx",
      phraseTable([
        [
          "~lang",
          [
            ["en", "fr"],
            ["fr", "fr"],
          ],
        ],
        [
          "~intro",
          [
            ["en", "Hello"],
            ["fr", "Bonjour"],
          ],
        ],
      ]),
    );
    const matrix = sorted(
      ...baseTable(),
      colB("_languagePhrasesSpreadsheet", "en.phrases.xlsx"),
      colB("_language", "~lang"),
      row("conditionName", "~intro", "~intro"),
    );
    const { errors, table } = runValidation(matrix, phrase);
    expect(errors).toEqual([]);
    expect(table.colB("_language")).toBe("fr");
    expect(table.conditionValue("conditionName", 0)).toBe("Bonjour");
    // With the source language English only, "fr" is unknown and the
    // compiler reports the language as missing from the table.
    const enOnly = phraseSource(
      "en.phrases.xlsx",
      phraseTable([
        ["~lang", [["en", "fr"]]],
        ["~intro", [["en", "Hello"]]],
      ]),
    );
    const errs = errorsOf(matrix, enOnly);
    expect(errs.map((e) => e.name)).toContain("Phrase column not found");
    expect(
      errs.find((e) => e.name === "Phrase column not found").message,
    ).toContain("fr");
  });

  it("reports a named-phrase column that is not in the named spreadsheet", () => {
    const named = phraseSource("named.phrases.xlsx", phraseTable([]), [
      "en",
      "fr",
    ]);
    const matrix = [
      ...baseTable(),
      colB("_phrasesSpreadsheet", "named.phrases.xlsx"),
      colB("_phrasesColumnName", "de"),
    ];
    const errors = errorsOf(matrix, null, named);
    const column = errors.find((e) => e.name === "Phrase column not found");
    expect(column.parameters).toEqual(["_phrasesColumnName"]);
    expect(column.message).toContain("de");
    expect(column.hint).toContain("_phrasesColumnName");
    expect(column.context).toBe("studio");
    expect(column.kind).toBe("error");
  });

  it("still resolves named phrases when the named column is valid", () => {
    const named = phraseSource(
      "named.phrases.xlsx",
      phraseTable([
        [
          "Ⓝthanks",
          [
            ["en", "Thanks"],
            ["fr", "Merci"],
          ],
        ],
      ]),
    );
    const matrix = sorted(
      ...baseTable(),
      colB("_phrasesSpreadsheet", "named.phrases.xlsx"),
      colB("_phrasesColumnName", "fr"),
      row("conditionName", "Ⓝthanks", ""),
    );
    const { errors, table } = runValidation(matrix, null, named);
    expect(errors).toEqual([]);
    expect(table.conditionValue("conditionName", 0)).toBe("Merci");
  });

  it("resolves _language given as a Ⓛ symbol, and survives one the table lacks", () => {
    const phrase = phraseSource(
      "en.phrases.xlsx",
      phraseTable([
        [
          "Ⓛlang",
          [
            ["en", "fr"],
            ["fr", "fr"],
          ],
        ],
        [
          "~intro",
          [
            ["en", "Hello"],
            ["fr", "Bonjour"],
          ],
        ],
      ]),
    );
    const matrix = sorted(
      ...baseTable(),
      colB("_languagePhrasesSpreadsheet", "en.phrases.xlsx"),
      colB("_language", "Ⓛlang"),
      row("conditionName", "~intro", "~intro"),
    );
    const { errors, table } = runValidation(matrix, phrase);
    expect(errors).toEqual([]);
    expect(table.colB("_language")).toBe("fr");
    expect(table.conditionValue("conditionName", 0)).toBe("Bonjour");
    // A symbol the phrase table does not know is left as is (and reported by
    // the type check), never an "Unexpected compiler error".
    const unknown = sorted(
      ...baseTable(),
      colB("_languagePhrasesSpreadsheet", "en.phrases.xlsx"),
      colB("_language", "Ⓛunknown"),
    );
    const result = runValidation(unknown, phrase);
    expect(result.errors.map((e) => e.name)).not.toContain(
      "Unexpected compiler error",
    );
    expect(result.table.colB("_language")).toBe("Ⓛunknown");
  });

  it("matches the named-phrase column without surrounding whitespace", () => {
    const named = phraseSource(
      "named.phrases.xlsx",
      phraseTable([
        [
          "Ⓝthanks",
          [
            ["en", "Thanks"],
            ["fr", "Merci"],
          ],
        ],
      ]),
    );
    const matrix = sorted(
      ...baseTable(),
      colB("_phrasesSpreadsheet", "named.phrases.xlsx"),
      colB("_phrasesColumnName", " fr "),
      row("conditionName", "Ⓝthanks", ""),
    );
    const { errors, table } = runValidation(matrix, null, named);
    expect(errors).toEqual([]);
    expect(table.conditionValue("conditionName", 0)).toBe("Merci");
  });

  it("collects errors from every check for a badly broken table", () => {
    const matrix = [
      row("targetKind", "letter", "letter"), // out of order: after block
      row("block", "1", "3"), // jumps: nonsequential
      row("notAParameter", "1", "1"), // unrecognized
    ];
    const errors = errorsOf(matrix);
    const names = errors.map((e) => e.name);
    expect(names).toContain("Parameters aren't alphabetical");
    expect(names).toContain("Parameter is unrecognized");
    const nonsequential = errors.find((e) =>
      e.name.startsWith("Nonsequential value"),
    );
    expect(nonsequential.kind).toBe("error");
    expect(nonsequential.parameters).toEqual(["block"]);
    // The hint lists the values with the offending one flagged, as "2nd".
    expect(nonsequential.hint).toContain("1");
    expect(nonsequential.hint).toMatch(/alert-invalid[^>]*>3</);
    expect(nonsequential.hint).toContain("2nd");
  });

  it("reports a duplicated parameter", () => {
    const matrix = sorted(
      row("block", "1", "1"),
      row("targetKind", "letter", "letter"),
      row("targetKind", "gabor", "gabor"),
      row("targetTask", "identify", "identify"),
      row("thresholdParameter", "targetSizeDeg", "targetSizeDeg"),
    );
    const errors = errorsOf(matrix);
    const duplicate = errors.find((e) => e.name === "Parameter is duplicated");
    expect(duplicate.parameters).toEqual(["targetKind"]);
    // A repeated parameter still leaves the table in alphabetical order.
    expect(errors.map((e) => e.name)).not.toContain(
      "Parameters aren't alphabetical",
    );
  });

  it("requires block numbering to start at 1", () => {
    const matrix = sorted(
      row("block", "2", "3"),
      row("targetKind", "letter", "letter"),
      row("targetTask", "identify", "identify"),
      row("thresholdParameter", "targetSizeDeg", "targetSizeDeg"),
    );
    const errors = errorsOf(matrix);
    expect(errors.map((e) => e.name)).toContain("Invalid initial value");
    expect(
      errors.find((e) => e.name === "Invalid initial value").message,
    ).toContain("2");
  });

  it("leaves no condition-column mapping behind for the next validation", () => {
    const disabled = sorted(
      row("block", "1", "1", "1"),
      row("targetKind", "letter", "letter", "letter"),
      row("targetTask", "identify", "identify", "identify"),
      row("conditionTrials", "0", "35", "35"),
      row("targetSizeDeg", "1", "two", "1"),
      row(
        "thresholdParameter",
        "targetSizeDeg",
        "targetSizeDeg",
        "targetSizeDeg",
      ),
    );
    // Column C disabled; the bad value sits in the spreadsheet's column D.
    expect(
      errorsOf(disabled).find((e) => e.parameters?.includes("targetSizeDeg"))
        .hint,
    ).toContain("column D");
    // Now a table with no disabled column: its column D must be reported as D.
    const plain = sorted(...baseTable(), row("targetSizeDeg", "1", "two"));
    const wrongType = errorsOf(plain).find((e) =>
      e.parameters?.includes("targetSizeDeg"),
    );
    expect(wrongType.hint).toContain("column D");
    expect(wrongType.hint).not.toContain("column E");
    // The spreadsheet-column bookkeeping is a module global the compile
    // shares; a validation must leave it as it found it.
    expect(conditionIndexToColumnName(0)).toBe("C");
  });
});

describe("runValidation: failure containment", () => {
  it("turns an unexpected compiler exception into one error and no table", () => {
    jest.resetModules();
    jest.doMock("../../threshold/parameters/glossaryRegistry", () => ({
      getGlossary: () => {
        throw new Error("getGlossary() called before initGlossary()");
      },
      getGlossaryVersion: () => null,
      getGlossaryFull: () => [],
      getSuperMatchingParams: () => {
        throw new Error("not initialized");
      },
      initGlossary: () => {},
    }));
    jest.doMock("../studio/glossary", () => ({
      getEntry: () => undefined,
    }));
    let validation;
    try {
      validation = require("../studio/validation");
      const result = validation.runValidation(baseTable());
      expect(result.table).toBeNull();
      expect(result.data).toBeNull();
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].name).toBe("Unexpected compiler error");
      expect(result.errors[0].kind).toBe("error");
      expect(result.errors[0].context).toBe("studio");
      expect(result.errors[0].message).toMatch(/initGlossary|not initialized/);
    } finally {
      jest.dontMock("../../threshold/parameters/glossaryRegistry");
      jest.dontMock("../studio/glossary");
      jest.resetModules();
    }
  });
});
