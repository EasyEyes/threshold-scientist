/**
 * @file Client-side (ie browser) processing of declarative table experiment.csv file.
 *
 * @goal Create a verbose, experimenter-friendly compiler, which validates the declarative experiment-specification found in experiment.csv, then prepares the provided files into the files/format which threshold.js expects.
 *
 * Program overview:
 * -> Get the list of files uploaded by user
 * -> Confirm that the list has all the necessary files (validateFileList())
 * -> Check the experiment file itself (validateExperimentFile())
 * -> Display all the errors found along the way, or actually preprocess the files
 */

const filesFromDropzone = []; // TODO actually get files
const fileListValidity = validateFilesList(filesFromDropzone);
if (fileListValidity.errors.length === 0) {
  // ie no errors in find finding files
  const experimentFileValidity = validateExperimentFile(
    fileListValidity.experimentFile
  );
}
// TODO nicely communicate the errors to the experimenter
const errorsToDisplay = [
  ...fileListValidity.errors,
  ...experimentFileValidity.errors,
];

const GLOSSARY = [
  {
    parameter: "conditionName",
    supported: true,
  },
  {
    parameter: "conditionTrials",
    supported: true,
  },
  {
    parameter: "easyEyesTrackGazeBool",
  },
  {
    parameter: "easyEyesTrackHeadBool",
  },
  {
    parameter: "fixationLocationStrategy",
  },
  {
    parameter: "fixationToleranceDeg",
  },
  {
    parameter: "instructionFont",
  },
  {
    parameter: "keyEscapeEnable",
  },
  {
    parameter: "markingOffsetBeforeTargetOnsetSecs",
  },
  {
    parameter: "markingOnsetAfterTargetOffsetSecs",
  },
  {
    parameter: "markTheFixationBool",
  },
  {
    parameter: "notes",
  },
  {
    parameter: "playNegativeFeedbackBeepBool",
  },
  {
    parameter: "playPositiveFeedbackBeepBool",
  },
  {
    parameter: "playPurrWhenReadyBool",
  },
  {
    parameter: "responseByClickingAlphabetBool",
  },
  {
    parameter: "responseByKeyboardBool",
  },
  {
    parameter: "showAlphabetWhere",
  },
  {
    parameter: "showCounterWhere",
  },
  {
    parameter: "showInstructionsWhere",
  },
  {
    parameter: "spacingDeg",
  },
  {
    parameter: "spacingDirection",
  },
  {
    parameter: "spacingOverSizeRatio",
  },
  {
    parameter: "spacingRelationToSize",
  },
  {
    parameter: "targetAlphabet",
  },
  {
    parameter: "targetBoundingBoxHorizontalAlignment",
  },
  {
    parameter: "targetDurationSec",
  },
  {
    parameter: "targetEccentricityXDeg",
  },
  {
    parameter: "targetEccentricityYDeg",
  },
  {
    parameter: "targetFont",
  },
  {
    parameter: "targetFontStyle",
  },
  {
    parameter: "targetFontVariationSettings",
  },
  {
    parameter: "targetFontWeight",
  },
  {
    parameter: "targetKind",
  },
  {
    parameter: "targetMinimumPix",
  },
  {
    parameter: "targetSizeDeg",
  },
  {
    parameter: "targetSizeIsHeightBool",
  },
  {
    parameter: "targetTask",
  },
  {
    parameter: "thresholdBeta",
  },
  {
    parameter: "thresholdDelta",
  },
  {
    parameter: "thresholdGuess",
  },
  {
    parameter: "thresholdGuessLogSd",
  },
  {
    parameter: "thresholdParameter",
  },
  {
    parameter: "thresholdProcedure",
  },
  {
    parameter: "thresholdProportionCorrect",
  },
  {
    parameter: "viewingDistanceDesiredCm",
  },
  {
    parameter: "wirelessKeyboardNeededBool",
  },
];

/**
 * Checks that the necessary files, eg an experiment.csv file, have been provided.
 * @param {File[]} filesProvided List of files offered by the user, ie put into the Dropzone
 * @returns {Object}
 */
const validateFileList = (filesProvided) => {
  const errors = [];
  const [experimentFilePresent, experimentFile, identifyExperimentFileError] =
    identifyExperimentFile(filesProvided);
  if (!experimentFilePresent) {
    errors.push({
      name: "Unable to identify experiment file",
      context: `As determined by 'identifyExperimentFile' within 'validateFileList', given the files: ${filesProvided}`,
      message:
        "Sorry, I wasn't able to find an csv file, eg 'experiment.csv', in the files that you provided. This file is defines your entire experiment -- I'm afraid I can't make your movie if you don't provide a screenplay.",
      hint: "Make sure you include exactly one '.csv' file among the files you upload. This file should be in row-major order, ie one row representing each parameter, and should follow the specification laid out in the EasyEyes Threshold Glossary.",
    });
    errors.push(identifyExperimentFileError);
  }
  return { errors: errors, experimentFile: experimentFile };
};

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
/**
 * Helper function for validateExperimentContent(), which checks the validity of the experiment file
 * provided against a number of different checks.
 * @see validateExperimentContent
 * @param {*} experimentFile
 */
