// ----------------------------------------
// Configs
// ----------------------------------------

import { GitlabUser } from "./gitlabUtil";

export interface IUserFileTypes {
  experiments: string[];
  fonts: string[];
  forms: string[];
}
export const acceptableExtensions: IUserFileTypes = {
  experiments: ["csv", "xlsx"],
  fonts: ["woff", "woff2", "otf", "ttf", "svg"],
  forms: ["md", "pdf"],
};
export const getAllUserAcceptableFileExtensions = (): string[] => {
  return [
    ...acceptableExtensions.experiments,
    ...acceptableExtensions.fonts,
    ...acceptableExtensions.forms,
  ];
};

// ----------------------------------------
// User constants
// ----------------------------------------
export const user: any = {
  // GitlabUser Object
  gitlabData: undefined,

  currentExperiment: {
    participantRecruitmentServiceName: null,
    participantRecruitmentServiceUrl: null,
    participantRecruitmentServiceCode: null,
    experimentUrl: null,
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
export interface ThresholdRepoFiles {
  experiment: File | null;
  blockFiles: File[];
  fonts: File[];
  forms: File[];
  requestedForms?: string[];
  requestedFonts?: string[];
}
export const userRepoFiles: ThresholdRepoFiles = {
  experiment: null,
  blockFiles: [],
  fonts: [],
  forms: [],
};

export const TOTAL_STEPS = 6;
export const STEP_DEFAULT = "";
export const STEP_ENABLED = '<span style="color: rgb(0,255,0)">⮕</span>';
export const STEP_COMPLETED = "✓";
