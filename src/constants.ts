// ----------------------------------------
// Configs
// ----------------------------------------

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
// User constants
// ----------------------------------------
export const user: any = {
  // gitlab auth
  accessToken: undefined,

  currentExperiment: {
    participantRecruitmentServiceName: null,
    participantRecruitmentServiceUrl: null,
    participantRecruitmentServiceCode: null,
    experimentUrl: null,
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
// Resources repository
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
// File upload constants
// ----------------------------------------
export const uploadedFiles: any = {
  experimentFile: null,
  others: [],
  requestedFonts: [],
  requestedForms: [],
};

// TODO need review, where to store SVGs
export const TOTAL_STEPS = 7;
export const RIGHT_ARROW_DISABLED =
  '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/></svg>';
export const RIGHT_ARROW_ENABLED =
  '<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#00FF00"><path d="M0 0h24v24H0z" fill="none"/><path d="M16.01 11H4v2h12.01v3L20 12l-3.99-4z"/></svg>';
