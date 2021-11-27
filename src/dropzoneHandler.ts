import {
  acceptableExtensions,
  EasyEyesResources,
  uploadedFiles,
  user,
} from "./constants";
import { isCsvFile } from "./utilities";
import Dropzone from "dropzone";
import { setTab, setTabList } from "./tab";
import { processFiles } from "./preprocessor";
import {
  getResourcesListFromRepository,
  populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment,
} from "./gitlabUtility";
import { getExperimentFontList, getExperimentFormList } from "./experimentUtil";
import XLSX from "xlsx";
import * as bootstrapImport from "bootstrap";

export const droppedFiles = [];
export const droppedFileNames = new Set();
export const acceptableFileExt = [
  ...acceptableExtensions.experiments,
  ...acceptableExtensions.fonts,
  ...acceptableExtensions.forms,
];

export const isUserLoggedIn = () => {
  return user.userData && user.userData.id;
};

/*export const showDialogBox = (
  title: string,
  body: string,
  exitOnOk: boolean,
  closeSelf: boolean = false
) => {
  // show dialog box
  let el: any = document.getElementById("dialog-box");
  if (el != null) {
    el.style.display = "block";

    // set title
    el = document.getElementsByClassName("dialog-title")[0];
    el.innerText = title;

    // set body
    el = document.getElementsByClassName("dialog-body")[0];
    el.innerHTML = body;

    // toggle "OK" button
    if (closeSelf) {
      let noOfWords = title.split(" ").length;
      setTimeout(function () {
        hideDialogBox();
      }, 1000 + 1000 * noOfWords);
    }
    if (exitOnOk) {
      el = document.getElementsByClassName("dialog-button")[0];
      el.style.display = "block";
      el.onclick = () => {
        hideDialogBox();
      };
    } else {
      el = document.getElementsByClassName("dialog-button")[0];
      el.style.display = "none";
    }
  }
};

export const hideDialogBox = () => {
  // hide dialog box
  let el = document.getElementById("dialog-box");
  if (el != null) {
    el.style.display = "none";
  }
};*/

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

const isAnyResourceMissing = () => {
  const missingFonts: string[] = [];
  const missingForms: string[] = [];
  console.log("uploadedFiles", uploadedFiles);

  // find missing fonts
  for (let i = 0; i < uploadedFiles.requestedFonts.length; i++) {
    if (
      !EasyEyesResources.fonts.includes(uploadedFiles.requestedFonts[i]) &&
      !missingFonts.includes(uploadedFiles.requestedFonts[i])
    ) {
      missingFonts.push(uploadedFiles.requestedFonts[i]);
    }
  }

  // find missing forms
  for (let i = 0; i < uploadedFiles.requestedForms.length; i++) {
    if (
      !EasyEyesResources.forms.includes(uploadedFiles.requestedForms[i]) &&
      !missingForms.includes(uploadedFiles.requestedForms[i])
    ) {
      missingForms.push(uploadedFiles.requestedForms[i]);
    }
  }

  console.log("missingFonts", missingFonts);
  console.log("missingForms", missingForms);

  if (missingFonts.length > 0 || missingForms.length > 0) {
    let message = "";

    if (missingFonts.length > 0) {
      message = "Missing Fonts: ";
      for (let i = 0; i < missingFonts.length; i++) {
        message += missingFonts[i] + " ";
      }
      message += "\n";
    }

    if (missingForms.length > 0) {
      message += "Missing Forms: ";
      for (let i = 0; i < missingForms.length; i++) {
        message += missingForms[i] + " ";
      }
    }

    alert(message);
    return true;
  } else {
    return false;
  }
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
    // authentication check
    if (!isUserLoggedIn()) {
      let hideDialogBox = showDialogBox(
        "Error",
        "Not connected to Pavlovia, so nothing can be uploaded.",
        true
      );
      return;
    }

    // check file type
    const ext = getFileExtension(file);
    if (!isAcceptableExtension(ext)) {
      let hideDialogBox = showDialogBox(
        `${file.name} was discarded.`,
        `Sorry, cannot accept any file with extension '.${ext}'`,
        true
      );
      return;
    }

    if (getFileExtension(file) == "xlsx") {
      // assuming there is only 1 sheet in the experiment file
      const data = await file.arrayBuffer();
      const book = XLSX.read(data);
      for (let sheet in book.Sheets) {
        const dataString = XLSX.utils.sheet_to_csv(book.Sheets[sheet]);
        const blob = new Blob([dataString], { type: "text/csv;charset=utf-8" });
        file = new File([blob], `${getFileNameWithoutExtension(file)}.csv`, {
          type: "text/csv",
          lastModified: Date.now(),
        });
      }
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
        false
      );
      processFiles([file], (fileList: File[]) => {
        if (fileList.length == 0) {
          hideDialogBox();
          clearDropzone();
          setTimeout(() => {
            uploadedFiles.experimentFile = null;
          }, 800);
          return;
        }

        for (let fi = 0; fi < fileList.length; fi++) {
          droppedFileNames.add(fileList[fi].name);
          uploadedFiles.others.push(fileList[fi]);
        }

        hideDialogBox();

        // extract required fonts
        getExperimentFontList(
          uploadedFiles.experimentFile,
          (fontList: string[]) => {
            console.log("REQUESTED FONTS", fontList);
            uploadedFiles.requestedFonts = fontList;

            // extract required forms
            getExperimentFormList(
              uploadedFiles.experimentFile,
              (formList: string[]) => {
                console.log("REQUESTED FORMS", formList);
                uploadedFiles.requestedForms = formList;

                if (isAnyResourceMissing()) {
                  clearDropzone();
                }
              }
            );
          }
        );

        // set repo name
        const gitlabRepoNameEl = document.getElementById(
          "new-gitlab-repo-name"
        ) as HTMLInputElement;
        gitlabRepoNameEl.value = file.name.split(".")[0];
      });
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
