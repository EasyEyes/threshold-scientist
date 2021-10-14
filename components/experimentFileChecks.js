/**
 * @file Validate a Threshold experiment file
 */

import { GLOSSARY } from "./glossary.js";
import { DataFrame, dataframeFromPapaParsed, levDist } from "./utilities.js";

const tooStrict = false;
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
export const validateExperimentFileContent = (parsedExperimentContent) => {
  const df = dataframeFromPapaParsed(parsedContent);
  const parameters = df.listColumns();
  const errors = [];

  if (tooStrict) errors.push(areParametersAlphabetical(df));
  errors.push(areRequiredParametersPresent(df));
  errors.push(areAllPresentParametersRecognized(parameters));
  errors.push(areAllPresentParametersSupported(parameters));
};

const areParametersAlphabetical = (experiment) => {
  const parameters = experiment.listColumns();
  if (parameters !== parameters.sort()) {
    return PARAMETERS_NOT_ALPHABETICAL;
  }
};

const areRequiredParametersPresent = (experiment) => {
  // TODO determine which parameters are required
};

const areAllPresentParametersRecognized = (parameters) => {
  const unrecognized = [];
  const checkIfRecognized = (parameter) => {
    if (!GLOSSARY.hasOwnProperty(parameter)) {
      unrecognized.push({
        name: parameter,
        closest: similarlySpelledCandidates(parameter, GLOSSARY.keys()),
      });
    }
  };
  parameters.forEach((parameter) => checkIfRecognized(parameter));
  return unrecognized.map(UNRECOGNIZED_PARAMETER);
};

const areAllPresentParametersSupported = (parameters) => {
  const notYetSupported = parameters.filter(
    (parameter) => GLOSSARY[parameter]["availability"] !== "now"
  );
  // TODO get error message for not yet supported parameters
};

const similarlySpelledCandidates = (proposedParameter, parameters) => {
  const closest = parameters.sort(
    (a, b) => levDist(proposedParameter, a) - levDist(proposedParameter, b)
  );
  return closest.slice(0, 3);
};

const parameterSpecificChecks = (experiment) => {
  // TODO misc checks for other parameters
};
