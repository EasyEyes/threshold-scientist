/**
 * Round-trip export: produces exactly the files today's compiler accepts,
 * so the studio slots into the existing pipeline with zero changes.
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export function exportCsv(matrix: string[][], name: string): void {
  const csv = Papa.unparse(matrix);
  saveAs(new Blob([csv], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
}

export function exportXlsx(matrix: string[][], name: string): void {
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${name}.xlsx`);
}

export async function exportSourceZip(
  matrix: string[][],
  resourceFiles: File[],
  name: string,
): Promise<void> {
  const zip = new JSZip();
  zip.file(`${name}.csv`, Papa.unparse(matrix));
  for (const f of resourceFiles) zip.file(f.name, await f.arrayBuffer());
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, `${name}.source.zip`);
}
