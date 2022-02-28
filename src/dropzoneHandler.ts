import {
  acceptableExtensions,
  EasyEyesResources,
  getAllUserAcceptableFileExtensions,
  getAllUserAcceptableResourcesExtensions,
  user,
  userRepoFiles,
} from "./constants";
import { isExpTableFile } from "../threshold/preprocess/utils";
import Dropzone from "dropzone";
import { setTab } from "./tab";
import { processFiles } from "./preprocessor";
import * as bootstrapImport from "bootstrap";
import { EasyEyesError } from "../threshold/preprocess/errorMessages";
import {
  addExperimentNameBanner,
  clearAllLogs,
  logError,
  newLog,
} from "./errorLog";
import { completeStep, enableStep } from "./thresholdState";
import { getFileExtension } from "./fileUtil";
import {
  createOrUpdateCommonResources,
  getCommonResourcesNames,
} from "./pavloviaController";
import {
  getProjectByNameInProjectList,
  isProjectNameExistInProjectList,
} from "./gitlabUtil";
import { resourcesFileTypes } from "./utils";

export const droppedFiles = [];
export const droppedFileNames = new Set();
export const acceptableFileExt = [
  ...acceptableExtensions.experiments,
  ...acceptableExtensions.fonts,
  ...acceptableExtensions.forms,
];

export const isUserLoggedIn = () => {
  return user.gitlabData.id != undefined;
};

export const updateDialog = (body: string) => {
  let modalBodyDiv: HTMLElement = document.getElementById(
    "modalBody"
  ) as HTMLElement;
  modalBodyDiv.innerText = body;
};
export const showDialogBox = (
  title: string,
  body: string,
  exitOnOk: boolean,
  closeSelf: boolean = false,
  backdropEffect: boolean = true
) => {
  let el: HTMLElement = document.getElementById("exampleModal") as HTMLElement;
  let bootstrapModal: any = new bootstrapImport.Modal(el, {
    backdrop: backdropEffect,
  });
  let modalButtonCloseEl: HTMLElement = document.getElementById(
    "modalButtonClose"
  ) as HTMLElement;
  let modalButtonOkEl: HTMLElement = document.getElementById(
    "modalButtonOk"
  ) as HTMLElement;
  let modalTitleDiv: HTMLElement = document.getElementById(
    "modalTitle"
  ) as HTMLElement;
  let modalBodyDiv: HTMLElement = document.getElementById(
    "modalBody"
  ) as HTMLElement;
  let noOfWords = title.split(" ").length;
  modalTitleDiv.innerText = title;
  modalBodyDiv.innerHTML = body;
  modalButtonCloseEl.onclick = () => {
    bootstrapModal.hide();
  };
  if (exitOnOk) {
    modalButtonOkEl.classList.remove("no-display");
    modalButtonOkEl.onclick = () => {
      if (bootstrapModal._isShown) bootstrapModal.hide();
    };
  } else {
    modalButtonOkEl.classList.add("no-display");
  }
  bootstrapModal.show();
  if (closeSelf) {
    setTimeout(function () {
      if (bootstrapModal._isShown) bootstrapModal.hide();
    }, 1000 + 1000 * noOfWords);
  }
  return async () => {
    while (bootstrapModal._isTransitioning) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (bootstrapModal._isShown) bootstrapModal.hide();
    modalButtonOkEl.classList.remove("no-display");
  };
};

export const getFileNameWithoutExtension = (file: File) => {
  let nameTokens = file.name.split(".");
  return nameTokens[0];
};

const isAcceptableExtension = (ext: string) => {
  return getAllUserAcceptableFileExtensions().includes(ext);
};

const isAcceptableResourcesExtension = (ext: string) => {
  return getAllUserAcceptableResourcesExtensions().includes(ext);
};

const setRepoName = (name: string): string => {
  for (let i = 1; i < 100000; i++) {
    if (!isProjectNameExistInProjectList(user.gitlabData.projectList, name + i))
      return name + i;
  }
  alert("Duplicate experiment name found. Please change it.");
  return name + 1;
};

