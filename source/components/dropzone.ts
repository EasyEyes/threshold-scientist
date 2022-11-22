/* eslint-disable @typescript-eslint/ban-ts-comment */

import Swal from "sweetalert2";
import { getFileExtension, isAcceptableExtension } from "./fileUtils";
import { isExpTableFile } from "../../threshold/preprocess/utils";
import {
  createOrUpdateCommonResources,
  getCommonResourcesNames,
  User,
} from "./gitlabUtils";
import { userRepoFiles } from "./constants";

export const handleDrop = async (
  user: User,
  files: File[],
  addResourcesForApp: (newResourcesRepo: any) => void,
  handleExperimentFile: (file: File) => void
) => {
  const resourcesList: File[] = [];
  let experimentFile = null;
  for (const file of files) {
    const ext = getFileExtension(file);
    if (!isAcceptableExtension(ext)) {
      Swal.fire({
        icon: "error",
        title: `${file.name} was discarded.`,
        text: `Sorry, we cannot accept files with extension '.${ext}'.`,
        confirmButtonColor: "#666",
      });
      continue;
    }

    if (!isExpTableFile(file)) resourcesList.push(file);
    else experimentFile = file;
  }

  if (resourcesList.length > 0) {
    await Swal.fire({
      title: "Uploading files for you ...",
      // html: 'I will close in <b></b> milliseconds.',
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
  }

  if (experimentFile) {
    // Build an experiment
    userRepoFiles.experiment = experimentFile;
    handleExperimentFile(experimentFile);
  }
};
