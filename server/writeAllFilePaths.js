const path = require("path");
const fs = require("fs");
const process = require("process");

const fetchDir = "threshold/";

const ignorePattern = [
  ".git",
  ".husky",
  ".prettierignore",
  "fonts",
  "forms",
  "components",
  "addons",
  "css/",
  "legacy",
  "psychojs/src",
  "psychojs/docs",
  "psychojs/scripts",
  "psychojs/.dprint.json",
  "psychojs/.editorconfig",
  "psychojs/.eslintrc.cjs",
  "psychojs/CHANGELOG.md",
  "psychojs/CONTRIBUTING.md",
  "psychojs/README.md",
  "psychojs/code-of-conduct.md",
  "netlify",
  "package",
  "webpack",
  "experiment",
];

const inIgnore = (f) => {
  for (let ig of ignorePattern) {
    if (f.includes(ig)) return true;
  }
  return false;
};

function throughDirectory(directory) {
  let files = [];
  fs.readdirSync(directory).forEach((file) => {
    const absolute = path.join(directory, file);

    if (fs.statSync(absolute).isDirectory())
      files.push(...throughDirectory(absolute));
    else return files.push(absolute.replace(fetchDir, ""));
  });

  const returner = [];
  for (let f of files) if (!inIgnore(f)) returner.push(f);
  return returner;
}

const exportWarning = `/*
  Do not modify this file! Run npm \`npm run files\` at ROOT of this project to update
*/\n\n`;
const exportHandle = `const _loadDir = "/threshold/threshold/"\nconst _loadFiles = `;

fs.writeFile(
  `${process.cwd()}/components/files.js`,
  exportWarning +
    exportHandle +
    JSON.stringify(throughDirectory(fetchDir)) +
    "\n",
  (error) => {
    if (error) {
      console.log("Error! Couldn't write to the file.", error);
    } else {
      console.log("File directories updated successfully.");
    }
  }
);
