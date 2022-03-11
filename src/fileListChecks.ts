import { isExpTableFile } from "../threshold/preprocess/utils";
import {
  NO_CSV_FILE_FOUND,
  TOO_MANY_CSV_FILES_FOUND,
} from "../threshold/preprocess/errorMessages";

export const validateFileList = (fileList: any) => {
  const numberOfCsvFiles = fileList.filter(isExpTableFile).length;
  if (numberOfCsvFiles < 1) return NO_CSV_FILE_FOUND;
  if (numberOfCsvFiles > 1) return TOO_MANY_CSV_FILES_FOUND;
};

/**
 * Assuming there is only one csv file present, return it to be used as the experiment file
 * @assumes .csv files are only used to specify the 'experiment.csv' file, aka the experiment specification
 * @param {File[]} filesProvided Set of files that the user has provided
 * @returns {File}
 */
export const returnExperimentFile = (filesProvided: any) => {
  return filesProvided.filter(isExpTableFile)[0];
};
