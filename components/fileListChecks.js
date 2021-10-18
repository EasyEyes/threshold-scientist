import {
  NO_CSV_FILE_FOUND,
  TOO_MANY_CSV_FILES_FOUND,
} from "./errorMessages.js";

export const validateFileList = (fileList) => {
  const numberOfCsvFiles = fileList.filter(isCsvFile).length;
  if (numberOfCsvFiles < 1) return NO_CSV_FILE_FOUND;
  if (numberOfCsvFiles > 1) return TOO_MANY_CSV_FILES_FOUND;
};

/**
 * Assuming there is only one csv file present, return it to be used as the experiment file
 * @assumes .csv files are only used to specify the 'experiment.csv' file, aka the experiment specification
 * @param {File[]} filesProvided Set of files that the user has provided
 * @returns {File}
 */
const returnExperimentFile = (filesProvided) => {
  return fileList.filter(isCsvFile)[0];
};
