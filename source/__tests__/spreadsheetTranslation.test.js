jest.mock("../translateExportApi", () => ({
  translateExport: jest.fn(),
  TranslateExportError: class TranslateExportError extends Error {},
}));

jest.mock("xlsx", () => ({
  utils: {
    aoa_to_sheet: jest.fn(() => ({})),
  },
  write: jest.fn(() => new Uint8Array([1, 2, 3])),
}));

const { translateExport } = require("../translateExportApi");
const { translateAndSerialize } = require("../spreadsheetTranslation");

describe("translateAndSerialize", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Tracer bullet: the function calls translateExport with unique extracted
  // texts and the language code, then applies the translations to the AOA.
  it("passes extracted texts and lang.code to translateExport, and the translation appears in CSV output", async () => {
    translateExport.mockResolvedValueOnce(["Bonjour"]);

    const aoa = [
      ["parameter", "c1"],
      ["blockCondition", "Hello"],
      ["targetFont", "Arial"],
    ];
    const lang = { code: "FR", label: "French" };

    const result = await translateAndSerialize(
      aoa,
      ["blockCondition"],
      lang,
      "csv",
    );

    expect(translateExport).toHaveBeenCalledWith(["Hello"], "FR");
    expect(result).toContain("Bonjour");
    expect(result).toContain("Arial");
  });

  it("builds the translation map by pairing texts[i] with translations[i]", async () => {
    translateExport.mockResolvedValueOnce(["Bonjour", "Monde"]);

    const aoa = [
      ["parameter", "c1", "c2"],
      ["blockCondition", "Hello", "World"],
    ];
    const lang = { code: "FR", label: "French" };

    const result = await translateAndSerialize(
      aoa,
      ["blockCondition"],
      lang,
      "csv",
    );

    expect(result).toContain("Bonjour");
    expect(result).toContain("Monde");
    expect(result).not.toContain("Hello");
    expect(result).not.toContain("World");
  });

  it("returns a Blob when ext is xlsx", async () => {
    translateExport.mockResolvedValueOnce([]);

    const result = await translateAndSerialize([], [], { code: "FR" }, "xlsx");

    expect(result).toBeInstanceOf(Blob);
  });

  it("returns a string when ext is csv", async () => {
    translateExport.mockResolvedValueOnce([]);

    const result = await translateAndSerialize([], [], { code: "FR" }, "csv");

    expect(typeof result).toBe("string");
  });
});
