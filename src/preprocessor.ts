import { preprocessExperimentFile } from "../threshold/preprocess/main";
import { EasyEyesError } from "../threshold/preprocess/errorMessages";
import { isExpTableFile } from "../threshold/preprocess/utils";
import { EasyEyesResources, user } from "./constants";

/**
 * @file Client-side (ie browser) processing of declarative table experiment.csv file.
 */
export const processFiles = (fileList: File[], callback: any) => {
  const errors: EasyEyesError[] = [];

  fileList.forEach(async (file) => {
    if (isExpTableFile(file)) {
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
