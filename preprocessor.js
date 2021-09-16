/**
 * @file Client-side (ie browser) processing of declarative experiment.csv file
 * @see preprocessor.py for the original Python script of the same purpose
 */

// Initialize dataframe-js module
var DataFrame = dfjs.DataFrame;

/**
 * Return a transposed copy of a 2D array.
 * CREDIT https://stackoverflow.com/questions/17428587/transposing-a-2d-array-in-javascript
 * @param {*[][]} nestedArray A 2D array (array of arrays of primitives)
 * @returns {*[][]} transposed Transposed transformation of nestedArray
 */
const transpose = (nestedArray) => {
  const transposed = nestedArray[0].map((_, colIndex) =>
    nestedArray.map((row) => row[colIndex])
  );
  return transposed;
};
/**
 * Given the parsed experiment csv from PapaParse, create PsychoJS readable files.
 * @param {Object} parsedContent Returned value from Papa.parse
 */
const interpretExperimentFile = (parsedContent) => {
  let parsedData = parsedContent.data;
  // Transpose, to get from Denis' row-major convention to the usual column-major
  let transposed = parsedData[0].map((_, colIndex) =>
    parsedData.map((row) => row[colIndex])
  );
  // Separate out the column names from rows of values
  let data = transposed.slice(1); // Rows
  let columns = transposed[0]; // Header
  // Create a dataframe for easy data manipulation
  let df = new DataFrame(data, columns);
  // Change some names to the ones that PsychoJS expects
  const nameChanges = {
    conditionName: "label",
    thresholdBeta: "beta",
    thresholdDelta: "delta",
    thresholdProbability: "pThreshold",
  };
  //// https://stackoverflow.com/questions/5915789/how-to-replace-item-in-array
  let preparedNames = transposed[0].map((oldName) =>
    nameChanges.hasOwnProperty(oldName) ? nameChanges[oldName] : oldName
  );
  df = df.renameAll(preparedNames);
  // VERIFY correctness
  if ("thresholdGuessLogSd" in df.toDict()) {
    df = df
      .withColumn("startValSd", (row) => row.get("thresholdGuessLogSd"))
      .withColumn("startVal", (row) => Math.log10(row.get("thresholdGuess")));
  }
  splitIntoBlockFiles(df);
};
/**
 * Given a dataframe of the correctly formatted experiment parameters, split into appropriate files for the user to download
 * @param {Object} df Dataframe (from data-frame.js) of correctly specified parameters for the experiment
 */
const splitIntoBlockFiles = (df) => {
  // Initialize the set of files to be downloaded as a zip file
  const zip = new JSZip();
  // Split up into block files
  const blockIndices = { block: [] };
  df.unique("blockOrder")
    .toDict()
    ["blockOrder"].forEach((blockId, index) => {
      // Add an index to our blockCount file (see below) for this block
      blockIndices["block"].push(index);
      // Get the parameters from just this block...
      const blockDf = df.filter((row) => row.get("blockOrder") === blockId);
      const blockDict = blockDf.toDict();
      const columns = Object.keys(blockDict);
      const data = transpose(columns.map((column) => blockDict[column]));
      // ... and use them to create a csv file for this block.
      const blockCSVString = Papa.unparse({ fields: columns, data: data });
      const blockFileName = "block_" + String(blockId) + ".csv";
      // Add this block file to the output zip
      zip.file(blockFileName, blockCSVString);
    });
  // Create a "blockCount" file, just one column with the the indicies of the blocks
  const blockCountCSVString = Papa.unparse({
    fields: ["block"],
    data: blockIndices.block.map((x) => [x]),
  });
  const blockCountFileName = "blockCount.csv";
  // Add blockCount file to output zip
  zip.file(blockCountFileName, blockCountCSVString);
  // Download the zip of files to the user's computer
  zip.generateAsync({ type: "base64" }).then((base64) => {
    location.href = "data:application/zip;base64," + base64;
  });
};

/**
 * Checks whether the user has provided the files necessary for the experiment
 * TODO use getMissingFontFiles to check if font files are also provided
 * @param {File[]} fileList Array of files that the user has provided
 * @returns {boolean}
 */
const containsNecessaryFiles = (fileList) => {
  // Check that there is one, and only one, experiment.csv file
  const isCsvFile = (file) => file.type == "text/csv";
  // https://stackoverflow.com/questions/45052433/javascript-how-to-check-if-array-of-object-has-one-and-only-one-item-with-given
  if (!fileList.filter(isCsvFile).length == 1) {
    console.error(
      "Uh oh! Trouble finding an *.csv file amongst those you uploaded."
    );
    return false;
  }
  return true;
};

/**
 * Compares the fonts provided to those referenced in the experiment file,
 * and returns an array of those font files which were referenced but not supported natively or provided font files for.
 * Returning an empty array implies that all fonts are available.
 * @param {String[]} fontsRequired List of font names used in experiment.csv
 * @param {File[]} filesProvided List of file objects the user has provided
 */
const getMissingFontFiles = (fontsRequired, filesProvided) => {
  const webSafeFonts = [
    "Arial",
    "Verdana",
    "Helvetica",
    "Tahoma",
    "Trebuchet",
    "Times New Roman",
    "Georgia",
    "Garamond",
    "Courier New",
    "Brush Script MT",
    "sans-serif",
    "serif",
  ];
  const missingFontFiles = [];
  const isWebSafe = (font) => webSafeFonts.contains(font);
  const hasFontFile = (fontFilename) =>
    filesProvided.map((file) => file.name).contains(fontFilename);
  for (const font of fontsRequired) {
    const fontString = String(font) + ".woff"; // TODO also allow .woff2?
    if (!(isWebSafe(font) || hasFontFile(fontString))) {
      console.log("Uh oh! Unable to find a font file for " + font);
      missingFontFiles.push(font);
    }
  }
  return missingFontFiles;
};

/**
 * On <Change> of #fileInput element, read in files and parse appropriately.
 */
const processFiles = () => {
  // Assume a <input> element of type 'file', multiple, #fileInput
  const fileList = [...document.getElementById("fileInput").files];
  // TEMP just checks for experiment file; should also check for necessary font files
  const experimentFileProvided = containsNecessaryFiles(fileList);
  // Look through the files and handle appropriately
  fileList.forEach((file) => {
    switch (file.type) {
      case "text/csv":
        Papa.parse(file, {
          dynamicTyping: true, // check out index 23; make sure null values preserve
          complete: interpretExperimentFile,
        });
        break;
      case "font/woff":
        // TODO handle uploading font files
        console.error("TODO uploading fonts now yet supported");
        break;
      case "font/woff2":
        // TODO handle uploading font files
        console.error("TODO uploading fonts now yet supported");
        break;
      default:
        console.log(
          "Huh, I don't recognize the type of file that " +
            String(file) +
            " is."
        );
    }
  });
};

// Add Change event handler to #fileInput
document.getElementById("fileInput").addEventListener("change", processFiles);
