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

describe("returned translation validation", () => {
  test("marks returned-sheet translation payloads as validated imports", () => {
    const { buildTranslationImportPayload } = loadAppsScript();
    const payload = buildTranslationImportPayload(
      { first: "First" },
      { first: { fr: "#ffff00" } },
      { first: { fr: "Premier" } },
      ["en", "fr"],
      "1.0",
      "operation-id",
      1,
      1,
      1,
    );

    expect(payload.translationImport).toBe(true);
    expect(payload.changedPhrases).toEqual({ first: "First" });
  });

  test("matches moved rows and columns using stable identifiers", () => {
    const { validateTranslationImport } = loadAppsScript();
    const current = [
      ["EE_LanguageCode", "en", "fr", "ar"],
      ["first", "First", "Premier", "أول"],
      ["second", "Second", "Deuxième", "ثانية"],
    ];
    const compact = [
      ["EE_LanguageCode", "en", "ar", "fr"],
      ["second", "Second", "ثانية جديدة", "Deuxième"],
      ["first", "First", "أول", "Nouveau"],
    ];
    const backgrounds = compact.map((row) => row.map(() => "#ffffff"));
    backgrounds[1][2] = "#ffff00";
    backgrounds[2][3] = "#00ffff";
    expect(validateTranslationImport(compact, backgrounds, current)).toEqual({
      conflicts: [],
      incoming: [
        {
          phraseName: "second",
          languageCode: "ar",
          englishText: "Second",
          value: "ثانية جديدة",
          background: "#ffff00",
        },
        {
          phraseName: "first",
          languageCode: "fr",
          englishText: "First",
          value: "Nouveau",
          background: "#00ffff",
        },
      ],
    });
  });

  test("collects every English conflict before any caller mutation", () => {
    const { validateTranslationImport, formatEnglishConflicts } =
      loadAppsScript();
    const current = [
      ["EE_LanguageCode", "en", "fr"],
      ["first", "Current first", "Premier"],
      ["second", "Current second", "Deuxième"],
    ];
    const compact = [
      ["EE_LanguageCode", "en", "fr"],
      ["first", "Old first", "Nouveau"],
      ["second", "Old second", "Nouvelle"],
    ];
    const backgrounds = compact.map((row) => row.map(() => "#ffffff"));
    backgrounds[1][2] = "#ffff00";
    backgrounds[2][2] = "#ffff00";
    const result = validateTranslationImport(compact, backgrounds, current);
    expect(result.conflicts).toHaveLength(2);
    const report = formatEnglishConflicts(result.conflicts);
    expect(report).toContain(
      "first\nReturned: Old first\nInternational: Current first",
    );
    expect(report).toContain(
      "second\nReturned: Old second\nInternational: Current second",
    );
  });

  test.each([
    [
      "duplicate phrase",
      [
        ["EE_LanguageCode", "en", "fr"],
        ["same", "One", ""],
        ["same", "Two", ""],
      ],
    ],
    [
      "duplicate language",
      [
        ["EE_LanguageCode", "en", "fr", "fr"],
        ["same", "One", "", ""],
      ],
    ],
  ])("rejects %s identifiers", (_label, compact) => {
    const { validateTranslationImport } = loadAppsScript();
    const backgrounds = compact.map((row) => row.map(() => "#ffffff"));
    expect(() =>
      validateTranslationImport(compact, backgrounds, [
        ["EE_LanguageCode", "en", "fr"],
        ["same", "One", ""],
      ]),
    ).toThrow("Duplicate");
  });
});
