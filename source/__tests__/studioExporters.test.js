// The Studio's xlsx export: text cells the compiler reads back unchanged, with
// the skipped rows/columns filled in the grid's grey (exporters.ts buildXlsx).
import ExcelJS from "exceljs/dist/exceljs.min.js";
import {
  buildXlsx,
  SKIPPED_FILL_ARGB,
  SKIPPED_TEXT_ARGB,
} from "../studio/exporters";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const matrix = [
  ["block", "", "1", "1"],
  ["%conditionName", "", "old", "old"],
  ["conditionEnabledBool", "", "", "FALSE"],
  ["conditionName", "", "a", "b"],
];

const load = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook.worksheets[0];
};

describe("buildXlsx", () => {
  it("writes every value as text, leaving blanks empty", async () => {
    const sheet = await load(await buildXlsx(matrix));
    expect(sheet.getCell("A1").value).toBe("block");
    expect(sheet.getCell("C1").value).toBe("1");
    expect(sheet.getCell("B1").value).toBeNull();
    expect(sheet.getCell("D3").value).toBe("FALSE");
    expect(sheet.getCell("A4").value).toBe("conditionName");
    expect(sheet.getCell("A1").fill?.fgColor).toBeUndefined();
  });

  it("fills the skipped row and column, and nothing else", async () => {
    const sheet = await load(
      await buildXlsx(matrix, { rows: [1], columns: [3] }),
    );
    const filled = (ref) => sheet.getCell(ref).fill?.fgColor?.argb;
    const muted = (ref) => sheet.getCell(ref).font?.color?.argb;
    expect(sheet.getCell("A2").fill?.type).toBe("pattern");
    expect(sheet.getCell("A2").fill?.pattern).toBe("solid");
    // Row 2 (the commented row), across the table's width.
    for (const ref of ["A2", "B2", "C2", "D2"]) {
      expect(filled(ref)).toBe(SKIPPED_FILL_ARGB);
      expect(muted(ref)).toBe(SKIPPED_TEXT_ARGB);
      expect(sheet.getCell(ref).font.italic).toBe(true);
    }
    // Column D (the disabled column), down every row.
    for (const ref of ["D1", "D3", "D4"])
      expect(filled(ref)).toBe(SKIPPED_FILL_ARGB);
    // Untouched cells carry no fill.
    for (const ref of ["A1", "C1", "A3", "C4"])
      expect(filled(ref)).toBeUndefined();
  });
});

// The downloads (exporters.ts): csv, xlsx and the signed-out source archive.
import JSZip from "jszip";
import { saveAs } from "file-saver";
import {
  exportCsv,
  exportSourceZip,
  exportXlsx,
  tableToCsvFile,
} from "../studio/exporters";

jest.mock("file-saver", () => ({ saveAs: jest.fn() }));
const saved = () => saveAs.mock.calls[saveAs.mock.calls.length - 1];

/** jsdom's Blob has no text()/arrayBuffer(): read it with FileReader. */
const readBlob = (blob, as = "text") =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    if (as === "text") reader.readAsText(blob);
    else reader.readAsArrayBuffer(blob);
  });
const bytesOf = async (blob) => [
  ...new Uint8Array(await readBlob(blob, "bytes")),
];
/** A dropped file as the Studio sees it: a name and bytes. */
const droppedFile = (bytes, name) => ({
  name,
  arrayBuffer: async () =>
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
});

describe("csv export", () => {
  it("writes the matrix as the csv a drop on the compiler would accept", async () => {
    const file = tableToCsvFile(matrix, "myExperiment");
    expect(file.name).toBe("myExperiment.csv");
    expect(file.type).toBe("text/csv;charset=utf-8");
    expect(await readBlob(file)).toBe(
      [
        "block,,1,1",
        "%conditionName,,old,old",
        "conditionEnabledBool,,,FALSE",
        "conditionName,,a,b",
      ].join("\r\n"),
    );
  });

  it("quotes cells with commas, quotes or newlines, and leaves ragged rows ragged", async () => {
    const file = tableToCsvFile(
      [["a", "", 'say "hi", ok'], ["b", "", "line1\nline2"], ["c"]],
      "x",
    );
    expect(await readBlob(file)).toBe(
      ['a,,"say ""hi"", ok"', 'b,,"line1\nline2"', "c"].join("\r\n"),
    );
  });

  it("downloads <name>.csv", () => {
    saveAs.mockClear();
    exportCsv(matrix, "myExperiment");
    const [blob, name] = saved();
    expect(name).toBe("myExperiment.csv");
    expect(blob).toBeInstanceOf(File);
  });
});

