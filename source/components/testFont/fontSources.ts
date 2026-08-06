/**
 * @file Getting a font into the browser for the Test Font tool.
 *
 * Two origins, one result: raw bytes plus a `@font-face` family the tool can
 * measure with. Fonts already in EasyEyesResources come down the same GitLab
 * path a compile uses, so what the tool measures is what an experiment would
 * get. A font dragged in from the desktop never leaves the browser.
 */

import { createFontDataCache } from "../../../threshold/preprocess/fontDataCache";

export type FontOrigin = "resources" | "local";

export interface LoadedFont {
  /** Unique family name registered with document.fonts, for measuring. */
  family: string;
  /** File name, for display. */
  fileName: string;
  bytes: ArrayBuffer;
  origin: FontOrigin;
}

const tagAt = (bytes: Uint8Array, offset: number): string =>
  String.fromCharCode(
    bytes[offset],
    bytes[offset + 1],
    bytes[offset + 2],
    bytes[offset + 3],
  );

/**
 * The `format()` hint for a FontFace source, read from the file signature
 * rather than the extension, since EasyEyesResources holds files named by
 * scientists rather than by a build tool.
 */
const fontFormat = (bytes: ArrayBuffer): string => {
  const signature = tagAt(new Uint8Array(bytes, 0, 4), 0);
  if (signature === "wOF2") return "woff2";
  if (signature === "wOFF") return "woff";
  if (signature === "OTTO") return "opentype";
  return "truetype";
};

let familyCounter = 0;

/**
 * Register `bytes` under a family name no other font uses.
 *
 * A fresh name per load matters: the browser caches a family's glyphs, so
 * reusing one name would let a previously tested font answer measurements for
 * the current one.
 */
const registerFont = async (
  bytes: ArrayBuffer,
  fileName: string,
): Promise<string> => {
  const family = `EasyEyesTestFont${++familyCounter}`;
  const blobUrl = URL.createObjectURL(new Blob([bytes]));
  try {
    const face = new FontFace(
      family,
      `url(${blobUrl}) format('${fontFormat(bytes)}')`,
    );
    await face.load();
    document.fonts.add(face);
    return family;
  } catch (error) {
    throw new Error(
      `The browser could not load "${fileName}". It may be corrupt, or in a format this browser does not accept. (${String(
        error,
      )})`,
    );
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

/** Fetch a font from the user's EasyEyesResources repo and register it. */
export const loadFontFromResources = async (
  fileName: string,
): Promise<LoadedFont> => {
  const files = await createFontDataCache("web").getFontData([fileName]);
  const file = files.find((candidate) => candidate.name === fileName);
  // getFontData reports every failure the same way, by returning nothing, so
  // this covers an expired session as well as a font missing from the repo.
  if (!file) {
    throw new Error(
      `"${fileName}" could not be downloaded from EasyEyesResources. If it is listed above, your Pavlovia session may have expired; reload the page and sign in again.`,
    );
  }
  return {
    family: await registerFont(file.data, fileName),
    fileName,
    bytes: file.data,
    origin: "resources",
  };
};

/** Register a font the scientist dropped in. Nothing is uploaded anywhere. */
export const loadFontFromFile = async (file: File): Promise<LoadedFont> => {
  const bytes = await file.arrayBuffer();
  return {
    family: await registerFont(bytes, file.name),
    fileName: file.name,
    bytes,
    origin: "local",
  };
};

const FONT_EXTENSIONS = [".ttf", ".otf", ".woff", ".woff2", ".ttc"];

export const looksLikeFontFile = (fileName: string): boolean =>
  FONT_EXTENSIONS.some((extension) =>
    fileName.toLowerCase().endsWith(extension),
  );
