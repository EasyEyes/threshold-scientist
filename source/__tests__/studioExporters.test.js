// The Studio's xlsx export: text cells the compiler reads back unchanged, with
// the skipped rows/columns filled in the grid's grey (exporters.ts buildXlsx).
import ExcelJS from "exceljs/dist/exceljs.min.js";
import {
  buildXlsx,
  SKIPPED_FILL_ARGB,
  SKIPPED_TEXT_ARGB,
} from "../studio/exporters";

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
