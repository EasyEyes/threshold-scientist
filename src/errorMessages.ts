import { GLOSSARY } from "../threshold/parameters/glossary";
import { verballyEnumerate } from "./utilities";

export interface EasyEyesError {
  name: string;
  message: string;
  hint: string;
  context: string;
  kind: "error" | "warning" | "correct";
  parameters?: string[];
}

export const UNBALANCED_COMMAS = (
  offendingParameters: {
    parameter: string;
    length: number;
    correctLength: number;
  }[]
): EasyEyesError => {
  const hintBlob: String = offendingParameters
    .map((offenderReport) => {
      const adjustment = offenderReport.length - offenderReport.correctLength;
      const magnitude = Math.abs(adjustment);
      const verb = adjustment < 0 ? "add" : "remove";
      const noun = magnitude > 1 ? "commas" : "comma";
      const preposition = verb === "add" ? "to" : "from";
      return `•${verb} ${magnitude} ${noun} ${preposition} the <span class="error-parameter">${offenderReport.parameter}</span> row`;
    })
    .join("<br/>");
  return {
    name: "Unbalanced commas",
    message:
      "Uh oh, looks like we found an inconsistent number of commas. Each row needs to have the same number of commas, so that we can correctly read your experiment.",
    hint: `Try this: <br/> ${hintBlob}`,
    kind: "error",
    context: "preprocessor",
    parameters: offendingParameters.map((value) => value.parameter),
  };
};

export const ILL_FORMED_UNDERSCORE_PARAM = (
  parameter: string
): EasyEyesError => {
  return {
    name: `_Underscore parameter incorrectly formatted`,
    message: `Experiment-scope parameters, such as "${parameter}", start with an underscore and require exactly one value, as they don't vary across conditions.`,
    hint: `Make sure that you give "${parameter}" a value for only the very first column. The "${parameter}" row should look something like: "${parameter}, [your ${parameter} value]", with the appropriate amount of trailing commas but not other values.`,
    kind: "error",
    context: "preprocessor",
    parameters: [parameter],
  };
};
export const INCORRECT_PARAMETER_TYPE = (
  offendingValues: { value: string; block: number }[],
  parameter: string,
  correctType: "integer" | "numerical" | "text" | "boolean" | "categorical",
  categories?: string[]
): EasyEyesError => {
  const offendingMessage = offendingValues.map(
    (offending) => ` "${offending.value}" [condition ${offending.block}]`
  );
  let message: string = `All values for the parameter "${parameter}" must be "${correctType}" type.`;
  if (categories) {
    message = message + ` Valid categories are: ${categories.join(", ")}.`;
  }
  return {
    name: `Parameter "${parameter}" contains values of the wrong type`,
    message: message,
    hint: `We're having trouble with the following values, try double checking them:${offendingMessage}.`,
    context: "preprocessor",
    kind: "error",
  };
};

export const EXPERIMENT_FILE_NOT_FOUND = (
  filesProvided: string[]
): EasyEyesError => {
  return {
    name: "Unable to identify experiment file",
    context: `preprocessor`,
    message: `Sorry, we weren't able to find an csv file, e.g., "experiment.csv", in the files that you provided. This file is required, as it defines your entire experiment -- we can't make your movie without your don't provide a screenplay.`,
    hint: `Make sure you include exactly one ".csv" file among the files you upload. This file should be in row-major order, ie one row representing each parameter, and should follow the specification laid out in the EasyEyes Threshold Glossary.`,
    kind: "error",
  };
};

export const NO_CSV_FILE_FOUND: EasyEyesError = {
  name: "No CSV files provided",
  message:
    "When looking for an experiment file, we couldn't even find one .csv file as a candidate.",
  hint: `Make sure you provide a file with the ".csv" extension amongst your files -- this file will be used as your experiment specification.`,
  context: "preprocessor",
  kind: "error",
};

export const TOO_MANY_CSV_FILES_FOUND: EasyEyesError = {
  name: "Multiple CSV files provided",
  message:
    "When looking for an experiment file, we found more than one .csv file, and we don't know which one to pick!",
  hint: `Make sure you provide a file with the ".csv" extension amongst your files -- this file will be used as your experiment specification.`,
  context: "preprocessor",
  kind: "error",
};

export const PARAMETERS_NOT_ALPHABETICAL: EasyEyesError = {
  name: "Parameters aren't alphabetical",
  message:
    "Uh oh! Looks like your parameters are out of order. Keeping everything alphabetical will make working with your experiment file easier.",
  hint: "Try reordering your parameters into alphabetical order",
  context: "preprocessor",
  kind: "error",
};

