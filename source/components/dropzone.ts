/* eslint-disable @typescript-eslint/ban-ts-comment */

import JSZip from "jszip";
import * as XLSX from "xlsx";
import Swal from "sweetalert2";

import {
  getFileExtension,
  isAcceptableExtension,
  isValidateFileName,
} from "../../threshold/preprocess/fileUtils";
import { isExpTableFile } from "../../threshold/preprocess/utils";
import {
  flattenZipEntries,
  isSourceArchiveFileName,
} from "../../threshold/preprocess/zipUtils";
import {
  createOrUpdateCommonResources,
  getCommonResourcesNames,
  User,
} from "../../threshold/preprocess/gitlabUtils";
import { ensureValidToken } from "../../threshold/preprocess/auth/ensureValidToken";
import { redirectToOauth2 } from "../../threshold/preprocess/user";
import { translatePhraseFileApi } from "./phraseFileApi";
import { userRepoFiles } from "../../threshold/preprocess/constants";
import {
  endCompile,
  optimizationOn,
} from "../../threshold/preprocess/compileMode";
import { markCompilePhase } from "../../threshold/preprocess/compileTiming";

/**
 * The step dialogs below ("Compiling ...", "Translating …", "Uploading ...")
 * are the classic compile's progress display. With the "singleProgressUi"
 * optimization (compileMode.ts, Studio compiles) the compile is shown by one
 * continuous progress view that follows the recorded phases instead, so the
 * dialogs are not opened and the work runs directly.
 */
const stepDialogs = () => !optimizationOn("singleProgressUi");

/**
 * The drop did not lead to a compile (no valid experiment file, or the
 * session must be re-authenticated). With step dialogs the scientist has just
 * dismissed the explanation; without them, the progress view is waiting for
 * phases that will never come — tell it the compile is over.
 */
const noCompileFromThisDrop = () => {
  if (!stepDialogs()) endCompile();
};

/** Open the "Compiling ..." dialog the rest of the compile retitles. */
const openCompilingDialog = () => {
  if (!stepDialogs()) return;
  Swal.fire({
    title: "Compiling ...",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    // Show the spinner immediately. Later phases only retitle this same modal
    // (manuallySetSwalTitle), so if we don't start the loader here it never
    // appears when resources are already loaded and the glossary is cached.
    didOpen: () => Swal.showLoading(),
  });
};

/**
 * Run `work` behind a blocking "<title>" dialog with a spinner, closing it
 * when done — or, without step dialogs, run it directly after recording
 * `phase` for the progress view.
 */
const runStep = async (
  title: string,
  phase: string,
  work: () => Promise<void>,
) => {
  if (!stepDialogs()) {
    markCompilePhase(phase);
    try {
      await work();
    } catch (error) {
      // The compile will not happen; let the progress view go before the
      // failure propagates.
      endCompile();
      throw error;
    }
    return;
  }
  await Swal.fire({
    title,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: async () => {
      // @ts-ignore
      Swal.showLoading(null);
      await work();
      Swal.close();
    },
  });
};

// Helper function to identify impulse response files by their filename pattern
const isImpulseResponseFile = (file: File): boolean => {
  return file.name.match(/\.gainVTime\.(xlsx|csv)$/i) !== null;
};

// Helper function to identify frequency response files by their filename pattern
const isFrequencyResponseFile = (file: File): boolean => {
  return file.name.match(/\.gainVFreq\.(xlsx|csv)$/i) !== null;
};

const isTargetSoundListFile = (file: File): boolean => {
  return file.name.match(/\.targetSoundList\.(xlsx|csv)$/i) !== null;
};

// A phrase file is identified by its filename suffix, like the other
// resource predicates above. The file named in _languagePhrasesSpreadsheet
// must be a "*.phrases.xlsx".
export const isPhraseFile = (file: File): boolean => {
  return file.name.match(/\.phrases\.xlsx$/i) !== null;
};

const isNamedPhraseFile = async (file: File): Promise<boolean> => {
  if (!/\.xlsx$/i.test(file.name)) return false;
  try {
    const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), {
      type: "array",
    });
    const sheet = book.Sheets[book.SheetNames[0]];
    return Array.from({ length: 20 }, (_, index) =>
      String(sheet?.[`A${index + 2}`]?.v ?? ""),
    ).some((value) => value.startsWith("Ⓝ"));
  } catch {
    return false;
  }
};

const requestedLanguagePhraseFile = async (file: File): Promise<string> => {
  const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), {
    type: "array",
  });
  const sheet = book.Sheets[book.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
  const row = rows.find((cells) => cells[0] === "_languagePhrasesSpreadsheet");
  return String(row?.[1] ?? "").trim();
};

