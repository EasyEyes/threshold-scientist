/**
 * File import, byte-compatible with the production compiler (main.ts):
 * xlsx → first sheet → sheet_to_csv → PapaParse with skipEmptyLines.
 */
import Papa from "papaparse";
import { read, utils } from "xlsx";

/**
 * Excel files routinely carry an inflated "used range" (stray formatting,
 * deleted-but-remembered cells), which sheet_to_csv faithfully emits as
 * hundreds of empty trailing columns and comma-only rows. Cut the matrix
 * down to its real content: drop all-blank rows and trim every row at the
 * table's last non-blank column.
 */
function trimPhantomCells(matrix: string[][]): string[][] {
  let width = 0;
  for (const row of matrix) {
    for (let i = row.length - 1; i >= 0; i--) {
      if ((row[i] ?? "").trim() !== "") {
        width = Math.max(width, i + 1);
        break;
      }
    }
  }
  width = Math.max(width, 2);
  return matrix
    .filter((row) => row.some((c) => (c ?? "").trim() !== ""))
    .map((row) => row.slice(0, width));
}

export function parseCsvString(csv: string): string[][] {
  const parsed = Papa.parse<string[]>(csv, { skipEmptyLines: true });
  return trimPhantomCells(parsed.data as string[][]);
}

export async function fileToMatrix(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const buf = await file.arrayBuffer();
    const book = read(buf, { type: "array" });
    const first = book.SheetNames[0];
    return parseCsvString(utils.sheet_to_csv(book.Sheets[first]));
  }
  return parseCsvString(await file.text());
}

const cellToString = (cell: unknown): string =>
  cell === null || cell === undefined ? "" : String(cell);

/**
 * The experiment table as a compile committed it to the root of the
 * experiment repository. A `.csv` upload is stored as-is; an `.xlsx` upload
 * keeps its name but is stored as the first sheet's rows in JSON
 * (`JSON.stringify(sheet_to_json(sheet, { header: 1 }))` —
 * threshold/preprocess/fileUtils.ts readXLSXFile), so its cells may be
 * numbers or booleans and its rows ragged. Either way the result is the
 * matrix the Studio's own import would produce for that table.
 */
export function repoTableToMatrix(fileName: string, text: string): string[][] {
  if (/\.xlsx$/i.test(fileName) && text.trimStart().startsWith("[")) {
    const rows = JSON.parse(text) as unknown[];
    return trimPhantomCells(
      rows.map((row) => (Array.isArray(row) ? row.map(cellToString) : [])),
    );
  }
  return parseCsvString(text);
}
