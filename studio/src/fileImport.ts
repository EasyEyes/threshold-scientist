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
