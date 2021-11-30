const path = require("path");
const fs = require("fs");
const process = require("process");
const processFiles = require("src/preprocessor.js");

const experimentFile = process.argv[0];
console.log("experimentFile: ", experimentFile);
// const processedFiles = processFiles()

// fs.writeFile(
//   `${process.cwd()}/conditions/`);
