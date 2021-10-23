import { processFiles } from "../preprocessor.js";
import { isCsvFile } from "./utilities.js";

const uploadedFiles = {
  experimentFile: null,
  others: [],
};

const droppedFiles = [];
const droppedFileNames = new Set();

const acceptableExtensions = {
  experiments: ["csv", "xlsx"],
  fonts: ["woff", "woff2", "otf", "ttf", "eot", "svg"],
  forms: ["md", "pdf"],
};

const acceptableFileExt = [
  ...acceptableExtensions.experiments,
  ...acceptableExtensions.fonts,
  ...acceptableExtensions.forms,
];
const isUserLoggedIn = () => {
  return user.userData && user.userData.id;
};

const showDialogBox = (title, body, exitOnOk) => {
  // show dialog box
  let el = document.getElementById("dialog-box");
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
};

const hideDialogBox = () => {
  // hide dialog box
  let el = document.getElementById("dialog-box");
  el.style.display = "none";
};

const getFileExtension = (file) => {
  let splitExt = file.name.split(".");
  return splitExt[splitExt.length - 1].toLowerCase();
};

const isAcceptableExtension = (ext) => {
  return acceptableFileExt.includes(ext);
};

const myDropzone = { myDropzone: null };
Dropzone.options.fileDropzone = {
  paramName: "file",
  maxFilesize: 2,
  // addedfile: (file) => {
  //   console.log(file);
  // },
  autoProcessQueue: false,

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
      processFiles([file], (fileList) => {
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
    for (let i = 0; i < progressElementsList.length; i++)
      progressElementsList[i].style.display = "none";
  },
  init: function () {
    myDropzone.myDropzone = this;
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
  },

  // instant upload when files have been dropped
  addedfiles: async (fileList) => {
    // filter out resources
    let resourcesList = [];
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
      myDropzone.myDropzone.removeAllFiles();
    }
  },
};

document
  .querySelector("#gitlab-file-submit")
  .addEventListener("click", async (e) => {
    // call gitlab routine
    await gitlabRoutine(uploadedFiles);

    // clear dropzone
    myDropzone.myDropzone.removeAllFiles();
  });
