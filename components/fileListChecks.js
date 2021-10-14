export const validateFileList = (fileList) => {};

/**
 * Determines whether a single .csv file (to be used as the experiment specification table) is present;
 * returns it, or an error explaining why it couldn't be identified, e.g. there were no candidates or it was ambiguous.
 * @assumes .csv files are only used to specify the 'experiment.csv' file, aka the experiment specification
 * @param {File[]} filesProvided Set of files that the user has provided
 * @returns {[Boolean, File, Object]} [isAnIdentifiableExperimentFilePresent, thatExperimentFileIfSo, anErrorExplainingIfNot]
 */
const identifyExperimentFile = (filesProvided) => {
  const isCsvFile = (file) => file.type == "text/csv";
  // Find how many .csv files are provided
  const numberOfCsvFiles = fileList.filter(isCsvFile).length;
  if (numberOfCsvFiles < 1)
    return [
      false,
      undefined,
      {
        name: "No CSV files provided.",
        context: `Within identifyExperimentFile, give the files: ${filesProvided}`,
        message:
          "When looking for an experiment file, I couldn't even find one .csv file as a candidate.",
        hint: "Make sure you provide a file with the '.csv' extension amongst your files -- this file will be used as your experiment specification.",
      },
    ];
  if (numberOfCsvFiles > 1)
    return [
      false,
      undefined,
      {
        name: "Multiple CSV files provided.",
        context: `Within identifyExperimentFile, give the files: ${filesProvided}, I found the following .csv files: ${fileList.fileter(
          isCsvFile
        )}`,
        message:
          "When looking for an experiment file, I found more than one .csv file, and I don't know which one to pick!",
        hint: "Make sure you provide a file with the '.csv' extension amongst your files -- this file will be used as your experiment specification.",
      },
    ];
  return [true, fileList.filter(isCsvFile)[0], {}];
};
