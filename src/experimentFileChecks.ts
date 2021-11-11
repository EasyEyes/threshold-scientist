/**
 * @file Validate a Threshold experiment file
 * ## Alphabetical parameters
 * ## Check for duplicate parameters
 * ## All parameters are recognized
 * ## All parameters present are implemented
 */

import { DataFrame } from "dataframe-js";
import {
  PARAMETERS_NOT_ALPHABETICAL,
  UNRECOGNIZED_PARAMETER,
  NOT_YET_SUPPORTED_PARAMETER,
  DUPLICATE_PARAMETER,
  EasyEyesError,
  INCORRECT_PARAMETER_TYPE,
} from "./errorMessages";
import { GLOSSARY } from "../threshold/parameters/glossary";
import { dataframeFromPapaParsed, isNumeric, levDist } from "./utilities";

var parametersToCheck: any[] = [];
/**
 * Check that the experiment file is correctly structured; provide errors for any problems
 * @param {DateFrame} experimentDf dataframe-js dataframe of the experiment file content
 * @returns {Object[]} Array of all errors found with the experiment file
 */
export const validateExperimentDf = (experimentDf: any): any => {
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
  errors.push(...areParametersOfTheCorrectType(experimentDf));

  return errors.filter((error) => error);
};

/**
 * Checks that the parameters of the experiment file are in alphabetical order
 * @param {String[]} parameters Array of parameters, as given by the experimenter
 * @returns {Object} Error message, if the parameters aren't in alphabetical order
 */
const areParametersAlphabetical = (parameters: string[]): any => {
  if (parameters !== parameters.sort()) {
    return PARAMETERS_NOT_ALPHABETICAL;
  }
};

/**
 * Checks that no parameter appears more than once.
 * @param {String[]} parameters Array of parameters, as given by the experimenter
 * @returns {Object[]} Array of error messages, for any parameter which has a duplicate
 */
const areParametersDuplicated = (parameters: string[]): any => {
  const seenParameters = new Set<any>();
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
const areAllPresentParametersRecognized = (parameters: any): any => {
  const unrecognized: any[] = [];
  parametersToCheck = [];
  const checkIfRecognized = (parameter: any): any => {
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

const areAllPresentParametersCurrentlySupported = (parameters: any): any => {
  parametersToCheck = parameters.filter(
    (parameter: any) => GLOSSARY[parameter]["availability"] === "now"
  );
  const notYetSupported = parameters.filter(
    (parameter: any) => GLOSSARY[parameter]["availability"] !== "now"
  );
  return notYetSupported.map(NOT_YET_SUPPORTED_PARAMETER);
};

const areParametersOfTheCorrectType = (df: any): EasyEyesError[] => {
  const errors: EasyEyesError[] = [];
  const checkType = (
    column: string[],
    typeCheck: (s: string) => boolean,
    columnName: string,
    correctType: "integer" | "numerical" | "text" | "boolean" | "categorical",
    categories?: string[]
  ): void => {
    const notType = (s: string): boolean => !typeCheck(s);
    if (column.some(notType)) {
      const offendingValues = column
        .map((e: string, i: number) => {
          return { value: e, block: i };
        })
        .filter((d: { value: string; block: number }) => notType(d.value));
      errors.push(
        INCORRECT_PARAMETER_TYPE(
          offendingValues,
          columnName,
          correctType,
          categories
        )
      );
    }
  };
  df.listColumns().forEach((columnName: string) => {
    if (GLOSSARY.hasOwnProperty(columnName) && GLOSSARY[columnName]["type"]) {
      const column: string[] = df
        .select(columnName)
        .toArray()
        .map((x: any[]): any => x[0]);
      const correctType = GLOSSARY[columnName]["type"];
      switch (correctType) {
        case "integer":
          const isInt = (s: string): boolean =>
            isNumeric(s) && Number.isInteger(Number(s));
          checkType(column, isInt, columnName, correctType);
          break;
        case "numerical":
          checkType(column, isNumeric, columnName, correctType);
          break;
        case "boolean":
          const isBool = (s: string): boolean =>
            s.toLowerCase() === "true" || s.toLowerCase() === "false";
          checkType(column, isBool, columnName, correctType);
          break;
        case "text":
          // TODO define what a failing, ie non-"text", value would be
          break;
        case "categorical":
          const validCategory = (s: string): boolean =>
            GLOSSARY[columnName]["categories"].includes(s);
          checkType(
            column,
            validCategory,
            columnName,
            correctType,
            GLOSSARY[columnName]["categories"] as string[]
          );
          break;
        default:
          throw `Unrecognized type \'${correctType}\' used in the glossary. Please contact the EasyEyes team.`;
      }
    }
  });
  return errors;
};

/**
 * Find some actual parameters, which are similar to the unknown parameter requested
 * @param {String} proposedParameter What the experimerimenter asked for
 * @param {String[]} parameters All the actual parameters, which they might have meant
 * @param {Number} numberOfCandidatesToReturn How many parameters to return
 * @returns {String[]}
 */
const similarlySpelledCandidates = (
  proposedParameter: any,
  parameters: any,
  numberOfCandidatesToReturn = 4
) => {
  const closest = parameters.sort(
    (a: any, b: any) =>
      levDist(proposedParameter, a) - levDist(proposedParameter, b)
  );
  return closest.slice(0, numberOfCandidatesToReturn - 1);
};

const _getDuplicateValuesAndIndicies = (
  l: any[]
): { [key: string]: number[] } => {
  // const seen: {[key: T]: number[]} = {};
  const seen: any = {};
  l.forEach((c: any, i: number) => {
    if (seen.hasOwnProperty(c)) {
      seen[c].push(i);
    } else {
      seen[c] = [i];
    }
  });
  return seen;
};
const _areColumnValuesUnique = (targetColumn: string, df: any): boolean => {
  if (df.unique(targetColumn) !== df.select(targetColumn)) return false;
  return true;
};

// --------------- FUTURE ---------------
const parameterSpecificChecks = (experiment: any): any => {
  // TODO misc checks for other parameters
  // check font files according to 'targetFontSelection'
  // check consent file according to '_consentForm'
};
