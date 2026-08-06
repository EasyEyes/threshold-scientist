/**
 * @file The font checks the compiler already runs, made available before a
 * compile rather than as errors during one.
 *
 * These are the same code paths `preprocessExperimentFile` uses: shaperglot in
 * the EasyEyes WASM module for language support and character coverage, and
 * HarfBuzz for the OpenType layout tables. Running them here means a scientist
 * can find out that a font will be rejected while there is still time to pick a
 * different one.
 */

import { initEasyEyesWasm } from "../../../threshold/preprocess/wasmFontLoader";
import {
  checkFontShapingTables,
  normalizeFontBytesForShaperglot,
} from "../../../threshold/preprocess/fontShapingCheck";

export interface LanguageSupportReport {
  /** False when shaperglot could not analyze the font at all. */
  ok: boolean;
  supported: boolean;
  /** Complete, Supported, Incomplete, Unsupported, None, or Indeterminate. */
  supportLevel: string;
  summary: string;
  problems: string[];
  error?: string;
}

export interface CoverageReport {
  ok: boolean;
  supported: boolean;
  missingCharacters: string[];
  error?: string;
}

export interface ShapingReport {
  /** Layout tables the font declares but HarfBuzz refuses, e.g. ["GSUB"]. */
  rejectedTables: string[];
}

/**
 * shaperglot needs raw sfnt, so WOFF/WOFF2 has to be decompressed first. That
 * costs a brotli pass, and every report below wants the same bytes, so each
 * font is normalized once.
 */
const normalizedBytes = new WeakMap<ArrayBuffer, Promise<Uint8Array>>();

const sfntBytes = (bytes: ArrayBuffer): Promise<Uint8Array> => {
  const cached = normalizedBytes.get(bytes);
  if (cached) return cached;
  const promise = normalizeFontBytesForShaperglot(bytes);
  normalizedBytes.set(bytes, promise);
  return promise;
};

/**
 * How well the font supports one language, per shaperglot. Returns null when
 * the WASM module is unavailable, which is also how the compiler treats it:
 * the check is skipped rather than failing the font.
 */
export const reportLanguageSupport = async (
  bytes: ArrayBuffer,
  shaperglotLanguageId: string,
): Promise<LanguageSupportReport | null> => {
  const wasm = await initEasyEyesWasm();
  if (!wasm) return null;
  try {
    const raw = wasm.check_font_language_support(
      await sfntBytes(bytes),
      shaperglotLanguageId,
    );
    const result = JSON.parse(raw);
    return {
      ok: result.ok,
      supported: result.supported,
      supportLevel: result.support_level,
      summary: result.summary ?? "",
      problems: result.problems ?? [],
      error: result.error ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      supported: false,
      supportLevel: "Unknown",
      summary: "",
      problems: [],
      error: String(error),
    };
  }
};

/** Which characters of `text` the font cannot shape. */
export const reportCoverage = async (
  bytes: ArrayBuffer,
  text: string,
): Promise<CoverageReport | null> => {
  const wasm = await initEasyEyesWasm();
  if (!wasm) return null;
  try {
    const result = JSON.parse(
      wasm.check_font_text_coverage(await sfntBytes(bytes), text),
    );
    return {
      ok: result.ok,
      supported: result.supported,
      missingCharacters: result.missing_characters ?? [],
      error: result.error ?? undefined,
    };
  } catch (error) {
    return {
      ok: false,
      supported: false,
      missingCharacters: [],
      error: String(error),
    };
  }
};

/**
 * Whether Chrome's shaper accepts the font's OpenType layout tables. A
 * rejected GSUB costs the font all of its glyph substitution — cursive
 * joining included — while the font still looks perfect in Safari, so this is
 * worth knowing before a study ships.
 */
export const reportShaping = async (
  bytes: ArrayBuffer,
): Promise<ShapingReport | null> => {
  try {
    const { rejectedTables } = await checkFontShapingTables(bytes);
    return { rejectedTables: [...rejectedTables] };
  } catch {
    return null;
  }
};
