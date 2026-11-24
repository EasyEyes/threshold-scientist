// Dropping a source archive on the compiler (source/components/dropzone.ts):
// the experiment table inside the zip must be found by what it is, not by
// which entry happens to finish decompressing last. Real JSZip, real
// classifiers; only the network/session edges are mocked.
jest.mock("sweetalert2", () => ({
  __esModule: true,
  default: { fire: jest.fn(), showLoading: jest.fn(), close: jest.fn() },
}));
jest.mock("../../threshold/preprocess/auth/ensureValidToken", () => ({
  ensureValidToken: jest.fn().mockResolvedValue(true),
}));
jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  createOrUpdateCommonResources: jest.fn().mockResolvedValue(undefined),
  getCommonResourcesNames: jest.fn().mockResolvedValue([]),
}));
jest.mock("../../threshold/preprocess/user", () => ({
  redirectToOauth2: jest.fn(),
}));
jest.mock("../components/phraseFileApi", () => ({
  translatePhraseFileApi: jest.fn(),
}));

import JSZip from "jszip";
import {
  chooseExperimentFile,
  handleDrop,
  looksLikeExperimentTable,
} from "../components/dropzone";
import { userRepoFiles } from "../../threshold/preprocess/constants";

// jsdom's File has neither; browsers do. Read it the way a polyfill would.
const readAs = (file, method) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader[method](file);
  });
beforeAll(() => {
  File.prototype.text = function () {
    return readAs(this, "readAsText");
  };
  File.prototype.arrayBuffer = function () {
    return readAs(this, "readAsArrayBuffer");
  };
});

/** A valid experiment table as CSV text. */
const experimentCsv = [
  "block,,1,1",
  "targetKind,,letter,letter",
  "targetTask,,identify,identify",
  "thresholdParameter,,targetSizeDeg,targetSizeDeg",
].join("\n");

/** Bytes with an xlsx-ish size: larger than the table, as a phrases sheet is. */
const spreadsheetBytes = () => new Uint8Array(24000).fill(65);

const archiveOf = async (entries) => {
  const zip = new JSZip();
  for (const [name, content] of entries) zip.file(name, content);
  return new File(
    [await zip.generateAsync({ type: "arraybuffer" })],
    "my.source.zip",
  );
};

const drop = async (file) => {
  const args = {
    addResourcesForApp: jest.fn(),
    handleExperimentFile: jest.fn(),
    handleArchiveBool: jest.fn(),
    handleArchiveZip: jest.fn(),
  };
  await handleDrop({ accessToken: "token" }, [file], ...Object.values(args));
  return args;
};

beforeEach(() => {
  jest.clearAllMocks();
  for (const key of Object.keys(userRepoFiles)) delete userRepoFiles[key];
});

describe("looksLikeExperimentTable", () => {
  it("reads the parameter column of a csv, a workbook, and a stored .xlsx", async () => {
    expect(
      await looksLikeExperimentTable(
        new File([experimentCsv], "myExperiment.csv"),
      ),
    ).toBe(true);
    expect(
      await looksLikeExperimentTable(
        new File(['"block","",1,1\r\n%blockNote,,x,x\r\n'], "quoted.csv"),
      ),
    ).toBe(true);
    // An .xlsx upload as the repository stores it: the rows as JSON.
    expect(
      await looksLikeExperimentTable(
        new File(
          [
            JSON.stringify([
              ["block", "", "1"],
              ["font", "", "x"],
            ]),
          ],
          "x.xlsx",
        ),
      ),
    ).toBe(true);
    // A real workbook: write one with SheetJS.
    const XLSX = require("xlsx");
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      book,
      XLSX.utils.aoa_to_sheet([
        ["block", "", "1"],
        ["font", "", "x"],
      ]),
      "Sheet1",
    );
    expect(
      await looksLikeExperimentTable(
        new File(
          [XLSX.write(book, { type: "array", bookType: "xlsx" })],
          "y.xlsx",
        ),
      ),
    ).toBe(true);
  });

  it("is false for phrases and response sheets, junk, and unreadable files", async () => {
    expect(
      await looksLikeExperimentTable(
        new File(
          [["ⓛLanguageCode,en,fr", "Ⓛintro,Hello,Bonjour"].join("\n")],
          "translations.csv",
        ),
      ),
    ).toBe(false);
    expect(
      await looksLikeExperimentTable(
        new File(["time,amplitude\n1,2"], "spk.gainVTime.csv"),
      ),
    ).toBe(false);
    expect(
      await looksLikeExperimentTable(
        new File(["blockages,,1\nnotBlock,,1"], "nope.csv"),
      ),
    ).toBe(false);
    expect(
      await looksLikeExperimentTable(
        new File([new Uint8Array(24000).fill(65)], "junk.xlsx"),
      ),
    ).toBe(false);
    expect(
      await looksLikeExperimentTable(new File(["not json ["], "broken.xlsx")),
    ).toBe(false);
    expect(await looksLikeExperimentTable({ name: "x.csv" })).toBe(false);
  });
});

