import { preprocessExperimentFile } from "../threshold/preprocess/main";
import { EasyEyesError } from "../threshold/preprocess/errorMessages";
import { isCsvFile } from "../threshold/preprocess/utilities";
import { EasyEyesResources, user } from "./constants";

/**
 * @file Client-side (ie browser) processing of declarative table experiment.csv file.
 */
export const processFiles = (fileList: File[], callback: any) => {
  const errors: EasyEyesError[] = [];

  fileList.forEach(async (file) => {
    if (isCsvFile(file)) {
      await preprocessExperimentFile(
        file,
        user,
        errors,
        EasyEyesResources,
        callback
      );
    }
  });
};