// const myDropzone = { myDropzone: null };
const newDz = new Dropzone("#file-dropzone", {
  paramName: "file",
  maxFilesize: 2,
  autoProcessQueue: false,

  init: function () {},

  // file type verification
  accept: async (file: any, done) => {
    // clear logs
    const errorLogsEl = document.getElementById("errors")!;
    const successLogsEl = document.getElementById("success-logs")!;
    clearAllLogs("errors");

    // check file type
    const ext = getFileExtension(file);
    if (!isAcceptableExtension(ext)) {
      showDialogBox(
        `${file.name} was discarded.`,
        `Sorry, cannot accept any file with extension '.${ext}'`,
        true
      );
      return;
    }

    // if dropped file is an experiment file, ie a csv extension, preprocess it immediately, and upon successful processing, add to droppedFiles array
    // and names to droppedFileNames set to avoid duplicates
    if (isExpTableFile(file)) {
      // call preprocessor here
      // if successful, remove all csv files and their names, because we want to keep the block files from latest preprocessed table

      // store experiment file
      userRepoFiles.experiment = file;

      // preprocess experiment files
      let hideDialogBox = showDialogBox(
        `The file ${file.name} is being processed ...`,
        ``,
        false,
        false,
        false
      );

      processFiles(
        [file],
        (
          requestedForms: any,
          requestedFontList: string[],
          requestedTextList: string[],
          fileList: File[],
          errorList: any[]
        ) => {
          const formList: string[] = [];

          if (requestedForms.debriefForm) {
            formList.push(requestedForms.debriefForm);
          }

          if (requestedForms.consentForm) {
            formList.push(requestedForms.consentForm);
          }

          userRepoFiles.requestedForms = formList;
          userRepoFiles.requestedFonts = requestedFontList;
          userRepoFiles.requestedTexts = requestedTextList;
          userRepoFiles.blockFiles = fileList;

          if (errorList.length) {
            hideDialogBox();
            clearDropzone();

            // show file name
            addExperimentNameBanner(errorLogsEl);

            // sort errorList according to parameter name
            errorList.sort((errA: EasyEyesError, errB: EasyEyesError) => {
              if (errA.parameters < errB.parameters) return -1;
              else return 1;
            });

            // show errors
            errorList.forEach((e) => logError(e, errorLogsEl));

            // clear experiment file cache
            setTimeout(() => {
              userRepoFiles.experiment = null;
            }, 800);
            return;
          } else {
            if (isUserLoggedIn()) {
              completeStep(2);
              completeStep(3);
              enableStep(4);
            }

            // show success log
            addExperimentNameBanner(successLogsEl);
            newLog(
              successLogsEl,
              "The experiment has been compiled, and is ready to upload.",
              ``,
              "correct"
            );
          }

          for (let fi = 0; fi < fileList.length; fi++) {
            droppedFileNames.add(fileList[fi].name);
          }

          hideDialogBox();

          // set repo name
          const gitlabRepoNameEl = document.getElementById(
            "new-gitlab-repo-name"
          ) as HTMLInputElement;

          gitlabRepoNameEl.value = setRepoName(file.name.split(".")[0]);
        }
      );
    }

    // hide default progress bar UI
    const progressElementsList = document.getElementsByClassName("dz-progress");
    let progressElement: any;
    for (let i = 0; i < progressElementsList.length; i++)
      progressElement = progressElementsList[i];
    if (progressElement != null) {
      progressElement.style.display = "none";
    }
  },

  // instant upload when files have been dropped
  addedfiles: async (fileList: File[]) => {
    // filter out resources
    let resourcesList: File[] = [];

    for (const file of fileList) {
      const ext = getFileExtension(file);
      if (isAcceptableResourcesExtension(ext)) resourcesList.push(file);
    }

    if (resourcesList.length > 0) {
      // Authentication check
      if (!isUserLoggedIn()) {
        showDialogBox(
          "Error",
          "Not connected to Pavlovia (https://pavlovia.org/), so nothing can be uploaded : (",
          true
        );
        clearDropzone();
        return;
      }

      let hideDialogBox = showDialogBox("Now uploading files ...", "", false);

      // UPLOAD
      await createOrUpdateCommonResources(user.gitlabData, resourcesList);
      user.easyEyesResourcesRepo = getProjectByNameInProjectList(
        user.gitlabData.projectList,
        "EasyEyesResources"
      );

      const resources = await getCommonResourcesNames(user.gitlabData);
      for (let i in resources) EasyEyesResources[i] = [...resources[i]];
      for (let cat of resourcesFileTypes)
        setTab(cat.substring(0, cat.length - 1));

      hideDialogBox();
      clearDropzone();
    }
  },
});

export const clearDropzone = () => {
  newDz.removeAllFiles();
};
