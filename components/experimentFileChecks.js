/**
 * @file Validate a Threshold experiment file
 */

import { GLOSSARY } from "./glossary.js";
import { DataFrame, dataframeFromPapaParsed } from "./utilities.js";

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
  const errors = [];

  if (tooStrict) errors.push(areParametersAlphabetical(df));
  errors.push(areRequiredParametersPresent(df));
  errors.push(areAllPresentParametersRecognized(df));
  errors.push(areAllPresentParametersSupported(df));
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

const areAllPresentParametersRecognized = (experiment) => {
  const parameters = experiment.listColumns();
  const unrecognized = [];
  const checkIfRecognized = (parameter) => {
    if (!GLOSSARY.hasOwnProperty(parameter)) {
      unrecognized.push({
        name: parameter,
        closest: similarlySpelledCandidates(parameter, GLOSSARY.key()),
      });
    }
  };
  parameters.forEach((parameter) => checkIfRecognized(parameter));
  return unrecognized.map(UNRECOGNIZED_PARAMETER);
};

const similarlySpelledCandidates = (proposedParameter, parameters) => {
  // TODO return the value from parameters which is closest to proposedParameter
};
