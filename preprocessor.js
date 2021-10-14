const { EXPERIMENT_FILE_NOT_FOUND } = require("./components/errorMessages");

let externalCallback;

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
const processFiles = (fileList, callback) => {
  // init callback for returning values
  externalCallback = callback;

  // Assume a <input> element of type 'file', multiple, #fileInput
  // const fileList = [...document.getElementById("fileInput").files];
  // TEMP just checks for experiment file; should also check for necessary font files
  // const experimentFileProvided = containsNecessaryFiles(fileList);
  // Look through the files and handle appropriately
  fileList.forEach((file) => {
    console.log("> checking file type", file.type);
    switch (file.type) {
      case "application/vnd.ms-excel":
      case "text/csv":
        Papa.parse(file, {
          dynamicTyping: true, // check out index 23; make sure null values preserve
          complete: prepareExperimentFileForThreshold,
        });
        break;
      case "font/woff":
        // TODO handle uploading font files
        console.error("TODO uploading fonts now yet supported");
        break;
      case "font/woff2":
        // TODO handle uploading font files
        console.error("TODO uploading fonts now yet supported");
        break;
      default:
        console.log(
          "Huh, I don't recognize the type of file that " +
            String(file) +
            " is."
        );
    }
  });
};

// ------------------------- FUTURE, COMPLETE PREPROCESSING -------------------

/**
 * @todo complete Denis' compiler vision
 */
const futurePreprocessor = () => {
  // Get all the files
  const filesFromDropzone = []; // TODO actually get files
  // Check everything
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
};

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
    errors.push(EXPERIMENT_FILE_NOT_FOUND);
    errors.push(identifyExperimentFileError);
  }
  return { errors: errors, experimentFile: experimentFile };
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

// ------------------------- Utilities -------------------------------------------------
/**
 * Given the parsed experiment csv from PapaParse, create PsychoJS readable files.
 * @param {Object} parsedContent Returned value from Papa.parse
 */
const prepareExperimentFileForThreshold = (parsedContent) => {
  // Create a dataframe for easy data manipulation.
  // extract participant recruitement service name
  if (
    parsedContent.data.find((i) => i[0] == "_participantRecruitmentService")
  ) {
    user.currentExperiment.participantRecruitmentServiceName =
      parsedContent.data.find(
        (i) => i[0] == "_participantRecruitmentService"
      )[1];
  }

  let df = dataframeFromPapaParsed(parsedContent);
  // Change some names to the ones that PsychoJS expects.
  const nameChanges = {
    conditionName: "label",
    thresholdBeta: "beta",
    thresholdDelta: "delta",
    thresholdProbability: "pThreshold",
  };
  //// https://stackoverflow.com/questions/5915789/how-to-replace-item-in-array
  let preparedNames = df
    .listColumns()
    .map((oldName) =>
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
  const resultFileList = [];

  // Initialize the set of files to be downloaded as a zip file.
  // September 2021: Instead we plan to upload to the scientist's Pavlovia account. Might skip zipping.
  const zip = new JSZip();
  // Split up into block files
  const blockIndices = { block: [] };
  df.unique("block")
    .toDict()
    ["block"].forEach((blockId, index) => {
      // Add an index to our blockCount file (see below) for this block
      blockIndices["block"].push(index);
      // Get the parameters from just this block...
      const blockDf = df.filter((row) => row.get("block") === blockId);
      const blockDict = blockDf.toDict();
      const columns = Object.keys(blockDict);
      const data = transpose(columns.map((column) => blockDict[column]));
      // ... and use them to create a csv file for this block.
      const blockCSVString = Papa.unparse({ fields: columns, data: data });
      const blockFileName = "block_" + String(blockId) + ".csv";

      // store block file
      const csvBlob = new Blob([blockCSVString], { type: "text/csv" });
      const csvFile = new File([csvBlob], blockFileName, { type: "text/csv" });
      resultFileList.push(csvFile);

      // Add this block file to the output zip
      // zip.file(blockFileName, blockCSVString);
    });

  // Create a "blockCount" file, just one column with the the indices of the blocks
  const blockCountCSVString = Papa.unparse({
    fields: ["block"],
    data: blockIndices.block.map((x) => [x]),
  });
  const blockCountFileName = "blockCount.csv";

  // store blockCount file
  const blockCountBlob = new Blob([blockCountCSVString], { type: "text/csv" });
  const blockCountFile = new File([blockCountBlob], blockCountFileName, {
    type: "text/csv",
  });
  resultFileList.push(blockCountFile);

  // it is expected that the externalCallback function has been initialized.
  if (externalCallback && resultFileList.length > 0)
    externalCallback(resultFileList);

  // Add blockCount file to output zip
  // zip.file(blockCountFileName, blockCountCSVString);

  // Download the zip of files to the user's computer
  // zip.generateAsync({ type: "base64" }).then((base64) => {
  //   const link = document.createElement("a");
  //   link.href = "data:application/zip;base64," + base64;
  //   link.download = "blocks.zip"; // !
  //   document.body.appendChild(link);
  //   link.click();
  //   document.body.removeChild(link);

  //   // location.href = "data:application/zip;base64," + base64;
  // });
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