/** Where a dropped file goes, by the same order of tests as before. */
type DroppedFileKind =
  | "impulseResponse"
  | "frequencyResponse"
  | "targetSoundList"
  | "namedPhrase"
  | "phrase"
  | "table"
  | "resource";

const classifyDroppedFile = async (file: File): Promise<DroppedFileKind> => {
  if (isImpulseResponseFile(file)) return "impulseResponse";
  if (isFrequencyResponseFile(file)) return "frequencyResponse";
  if (isTargetSoundListFile(file)) return "targetSoundList";
  if (await isNamedPhraseFile(file)) return "namedPhrase";
  if (isPhraseFile(file)) return "phrase";
  if (isExpTableFile(file)) return "table";
  return "resource";
};

/**
 * The first column of a csv or xlsx spreadsheet (the parameter column of an
 * experiment table). An .xlsx upload is stored in the repository as its first
 * sheet's rows in JSON, under the .xlsx name (fileUtils.readXLSXFile); a
 * workbook a scientist dropped or exported is the real thing.
 */
const firstColumnOf = async (file: File): Promise<unknown[]> => {
  if (/\.xlsx$/i.test(file.name)) {
    const text = await file.text();
    if (text.trimStart().startsWith("["))
      return (JSON.parse(text) as unknown[]).map((row) =>
        Array.isArray(row) ? row[0] : undefined,
      );
    const book = XLSX.read(new Uint8Array(await file.arrayBuffer()), {
      type: "array",
    });
    const sheet = book.Sheets[book.SheetNames[0]];
    return (XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]).map(
      (row) => row?.[0],
    );
  }
  return (await file.text()).split(/\r?\n/).map((line) =>
    (line.split(",")[0] ?? "")
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .trim(),
  );
};

/**
 * Whether a spreadsheet is an experiment table: it has the `block` row
 * every experiment table has, and no phrases or response sheet has.
 */
export const looksLikeExperimentTable = async (
  file: File,
): Promise<boolean> => {
  try {
    return (await firstColumnOf(file)).some(
      (cell) => String(cell ?? "").trim() === "block",
    );
  } catch {
    return false;
  }
};

/**
 * The experiment table among an archive's csv/xlsx entries that are not
 * resources. A study archive can hold more than one: a phrases spreadsheet
 * need not follow the *.phrases.xlsx naming convention (and one whose Ⓝ rows
 * start late reads as no named-phrase sheet), and a response sheet is known
 * by its name only. Tell the table by its content rather than by which entry
 * happened to finish decompressing last; the first candidate stands in when
 * none does.
 */
export const chooseExperimentFile = async (
  candidates: File[],
): Promise<File | null> => {
  if (candidates.length <= 1) return candidates[0] ?? null;
  for (const candidate of candidates)
    if (await looksLikeExperimentTable(candidate)) return candidate;
  return candidates[0];
};

