export const EXPERIMENT_FILE_NOT_FOUND = {
  name: "Unable to identify experiment file",
  context: `As determined by 'identifyExperimentFile' within 'validateFileList', given the files: ${filesProvided}`,
  message:
    "Sorry, I wasn't able to find an csv file, eg 'experiment.csv', in the files that you provided. This file is defines your entire experiment -- I'm afraid I can't make your movie if you don't provide a screenplay.",
  hint: "Make sure you include exactly one '.csv' file among the files you upload. This file should be in row-major order, ie one row representing each parameter, and should follow the specification laid out in the EasyEyes Threshold Glossary.",
};

export const UNRECOGNIZED_PARAMETER = (report) => {};
