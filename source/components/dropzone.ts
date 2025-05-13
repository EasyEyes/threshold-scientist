/* eslint-disable @typescript-eslint/ban-ts-comment */

import JSZip from "jszip";
import Swal from "sweetalert2";

import {
  getFileExtension,
  isAcceptableExtension,
} from "../../threshold/preprocess/fileUtils";
import { isExpTableFile } from "../../threshold/preprocess/utils";
import {
  createOrUpdateCommonResources,
  getCommonResourcesNames,
  User,
} from "../../threshold/preprocess/gitlabUtils";
import { userRepoFiles } from "../../threshold/preprocess/constants";
import { validateImpulseResponseFile } from "../../threshold/preprocess/experimentFileChecks";
import { EasyEyesError } from "../../threshold/preprocess/errorMessages";

// Helper function to identify impulse response files by their filename pattern
const isImpulseResponseFile = (file: File): boolean => {
  return file.name.match(/\.gainVTime\.(xlsx|csv)$/i) !== null;
};

export const handleDrop = async (
  user: User,
  files: File[],
  addResourcesForApp: (newResourcesRepo: any) => void,
  handleExperimentFile: (file: File) => void,
  handleArchiveBool: (isArchivedBool: boolean) => void,
  handleArchiveZip: (archiveZip: any) => void,
) => {
  const resourcesList: File[] = [];
  const impulseResponseList: File[] = [];
  let experimentFile = null;
  const regex = /^(.+)\.export\.zip$/;
  let isCompiledFromArchiveBool = false;
  let archivedZip = null;

  for (const file of files) {
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
        icon: "error",
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
      allowOutsideClick: true,
      allowEscapeKey: false,
      showConfirmButton: false,
    });
    if (experimentFile) {
      // Store impulse response files
      userRepoFiles.impulseResponses = impulseResponseList;
      // Build an experiment
      userRepoFiles.experiment = experimentFile;
      handleExperimentFile(experimentFile);
    }
    return;
  }

  // handle valid resource files
  if (resourcesList.length > 0 || impulseResponseList.length > 0) {
    await Swal.fire({
      title: "Uploading ...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: async () => {
        // @ts-ignore
        Swal.showLoading(null);

        // Store impulse response files
        userRepoFiles.impulseResponses = impulseResponseList;

        // Upload all resources, including impulse responses
        const allResources = [...resourcesList, ...impulseResponseList];
        await createOrUpdateCommonResources(user, allResources);
        addResourcesForApp(await getCommonResourcesNames(user));

        Swal.close();
      },
    });
  } else if (experimentFile) {
    Swal.fire({
      title: "Compiling ...",
      allowOutsideClick: true,
      allowEscapeKey: false,
      showConfirmButton: false,
    });

    // Build an experiment
    userRepoFiles.experiment = experimentFile;
    handleExperimentFile(experimentFile);
  }
};
