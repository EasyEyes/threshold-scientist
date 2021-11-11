import { GLOSSARY } from "../threshold/parameters/glossary";

export const EXPERIMENT_FILE_NOT_FOUND = (filesProvided: string[]) => {
  return {
    name: "Unable to identify experiment file",
    context: `As determined by 'identifyExperimentFile' within 'validateFileList', given the files: ${filesProvided}`,
    message:
      "Sorry, I wasn't able to find an csv file, eg 'experiment.csv', in the files that you provided. This file is defines your entire experiment -- I'm afraid I can't make your movie if you don't provide a screenplay.",
    hint: "Make sure you include exactly one '.csv' file among the files you upload. This file should be in row-major order, ie one row representing each parameter, and should follow the specification laid out in the EasyEyes Threshold Glossary.",
  };
};

export const NO_CSV_FILE_FOUND = {
  name: "No CSV files provided.",
  message:
    "When looking for an experiment file, I couldn't even find one .csv file as a candidate.",
  hint: "Make sure you provide a file with the '.csv' extension amongst your files -- this file will be used as your experiment specification.",
};

export const TOO_MANY_CSV_FILES_FOUND = {
  name: "Multiple CSV files provided.",
  message:
    "When looking for an experiment file, I found more than one .csv file, and I don't know which one to pick!",
  hint: "Make sure you provide a file with the '.csv' extension amongst your files -- this file will be used as your experiment specification.",
};

export const PARAMETERS_NOT_ALPHABETICAL = {
  name: "Parameters aren't alphabetical",
  message:
    "Uh oh! Looks like your parameters are out of order. Keeping everything alphabetical will make working with your experiment file easier.",
  hint: "Try reordering your parameters into alphabetical order",
};

export const DUPLICATE_PARAMETER = (parameter: string) => {
  return {
    name: "Duplicate parameter",
    message: `The parameter ${parameter} appears more than once! Unintended behavior lurks ahead...`,
    hint: `Remove duplicate references to ${parameter} -- each parameter should only be set once per experiment file, so I know that I'm using exactly the value you want`,
  };
};

// TODO create type to match report object structure
export const UNRECOGNIZED_PARAMETER = (report: any) => {
  return {
    name: `Unrecognized parameter \'${report.name}\'`,
    context: `As determined by 'areAllPresentParametersRecognized' within 'validateExperimentFileContent'`,
    message: `Sorry, I don't recognize the parameter ${report.name}. The closest supported parameter that I was able to find is \'${report.closest[0]}\' -- is that what you meant?`,
    hint: `Make sure that you are only including parameter which are supported, and remember that all parameters are case-sensitive. Double check the spelling of \'${report.name}\', if you're confident it ought to be supported. The other closest supported parameters which I found were ${report.closest[1]}, ${report.closest[2]}, and ${report.closest[3]}.`,
  };
};

export const NOT_YET_SUPPORTED_PARAMETER = (parameter: string) => {
  /*    let glossaryKey = Object.keys(GLOSSARY).find(i => i == parameter);
    let glossaryObject = glossaryKey && GLOSSARY[glossaryKey];*/
  return {
    name: `Parameter \'${parameter}\' not yet supported`,
    message: `Apologies from the EasyEyes team! The parameter \'${parameter}\' isn't supported yet. We hope to implement the parameter ${GLOSSARY[parameter]?.availability}.`,
    hint: "Unfortunately, it looks like you're just going to have to stop using this parameter for now and try again later. If the parameter is important to you, I'd encourage you to reach out and email the EasyEyes team at easyeyes.team@gmail.com",
  };
};