export const handleDrop = async (
  user: User,
  files: File[],
  addResourcesForApp: (newResourcesRepo: any) => void,
  handleExperimentFile: (file: File) => void,
  handleArchiveBool: (isArchivedBool: boolean) => void,
  handleArchiveZip: (archiveZip: any) => void,
) => {
  if (!(await ensureValidToken(redirectToOauth2))) {
    noCompileFromThisDrop();
    return;
  }

  const resourcesList: File[] = [];
  const impulseResponseList: File[] = [];
  const frequencyResponseList: File[] = [];
  const targetSoundListList: File[] = [];
  const phraseFileList: File[] = [];
  const namedPhraseFileList: File[] = [];
  // Every csv/xlsx that is not a resource; the table is chosen from these
  // once the drop has been read.
  const tableCandidates: File[] = [];
  let experimentFile: File | null = null;
  const put = (kind: DroppedFileKind, file: File) => {
    if (kind === "impulseResponse") impulseResponseList.push(file);
    else if (kind === "frequencyResponse") frequencyResponseList.push(file);
    else if (kind === "targetSoundList") targetSoundListList.push(file);
    else if (kind === "namedPhrase") namedPhraseFileList.push(file);
    else if (kind === "phrase") phraseFileList.push(file);
    else if (kind === "table") tableCandidates.push(file);
    else resourcesList.push(file);
  };
  let isCompiledFromArchiveBool = false;
  let archivedZip = null;

  for (const file of files) {
    if (!isValidateFileName(file)) {
      await Swal.fire({
        title: "Invalid file name",
        html: `File names cannot contain "-_" or "_-" patterns.<br>The requested file name is <br>${file.name}.`,
        confirmButtonColor: "#666",
      });
      continue;
    }
    // get extension
    isCompiledFromArchiveBool = isSourceArchiveFileName(file.name);
    handleArchiveBool(isCompiledFromArchiveBool);
    if (isCompiledFromArchiveBool) {
      archivedZip = file;
      handleArchiveZip(archivedZip);
      break;
    }
    handleArchiveZip(null);
    const ext = getFileExtension(file);
    // check if we accept this kind of file by extension
    if (!isAcceptableExtension(ext)) {
      // give an error warning for the file if it's not supported
      await Swal.fire({
        title: `${file.name} was discarded.`,
        text: `Sorry, we cannot accept files with extension '.${ext}'.`,
        confirmButtonColor: "#666",
      });
      // continue to check the next file
      continue;
    }

    put(await classifyDroppedFile(file), file);
  }

  if (isCompiledFromArchiveBool) {
    const Zip = new JSZip();
    const zip = await Zip.loadAsync(archivedZip as unknown as File);
    // Read every entry, then distribute them in zip order — never in the
    // order the decompressions happen to complete, which once let the largest
    // csv/xlsx stand in for the experiment table.
    const classified = await Promise.all(
      flattenZipEntries(zip).map(async ({ name, entry }) => {
        const fileObject = new File(
          [new Blob([await entry.async("arraybuffer")])],
          name,
        );
        return { fileObject, kind: await classifyDroppedFile(fileObject) };
      }),
    );
    for (const { fileObject, kind } of classified) put(kind, fileObject);
    experimentFile = await chooseExperimentFile(tableCandidates);
    openCompilingDialog();
    if (experimentFile) {
      // Store impulse response files
      userRepoFiles.impulseResponses = impulseResponseList;
      // Store frequency response files
      userRepoFiles.frequencyResponses = frequencyResponseList;
      // Store target sound list files
      userRepoFiles.targetSoundLists = targetSoundListList;
      // Store phrase files bundled in the archive, verbatim — they are used
      // to build this study only, never translated or uploaded to the
      // receiving scientist's account.
      userRepoFiles.phrases = [...phraseFileList, ...namedPhraseFileList];
      // Build an experiment
      userRepoFiles.experiment = experimentFile;
      handleExperimentFile(experimentFile);
    } else noCompileFromThisDrop();
    return;
  }

  experimentFile = await chooseExperimentFile(tableCandidates);
  // A study only needs its requested language phrase sheet translated.
  // Standalone phrase uploads still translate the supplied files.
  const requestedLanguageFile = experimentFile
    ? await requestedLanguagePhraseFile(experimentFile)
    : null;
  const languagePhraseFiles =
    requestedLanguageFile === null
      ? phraseFileList
      : phraseFileList.filter(
          (file) =>
            file.name.toLowerCase() === requestedLanguageFile.toLowerCase(),
        );
  if (languagePhraseFiles.length > 0) {
    await runStep("Translating …", "resources-translating", async () => {
      const translatedFiles = await Promise.all(
        languagePhraseFiles.map((f) => translatePhraseFileApi(f)),
      );
      userRepoFiles.phrases = translatedFiles;
      await createOrUpdateCommonResources(user, translatedFiles);
    });
  }

  if (namedPhraseFileList.length > 0) {
    await createOrUpdateCommonResources(user, namedPhraseFileList);
    userRepoFiles.phrases = [
      ...(userRepoFiles.phrases || []),
      ...namedPhraseFileList,
    ];
  }

  // handle valid resource files
  if (
    resourcesList.length > 0 ||
    impulseResponseList.length > 0 ||
    frequencyResponseList.length > 0 ||
    targetSoundListList.length > 0
  ) {
    await runStep("Uploading ...", "resources-saving", async () => {
      // Store impulse response files
      userRepoFiles.impulseResponses = impulseResponseList;

      // Store frequency response files
      userRepoFiles.frequencyResponses = frequencyResponseList;

      // Store target sound list files
      userRepoFiles.targetSoundLists = targetSoundListList;

      // Upload all resources, including impulse responses and frequency responses
      const allResources = [
        ...resourcesList,
        ...impulseResponseList,
        ...frequencyResponseList,
        ...targetSoundListList,
      ];
      await createOrUpdateCommonResources(user, allResources);
      addResourcesForApp(await getCommonResourcesNames(user));
    });
  }
  if (experimentFile) {
    openCompilingDialog();

    // Build an experiment
    userRepoFiles.experiment = experimentFile;
    handleExperimentFile(experimentFile);
  } else noCompileFromThisDrop();
};
