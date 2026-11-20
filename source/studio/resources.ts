/**
 * Which resource files the experiment table references, and what the
 * compiler will say about the ones that are missing — computed with the
 * compiler's OWN functions, so the checklist moves with threshold:
 *
 * - the "requested" lists come from the same extractors main.ts calls
 *   (preprocess/utils.ts: getFontNameListBySource, getFormNames, getTextList,
 *   getImageNames, getFolderNames, getCodeList, …);
 * - the verdicts come from the same checks main.ts runs against the
 *   scientist's EasyEyesResources name lists (preprocess/experimentFileChecks.ts:
 *   checkFontPresence, checkFormPresence, checkTextPresence, …).
 *
 * The checks consume typed availability constructed once from the resource
 * catalog plus files dropped in the Studio — exactly the pool a compile has.
 * Two checks need file contents from
 * GitLab (image-folder contents, target sound lists) and only run at compile
 * time; here their folders are checked by name.
 *
 * Nothing here blocks the Fast compile button: these are shown in the resource
 * panel as what the compiler will report, not as table errors.
 */
import type { ExperimentTable } from "../../threshold/preprocess/experimentTable";
import type { Alert } from "../../threshold/preprocess/alerts";
import {
  checkCodePresence,
  checkFontPresence,
  checkFormPresence,
  checkFrequencyResponsePresence,
  checkImageFolderNamesPresence,
  checkImagePresence,
  checkImpulseResponsePresence,
  checkPhraseFilePresence,
  checkSoundFolderPresence,
  checkTextPresence,
} from "../../threshold/preprocess/experimentFileChecks";
import {
  resourceAvailabilities,
  resourceListingFor,
  type ResourceCatalog,
  type ResourceType,
} from "../../threshold/preprocess/resourceCatalog";
import {
  getCodeList,
  getFolderNames,
  getFontNameListBySource,
  getFormNames,
  getFrequencyResponseList,
  getImageFolderNames,
  getImageNames,
  getImpulseResponseList,
  getReadingCorpusFoilsList,
  getTextList,
} from "../../threshold/preprocess/utils";
export type ResourceKind =
  | "font"
  | "form"
  | "text"
  | "phrases"
  | "image"
  | "impulse response"
  | "frequency response"
  | "sound folder"
  | "image folder"
  | "code";

export interface NeededResource {
  kind: ResourceKind;
  /** File name as it must appear in EasyEyesResources (folders: name.zip). */
  filename: string;
  /** Table parameters that reference it. */
  params: string[];
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  fonts: "Fonts",
  forms: "Forms",
  texts: "Texts",
  folders: "Folders",
  images: "Images",
  code: "Code",
  impulseResponses: "Impulse responses",
  frequencyResponses: "Frequency responses",
  targetSoundLists: "Target sound lists",
  phrases: "Phrases",
};

export const resourceTypeLabel = (type: ResourceType): string =>
  RESOURCE_TYPE_LABELS[type] ?? type;

/** Which EasyEyesResources folder each kind of needed file lives in. */
export const RESOURCE_TYPE_OF_KIND: Record<ResourceKind, ResourceType> = {
  font: "fonts",
  form: "forms",
  text: "texts",
  phrases: "phrases",
  image: "images",
  "impulse response": "impulseResponses",
  "frequency response": "frequencyResponses",
  "sound folder": "folders", // stored zipped: <name>.zip (see checkSoundFolderPresence)
  "image folder": "folders", // likewise
  code: "code",
};

export type UserResourceStatus = "local" | "remote" | "missing" | "unverified";

/** One local/remote status rule for panels and assistant reports. */
export function userResourceStatus(
  n: NeededResource,
  catalog: ResourceCatalog,
  localNames: readonly string[] = [],
): UserResourceStatus {
  if (localNames.includes(n.filename)) return "local";
  const listing = resourceListingFor(catalog, RESOURCE_TYPE_OF_KIND[n.kind]);
  if (listing.kind !== "ready") return "unverified";
  return listing.names.includes(n.filename) ? "remote" : "missing";
}

/** Look up which table parameters reference an existing file, if any. */
export function paramsReferencing(
  type: string,
  filename: string,
  needed: NeededResource[],
): string[] {
  return needed
    .filter(
      (n) => RESOURCE_TYPE_OF_KIND[n.kind] === type && n.filename === filename,
    )
    .flatMap((n) => n.params);
}

export interface ResourceReport {
  needed: NeededResource[];
  /**
   * The compiler's own missing-resource errors for this table against the
   * available pool. Empty when everything is present.
   */
  errors: Alert[];
}

const EMPTY_REPORT: ResourceReport = { needed: [], errors: [] };

/** Values a parameter takes anywhere in the table (all rows, all columns). */
const valuesOf = (t: ExperimentTable, param: string): Set<string> => {
  const out = new Set<string>();
  if (!t.params.includes(param)) return out;
  for (const row of t.allRawRows(param))
    for (const v of (row as readonly string[]).slice(1)) {
      const s = (v ?? "").trim();
      if (s) out.add(s);
    }
  return out;
};

/**
 * @param data  The table as the compiler sees it right before its resource
 *              checks: pre-cleaned rows with the font rows tilde-resolved
 *              (validation.ts hands this over).
 * @param table The tilde-resolved ExperimentTable of the same rows.
 * @param resourceCatalog EasyEyesResources listing states (idle when signed out).
 * @param droppedFiles   Files dropped in the Studio this session.
 */