const validateExperimentFile = (experimentFile) => {
  // TODO Restructure; Papa.parse will run .complete on the content of the file, but there is no ability to return those results here
  Papa.parse(experimentFile, {
    dynamicTyping: true, // TODO check out index 23; make sure null values preserve
    complete: validateExperimentContent,
  });
};
/**
 * # Check correctness of the experiment file
 * ## Alphabetical parameters
 * ## All necessary parameters are provided
 * ## All parameters are recognized
 * ## All parameters present are implemented
 * ## Necessary checks for each parameter, eg
 * ### check font files according to 'targetFontSelection'
 * ### check consent file according to '_consentForm'
 */
const validateExperimentContent = (parsedExperimentContent) => {
  const df = dataframeFromPapaParsed(parsedContent);

  areParametersAlphabetical(df);
  areRequiredParametersPresent(df);
  /* 
  For each parameter in the file, compare to a reference of 
  */
  areAllPresentParametersRecognized(df);
  areAllPresentParametersSupported(df);
};

// ------------------------- Utilities -------------------------------------------------
// Initialize dataframe-js module
var DataFrame = dfjs.DataFrame;

/**
 * Return a transposed copy of a 2D table.
 * CREDIT https://stackoverflow.com/questions/17428587/transposing-a-2d-array-in-javascript
 * @param {*[][]} nestedArray A 2D array (array of arrays of primitives)
 * @returns {*[][]} transposed Transposed transformation of nestedArray
 */
const transpose = (nestedArray) => {
  const transposed = nestedArray[0].map((_, colIndex) =>
    nestedArray.map((row) => row[colIndex])
  );
  return transposed;
};

/**
 * Check whether an array of file objects contains one with the name of the value of targetFileName
 * @param {File[]} fileList
 * @param {String} targetFileName
 * @returns {Boolean}
 */
const fileListContainsFileOfName = (fileList, targetFileName) => {
  const isFileOfTargetName = (candidateFile) =>
    candidateFile.name == targetFileName;
  return fileList.filter(isFileOfTargetName).length > 0;
};

/**
 * Given the content returned by PapaParse on our csv file, provide a dfjs Dataframe
 * @param {Object} parsedContent .csv file as parsed by PapaParse
 * @returns {dfjs.DataFrame}
 */
const dataframeFromPapaParsed = (parsedContent) => {
  const parsedData = parsedContent.data;
  // Transpose, to get from Denis's row-major convention to the usual column-major
  const transposed = parsedData[0].map((_, colIndex) =>
    parsedData.map((row) => row[colIndex])
  );
  // Separate out the column names from rows of values
  const data = transposed.slice(1); // Rows
  const columns = transposed[0]; // Header
  // Create and return the DataFrame
  return new DataFrame(data, columns);
};

/**
 * Given the parsed experiment csv from PapaParse, create PsychoJS readable files.
 * @param {Object} parsedContent Returned value from Papa.parse
 */
const prepareExperimentFileForThreshold = (parsedContent) => {
  // Create a dataframe for easy data manipulation.
  const df = dataframeFromPapaParsed(parsedContent);
  // Change some names to the ones that PsychoJS expects.
  const nameChanges = {
    conditionName: "label",
    thresholdBeta: "beta",
    thresholdDelta: "delta",
    thresholdProbability: "pThreshold",
  };
  //// https://stackoverflow.com/questions/5915789/how-to-replace-item-in-array
  let preparedNames = transposed[0].map((oldName) =>
    nameChanges.hasOwnProperty(oldName) ? nameChanges[oldName] : oldName
  );
  df = df.renameAll(preparedNames);
  // VERIFY correctness
  if ("thresholdGuessLogSd" in df.toDict()) {
    df = df
      .withColumn("startValSd", (row) => row.get("thresholdGuessLogSd"))
      .withColumn("startVal", (row) => Math.log10(row.get("thresholdGuess")));
  }
  splitIntoBlockFilesAndDownload(df);
};

/**
 * Given a dataframe of the correctly formatted experiment parameters, split into appropriate files to be uploaded to Pavlovia.
 * @param {Object} df Dataframe (from data-frame.js) of correctly specified parameters for the experiment.
 */
