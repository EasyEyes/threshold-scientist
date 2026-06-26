/* eslint-disable @typescript-eslint/ban-ts-comment */

import JSZip from "jszip";
import Swal from "sweetalert2";

import {
  getFileExtension,
  isAcceptableExtension,
  isValidateFileName,
} from "../../threshold/preprocess/fileUtils";
import { isExpTableFile } from "../../threshold/preprocess/utils";
import {
  createOrUpdateCommonResources,
  getCommonResourcesNames,
  User,
} from "../../threshold/preprocess/gitlabUtils";
import { ensureValidToken } from "../../threshold/preprocess/auth/ensureValidToken";
import { redirectToOauth2 } from "../../threshold/preprocess/user";
import { translatePhraseFileApi } from "./phraseFileApi";
import { userRepoFiles } from "../../threshold/preprocess/constants";

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

export const handleDrop = async (
  user: User,
  files: File[],
  addResourcesForApp: (newResourcesRepo: any) => void,
  handleExperimentFile: (file: File) => void,
  handleArchiveBool: (isArchivedBool: boolean) => void,
  handleArchiveZip: (archiveZip: any) => void,
) => {
  if (!(await ensureValidToken(redirectToOauth2))) return;

  const resourcesList: File[] = [];
  const impulseResponseList: File[] = [];
  const frequencyResponseList: File[] = [];
  const targetSoundListList: File[] = [];
  const phraseFileList: File[] = [];
  let experimentFile = null;
  const regex = /^(.+)\.export\.zip$/;
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
    isCompiledFromArchiveBool = regex.test(file.name);
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

    if (isImpulseResponseFile(file)) {
      // Validate impulse response file right away
      impulseResponseList.push(file);
    } else if (isFrequencyResponseFile(file)) {
      // Add frequency response file
      frequencyResponseList.push(file);
    } else if (isTargetSoundListFile(file)) {
      targetSoundListList.push(file);
    } else if (await isPhraseFile(file)) {
      phraseFileList.push(file);
    } else if (isExpTableFile(file)) {
      experimentFile = file;
    } else {
      resourcesList.push(file);
    }
  }

  if (isCompiledFromArchiveBool) {
    const Zip = new JSZip();
    await Zip.loadAsync(archivedZip as unknown as File).then((zip) => {
      return Promise.all(
        Object.keys(zip.files).map(async (filename) => {
          return zip.files[filename]
            .async("arraybuffer")
            .then(async (arrayBuffer) => {
              const blob = new Blob([arrayBuffer]);
              const fileObject = new File([blob], filename);

              if (isImpulseResponseFile(fileObject)) {
                impulseResponseList.push(fileObject);
              } else if (isFrequencyResponseFile(fileObject)) {
                frequencyResponseList.push(fileObject);
              } else if (isTargetSoundListFile(fileObject)) {
                targetSoundListList.push(fileObject);
              } else if (await isPhraseFile(fileObject)) {
                phraseFileList.push(fileObject);
              } else if (isExpTableFile(fileObject)) {
                experimentFile = fileObject;
              } else {
                resourcesList.push(fileObject);
              }
            });
        }),
      );
    });
    Swal.fire({
      title: "Compiling ...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
    });
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
      userRepoFiles.phrases = phraseFileList;
      // Build an experiment
      userRepoFiles.experiment = experimentFile;
      handleExperimentFile(experimentFile);
    }
    return;
  }

  // Translate, store, and upload phrase files before other uploads
  if (phraseFileList.length > 0) {
    await Swal.fire({
      title: "Translating …",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: async () => {
        // @ts-ignore
        Swal.showLoading(null);
        const translated = await translatePhraseFileApi(phraseFileList[0]);
        userRepoFiles.phrases = [translated];
        await createOrUpdateCommonResources(user, [translated]);
        Swal.close();
      },
    });
  }

  // handle valid resource files
  if (
    resourcesList.length > 0 ||
    impulseResponseList.length > 0 ||
    frequencyResponseList.length > 0 ||
    targetSoundListList.length > 0
  ) {
    await Swal.fire({
      title: "Uploading ...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: async () => {
        // @ts-ignore
        Swal.showLoading(null);

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

        Swal.close();
      },
    });

    if (experimentFile) {
      userRepoFiles.experiment = experimentFile;
      handleExperimentFile(experimentFile);
    }
  } else if (experimentFile) {
    Swal.fire({
      title: "Compiling ...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
    });

    // Build an experiment
    userRepoFiles.experiment = experimentFile;
    handleExperimentFile(experimentFile);
  }
};
