import fs from "fs";
import path from "path";
import vm from "vm";

function loadAppsScript() {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../../apps-script/update-phrases.gs"),
    "utf8",
  );
  const context = vm.createContext({ console });
  vm.runInContext(source, context);
  return context;
}

describe("International Phrases freshness workflows", () => {
  const rows = [
    ["EE_LanguageCode", "en", "fr", "ar"],
    ["second", "Second", "Deuxième", "ثانية"],
    ["first", "First", "Premier", "أول"],
  ];

  test("builds identifier-based batches independent of row order", () => {
    const { buildFreshnessBatches } = loadAppsScript();
    expect(buildFreshnessBatches(rows, 1)).toEqual([
      {
        action: "checkFreshness",
        phrases: [
          {
            phraseName: "second",
            englishText: "Second",
            languageCodes: ["fr", "ar"],
          },
        ],
      },
      {
        action: "checkFreshness",
        phrases: [
          {
            phraseName: "first",
            englishText: "First",
            languageCodes: ["fr", "ar"],
          },
        ],
      },
    ]);
  });

  test("changes only target font colors and treats blanks as stale", () => {
    const { planFreshnessFontColors } = loadAppsScript();
    const values = rows.map((row) => row.slice());
    values[2][3] = "";
    const colors = values.map((row, rowIndex) =>
      row.map(() => (rowIndex === 0 ? "#123456" : "#654321")),
    );
    const planned = planFreshnessFontColors(values, colors, [
      { phraseName: "second", languageCode: "fr", fresh: true },
      { phraseName: "second", languageCode: "ar", fresh: false },
      { phraseName: "first", languageCode: "fr", fresh: true },
      { phraseName: "first", languageCode: "ar", fresh: true },
    ]);
    expect(planned[0]).toEqual(colors[0]);
    expect(planned[1]).toEqual(["#654321", "#654321", "#000000", "#ff0000"]);
    expect(planned[2]).toEqual(["#654321", "#654321", "#000000", "#ff0000"]);
  });

  test("plans compact deletion bottom-up and right-to-left", () => {
    const { planCompactTranslationRequest } = loadAppsScript();
    const paddedRows = rows.concat(
      Array.from({ length: 7 }, (_, index) => ["meta" + index, "", "", ""]),
      [["onlyFresh", "Fresh", "Frais", "طازج"]],
    );
    const backgrounds = paddedRows.map((row) => row.map(() => "#ffffff"));
    backgrounds[2][2] = "#ffff00";
    backgrounds[10][3] = "#ffff00";
    const plan = planCompactTranslationRequest(paddedRows, backgrounds, [
      { phraseName: "first", languageCode: "fr", fresh: false },
      { phraseName: "onlyFresh", languageCode: "ar", fresh: true },
    ]);
    expect(plan.rowsToDelete).toEqual([10, 9]);
    expect(plan.columnsToDelete).toEqual([3]);
    expect(plan.clears).toContainEqual({ rowIndex: 1, colIndex: 2 });
    expect(plan.clears).not.toContainEqual({ rowIndex: 2, colIndex: 2 });
  });
});
