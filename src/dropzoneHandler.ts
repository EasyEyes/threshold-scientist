import {
  acceptableExtensions,
  EasyEyesResources,
  uploadedFiles,
  user,
} from "./constants";
import { isCsvFile } from "../threshold/preprocess/utilities";
import Dropzone from "dropzone";
import { setTab, setTabList } from "./tab";
import { processFiles } from "./preprocessor";
import {
  getResourcesListFromRepository,
  populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment,
} from "./gitlabUtility";
import * as bootstrapImport from "bootstrap";
import { EasyEyesError } from "../threshold/preprocess/errorMessages";
import {
  addExperimentNameBanner,
  clearAllLogs,
  logError,
  newLog,
} from "./errorLog";
import { completeStep, disableStep, enableStep } from "./thresholdState";

export const droppedFiles = [];
export const droppedFileNames = new Set();
export const acceptableFileExt = [
  ...acceptableExtensions.experiments,
  ...acceptableExtensions.fonts,
  ...acceptableExtensions.forms,
];

export const isUserLoggedIn = () => {
  return user.userData != undefined && user.userData.id != undefined;
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
    modalButtonOkEl.className = modalButtonOkEl.className.replace(
      "no-display",
      ""
    );
    modalButtonOkEl.onclick = () => {
      if (bootstrapModal._isShown) bootstrapModal.hide();
    };
  } else {
    modalButtonOkEl.className += " no-display";
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
    modalButtonOkEl.className = modalButtonOkEl.className.replace(
      "no-display",
      ""
    );
  };
};

export const getFileExtension = (file: any) => {
  let splitExt = file.name.split(".");
  return splitExt[splitExt.length - 1].toLowerCase();
};
export const getFileNameWithoutExtension = (file: File) => {
  let nameTokens = file.name.split(".");
  return nameTokens[0];
};
export const isAcceptableExtension = (ext: any) => {
  return acceptableFileExt.includes(ext);
};

// const myDropzone = { myDropzone: null };
const newDz = new Dropzone("#file-dropzone", {
  paramName: "file",
  maxFilesize: 2,
  autoProcessQueue: false,

  init: function () {
    // TODO look for better refactoring here for myThis
    // let myThis: any = this;
    // if (myThis != null) {
    //   myDropzone.myDropzone = myThis;
    // document
    // .querySelector("#preprocess-file-submit")
    // .querySelector("#file-dropzone")
    // .addEventListener("click", (e) => {
    //   processFiles(myDropzone.files);
    //   // prepareExperimentFileForThreshold(myDropzone);
    //   // myDropzone.processQueue()
    //   // TODO make elegant
    //   myDropzone.files.forEach((f) => {
    //     myDropzone.removeFile(f);
    //   });
    // });
    // }
  },

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
    if (isCsvFile(file)) {
      // call preprocessor here
      // if successful, remove all csv files and their names, because we want to keep the block files from latest preprocessed table

      // store experiment file
      uploadedFiles.experimentFile = file;

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

          uploadedFiles.requestedForms = formList;
          uploadedFiles.requestedFonts = requestedFontList;

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
              uploadedFiles.experimentFile = null;
            }, 800);
            return;
          } else {
            console.log("> " + isUserLoggedIn());
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
            uploadedFiles.others.push(fileList[fi]);
          }

          hideDialogBox();

          // set repo name
          const gitlabRepoNameEl = document.getElementById(
            "new-gitlab-repo-name"
          ) as HTMLInputElement;
          gitlabRepoNameEl.value = file.name.split(".")[0];
        }
      );
    }

    // store experiment files only as resource files are uploaded instantaneously
    else if (
      !droppedFileNames.has(file.name) &&
      !acceptableExtensions.fonts.includes(ext) &&
      !acceptableExtensions.forms.includes(ext)
    ) {
      droppedFileNames.add(file.name);
      uploadedFiles.others.push(file);
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
    for (let fi = 0; fi < fileList.length; fi++) {
      const file = fileList[fi];
      const ext = getFileExtension(file);
      if (
        acceptableExtensions.fonts.includes(ext) ||
        acceptableExtensions.forms.includes(ext)
      ) {
        resourcesList.push(file);
      }
    }

    if (resourcesList.length > 0) {
      // authentication check
      if (!isUserLoggedIn()) {
        showDialogBox(
          "Error",
          "Not connected to Pavlovia, so nothing can be uploaded.",
          true
        );
        clearDropzone();
        return;
      }

      let hideDialogBox = showDialogBox("Now uploading files ...", "", false);

      // upload resources instantly
      await populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment(
        resourcesList
      );

      const easyEyesResourcesRepo = user.userData.projects.find(
        (i: any) => i.name == "EasyEyesResources"
      );
      user.easyEyesResourcesRepo = easyEyesResourcesRepo;
      const allResourcesList = await getResourcesListFromRepository(
        easyEyesResourcesRepo.id,
        user.accessToken
      );
      EasyEyesResources.fonts = allResourcesList.fonts;
      EasyEyesResources.forms = allResourcesList.forms;

      // update info UI
      setTab("font-tab", EasyEyesResources.fonts.length, "Fonts");
      setTab("form-tab", EasyEyesResources.forms.length, "Forms");
      setTabList("fonts", EasyEyesResources.fonts);
      setTabList("forms", EasyEyesResources.forms);

      hideDialogBox();
      clearDropzone();
    }
  },
});

export const clearDropzone = () => {
  newDz.removeAllFiles();
};
