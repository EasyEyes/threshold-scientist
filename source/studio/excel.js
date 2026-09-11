/**
 * ExcelJS, loaded on first use. A JavaScript module on purpose: webpack turns
 * this `import()` into a separate chunk (ts-loader, with tsconfig's
 * `module: commonjs`, would compile it to a plain require and put the ~1 MB
 * library in the compiler's main bundle). The browser bundle is the one the
 * compiler's own styled-xlsx writer uses (threshold/preprocess/xlsxExport.ts).
 *
 * @returns {Promise<any>} the ExcelJS namespace (`new ExcelJS.Workbook()`)
 */
export const loadExcelJS = () =>
  import("exceljs/dist/exceljs.min.js").then((m) => m.default ?? m);