describe("chooseExperimentFile", () => {
  const csv = (name, text) => new File([text], name);
  it("returns the only candidate untouched, and null for none, without reading it", async () => {
    const only = { name: "only.csv" }; // no text(): must not be read
    expect(await chooseExperimentFile([only])).toBe(only);
    expect(await chooseExperimentFile([])).toBeNull();
  });

  it("prefers the candidate with a block row, whichever position it is in", async () => {
    const phrases = csv("translations.csv", "ⓛLanguageCode,en\nⓁintro,Hello");
    const table = csv("myExperiment.csv", experimentCsv);
    expect(await chooseExperimentFile([phrases, table])).toBe(table);
    expect(
      await chooseExperimentFile([phrases, table, csv("more.csv", "a,b")]),
    ).toBe(table);
  });

  it("falls back to the first candidate when none looks like a table", async () => {
    const a = csv("a.csv", "x,y");
    const b = csv("b.csv", "1,2");
    expect(await chooseExperimentFile([a, b])).toBe(a);
  });
});

describe("handleDrop with a source archive", () => {
  it("picks the experiment table, not a larger spreadsheet that is not the table", async () => {
    // A language phrases spreadsheet need not be named *.phrases.xlsx (the
    // compiler accepts any name in _languagePhrasesSpreadsheet), and a
    // rigorous source.zip contains the study's phrases/ folder.
    const archive = await archiveOf([
      ["myExperiment.csv", experimentCsv],
      ["translations.xlsx", spreadsheetBytes()],
    ]);
    const { handleExperimentFile } = await drop(archive);
    expect(handleExperimentFile).toHaveBeenCalledTimes(1);
    expect(handleExperimentFile.mock.calls[0][0].name).toBe("myExperiment.csv");
    expect(userRepoFiles.experiment.name).toBe("myExperiment.csv");
  });

  it("is independent of the entry order inside the zip", async () => {
    const reversed = await archiveOf([
      ["translations.xlsx", spreadsheetBytes()],
      ["myExperiment.csv", experimentCsv],
    ]);
    const { handleExperimentFile } = await drop(reversed);
    expect(handleExperimentFile.mock.calls[0][0].name).toBe("myExperiment.csv");
  });

  it("routes patterned response sheets and *.phrases.xlsx to their lists", async () => {
    const archive = await archiveOf([
      ["myExperiment.csv", experimentCsv],
      ["spk.gainVTime.xlsx", spreadsheetBytes()],
      ["mic.gainVFreq.csv", "time,amplitude\n1,2"],
      ["noise.targetSoundList.csv", "targetSoundList\nx"],
      ["en.phrases.xlsx", spreadsheetBytes()],
    ]);
    const { handleExperimentFile } = await drop(archive);
    expect(handleExperimentFile.mock.calls[0][0].name).toBe("myExperiment.csv");
    expect(userRepoFiles.impulseResponses.map((f) => f.name)).toEqual([
      "spk.gainVTime.xlsx",
    ]);
    expect(userRepoFiles.frequencyResponses.map((f) => f.name)).toEqual([
      "mic.gainVFreq.csv",
    ]);
    expect(userRepoFiles.targetSoundLists.map((f) => f.name)).toEqual([
      "noise.targetSoundList.csv",
    ]);
    expect(userRepoFiles.phrases.map((f) => f.name)).toEqual([
      "en.phrases.xlsx",
    ]);
  });
});