const splitIntoBlockFilesAndDownload = (df) => {
  // Initialize the set of files to be downloaded as a zip file.
  // September 2021: Instead we plan to upload to the scientist's Pavlovia account. Might skip zipping.
  const zip = new JSZip();
  // Split up into block files
  const blockIndices = { block: [] };
  df.unique("blockOrder")
    .toDict()
    ["blockOrder"].forEach((blockId, index) => {
      // Add an index to our blockCount file (see below) for this block
      blockIndices["block"].push(index);
      // Get the parameters from just this block...
      const blockDf = df.filter((row) => row.get("blockOrder") === blockId);
      const blockDict = blockDf.toDict();
      const columns = Object.keys(blockDict);
      const data = transpose(columns.map((column) => blockDict[column]));
      // ... and use them to create a csv file for this block.
      const blockCSVString = Papa.unparse({ fields: columns, data: data });
      const blockFileName = "block_" + String(blockId) + ".csv";
      // Add this block file to the output zip
      zip.file(blockFileName, blockCSVString);
    });
  // Create a "blockCount" file, just one column with the the indices of the blocks
  const blockCountCSVString = Papa.unparse({
    fields: ["block"],
    data: blockIndices.block.map((x) => [x]),
  });
  const blockCountFileName = "blockCount.csv";
  // Add blockCount file to output zip
  zip.file(blockCountFileName, blockCountCSVString);
  // Download the zip of files to the user's computer
  zip.generateAsync({ type: "base64" }).then((base64) => {
    const link = document.createElement("a");
    link.href = "data:application/zip;base64," + base64;
    link.download = "blocks.zip"; // !
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // location.href = "data:application/zip;base64," + base64;
  });
};

// ------------------------- Example error messages -------------------------------------------------

//   errors.push({
//     name: "Missing consent page",
//     context: `As determined by 'checkForConsentPage', within 'validateFileList', looking for the page ${experiment._consentForm} within the files ${filesProvided}.`,
//     message:  "Uh oh, I can't find the consent page to be displayed for the participant to evaluate. A consent page is a mandatory component of any EasyEyes experiment.",
//     hint: `You will need to provide a .txt or .pdf file displaying your consent information; the name should match the value you provided for the '_consentForm' parameter of the experiment.csv file; currently that value is: '${experiment._consentForm}.`,
//   });

//   errors.push({
//     name: "Experiment File isn't valid.",
//     context: `As determined by 'validateExperimentFile' for experiment file ${experimentFile.name}`,
//     message: "Uh oh, there seems to be something wrong with your experiment file. Don't worry, I'll go ahead and let you know exactly what isn't right with other errors.",
//     hint: "Looks like you're going to have to edit your experiment file, and try uploading your files again. Make sure to go through and addess each complain that I lay out here -- I'm a bit of a stickler for the rules, ya'know.",
//   })

// ------------------------- Potentially useful legacy code -------------------------------------------------
/**
 * Compares the fonts provided to those referenced in the experiment file,
 * and returns an array of those font files which were referenced but not supported natively or provided font files for.
 * Returning an empty array implies that all fonts are available.
 * @param {String[]} fontsRequired List of font names used in experiment.csv
 * @param {File[]} filesProvided List of file objects the user has provided.
 *
 * Denis Pelli, September, 2021. See EasyEyes Threshold manual for new plans.
 * https://docs.google.com/spreadsheets/d/1x65NjykMm-XUOz98Eu_oo6ON2xspm_h0Q0M2u6UGtug/edit#gid=2021552264
 * This preprocessor should thoroughly check all parameters against the list of available parameters (and their types) listed in
 * the Inputs sheet of the manual. Fonts are NOT checked against what is being uploaded now. Instead EasyEyes accumulates
 * fonts for this scientist in a folder called EasyEyesResources/Fonts in the scientist's account in Pavlovia.
 * For each condition, the parameter targetFontSelection determines whether the scientist wants to use a font in his Pavlovia folder
 * or a font available in the future participant's browser, and whether font substitution is acceptable.
 * For each condition, that preference guides how the preprocessor should check the targetFont.
 */
// const getMissingFontFiles = (fontsRequired, filesProvided) => {
//   const webSafeFonts = [
//     "Arial",
//     "Verdana",
//     "Helvetica",
//     "Tahoma",
//     "Trebuchet",
//     "Times New Roman",
//     "Georgia",
//     "Garamond",
//     "Courier New",
//     "Brush Script MT",
//     "sans-serif",
//     "serif",
//   ];
//   const missingFontFiles = [];
//   const isWebSafe = (font) => webSafeFonts.contains(font);
//   const hasFontFile = (fontFilename) =>
//     filesProvided.map((file) => file.name).contains(fontFilename);
//   for (const font of fontsRequired) {
//     const fontString = String(font) + ".woff"; // TODO also allow .woff2?
//     if (!(isWebSafe(font) || hasFontFile(fontString))) {
//       console.log("Uh oh! Unable to find a font file for " + font);
//       missingFontFiles.push(font);
//     }
//   }
//   return missingFontFiles;
// };

// // Try to read in the spreadsheet from Sheets
// const spreadsheetId = '1x65NjykMm-XUOz98Eu_oo6ON2xspm_h0Q0M2u6UGtug';
// fetch(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json`)
//     .then(res => res.text())
//     .then(text => {
//         const json = JSON.parse(text.substr(47).slice(0, -2));
//         console.log("json from sheets: ", json);
//     })