export const DUPLICATE_PARAMETER = (parameter: string): EasyEyesError => {
  return {
    name: `Parameter \'${parameter}\' is duplicated`,
    message: `The parameter ${parameter} appears more than once! Unintended behavior lurks ahead...`,
    hint: `Remove duplicate references to ${parameter} -- each parameter should only be set once per experiment file, so we know we're using exactly the value you want`,
    context: "preprocessor",
    kind: "error",
  };
};

// TODO create type to match report object structure
export const UNRECOGNIZED_PARAMETER = (report: any): EasyEyesError => {
  return {
    name: `Parameter \'${report.name}\' is unrecognized`,
    message: `Sorry, we couldn't recognize the parameter ${report.name}. The closest supported parameter is "${report.closest[0]}" -- is that what you meant?`,
    hint: `Make sure that you are only including parameter which are supported, and remember that all parameters are case-sensitive. Double check the spelling of "${report.name}". If you're confident it ought to be supported. The other closest supported parameters found were ${report.closest[1]}, ${report.closest[2]}, and ${report.closest[3]}.`,
    context: "preprocessor",
    kind: "error",
  };
};

export const NOT_YET_SUPPORTED_PARAMETER = (
  parameter: string
): EasyEyesError => {
  /*    let glossaryKey = Object.keys(GLOSSARY).find(i => i == parameter);
    let glossaryObject = glossaryKey && GLOSSARY[glossaryKey];*/
  return {
    name: `Parameter \'${parameter}\' is not yet supported`,
    message: `Apologies from the EasyEyes team! The parameter "${parameter}" isn't supported yet. We hope to implement the parameter ${GLOSSARY[parameter]?.availability}.`,
    hint: "Unfortunately, you won't be able to use this parameter at this time. Please, try again later. If the parameter is important to you, we'd encourage you to reach out and email the EasyEyes team at easyeyes.team@gmail.com",
    context: "preprocessor",
    kind: "error",
  };
};

export const NO_BLOCK_PARAMETER: EasyEyesError = {
  name: "Parameter 'block' is not present.",
  message:
    "We weren't able to find a parameter named 'block'. This parameter is required, as it tells us how to organize your study.",
  hint: "Be sure to include a 'block' parameter in your experiment file. The values should be increasing from 1 (or 0, if 'zeroBasedNumberingBool' is set to true). Each condition, ie column, needs one block number, but a block can have any number of conditions.",
  context: "preprocessor",
  kind: "error",
  parameters: ["block"],
};

export const INVALID_STARTING_BLOCK = (
  actualStartingValue: number,
  correctStartingValue: 0 | 1
): EasyEyesError => {
  const zeroBasedNumberingBool = correctStartingValue ? false : true;
  const complementaryStart = correctStartingValue ? 1 : 0;
  return {
    name: "Invalid initial value",
    message: `The first value in your <span class="error-parameter">block</span> row isn't correct; it is <em>${actualStartingValue}</em>, when it ought to be <em>${correctStartingValue}</em>.`,
    hint: `Change your <span class="error-parameter">block</span> row to start with ${correctStartingValue}, with each value either the same -- or one larger --  than the previous. If you'd like the blocks to start from ${complementaryStart} instead, set <span class="error-parameter">_zeroBasedNumberingBool</span> to ${!zeroBasedNumberingBool}.`,
    context: "preprocessor",
    kind: "error",
    parameters: ["block"],
  };
};

export const NONSEQUENTIAL_BLOCK_VALUE = (
  nonsequentials: { value: number; previous: number; index: number }[],
  blockValues: number[]
): EasyEyesError => {
  let problemStatement: string;
  const illustratedValues =
    '<span class="error-parameter">' +
    blockValues
      .map((value, i) => {
        const improperValue: boolean = nonsequentials.some(
          (nonsequential) => nonsequential.index === i
        );
        if (!improperValue) return String(value);
        return `<span style="color: #e02401;">${String(value)}</span>`;
      })
      .join(",") +
    "</span>";
  const nonsequentialIndicies: string[] = nonsequentials.map(
    (nonsequential) => {
      const suffix =
        nonsequential.index === 2
          ? "nd"
          : nonsequential.index === 3
          ? "rd"
          : "th";
      return `${nonsequential.index + 1}${suffix}`;
    }
  );
  const hintBlob = `<span class="error-parameter">block,${illustratedValues}</span><br/>
                    The ${verballyEnumerate(
                      nonsequentialIndicies
                    )} values are nonsequential, as highlighted in 
                    <span style="color: #e02401;">red</span>.`;
  const plural = nonsequentials.length > 1;
  return {
    name: `Nonsequential value${plural ? "s" : ""}`,
    message: `Looks like we've got ${
      plural ? "some" : "a"
    } nonsequential value${
      plural ? "s" : ""
    }. Each value should either be the same as the previous, or 1 larger.`,
    hint: hintBlob,
    context: "preprocessor",
    kind: "error",
    parameters: ["block"],
  };
};
