Dropzone.options.fileDropzone = {
  paramName: "file",
  maxFilesize: 2,
  // addedfile: (file) => {
  //   console.log(file);
  // },
  autoProcessQueue: false,
  accept: (file, done) => {
    console.log("New file dropped!");
    console.log(file);
  },
  init: function () {
    const myDropzone = this;
    document.querySelector("#preprocess-file-submit").addEventListener("click", (e) => {
      console.log(myDropzone.files);
      //processFiles(myDropzone.files);
      prepareExperimentFileForThreshold(myDropzone);
      // myDropzone.processQueue()
      // TODO make elegant
      myDropzone.files.forEach((f) => {
        myDropzone.removeFile(f);
      });
    });

    document.querySelector("#gitlab-file-submit").addEventListener("click", async (e) => {
      console.log(myDropzone.files);
      // call gitlab routine
      var abc = await myDropzone.files[0].text();
      await gitlabRoutine(myDropzone.files);
      myDropzone.files.forEach((f) => {
        myDropzone.removeFile(f);
      });
    });
  },
};
