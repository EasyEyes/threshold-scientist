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
    document.querySelector("#file-submit").addEventListener("click", (e) => {
      console.log(myDropzone.files);
      processFiles(myDropzone.files);
      // myDropzone.processQueue()
      // TODO make elegant
      myDropzone.files.forEach((f) => {
        myDropzone.removeFile(f);
      });
    });
  },
};
