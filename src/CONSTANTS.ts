// ----------------------------------------
// configs
// ----------------------------------------
// export const env: any = {
//   DEVELOPMENT: {
//     GITLAB_REDIRECT_URL:
//       "https://gitlab.pavlovia.org//oauth/authorize?client_id=914cc931ddf67ab1b9ad8366e29c3a33a89348e09d80fe9c4bbacaa199fa2ce1&redirect_uri=http%3A%2F%2Flocalhost%3A63342%2Fwebsite%2Fdocs%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=0wo5oj2oubc",
//   },
//   PRODUCTION: {
//     GITLAB_REDIRECT_URL:
//       "https://gitlab.pavlovia.org//oauth/authorize?client_id=7ad8f608b1706c035a47c22e36e53f14e8f137a28d0b922c30b3bbd8496da190&redirect_uri=https%3A%2F%2Foauth--easyeyes.netlify.app%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=6og9rq7bn6u",
//   },
// };
export const acceptableExtensions = {
  experiments: ["csv", "xlsx"],
  fonts: ["woff", "woff2", "otf", "ttf", "svg"],
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
  requestedFonts: [],
  requestedForms: [],
};
