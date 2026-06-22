const {
  extractTranslatableTexts,
  applyTranslations,
} = require("../experimentTranslator");

const header = ["parameter", "condition1", "condition2"];

describe("extractTranslatableTexts", () => {
  test("collects condition-column values from rows whose key is in translatableKeys", () => {
    const spreadsheet = [
      header,
      ["blockCondition", "Hello", "World"],
      ["targetFont", "Arial", ""],
    ];
    const result = extractTranslatableTexts(spreadsheet, ["blockCondition"]);
    expect(result).toEqual(expect.arrayContaining(["Hello", "World"]));
    expect(result).toHaveLength(2);
  });

  test("excludes empty, null, and undefined cells from translatable rows", () => {
    const spreadsheet = [
      header,
      ["blockCondition", "Hello", ""],
      ["targetFont", null, undefined],
    ];
    const result = extractTranslatableTexts(spreadsheet, [
      "blockCondition",
      "targetFont",
    ]);
    expect(result).toEqual(["Hello"]);
  });

  test("ignores rows not in translatableKeys", () => {
    const spreadsheet = [
      header,
      ["blockCondition", "Hello", "World"],
      ["targetFont", "Arial", "Helvetica"],
    ];
    const result = extractTranslatableTexts(spreadsheet, ["blockCondition"]);
    expect(result).not.toContain("Arial");
    expect(result).not.toContain("Helvetica");
  });

  test("deduplicates identical values across rows and columns", () => {
    const spreadsheet = [
      header,
      ["blockCondition", "Hello", "Hello"],
      ["targetFont", "Hello", "World"],
    ];
    const result = extractTranslatableTexts(spreadsheet, [
      "blockCondition",
      "targetFont",
    ]);
    expect(result).toEqual(expect.arrayContaining(["Hello", "World"]));
    expect(result).toHaveLength(2);
  });
});

describe("applyTranslations", () => {
  test("returns a new array and does not mutate the input spreadsheet", () => {
    const spreadsheet = [header, ["blockCondition", "Hello", "World"]];
    const original = spreadsheet.map((row) => [...row]);
    const map = { Hello: "Hola" };
    const result = applyTranslations(spreadsheet, map, ["blockCondition"]);
    expect(result).not.toBe(spreadsheet);
    expect(spreadsheet).toEqual(original);
  });

  test("row[0] parameter name is never replaced even if it appears in the translation map", () => {
    const spreadsheet = [header, ["blockCondition", "Hello", "World"]];
    const map = { blockCondition: "bloqueCondicion", Hello: "Hola" };
    const result = applyTranslations(spreadsheet, map, ["blockCondition"]);
    expect(result[1][0]).toBe("blockCondition");
  });

  test("empty cells in translatable rows remain empty after applying translations", () => {
    const spreadsheet = [header, ["blockCondition", "Hello", ""]];
    const map = { Hello: "Hola" };
    const result = applyTranslations(spreadsheet, map, ["blockCondition"]);
    expect(result[1]).toEqual(["blockCondition", "Hola", ""]);
  });

  test("non-translatable rows pass through unchanged even if values match the translation map", () => {
    const spreadsheet = [
      header,
      ["blockCondition", "Hello", "World"],
      ["targetFont", "Hello", "Arial"],
    ];
    const map = { Hello: "Hola" };
    const result = applyTranslations(spreadsheet, map, ["blockCondition"]);
    expect(result[2]).toEqual(["targetFont", "Hello", "Arial"]);
  });

  test("replaces matching condition-column values in translatable rows, including repeats", () => {
    const spreadsheet = [
      header,
      ["blockCondition", "Hello", "Hello"],
      ["targetFont", "Arial", "Helvetica"],
    ];
    const map = { Hello: "Hola" };
    const result = applyTranslations(spreadsheet, map, ["blockCondition"]);
    expect(result[1]).toEqual(["blockCondition", "Hola", "Hola"]);
  });
});
