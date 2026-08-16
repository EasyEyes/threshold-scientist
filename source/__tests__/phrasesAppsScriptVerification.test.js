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

describe("International Phrases completion verification", () => {
  test("does not automatically translate Nigerian Pidgin cells", () => {
    const { isAutomaticallyTranslatedLanguage } = loadAppsScript();

    expect(isAutomaticallyTranslatedLanguage("pcm")).toBe(false);
    expect(isAutomaticallyTranslatedLanguage("tl")).toBe(true);
  });

  test("omits Nigerian Pidgin from phrase translation payloads", () => {
    const { buildTranslatePayload } = loadAppsScript();
    const rows = [
      ["EE_LanguageCode", "en", "pcm", "tl"],
      ["example", "Hello", "", "Kumusta"],
    ];
    const backgrounds = [
      ["#ffffff", "#ffffff", "#ffffff", "#ffffff"],
      ["#ffffff", "#ffffff", "#ffffff", "#ffffff"],
    ];

    const payload = buildTranslatePayload(
      rows,
      backgrounds,
      ["example"],
      "1.0",
      false,
    );

    expect(payload.colorMask.example).toEqual({ tl: "#ffffff" });
    expect(payload.sentValues.example).toEqual({ tl: "Kumusta" });
    expect(payload.activeLanguages).toEqual(["en", "pcm", "tl"]);
  });

  test("retries a transient phrases API failure before returning", () => {
    const transient = {
      getResponseCode: () => 503,
      getContentText: () => "temporarily unavailable",
    };
    const success = {
      getResponseCode: () => 200,
      getContentText: () => "{}",
    };
    const fetch = jest
      .fn()
      .mockReturnValueOnce(transient)
      .mockReturnValueOnce(success);
    const source = fs.readFileSync(
      path.resolve(__dirname, "../../apps-script/update-phrases.gs"),
      "utf8",
    );
    const context = vm.createContext({
      console,
      UrlFetchApp: { fetch },
      Utilities: { sleep: jest.fn() },
    });
    vm.runInContext(source, context);

    expect(context.fetchPhrasesWithRetry("https://example.test", {})).toBe(
      success,
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("rejects an API success response that lacks persistence verification", () => {
    const { parseVerifiedPhrasesResult } = loadAppsScript();

    expect(() =>
      parseVerifiedPhrasesResult(
        JSON.stringify({ newVersion: "1.1", translatedRows: {} }),
      ),
    ).toThrow("did not confirm persisted data");
  });

  test("reports exact sheet cells whose written values do not read back", () => {
    const { findUnverifiedSheetWrites } = loadAppsScript();
    const writes = [
      { rowIndex: 1, colIndex: 2, value: "Bonjour" },
      { rowIndex: 2, colIndex: 2, value: "Au revoir" },
    ];
    const sheet = {
      getRange: (row, column) => ({
        getDisplayValue: () =>
          row === 2 && column === 3 ? "Wrong value" : "Au revoir",
      }),
    };

    expect(findUnverifiedSheetWrites(sheet, writes)).toEqual([
      {
        coordinate: "C2",
        expected: "Bonjour",
        actual: "Wrong value",
      },
    ]);
  });
});
