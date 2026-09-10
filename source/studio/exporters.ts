/**
 * Round-trip export: produces exactly the files today's compiler accepts,
 * so the studio slots into the existing pipeline with zero changes.
 */
import Papa from "papaparse";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { saveAs } from "file-saver";

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

export function exportXlsx(matrix: string[][], name: string): void {
  const ws = XLSX.utils.aoa_to_sheet(matrix);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${name}.xlsx`);
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
