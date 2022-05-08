export const resourcesRepoName = "EasyEyesResources";

export const resourcesFileTypes: string[] = [
  "fonts",
  "forms",
  "texts",
  "folders",
];

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

export interface ThresholdRepoFiles {
  experiment: File | null;
  blockFiles: File[];
  fonts: File[];
  forms: File[];
  texts: File[];
  folders: File[];
  requestedForms: string[];
  requestedFonts: string[];
  requestedTexts: string[];
  requestedFolders: string[];
}

export const userRepoFiles: ThresholdRepoFiles = {
  experiment: null,
  blockFiles: [],
  fonts: [],
  forms: [],
  texts: [],
  folders: [],
  requestedForms: [],
  requestedFonts: [],
  requestedTexts: [],
  requestedFolders: [],
};
