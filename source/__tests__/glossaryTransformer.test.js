const { transformRows } = require("../glossaryTransformer");

const HEADERS = [
  "INPUT PARAMETER",
  "NOW",
  "TYPE",
  "DEFAULT",
  "EXPLANATION",
  "EXAMPLE",
  "CATEGORIES",
];

function makeRows(...dataRows) {
  return [HEADERS, ...dataRows];
}

describe("transformRows", () => {
  describe("1. normal row produces correct glossary shape", () => {
    it("includes name, availability, type, default, explanation in glossary", () => {
      const rows = makeRows([
        "targetKind",
        "now",
        "text",
        "letter",
        "What to show",
        "A",
        "",
      ]);
      const { glossary } = transformRows(rows);
      expect(glossary["targetKind"]).toEqual({
        name: "targetKind",
        availability: "now",
        type: "text",
        default: "letter",
        explanation: "What to show",
      });
    });

    it("falls back to 'now' when the NOW cell is empty", () => {
      const rows = makeRows(["targetKind", "", "text", "letter", "desc", "A", ""]);
      const { glossary } = transformRows(rows);
      expect(glossary["targetKind"].availability).toBe("now");
    });
  });

  describe("2. rows with __ in INPUT PARAMETER are excluded from all outputs", () => {
    it("excludes the row from glossary, glossaryFull, and superMatchingParams", () => {
      const rows = makeRows(
        ["validParam", "now", "text", "", "", "", ""],
        ["__internalNote", "now", "text", "", "", "", ""],
        ["also__invalid", "now", "text", "", "", "", ""],
      );
      const { glossary, glossaryFull, superMatchingParams } = transformRows(rows);
      expect(Object.keys(glossary)).toEqual(["validParam"]);
      expect(glossaryFull.map((e) => e.name)).toEqual(["validParam"]);
      expect(superMatchingParams).not.toContain("__internalNote");
      expect(superMatchingParams).not.toContain("also__invalid");
    });
  });

  describe("3. superMatchingParams contains only parameter names that include @", () => {
    it("includes names with @ and excludes those without", () => {
      const rows = makeRows(
        ["normalParam", "now", "text", "", "", "", ""],
        ["param@Block", "now", "text", "", "", "", ""],
        ["another@Cond", "now", "text", "", "", "", ""],
      );
      const { superMatchingParams } = transformRows(rows);
      expect(superMatchingParams).toEqual(
        expect.arrayContaining(["param@Block", "another@Cond"]),
      );
      expect(superMatchingParams).not.toContain("normalParam");
    });
  });

  describe("4. categorical and multicategorical include categories in glossaryFull", () => {
    it("categorical type: glossary gets string[], glossaryFull gets raw string", () => {
      const rows = makeRows([
        "targetKind",
        "now",
        "categorical",
        "",
        "",
        "",
        "word, letter , ",
      ]);
      const { glossary, glossaryFull } = transformRows(rows);
      expect(glossary["targetKind"].categories).toEqual(["word", "letter"]);
      const full = glossaryFull.find((e) => e.name === "targetKind");
      expect(full.categories).toBe("word, letter , ");
    });

    it("multicategorical type: glossary gets string[], glossaryFull gets raw string", () => {
      const rows = makeRows([
        "fontFeatures",
        "now",
        "multicategorical",
        "",
        "",
        "",
        "bold,italic",
      ]);
      const { glossary, glossaryFull } = transformRows(rows);
      expect(glossary["fontFeatures"].categories).toEqual(["bold", "italic"]);
      const full = glossaryFull.find((e) => e.name === "fontFeatures");
      expect(full.categories).toBe("bold,italic");
    });
  });

  describe("5. other types emit categories: '' in glossaryFull", () => {
    it("text type: no categories key in glossary, empty string in glossaryFull", () => {
      const rows = makeRows([
        "targetKind",
        "now",
        "text",
        "",
        "",
        "",
        "irrelevant",
      ]);
      const { glossary, glossaryFull } = transformRows(rows);
      expect(Object.keys(glossary["targetKind"])).not.toContain("categories");
      const full = glossaryFull.find((e) => e.name === "targetKind");
      expect(full.categories).toBe("");
    });
  });
});
