const path = require("path");
const fs = require("fs");
const process = require("process");

const fetchDir = "threshold/";
const psychoJSVersion = "2021.3.0";

const ignorePattern = [
  ".DS_Store",
  ".git",
  ".husky",
  ".prettierignore",
  "fonts/",
  "forms/",
  "components",
  "addons",
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
  `psychojs/out/psychojs-${psychoJSVersion}.iife.js`,
  `psychojs/out/psychojs-${psychoJSVersion}.iife.js.map`,
  `psychojs/out/psychojs-${psychoJSVersion}.js`,
  `psychojs/out/psychojs-${psychoJSVersion}.js.map`,
  "netlify",
  "package",
  "webpack",
  "experiment",
  "i18n",
  "node_modules",
  "threshold.js",
  "parameters",
  "server",
  "tsconfig.json",
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
const exportHandle = `export const _loadDir: string = "threshold/"\nexport const _loadFiles: string[] = `;

fs.writeFile(
  `${process.cwd()}/src/files.ts`,
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
