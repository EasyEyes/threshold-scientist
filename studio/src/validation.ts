/**
 * Runs the PRODUCTION compiler checks — the same TABLE_CHECKS registry the
 * web compiler executes after upload — against the live table.
 */
import { ExperimentTable } from "../../threshold/preprocess/experimentTable";
import { validateExperimentTable } from "../../threshold/preprocess/validateExperimentTable";
import { isBlockPresentAndProper } from "../../threshold/preprocess/experimentFileChecks";
import { resolveTildeValues } from "../../threshold/preprocess/resolveTildeValues";
import { dataframeFromPapaParsed } from "../../threshold/preprocess/utils";
import type { EasyEyesError } from "../../threshold/preprocess/errorMessages";
import type { PhraseTable } from "../../source/components/parsePhraseFile";
import { getEntry } from "./glossary";

export type { EasyEyesError };

/** A parsed `*.phrases.xlsx` spreadsheet (production parsePhraseFile output). */
export interface PhraseSource {
  fileName: string;
  table: PhraseTable;
  sourceLanguageCode: string;
  availableLanguageCodes: string[];
}

// Mirror of convertLanguageToLanguageCode (compatibilityCheck.js) without its
// runtime i18n dependency: pass through a supported BCP-47 code, else "en".
function toLanguageCode(raw: string): string {
  const trimmed = (raw ?? "").trim();
  const codes = getEntry("_language")?.categories ?? [];
  const hit = codes.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  return hit ? trimmed : "en";
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
}

export function runValidation(
  matrix: string[][],
  phrase?: PhraseSource | null,
): ValidationResult {
  const data = mirrorPreprocess(matrix);
  if (data.length === 0) return { errors: [], table: null };
  try {
    const errors: EasyEyesError[] = [];
    errors.push(
      ...isBlockPresentAndProper(dataframeFromPapaParsed({ data } as any)),
    );
    let table = new ExperimentTable(data);

    // Mirror main.ts: resolve ~tilde phrase references before validation.
    // If _language is itself a tilde, pre-resolve it in the phrase file's
    // source language, then resolve everything else in that language.
    let rawLanguage = table.colBOrDefault("_language") ?? "";
    if (rawLanguage.trim().startsWith("~") && phrase) {
      const key = rawLanguage.trim().slice(1).toLowerCase();
      const resolvedName = phrase.table
        .get(key)
        ?.get(phrase.sourceLanguageCode);
      if (resolvedName) rawLanguage = resolvedName;
    }
    const { resolved, errors: tildeErrors } = resolveTildeValues(
      table,
      phrase?.table,
      toLanguageCode(rawLanguage),
    );
    table = resolved;
    errors.push(...tildeErrors);

    errors.push(...validateExperimentTable(table));
    return { errors, table };
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
    };
  }
}
