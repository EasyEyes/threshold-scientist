import {
  acceptableExtensions,
  EasyEyesResources,
  uploadedFiles,
  user,
} from "./CONSTANTS";
import { isCsvFile } from "./utilities";
import Dropzone from "dropzone";
import { setTabList } from "./tab";
import { processFiles } from "../preprocessor";
import { populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment } from "./gitlabUtility";

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

export const showDialogBox = (
  title: string,
  body: string,
  exitOnOk: boolean
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
    el.innerText = body;

    // toggle "OK" button
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
};

export const getFileExtension = (file: any) => {
  let splitExt = file.name.split(".");
  return splitExt[splitExt.length - 1].toLowerCase();
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
    console.log("dropzone init");
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
  accept: (file, done) => {
    // authentication check
    if (!isUserLoggedIn()) {
      showDialogBox(
        "Error",
        "Not connected to Pavlovia, so nothing can be uploaded.",
        true
      );
      return;
    }

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
    // if (file.name.split(".")[1] == "csv" || file.type == "text/csv") {
    if (isCsvFile(file)) {
      // call preprocessor here
      // if successful, remove all csv files and their names, because we want to keep the block files from latest preprocessed easyeyes table

      // preprocess experiment files
      showDialogBox(`The file ${file.name} is being processed ...`, ``, false);
      processFiles([file], (fileList: File[]) => {
        for (let fi = 0; fi < fileList.length; fi++) {
          droppedFileNames.add(fileList[fi].name);
          uploadedFiles.others.push(fileList[fi]);
        }
      });
      hideDialogBox();

      uploadedFiles.experimentFile = file;
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
    console.log("file list added");
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
      showDialogBox("Now uploading files ...", "", false);

      // upload resources instantly
      await populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment(
        resourcesList
      );

      // update info
      for (let fi = 0; fi < resourcesList.length; fi++) {
        const file = resourcesList[fi];
        const ext = getFileExtension(file);
        if (acceptableExtensions.fonts.includes(ext)) {
          if (EasyEyesResources.fonts.indexOf(file.name) == -1)
            EasyEyesResources.fonts.push(file.name);
        }

        if (acceptableExtensions.forms.includes(ext)) {
          if (EasyEyesResources.forms.indexOf(file.name) == -1)
            EasyEyesResources.forms.push(file.name);
        }
      }

      // update info UI
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
