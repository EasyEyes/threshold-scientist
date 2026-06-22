import * as XLSX from "xlsx";
import Papa from "papaparse";
import {
  extractTranslatableTexts,
  applyTranslations,
} from "./experimentTranslator";
import { translateExport } from "./translateExportApi";

export async function translateAndSerialize(aoa, translationKeys, lang, ext) {
  console.log(
    "[translateAndSerialize] translationKeys received:",
    translationKeys,
  );
  console.log("[translateAndSerialize] lang:", lang);
  console.log("[translateAndSerialize] ext:", ext);
  const texts = extractTranslatableTexts(aoa, translationKeys);
  console.log("[translateAndSerialize] extractedTexts:", texts);
  const translations = await translateExport(texts, lang.code);
  console.log("[translateAndSerialize] translations from API:", translations);
  const map = Object.fromEntries(texts.map((t, i) => [t, translations[i]]));
  const translated = applyTranslations(aoa, map, translationKeys);

  for (const key of [
    "_language",
    "_prolific4LanguageFirst",
    "_prolific4LanguageFluent",
  ]) {
    const idx = translated.findIndex((row) => row[0] === key);
    if (idx !== -1) {
      translated[idx] = translated[idx].map((cell, i) =>
        i === 1 ? lang.label : cell,
      );
    }
  }

  const blockRow = translated.find((row) => row[0] === "block");
  const fontLangIdx = translated.findIndex((row) => row[0] === "fontLanguage");
  if (fontLangIdx !== -1) {
    const blockFilledCols = new Set(
      blockRow
        ? blockRow.reduce(
            (acc, cell, i) =>
              i > 0 && cell != null && cell !== "" ? [...acc, i] : acc,
            [],
          )
        : [],
    );
    translated[fontLangIdx] = translated[fontLangIdx].map((cell, i) =>
      blockFilledCols.has(i) ? lang.code : cell,
    );
  }

  if (ext === "xlsx") {
    const ws = XLSX.utils.aoa_to_sheet(translated);
    const wb = { Sheets: { Sheet1: ws }, SheetNames: ["Sheet1"] };
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }

  return Papa.unparse(translated);
}
