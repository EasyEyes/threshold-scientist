import JSZip from "jszip";
import Papa from "papaparse";
import XLSX from "xlsx";
import { splitIntoBlockFiles } from "../threshold/init/blockgen";
// const { EXPERIMENT_FILE_NOT_FOUND } = require("./errorMessages");
import { EXPERIMENT_FILE_NOT_FOUND } from "./errorMessages";
import { validatedCommas, validateExperimentDf } from "./experimentFileChecks";
import {
  dataframeFromPapaParsed,
  transpose,
  addUniqueLabelsToDf,
} from "./utilities";
import { user } from "./constants";
import { newLog, logError } from "./errorLog";
import { getFileBinaryData } from "./assetUtil";

let externalCallback: any;

/**
 * @file Client-side (ie browser) processing of declarative table experiment.csv file.
 */
export const processFiles = (fileList: File[], callback: any) => {
  // init callback for returning values
  externalCallback = callback;

  fileList.forEach(async (file) => {
    if (file.name.includes("xlsx")) {
      const data = await file.arrayBuffer();
      const book = XLSX.read(data);

      for (let sheet in book.Sheets) {
        Papa.parse(XLSX.utils.sheet_to_csv(book.Sheets[sheet]), {
          skipEmptyLines: true,
          complete: prepareExperimentFileForThreshold,
        });
        break;
      }
    } else
      Papa.parse(file, {
        dynamicTyping: false, // check out index 23; make sure null values preserve
        skipEmptyLines: true,
        complete: prepareExperimentFileForThreshold,
      });
  });
};

/**
 * Given the parsed experiment csv from PapaParse, create PsychoJS readable files.
 * @param {Object} parsedContent Returned value from Papa.parse
 */
const prepareExperimentFileForThreshold = (parsedContent: any) => {
  // extract participant recruitment service name
  if (
    parsedContent.data.find(
      (i: any) => i[0] == "_participantRecruitmentService"
    )
  ) {
    user.currentExperiment.participantRecruitmentServiceName =
      parsedContent.data.find(
        (i: any) => i[0] == "_participantRecruitmentService"
      )[1];
  }

  // Check that every row has the same number of values
  const unbalancedCommasError = validatedCommas(parsedContent);

  // Create a dataframe for easy data manipulation.
  let df = dataframeFromPapaParsed(parsedContent);
  // Run the compiler checks on our experiment
  const validationErrors = unbalancedCommasError
    ? [unbalancedCommasError, ...validateExperimentDf(df)]
    : validateExperimentDf(df);

  df = addUniqueLabelsToDf(df);
  /* ------------------------------- Got errors ------------------------------- */
  const errors = document.getElementById("errors")!;
  console.log(errors);
  console.log(validationErrors);
  if (validationErrors.length) {
    validationErrors.forEach((e) => logError(e, errors));
    externalCallback([]);
    return;
  } else {
    newLog(
      errors,
      "The experiment file is ready",
      `We didn't find any error in your experiment file. Feel free to upload your experiment to Pavlovia and start running it.`,
      "correct"
    );

    // Change some names to the ones that PsychoJS expects.
    const nameChanges: any = {
      thresholdBeta: "beta",
      thresholdDelta: "delta",
      thresholdProbability: "pThreshold",
    };
    //// https://stackoverflow.com/questions/5915789/how-to-replace-item-in-array
    let preparedNames = df
      .listColumns()
      .map((oldName: string) =>
        nameChanges.hasOwnProperty(oldName) ? nameChanges[oldName] : oldName
      );
    df = df.renameAll(preparedNames);
    // VERIFY correctness
    if ("thresholdGuessLogSd" in df.toDict()) {
      df = df
        .withColumn("startValSd", (row: any) => row.get("thresholdGuessLogSd"))
        .withColumn("startVal", (row: any) =>
          Math.log10(row.get("thresholdGuess"))
        );
    }
    // split into blocks
    const resultFileList = splitIntoBlockFiles(df);

    // externalCallback must be initialised at the time of initial function
    // call in function processFiles(). This is a workaround because calling
    // through Papa.parse calls preppareExperimentForThreshold internally
    // and thus, we do not have access to its return value.
    externalCallback(resultFileList);
  }
};

/**
 * Given a dataframe of the correctly formatted experiment parameters, split into appropriate files to be uploaded to Pavlovia.
 * @param {Object} df Dataframe (from data-frame.js) of correctly specified parameters for the experiment.
 */

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
