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
export const STEP_DEFAULT = "";
export const STEP_ENABLED = "⮕";
export const STEP_COMPLETED = "✓";
