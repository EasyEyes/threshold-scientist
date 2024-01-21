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

export const handleDrop = async (
  user: User,
  files: File[],
  addResourcesForApp: (newResourcesRepo: any) => void,
  handleExperimentFile: (file: File) => void,
  handleArchiveBool: (isArchivedBool: boolean) => void,
  handleArchiveZip: (archiveZip: any) => void,
) => {
  const resourcesList: File[] = [];
  let experimentFile = null;
  const regex = /^ExportedExperiment-(.+)\.zip$/;
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

    if (!isExpTableFile(file)) resourcesList.push(file);
    else experimentFile = file;
  }

  if (isCompiledFromArchiveBool) {
    const Zip = new JSZip();
    await Zip.loadAsync(archivedZip as unknown as File).then((zip) => {
      return Promise.all(
        Object.keys(zip.files).map(async (filename) => {
          return zip.files[filename]
            .async("arraybuffer")
            .then((arrayBuffer) => {
              const blob = new Blob([arrayBuffer]);
              const fileObject = new File([blob], filename);
              if (!isExpTableFile(fileObject)) resourcesList.push(fileObject);
              else experimentFile = fileObject;
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
      // Build an experiment
      userRepoFiles.experiment = experimentFile;
      handleExperimentFile(experimentFile);
    }
    return;
  }
  // handle valid resource files
  if (resourcesList.length > 0) {
    await Swal.fire({
      title: "Uploading ...",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: async () => {
        // @ts-ignore
        Swal.showLoading(null);

        await createOrUpdateCommonResources(user, resourcesList);
        addResourcesForApp(await getCommonResourcesNames(user));

        Swal.close();
      },
    });
  } else {
    Swal.fire({
      title: "Compiling ...",
      allowOutsideClick: true,
      allowEscapeKey: false,
      showConfirmButton: false,
    });
  }

  // handle experiment file
  if (experimentFile) {
    // Build an experiment
    userRepoFiles.experiment = experimentFile;
    handleExperimentFile(experimentFile);
  }
};
