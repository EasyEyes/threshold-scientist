import { parsePhraseFile } from "../components/parsePhraseFile";
import * as XLSX from "xlsx";

jest.mock("xlsx", () => ({
  read: jest.fn(),
  utils: { sheet_to_json: jest.fn() },
}));

function makeFileReaderStub(buffer) {
  return class {
    readAsArrayBuffer(_file) {
      this.result = buffer;
      Promise.resolve().then(() => {
        this.onload && this.onload({ target: { result: buffer } });
      });
    }
  };
}

const DUMMY_BUFFER = new ArrayBuffer(8);
const DUMMY_WORKBOOK = { SheetNames: ["Sheet1"], Sheets: { Sheet1: {} } };

beforeEach(() => {
  jest.clearAllMocks();
  XLSX.read.mockReturnValue(DUMMY_WORKBOOK);
  global.FileReader = makeFileReaderStub(DUMMY_BUFFER);
});

// ── Cycle 1: valid xlsx ───────────────────────────────────────────────────────

describe("parsePhraseFile — valid xlsx", () => {
  it("returns phraseTable, sourceLanguageCode, and availableLanguageCodes", async () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ["~LanguageCode", "en", "ar"],
      ["~LettersAndReading", "Letters and Reading", "الحروف والقراءة"],
      ["~WelcomeMessage", "Welcome", "مرحبا"],
    ]);

    const file = new File([""], "phrases.xlsx");
    const result = await parsePhraseFile(file);

    expect(result.sourceLanguageCode).toBe("en");
    expect(result.availableLanguageCodes).toEqual(["en", "ar"]);

    expect(result.phraseTable.get("lettersandreading")).toEqual(
      new Map([
        ["en", "Letters and Reading"],
        ["ar", "الحروف والقراءة"],
      ]),
    );
    expect(result.phraseTable.get("welcomemessage")).toEqual(
      new Map([
        ["en", "Welcome"],
        ["ar", "مرحبا"],
      ]),
    );
    expect(result.phraseTable.get("languagecode")).toEqual(
      new Map([
        ["en", "en"],
        ["ar", "ar"],
      ]),
    );
  });

  it("normalises symbolic name keys to lowercase regardless of input casing", async () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ["~LanguageCode", "fr"],
      ["~MixedCaseKey", "Bonjour"],
    ]);

    const file = new File([""], "phrases.xlsx");
    const result = await parsePhraseFile(file);

    expect(result.phraseTable.has("mixedcasekey")).toBe(true);
    expect(result.phraseTable.has("MixedCaseKey")).toBe(false);
  });
});

// ── Cycle 2: missing ~LanguageCode row ────────────────────────────────────────

describe("parsePhraseFile — missing ~LanguageCode row", () => {
  it("rejects with a descriptive error naming the missing row", async () => {
    XLSX.utils.sheet_to_json.mockReturnValue([
      ["~WelcomeMessage", "Hello", "Hola"],
    ]);

    const file = new File([""], "phrases.xlsx");
    await expect(parsePhraseFile(file)).rejects.toThrow("~LanguageCode");
  });
});

// ── Cycle 3: single-column xlsx ───────────────────────────────────────────────

describe("parsePhraseFile — single-column xlsx", () => {
  it("rejects with a descriptive error when no language columns exist", async () => {
    XLSX.utils.sheet_to_json.mockReturnValue([["~LanguageCode"], ["~Hello"]]);

    const file = new File([""], "phrases.xlsx");
    await expect(parsePhraseFile(file)).rejects.toThrow(/no language columns/i);
  });
});
