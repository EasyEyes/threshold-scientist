const droppedFiles = [];
const droppedFileNames = new Set();

const myDropzone = { myDropzone: null };
Dropzone.options.fileDropzone = {
  paramName: "file",
  maxFilesize: 2,
  // addedfile: (file) => {
  //   console.log(file);
  // },
  autoProcessQueue: false,
  accept: (file, done) => {
    // Since we want the user to see instantenous uploads, we will accept the file here, store it in a json and delete it from dz
    console.log("New file dropped!");

    // if dropped file is an experiment file, ie a csv extension, preprocess it immediately, and upon successful processing, add to droppedFiles array
    // and names to droppedFileNames set to avoid duplicates
    if (file.name.split(".")[1] == "csv" || file.type == "text/csv") {
      // call preprocessor here
      // if successful, remove all csv files and their names, because we want to keep the block files from latest preprocessed easyeyes table
    } else if (!droppedFileNames.has(file.name)) {
      alert("File is ready to be uploaded.");
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
