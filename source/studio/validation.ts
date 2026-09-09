/**
 * Runs the PRODUCTION compiler checks — the same TABLE_CHECKS registry the
 * web compiler executes after upload — against the live table.
 */
import { ExperimentTable } from "../../threshold/preprocess/experimentTable";
import { validateExperimentTable } from "../../threshold/preprocess/validateExperimentTable";
import { isBlockPresentAndProper } from "../../threshold/preprocess/experimentFileChecks";
import {
  resolveTildeValues,
  syncResolvedFontRows,
} from "../../threshold/preprocess/resolveTildeValues";
import { dataframeFromPapaParsed } from "../../threshold/preprocess/utils";
import type { EasyEyesError } from "../../threshold/preprocess/errorMessages";
import type { PhraseTable } from "../components/parsePhraseFile";
import { readi18nPhrases } from "../../threshold/components/readPhrases";
import { getEntry } from "./glossary";

export type { EasyEyesError };

/** A parsed `*.phrases.xlsx` spreadsheet (production parsePhraseFile output). */
export interface PhraseSource {
  fileName: string;
  /** Dropped in the Studio, or read from the user's EasyEyesResources. */
  origin: "dropped" | "resources";
  table: PhraseTable;
  sourceLanguageCode: string;
  availableLanguageCodes: string[];
}

// Mirror of convertLanguageToLanguageCode (compatibilityCheck.js, too heavy a
// module to import here): a supported language code passes through; a full
// English name ("French") maps to its code; anything else is "en". Uses the
// same EE_LanguageEnglishName phrases (loaded by App.js) and, should they not
// be loaded, the glossary's list of codes.
export function toLanguageCode(raw: string | undefined): string {
  const language = raw ?? "";
  try {
    const names = readi18nPhrases("EE_LanguageEnglishName") as Record<
      string,
      string
    >;
    if (language && Object.prototype.hasOwnProperty.call(names, language))
      return language;
    const byName = Object.keys(names).find((k) => names[k] === language);
    return byName ?? "en";
  } catch {
    const codes = getEntry("_language")?.categories ?? [];
    return codes.includes(language) ? language : "en";
  }
}

/**
 * Mirror of prepareExperimentFileForThreshold's table pre-cleaning
 * (main.ts): drop %-commented rows, drop all-blank rows, trim the shared
 * trailing blank columns, trim parameter names.
 */
export function mirrorPreprocess(matrix: string[][]): string[][] {
  let data = matrix.filter((row) => !/^%/.test((row[0] ?? "").trim()));
  data = data.filter((row) => row.some((x) => x));
  const numTrailing = (r: string[]) => {
    const v = [...r];
    let n = 0;
    while (v.pop() === "") n++;
    return n;
  };
  if (data.length > 0) {
    const fewest = Math.min(...data.map(numTrailing));
    if (fewest > 0) data = data.map((row) => row.slice(0, row.length - fewest));
  }
  return data.map((r) => [(r[0] ?? "").trim(), ...r.slice(1)]);
}

export interface ValidationResult {
  errors: EasyEyesError[];
  table: ExperimentTable | null;
  /**
   * The rows as the compiler's resource checks see them (pre-cleaned, font
   * rows tilde-resolved — main.ts's `parsed.data` at that point); input to
   * resources.ts checkResources.
   */
  data: string[][] | null;
}

export function runValidation(
  matrix: string[][],
  phrase?: PhraseSource | null,
): ValidationResult {
  let data = mirrorPreprocess(matrix);
  if (data.length === 0) return { errors: [], table: null, data: null };
  try {
    const errors: EasyEyesError[] = [];
    errors.push(
      ...isBlockPresentAndProper(dataframeFromPapaParsed({ data } as any)),
    );
    let table = new ExperimentTable(data);

    // Mirror main.ts: resolve ~tilde phrase references before validation.
    // If _language is itself a tilde, pre-resolve it in the phrase file's
    // source language, then resolve everything else in that language.
    let rawLanguage = table.colBOrDefault("_language");
    if (rawLanguage?.startsWith("~") && phrase) {
      const key = rawLanguage.slice(1).toLowerCase();
      const resolvedName = phrase.table
        .get(key)
        ?.get(phrase.sourceLanguageCode);
      if (resolvedName) rawLanguage = resolvedName;
    }
    const sourceTable = table;
    const { resolved, errors: tildeErrors } = resolveTildeValues(
      table,
      phrase?.table,
      toLanguageCode(rawLanguage),
    );
    table = resolved;
    errors.push(...tildeErrors);
    // As main.ts does: the font rows of the row-major data follow the
    // resolved table, so font discovery never sees a ~symbol.
    data = syncResolvedFontRows(data, table);

    // The source (unresolved) table lets type errors say which ~symbol a bad
    // value was resolved from, as the compiler's messages do.
    errors.push(...validateExperimentTable(table, sourceTable));
    return { errors, table, data };
  } catch (e) {
    return {
      errors: [
        {
          name: "Unexpected compiler error",
          message: String(e),
          hint: "",
          context: "studio",
          kind: "error",
          parameters: [],
        } as EasyEyesError,
      ],
      table: null,
      data: null,
    };
  }
}
