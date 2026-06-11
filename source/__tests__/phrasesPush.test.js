import {
  extractEnglishMap,
  buildDiffPayload,
  isWhiteBackground,
  buildTranslatePayload,
  findMissingTranslatableKeys,
  planWriteBack,
} from "../appsScript/phrasesPush";

describe("extractEnglishMap", () => {
  it("extracts { key: en } from sheet rows", () => {
    const rows = [
      ["key", "en", "fr", "de"],
      ["greeting", "Hello", "Bonjour", "Hallo"],
      ["farewell", "Goodbye", "Au revoir", "Auf Wiedersehen"],
    ];
    expect(extractEnglishMap(rows)).toEqual({
      greeting: "Hello",
      farewell: "Goodbye",
    });
  });

  it("skips rows with empty key", () => {
    const rows = [
      ["key", "en", "fr"],
      ["hello", "Hello", "Bonjour"],
      ["", "Empty key row", ""],
    ];
    expect(extractEnglishMap(rows)).toEqual({ hello: "Hello" });
  });

  it("returns empty object when fewer than 2 rows", () => {
    expect(extractEnglishMap([["key", "en"]])).toEqual({});
  });

  it("returns empty object when key or en column is missing", () => {
    const rows = [
      ["phrase", "fr"],
      ["hello", "Bonjour"],
    ];
    expect(extractEnglishMap(rows)).toEqual({});
  });
});

describe("buildDiffPayload", () => {
  it("wraps english map in diff action payload", () => {
    const english = { greeting: "Hello", farewell: "Goodbye" };
    expect(buildDiffPayload(english)).toEqual({
      action: "diff",
      english: { greeting: "Hello", farewell: "Goodbye" },
    });
  });

  it("works with an empty english map", () => {
    expect(buildDiffPayload({})).toEqual({ action: "diff", english: {} });
  });
});

describe("isWhiteBackground", () => {
  it("returns true for lowercase #ffffff", () => {
    expect(isWhiteBackground("#ffffff")).toBe(true);
  });

  it("returns true for uppercase #FFFFFF (normalizes hex)", () => {
    expect(isWhiteBackground("#FFFFFF")).toBe(true);
  });

  it("returns true for empty string (Google Sheets default)", () => {
    expect(isWhiteBackground("")).toBe(true);
  });

  it("returns false for blue (#e8f0fe)", () => {
    expect(isWhiteBackground("#e8f0fe")).toBe(false);
  });

  it("returns false for black (#000000)", () => {
    expect(isWhiteBackground("#000000")).toBe(false);
  });

  it("returns false for any non-white colour", () => {
    expect(isWhiteBackground("#aabbcc")).toBe(false);
  });
});

describe("buildTranslatePayload", () => {
  const rows = [
    ["key", "en", "fr", "de"],
    ["greeting", "Hello", "Bonjour", "Hallo"],
    ["farewell", "Goodbye", "Au revoir", "Auf Wiedersehen"],
  ];
  const backgrounds = [
    ["#ffffff", "#ffffff", "#ffffff", "#ffffff"],
    ["#ffffff", "#ffffff", "#e8f0fe", "#ffffff"],
    ["#ffffff", "#ffffff", "#ffffff", "#e8f0fe"],
  ];

  it("builds translate payload with correct colorMask and sentValues", () => {
    const result = buildTranslatePayload(
      rows,
      backgrounds,
      ["greeting"],
      "v1",
      false,
    );
    expect(result).toEqual({
      action: "translate",
      changedPhrases: { greeting: "Hello" },
      colorMask: { greeting: { fr: true, de: false } },
      sentValues: { greeting: { fr: "Bonjour", de: "Hallo" } },
      currentVersion: "v1",
    });
  });

  it("uses action fullResync when isFullResync is true", () => {
    const result = buildTranslatePayload(
      rows,
      backgrounds,
      ["greeting"],
      "v2",
      true,
    );
    expect(result.action).toBe("fullResync");
  });

  it("handles null currentVersion", () => {
    const result = buildTranslatePayload(
      rows,
      backgrounds,
      ["greeting"],
      null,
      false,
    );
    expect(result.currentVersion).toBeNull();
  });

  it("only includes changedKeys, not all rows", () => {
    const result = buildTranslatePayload(
      rows,
      backgrounds,
      ["greeting"],
      "v1",
      false,
    );
    expect(Object.keys(result.changedPhrases)).toEqual(["greeting"]);
  });

  it("skips keys not found in the sheet", () => {
    const result = buildTranslatePayload(
      rows,
      backgrounds,
      ["missing_key"],
      "v1",
      false,
    );
    expect(result.changedPhrases).toEqual({});
  });
});

describe("findMissingTranslatableKeys", () => {
  it("returns keys where all target cells are white (mask all false)", () => {
    const colorMask = {
      greeting: { fr: true, de: false },
      farewell: { fr: false, de: false },
      newPhrase: { fr: false, de: false },
    };
    expect(
      findMissingTranslatableKeys(colorMask, [
        "greeting",
        "farewell",
        "newPhrase",
      ]),
    ).toEqual(["farewell", "newPhrase"]);
  });

  it("returns empty array when all keys have at least one translatable cell", () => {
    const colorMask = {
      greeting: { fr: true, de: false },
      farewell: { fr: false, de: true },
    };
    expect(
      findMissingTranslatableKeys(colorMask, ["greeting", "farewell"]),
    ).toEqual([]);
  });

  it("returns key when it has no target language cells at all", () => {
    const colorMask = { orphan: {} };
    expect(findMissingTranslatableKeys(colorMask, ["orphan"])).toEqual([
      "orphan",
    ]);
  });
});

describe("planWriteBack", () => {
  const rows = [
    ["key", "en", "fr", "de"],
    ["greeting", "Hello", "", ""],
    ["farewell", "Goodbye", "", ""],
  ];

  it("maps translated values to { rowIndex, colIndex, value } write ops", () => {
    const translatedRows = {
      greeting: { en: "Hello", fr: "Bonjour", de: "Hallo" },
    };
    expect(planWriteBack(translatedRows, rows)).toEqual([
      { rowIndex: 1, colIndex: 2, value: "Bonjour" },
      { rowIndex: 1, colIndex: 3, value: "Hallo" },
    ]);
  });

  it("never touches the key column (index 0)", () => {
    const translatedRows = {
      greeting: { key: "should-be-ignored", fr: "Bonjour" },
    };
    const writes = planWriteBack(translatedRows, rows);
    expect(writes.every((w) => w.colIndex !== 0)).toBe(true);
  });

  it("never touches the en column", () => {
    const translatedRows = {
      greeting: { en: "should-be-ignored", fr: "Bonjour" },
    };
    const writes = planWriteBack(translatedRows, rows);
    expect(writes.every((w) => w.colIndex !== 1)).toBe(true);
  });

  it("skips rows not found in the sheet", () => {
    const translatedRows = { unknown_key: { fr: "Bonjour" } };
    expect(planWriteBack(translatedRows, rows)).toEqual([]);
  });

  it("handles multiple keys in translatedRows", () => {
    const translatedRows = {
      greeting: { fr: "Bonjour" },
      farewell: { de: "Auf Wiedersehen" },
    };
    expect(planWriteBack(translatedRows, rows)).toEqual([
      { rowIndex: 1, colIndex: 2, value: "Bonjour" },
      { rowIndex: 2, colIndex: 3, value: "Auf Wiedersehen" },
    ]);
  });
});
