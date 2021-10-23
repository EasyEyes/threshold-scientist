/**
 * @file Validate a Threshold experiment file
 * ## Alphabetical parameters
 * ## Check for duplicate parameters
 * ## All parameters are recognized
 * ## All parameters present are implemented
 */

import {
  PARAMETERS_NOT_ALPHABETICAL,
  UNRECOGNIZED_PARAMETER,
  NOT_YET_SUPPORTED_PARAMETER,
} from "./errorMessages.js";
import { GLOSSARY } from "./glossary.js";
import { dataframeFromPapaParsed, levDist } from "./utilities.js";

var parametersToCheck = [];
/**
 * Check that the experiment file is correctly structured; provide errors for any problems
 * @param {DateFrame} experimentDf dataframe-js dataframe of the experiment file content
 * @returns {Object[]} Array of all errors found with the experiment file
 */
export const validateExperimentDf = (experimentDf) => {
  const parameters = experimentDf.listColumns();
  const errors = [];

  const tooStrict = true; // bc penalizing for alphabetical seems too strict lol
  if (tooStrict) errors.push(areParametersAlphabetical(parameters));

  // Alphabetize experimentDf
  experimentDf = experimentDf.restructure(experimentDf.listColumns().sort());
  parametersToCheck.push(...experimentDf.listColumns());

  errors.push(...areParametersDuplicated(parametersToCheck));
  errors.push(...areAllPresentParametersRecognized(parametersToCheck));
  errors.push(...areAllPresentParametersCurrentlySupported(parametersToCheck));

  return errors.filter((error) => error);
};

/**
 * Checks that the parameters of the experiment file are in alphabetical order
 * @param {String[]} parameters Array of parameters, as given by the experimenter
 * @returns {Object} Error message, if the parameters aren't in alphabetical order
 */
const areParametersAlphabetical = (parameters) => {
  if (parameters !== parameters.sort()) {
    return PARAMETERS_NOT_ALPHABETICAL;
  }
};

/**
 * Checks that no parameter appears more than once.
 * @param {String[]} parameters Array of parameters, as given by the experimenter
 * @returns {Object[]} Array of error messages, for any parameter which has a duplicate
 */
const areParametersDuplicated = (parameters) => {
  const seenParameters = new Set();
  const duplicatesErrors = [];
  for (const parameter of parameters) {
    if (seenParameters.has(parameter))
      duplicatesErrors.push(DUPLICATE_PARAMETER(parameter));
    seenParameters.add(parameter);
  }
  parametersToCheck = [...seenParameters];
  return duplicatesErrors;
};

/**
 * Compares the parameters provided to those recognized by Threshold.
 * Returns an error message for each unrecognized parameter present,
 * including recognized parameters which are similar and might have been intended instead.
 * @param {String[]} parameters Array of parameter names, which the experimenter has provided
 * @returns {Object[]} List of error messages for unrecognized parameters
 */
const areAllPresentParametersRecognized = (parameters) => {
  const unrecognized = [];
  parametersToCheck = [];
  const checkIfRecognized = (parameter) => {
    if (!GLOSSARY.hasOwnProperty(parameter)) {
      unrecognized.push({
        name: parameter,
        closest: similarlySpelledCandidates(parameter, Object.keys(GLOSSARY)),
      });
    } else {
      parametersToCheck.push(parameter);
    }
  };
  parameters.forEach(checkIfRecognized);
  return unrecognized.map(UNRECOGNIZED_PARAMETER);
};

const areAllPresentParametersCurrentlySupported = (parameters) => {
  parametersToCheck = parameters.filter(
    (parameter) => GLOSSARY[parameter]["availability"] === "now"
  );
  const notYetSupported = parameters.filter(
    (parameter) => GLOSSARY[parameter]["availability"] !== "now"
  );
  return notYetSupported.map(NOT_YET_SUPPORTED_PARAMETER);
};

/**
 * Find some actual parameters, which are similar to the unknown parameter requested
 * @param {String} proposedParameter What the experimerimenter asked for
 * @param {String[]} parameters All the actual parameters, which they might have meant
 * @param {Number} numberOfCandidatesToReturn How many parameters to return
 * @returns {String[]}
 */
const similarlySpelledCandidates = (
  proposedParameter,
  parameters,
  numberOfCandidatesToReturn = 4
) => {
  const closest = parameters.sort(
    (a, b) => levDist(proposedParameter, a) - levDist(proposedParameter, b)
  );
  return closest.slice(0, numberOfCandidatesToReturn - 1);
};

// --------------- FUTURE ---------------
const parameterSpecificChecks = (experiment) => {
  // TODO misc checks for other parameters
  // check font files according to 'targetFontSelection'
  // check consent file according to '_consentForm'
};

const areRequiredParametersPresent = (experiment) => {
  // TODO determine which parameters are required
};
