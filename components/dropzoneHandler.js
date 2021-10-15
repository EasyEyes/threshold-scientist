const droppedFiles = [];
const droppedFileNames = new Set();

const acceptableExtensions = {
  experiments: ['csv', 'xlsx'],
  fonts: ['woff', 'woff2', 'otf', 'ttf', 'eot', 'svg'],
  forms: ['md', 'pdf']
}
const acceptableFileExt = [...acceptableExtensions.experiments, ...acceptableExtensions.fonts, ...acceptableExtensions.forms];
const isUserLoggedIn = () => {
  return (user.userData && user.userData.id);
};

const showDialogBox = (title, body, exitOnOk) => {
  // show dialog box
  let el = document.getElementById('dialog-box');
  el.style.display = 'block';

  // set title
  el = document.getElementsByClassName('dialog-title')[0];
  el.innerText = title;

  // set body
  el = document.getElementsByClassName('dialog-body')[0];
  el.innerText = body;

  // toggle "OK" button
  if (exitOnOk) {
    el = document.getElementsByClassName('dialog-button')[0];
    el.style.display = 'block';
    el.onclick = () => {
      hideDialogBox();
    }
  } else {
    el = document.getElementsByClassName('dialog-button')[0];
    el.style.display = 'none';
  }
  
};

const hideDialogBox = () => {
  // hide dialog box
  let el = document.getElementById('dialog-box');
  el.style.display = 'none';
}

const getFileExtension = (file) => {
  let splitExt = file.name.split('.')
  return splitExt[splitExt.length-1].toLowerCase();
}

const isAcceptableExtension = (ext) => {
  return acceptableFileExt.includes(ext);
}

const myDropzone = { myDropzone: null };
Dropzone.options.fileDropzone = {
  paramName: "file",
  maxFilesize: 2,
  // addedfile: (file) => {
  //   console.log(file);
  // },
  autoProcessQueue: false,
  accept: (file, done) => {
    // authentication check
    if (!isUserLoggedIn()) {
      showDialogBox('Error', 'Not connected to Pavlovia, so nothing can be uploaded.', true)
      return;
    }

    // check file type
    const ext = getFileExtension(file);
    if (!isAcceptableExtension(ext)) {
      showDialogBox(`${file.name} was discarded.`, `Sorry, cannot accept any file with extension '.${ext}'`, true);
      return;
    }

    // Since we want the user to see instantenous uploads, we will accept the file here, store it in a json and delete it from dz
    console.log("New file dropped!");

    // if dropped file is an experiment file, ie a csv extension, preprocess it immediately, and upon successful processing, add to droppedFiles array
    // and names to droppedFileNames set to avoid duplicates
    if (file.name.split(".")[1] == "csv" || file.type == "text/csv") {
      // call preprocessor here
      // if successful, remove all csv files and their names, because we want to keep the block files from latest preprocessed easyeyes table
    } else if (!droppedFileNames.has(file.name)) {
      console.log(`${file.name} is ready to be uploaded.`);
      droppedFiles.push(file);
      droppedFileNames.add(file.name);
    }
    console.log(file);
    myDropzone.myDropzone.removeFile(file);
  },
  init: function () {
    myDropzone.myDropzone = this;
    document
      .querySelector("#preprocess-file-submit")
      .addEventListener("click", (e) => {
        console.log(myDropzone.files);
        //processFiles(myDropzone.files);
        prepareExperimentFileForThreshold(myDropzone);
        // myDropzone.processQueue()
        // TODO make elegant
        myDropzone.files.forEach((f) => {
          myDropzone.removeFile(f);
        });
      });
  },
};

document
  .querySelector("#gitlab-file-submit")
  .addEventListener("click", async (e) => {
    // call gitlab routine
    await gitlabRoutine(droppedFiles);
  });
