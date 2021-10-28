// ----------------------------------------
// configs
// ----------------------------------------
export const env: any = {
  DEVELOPMENT: {
    GITLAB_REDIRECT_URL:
      "https://gitlab.pavlovia.org//oauth/authorize?client_id=f43ec84eac32326bd40b28f79728bfb5ba32cace89d580662cdb46da3b7dcc8d&redirect_uri=http%3A%2F%2Flocalhost%3A63342%2Fwebsite%2Fdocs%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=1587kx42hje",
  },
  PRODUCTION: {
    GITLAB_REDIRECT_URL:
      "https://gitlab.pavlovia.org//oauth/authorize?client_id=7ad8f608b1706c035a47c22e36e53f14e8f137a28d0b922c30b3bbd8496da190&redirect_uri=https%3A%2F%2Foauth--easyeyes.netlify.app%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=6og9rq7bn6u",
  },
};
export const acceptableExtensions = {
  experiments: ["csv", "xlsx"],
  fonts: ["woff", "woff2", "otf", "ttf", "eot", "svg"],
  forms: ["md", "pdf"],
};
export const acceptableFileExt = [
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
    projects: [],
  },

  newRepo: {
    name: "",
    repo: null,
  },

  easyEyesResourcesRepo: undefined,
};

// ----------------------------------------
// resources repository
// ----------------------------------------
export const EasyEyesResources: any = {
  fonts: [],
  forms: [],
};

// ----------------------------------------
// UI
// ----------------------------------------
export let currentTabId = "fonts";
export const setCurrentTabId = (newId: string) => {
  currentTabId = newId;
};

// ----------------------------------------
// file upload constants
// ----------------------------------------
export const uploadedFiles: any = {
  experimentFile: null,
  others: [],
};

// ----------------------------------------
// Files. Do not modify this file! Run npm `npm run files` at ROOT of this
// project to generate a new /docs/threshold/components/files.js file
// and copy that content here.
// ----------------------------------------
export const _loadDir = "/threshold/threshold/";
export const _loadFiles = [
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
