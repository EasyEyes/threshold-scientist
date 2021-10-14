// Initialize dataframe-js module
export var DataFrame = dfjs.DataFrame;

/**
 * Return a transposed copy of a 2D table.
 * CREDIT https://stackoverflow.com/questions/17428587/transposing-a-2d-array-in-javascript
 * @param {*[][]} nestedArray A 2D array (array of arrays of primitives)
 * @returns {*[][]} transposed Transposed transformation of nestedArray
 */
export const transpose = (nestedArray) => {
  const transposed = nestedArray[0].map((_, colIndex) =>
    nestedArray.map((row) => row[colIndex])
  );
  return transposed;
};

/**
 * Check whether an array of file objects contains one with the name of the value of targetFileName
 * @param {File[]} fileList
 * @param {String} targetFileName
 * @returns {Boolean}
 */
export const fileListContainsFileOfName = (fileList, targetFileName) => {
  const isFileOfTargetName = (candidateFile) =>
    candidateFile.name == targetFileName;
  return fileList.filter(isFileOfTargetName).length > 0;
};

/**
 * Given the content returned by PapaParse on our csv file, provide a dfjs Dataframe
 * @param {Object} parsedContent .csv file as parsed by PapaParse
 * @returns {dfjs.DataFrame}
 */
export const dataframeFromPapaParsed = (parsedContent) => {
  const parsedData = parsedContent.data;
  // Transpose, to get from Denis's row-major convention to the usual column-major
  const transposed = parsedData[0].map((_, colIndex) =>
    parsedData.map((row) => row[colIndex])
  );
  // Separate out the column names from rows of values
  const data = transposed.slice(1); // Rows
  const columns = transposed[0]; // Header
  // Create and return the DataFrame
  return new DataFrame(data, columns);
};
