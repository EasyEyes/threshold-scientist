// ----------------------------------------
// Configs
// ----------------------------------------

import { GitlabUser } from "./gitlabUtil";

export interface IUserFileTypes {
  [key: string]: string[];
  experiments: string[];
  fonts: string[];
  forms: string[];
  texts: string[];
  folders: string[];
}

export const acceptableExtensions: IUserFileTypes = {
  experiments: ["csv", "xlsx"],
  fonts: ["woff", "woff2", "otf", "ttf", "svg"],
  forms: ["md", "pdf"],
  texts: ["txt"],
  folders: [""], // ?
};

export const getAllUserAcceptableFileExtensions = (): string[] => {
  return [
    ...acceptableExtensions.experiments,
    ...acceptableExtensions.fonts,
    ...acceptableExtensions.forms,
    ...acceptableExtensions.texts,
  ];
};

export const getAllUserAcceptableResourcesExtensions = (): string[] => {
  return [
    ...acceptableExtensions.fonts,
    ...acceptableExtensions.forms,
    ...acceptableExtensions.texts,
  ];
};

export const acceptableResourcesExtensionsOfTextDataType: string[] = [
  "md",
  "txt",
];

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
    pavloviaOfferPilotingOptionBool: null,
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
interface EasyEyesResourcesTyped {
  [key: string]: string[];
}
export const EasyEyesResources: EasyEyesResourcesTyped = {
  fonts: [],
  forms: [],
  texts: [],
  folders: [],
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
  texts: File[];
  requestedForms?: string[];
  requestedFonts?: string[];
  requestedTexts?: string[];
}
export const userRepoFiles: ThresholdRepoFiles = {
  experiment: null,
  blockFiles: [],
  fonts: [],
  forms: [],
  texts: [],
};

export const TOTAL_STEPS = 6;
export const STEP_DEFAULT = "";
export const STEP_ENABLED = '<span style="color: #2EB086">⮕</span>';
export const STEP_COMPLETED = "✓";
