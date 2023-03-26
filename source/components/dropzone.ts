/* eslint-disable @typescript-eslint/ban-ts-comment */

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
  handleExperimentFile: (file: File) => void
) => {
  const resourcesList: File[] = [];
  let experimentFile = null;

  for (const file of files) {
    // get extension
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

  // handle valid resource files
  if (resourcesList.length > 0) {
    await Swal.fire({
      title: "Uploading files for you ...",
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
      allowOutsideClick: false,
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
