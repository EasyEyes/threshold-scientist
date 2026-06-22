import { translateExport, TranslateExportError } from "../translateExportApi";

jest.mock("../../threshold/components/easyeyesBaseUrl", () => ({
  getEasyEyesBaseUrl: () => "",
}));

global.fetch = jest.fn();

describe("translateExport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POSTs strings and targetLangCode to translate-experiment and returns translations in order", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: jest
        .fn()
        .mockResolvedValueOnce({ translations: ["Hola", "Mundo"] }),
    });

    const result = await translateExport(["Hello", "World"], "ES");

    expect(global.fetch).toHaveBeenCalledWith(
      "/.netlify/functions/translate-experiment",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texts: ["Hello", "World"], targetLang: "ES" }),
      },
    );
    expect(result).toEqual(["Hola", "Mundo"]);
  });

  it("throws TranslateExportError on a non-OK response", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 422 });

    await expect(translateExport(["Hello"], "ES")).rejects.toThrow(
      TranslateExportError,
    );
  });

  it("includes the HTTP status in the TranslateExportError message", async () => {
    global.fetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(translateExport(["Hello"], "ES")).rejects.toThrow("500");
  });
});
