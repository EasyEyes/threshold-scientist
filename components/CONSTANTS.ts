// ----------------------------------------
// configs 
// ----------------------------------------
let env;
const acceptableExtensions = {
  experiments: ["csv", "xlsx"],
  fonts: ["woff", "woff2", "otf", "ttf", "eot", "svg"],
  forms: ["md", "pdf"],
};
const acceptableFileExt = [
  ...acceptableExtensions.experiments,
  ...acceptableExtensions.fonts,
  ...acceptableExtensions.forms,
];

// ----------------------------------------
// user constants
// ----------------------------------------
export const user: any = {
  // gitlab auth
  accessToken: undefined,

  currentExperiment: {
    participantRecruitmentServiceName: null,
    participantRecruitmentServiceUrl: null,
    participantRecruitmentServiceCode: null,
  },

  userData: {
    id: undefined,
    username: undefined,
    projects: []
  },

  easyEyesResourcesRepo: undefined
};

// ----------------------------------------
// resources repository 
// ----------------------------------------
const EasyEyesResources = {
  fonts: [],
  forms: [],
};

// ----------------------------------------
// UI
// ----------------------------------------
let currentTabId = "fonts";

// ----------------------------------------
// file upload constants
// ----------------------------------------
const uploadedFiles = {
  experimentFile: null,
  others: []
};

// ----------------------------------------
// Files. Do not modify this file! Run npm `npm run files` at ROOT of this
// project to generate a new /docs/threshold/components/files.js file
// and copy that content here.
// ----------------------------------------
const _loadDir = "/threshold/threshold/";
const _loadFiles = [
  "LICENSE",
  "README.md",
  "css/consent.css",
  "css/custom.css",
  "css/instructions.css",
  "css/showAlphabet.css",
  "css/utils.css",
  "index.html",
  "js/threshold.min.js",
  "js/threshold.min.js.LICENSE.txt",
  "js/threshold.min.js.map",
  "psychojs/LICENSE.md",
  "psychojs/out/psychojs-2021.3.0.css",
  "threshold.js",
];