describe("xlsx export", () => {
  it("downloads <name>.xlsx with the skipped cells tinted", async () => {
    saveAs.mockClear();
    await exportXlsx(matrix, "myExperiment", { rows: [1], columns: [3] });
    const [blob, name] = saved();
    expect(name).toBe("myExperiment.xlsx");
    expect(blob.type).toBe(XLSX_MIME);
    const sheet = await load(await readBlob(blob, "bytes"));
    expect(sheet.getCell("A1").value).toBe("block");
    expect(sheet.getCell("D3").value).toBe("FALSE");
    expect(sheet.getCell("A2").fill?.fgColor?.argb).toBe(SKIPPED_FILL_ARGB);
    expect(sheet.getCell("C4").fill?.fgColor).toBeUndefined();
  });

  it("round-trips text that a spreadsheet would otherwise retype", async () => {
    const m = [
      ["a", "", "007", "1e3"],
      ["b", "", "TRUE", "=1+1"],
    ];
    const sheet = await load(await buildXlsx(m));
    expect(sheet.getCell("C1").value).toBe("007");
    expect(sheet.getCell("D1").value).toBe("1e3");
    expect(sheet.getCell("C2").value).toBe("TRUE");
    expect(sheet.getCell("D2").value).toBe("=1+1");
  });

  it("handles an empty matrix and skips out-of-range tints", async () => {
    const empty = await load(await buildXlsx([], { rows: [0], columns: [2] }));
    expect(empty.rowCount).toBe(0);
    const sheet = await load(
      await buildXlsx([["a", "", "1"]], { rows: [5], columns: [7] }),
    );
    expect(sheet.getCell("A1").fill?.fgColor).toBeUndefined();
    // A skipped column is tinted down every row, creating cells as needed.
    expect(sheet.getCell("H1").fill?.fgColor?.argb).toBe(SKIPPED_FILL_ARGB);
  });

  it("tints a blank cell inside a skipped column, which then exists only to carry the tint", async () => {
    const tinted = await load(
      await buildXlsx(
        [
          ["a", "", "x"],
          ["b", "", ""],
        ],
        { rows: [], columns: [2] },
      ),
    );
    expect(tinted.getCell("C2").value).toBeNull();
    expect(tinted.getCell("C2").fill?.fgColor?.argb).toBe(SKIPPED_FILL_ARGB);
    expect(tinted.getCell("C2").font?.color?.argb).toBe(SKIPPED_TEXT_ARGB);
    expect(tinted.getCell("C1").fill?.fgColor?.argb).toBe(SKIPPED_FILL_ARGB);
  });

  it("reads the tint back from a cell that is blank in the tinted row too", async () => {
    // The Studio always passes both lists; an xlsx from the export re-imports
    // with the same skipped cells (tableModel skippedCells reads content).
    const sheet = await load(
      await buildXlsx(
        [
          ["%old", "", "", ""],
          ["a", "", "1", "2"],
        ],
        { rows: [0], columns: [3] },
      ),
    );
    for (const ref of ["A1", "B1", "C1", "D1", "D2"])
      expect(sheet.getCell(ref).fill?.fgColor?.argb).toBe(SKIPPED_FILL_ARGB);
  });
});

describe("exportSourceZip", () => {
  it("bundles the csv and the dropped files verbatim as <name>.raw.source.zip", async () => {
    saveAs.mockClear();
    const font = droppedFile(new Uint8Array([0, 1, 2, 255]), "Sloan.woff2");
    const form = droppedFile(
      new Uint8Array(Buffer.from("# Consent")), // jsdom realm, for JSZip
      "consent.md",
    );
    await exportSourceZip(matrix, [font, form], "myExperiment");
    const [blob, name] = saved();
    expect(name).toBe("myExperiment.raw.source.zip");
    const zip = await JSZip.loadAsync(await readBlob(blob, "bytes"));
    expect(Object.keys(zip.files).sort()).toEqual([
      "Sloan.woff2",
      "consent.md",
      "myExperiment.csv",
    ]);
    expect(await zip.file("myExperiment.csv").async("string")).toBe(
      await readBlob(tableToCsvFile(matrix, "x")),
    );
    expect([
      ...new Uint8Array(await zip.file("Sloan.woff2").async("arraybuffer")),
    ]).toEqual([0, 1, 2, 255]);
    expect(await zip.file("consent.md").async("string")).toBe("# Consent");
  });

  it("works with no dropped files", async () => {
    saveAs.mockClear();
    await exportSourceZip(matrix, [], "solo");
    const [blob] = saved();
    const zip = await JSZip.loadAsync(await readBlob(blob, "bytes"));
    expect(Object.keys(zip.files)).toEqual(["solo.csv"]);
  });
});
