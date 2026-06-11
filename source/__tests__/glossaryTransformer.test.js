const { transformGlossaryRows } = require("../glossaryTransformer");

const baseRow = {
  name: "_about",
  availability: "now",
  example: "Effect of font on crowding.",
  explanation: "Some explanation.",
  type: "text",
  default: "",
  categories: "",
};

describe("transformGlossaryRows", () => {
  test("categories is array of trimmed strings for categorical type", () => {
    const row = {
      ...baseRow,
      type: "categorical",
      categories: "fixation, center, target",
    };
    const [entry] = transformGlossaryRows([row]);
    expect(entry.categories).toEqual(["fixation", "center", "target"]);
  });

  test("categories is array of trimmed strings for multicategorical type", () => {
    const row = {
      ...baseRow,
      type: "multicategorical",
      categories: "typical, paper, object",
    };
    const [entry] = transformGlossaryRows([row]);
    expect(entry.categories).toEqual(["typical", "paper", "object"]);
  });

  test("categories is empty array for non-categorical types", () => {
    const [entry] = transformGlossaryRows([baseRow]);
    expect(entry.categories).toEqual([]);
  });

  test("excludes rows whose name contains __", () => {
    const privateRow = { ...baseRow, name: "__internalParam" };
    const result = transformGlossaryRows([privateRow, baseRow]);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("_about");
  });

  test("each entry has all seven GlossaryEntry fields", () => {
    const result = transformGlossaryRows([baseRow]);
    expect(result).toHaveLength(1);
    const entry = result[0];
    expect(entry).toHaveProperty("name", "_about");
    expect(entry).toHaveProperty("availability", "now");
    expect(entry).toHaveProperty("type", "text");
    expect(entry).toHaveProperty("default", "");
    expect(entry).toHaveProperty("explanation", "Some explanation.");
    expect(entry).toHaveProperty("example", "Effect of font on crowding.");
    expect(entry).toHaveProperty("categories");
  });
});
