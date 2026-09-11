/**
 * Round-trip export: produces exactly the files today's compiler accepts,
 * so the studio slots into the existing pipeline with zero changes.
 */
import Papa from "papaparse";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { loadExcelJS } from "./excel";

/** Cells the compiler will skip, to be tinted in the export (tableModel.ts skippedCells). */
export interface SkippedCells {
  /** Matrix row indices of %-commented rows. */
  rows: number[];
  /** Matrix column indices of disabled columns (C is 2). */
  columns: number[];
}

/**
 * The grid's tint for skipped rows/columns (styles.css --off-bg), as Excel
 * writes it (ARGB) — a very light pastel red — and the muted grey of their text.
 */
export const SKIPPED_FILL_ARGB = "FFFDE8E8";
export const SKIPPED_TEXT_ARGB = "FF999999";

const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * The experiment table as the csv File the compiler accepts — what a
 * scientist would drop on the compiler after "Export csv".
 */
export function tableToCsvFile(matrix: string[][], name: string): File {
  return new File([Papa.unparse(matrix)], `${name}.csv`, {
    type: "text/csv;charset=utf-8",
  });
}

export function exportCsv(matrix: string[][], name: string): void {
  saveAs(tableToCsvFile(matrix, name), `${name}.csv`);
}

/**
 * The table as an xlsx workbook (one sheet, every cell text — what the
 * compiler's import reads back as the same csv), with the rows and columns
 * the compiler will skip filled in the grid's pale red and their text muted, so
 * the spreadsheet shows what the Studio shows. The colours are presentation
 * only: what makes a row or column skipped is its content (`%`,
 * conditionEnabledBool), so re-importing the file restores the tint too.
 * Written with ExcelJS (the compiler's own styled-xlsx writer, xlsxExport.ts),
 * loaded on first use (excel.js); SheetJS's community build cannot write fills.
 */
export async function buildXlsx(
  matrix: string[][],
  skipped: SkippedCells = { rows: [], columns: [] },
): Promise<ArrayBuffer> {
  const ExcelJS = await loadExcelJS();
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  const width = Math.max(0, ...matrix.map((r) => r.length));
  // Blank cells are left out (as SheetJS leaves them), so an empty string
  // never becomes a cell of its own.
  sheet.addRows(matrix.map((row) => row.map((v) => (v === "" ? null : v))));

  const tint = (rowIndex: number, columnIndex: number) => {
    const cell = sheet.getCell(rowIndex + 1, columnIndex + 1);
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: SKIPPED_FILL_ARGB },
    };
    cell.font = { italic: true, color: { argb: SKIPPED_TEXT_ARGB } };
  };
  for (const r of skipped.rows) for (let c = 0; c < width; c++) tint(r, c);
  for (const c of skipped.columns)
    for (let r = 0; r < matrix.length; r++) tint(r, c);

  return workbook.xlsx.writeBuffer();
}

export async function exportXlsx(
  matrix: string[][],
  name: string,
  skipped?: SkippedCells,
): Promise<void> {
  const buffer = await buildXlsx(matrix, skipped);
  saveAs(new Blob([buffer], { type: XLSX_MIME }), `${name}.xlsx`);
}

/**
 * Signed-out "Download source": the table plus the files dropped in this
 * session, which is everything the Studio can reach without a Pavlovia
 * session. Signed in, the Studio uses the compiler's own pre-compile export
 * instead (exportStudyBeforeCompiling), which also bundles every resource the
 * table names from EasyEyesResources. Both produce a `<name>.raw.source.zip`
 * — the uncompiled archive the compiler accepts like any *.source.zip.
 */
export async function exportSourceZip(
  matrix: string[][],
  resourceFiles: File[],
  name: string,
): Promise<void> {
  const zip = new JSZip();
  zip.file(`${name}.csv`, Papa.unparse(matrix));
  for (const f of resourceFiles) zip.file(f.name, await f.arrayBuffer());
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${name}.raw.source.zip`);
}