export function checkResources(
  data: string[][] | null,
  table: ExperimentTable | null,
  resourceCatalog: ResourceCatalog,
  droppedFiles: File[],
): ResourceReport {
  if (!data || !table) return EMPTY_REPORT;
  const parsed = { data };
  const dropped = droppedFiles.map((f) => f.name);
  const availability = resourceAvailabilities(resourceCatalog, dropped);

  const needed = new Map<string, NeededResource>();
  const add = (kind: ResourceKind, filename: string, ...params: string[]) => {
    const key = `${kind}:${filename}`;
    const existing = needed.get(key);
    if (existing) {
      for (const p of params)
        if (!existing.params.includes(p)) existing.params.push(p);
    } else needed.set(key, { kind, filename, params: [...params] });
  };
  const errors: Alert[] = [];

  try {
    // Fonts with fontSource=file (font and instructionFont), as main.ts asks.
    const fontList = getFontNameListBySource(parsed, "file").fontList;
    const instructionFonts = valuesOf(table, "instructionFont");
    const fonts = valuesOf(table, "font");
    for (const f of fontList) {
      const params: string[] = [];
      if (fonts.has(f) || !instructionFonts.has(f)) params.push("font");
      if (instructionFonts.has(f)) params.push("instructionFont");
      add("font", f, ...params);
    }
    errors.push(
      ...checkFontPresence(fontList, availability.fonts, [
        "font",
        "instructionFont",
      ]),
    );

    // Consent and debrief forms.
    const forms = getFormNames(parsed);
    if (forms.consentForm) {
      add("form", forms.consentForm, "_consentForm");
      errors.push(
        ...checkFormPresence(
          forms.consentForm,
          availability.forms,
          "_consentForm",
        ),
      );
    }
    if (forms.debriefForm) {
      add("form", forms.debriefForm, "_debriefForm");
      errors.push(
        ...checkFormPresence(
          forms.debriefForm,
          availability.forms,
          "_debriefForm",
        ),
      );
    }

    // Reading corpora and their foils.
    const texts = getTextList(table) as string[];
    for (const t of texts) add("text", t, "readingCorpus");
    errors.push(...checkTextPresence(texts, availability.texts));
    const foils = getReadingCorpusFoilsList(table) as string[];
    for (const t of foils) add("text", t, "readingCorpusFoils");
    errors.push(
      ...checkTextPresence(foils, availability.texts, "readingCorpusFoils"),
    );

    // Phrase spreadsheet.
    const phraseFile = (
      table.colBOrDefault("_languagePhrasesSpreadsheet") ?? ""
    ).trim();
    if (phraseFile) add("phrases", phraseFile, "_languagePhrasesSpreadsheet");
    errors.push(...checkPhraseFilePresence(phraseFile, availability.phrases));
    const namedPhraseFile = (
      table.colBOrDefault("_phrasesSpreadsheet") ?? ""
    ).trim();
    if (namedPhraseFile) add("phrases", namedPhraseFile, "_phrasesSpreadsheet");
    errors.push(
      ...checkPhraseFilePresence(
        namedPhraseFile,
        availability.phrases,
        "_phrasesSpreadsheet",
      ),
    );

    // Images.
    const images = getImageNames(parsed) as string[];
    for (const i of images) add("image", i, "showImage");
    errors.push(...checkImagePresence(images, availability.images));

    // Impulse and frequency responses (sound calibration simulation).
    const simParams = [
      "_calibrateSoundSimulateLoudspeaker",
      "_calibrateSoundSimulateMicrophone",
    ];
    const simParamsFor = (name: string) =>
      simParams.filter((p) => valuesOf(table, p).has(name));
    const impulse = getImpulseResponseList(parsed);
    for (const f of impulse) add("impulse response", f, ...simParamsFor(f));
    if (impulse.length > 0)
      errors.push(
        ...checkImpulseResponsePresence(
          impulse,
          availability.impulseResponses,
          "impulse response files",
        ),
      );
    const frequency = getFrequencyResponseList(parsed);
    for (const f of frequency) add("frequency response", f, ...simParamsFor(f));
    if (frequency.length > 0)
      errors.push(
        ...checkFrequencyResponsePresence(
          frequency,
          availability.frequencyResponses,
          "frequency response files",
        ),
      );

    // Sound folders (stored as <name>.zip).
    const folders = getFolderNames(parsed);
    for (const f of folders.maskerSoundFolder as string[])
      add("sound folder", `${f}.zip`, "maskerSoundFolder");
    for (const f of folders.targetSoundFolder as string[])
      add("sound folder", `${f}.zip`, "targetSoundFolder");
    if (
      folders.maskerSoundFolder.length > 0 ||
      folders.targetSoundFolder.length > 0
    )
      errors.push(
        ...checkSoundFolderPresence(
          {
            maskerSoundFolder: folders.maskerSoundFolder,
            targetSoundFolder: folders.targetSoundFolder,
          },
          availability.folders,
        ),
      );

    // Image folders — by name here; the compile also inspects their contents.
    const imageFolderSpec = getImageFolderNames(parsed);
    const imageFolders = imageFolderSpec.targetImageFolderList as string[];
    for (const f of imageFolders)
      add("image folder", `${f}.zip`, "targetImageFolder");
    errors.push(
      ...checkImageFolderNamesPresence(imageFolderSpec, availability.folders),
    );

    // Code (movieComputeJS).
    const code = getCodeList(parsed) as string[];
    for (const c of code) add("code", c, "movieComputeJS");
    errors.push(...checkCodePresence(code, availability.code));
  } catch (e) {
    // A malformed table mid-edit must never take the panel down; the table
    // checks report the problem.
    console.warn("[EasyEyes Studio] resource check skipped:", e);
  }

  return {
    needed: [...needed.values()].sort((a, b) =>
      a.filename.toLowerCase().localeCompare(b.filename.toLowerCase()),
    ),
    errors,
  };
}
