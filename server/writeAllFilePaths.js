const path = require("path");
const fs = require("fs");
const process = require("process");

const fetchDir = "threshold/";

// Files/directories to ignore (won't be included unless in matchPattern)
const ignorePattern = [
  // System/editor files
  ".DS_Store",
  ".git",
  ".husky",
  ".prettierignore",
  ".aider",
  ".claude",
  ".env",

  // Build/dev config files
  "tsconfig.json",
  "jest.config",
  "vite.config",
  "webpack",
  "netlify",
  "package",
  "eslintrc",

  // Source directories (not needed for Pavlovia runtime)
  "@rust", // Entire directory - WASM is bundled into js/easyeyes_wasm.js
  ".d.ts", // TypeScript definitions

  // Threshold source/build directories
  "fonts/",
  "forms/",
  "folders/",
  "code/",
  "components",
  "preprocess",
  "addons",
  "legacy",
  "parameters",
  "server",
  "conditions/",
  "examples",
  "notes",

  // PsychoJS non-runtime files
  "psychojs/src",
  "psychojs/docs",
  "psychojs/scripts",
  "psychojs/out",
  "psychojs/.dprint.json",
  "psychojs/.editorconfig",
  "psychojs/.eslintrc.cjs",
  "psychojs/CHANGELOG.md",
  "psychojs/CONTRIBUTING.md",
  "psychojs/README.md",
  "psychojs/code-of-conduct.md",

  // Other non-runtime files
  "experiment",
  "i18n",
  "node_modules",
  "threshold.js",
  "first.js",
  "debugExperiment.csv",
  "init",
];

// Exact match - always include these specific files even if in ignored directories
const matchPattern = [
  // Build outputs - entry points
  "js/threshold.min.js",
  "js/threshold.min.js.map",
  "js/threshold.css",
  "js/first.min.js",
  "js/first.min.js.map",

  // Build outputs - chunks (stable names, no hashes)
  "js/easyeyes_wasm.js",

  // Component assets needed at runtime
  "components/images/favicon.ico",
  "components/images/ios_settings.png",
  "components/multiple-displays/peripheralDisplay.js",
  "components/multiple-displays/peripheralDisplay.html",
  "components/multiple-displays/multipleDisplay.css",
];

const inIgnore = (f) => {
  for (const ig of ignorePattern) {
    if (f.includes(ig)) return true;
  }
  return false;
};

const inMatch = (f) => {
  for (const pattern of matchPattern) {
    if (f === pattern) return true;
  }
  return false;
};

function throughDirectory(directory) {
  const files = [];
  fs.readdirSync(directory).forEach((file) => {
    const absolute = path.join(directory, file);

    if (fs.statSync(absolute).isDirectory())
      files.push(...throughDirectory(absolute));
    else return files.push(absolute.replace(fetchDir, ""));
  });

  const returner = [];
  for (let f of files) {
    if (inMatch(f) || !inIgnore(f)) {
      returner.push(f);
    }
  }
  return returner;
}

const exportWarning = `/*
  Do not modify this file! Run \`npm run files\` from docs/experiment/ to regenerate.
  This file lists all files uploaded to Pavlovia for hosted experiments.
*/\n\n`;
const exportHandle = `export const _loadDir = "/compiler/threshold/";\nexport const _loadFiles: string[] = `;

const fileList = throughDirectory(fetchDir);
const fileContent =
  exportWarning + exportHandle + JSON.stringify(fileList, null, 2) + ";\n";

// Write to threshold/preprocess/files.ts (the one actually used for Pavlovia uploads)
// Also write to source/components/files.ts for backwards compatibility
const out = [
  `${process.cwd()}/threshold/preprocess/files.ts`,
  `${process.cwd()}/source/components/files.ts`,
];
out.forEach((filepath) =>
  fs.writeFile(filepath, fileContent, (error) => {
    if (error) {
      console.log(`Error writing ${filepath}:`, error);
    } else {
      console.log(`Updated ${filepath}`);
    }
  }),
);

// Log summary
console.log(`\nGenerated file list with ${fileList.length} files.`);
