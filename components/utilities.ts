// Initialize dataframe-js module
declare let dfjs: any;
export var DataFrame = dfjs.DataFrame;

/**
 * Return a transposed copy of a 2D table.
 * CREDIT https://stackoverflow.com/questions/17428587/transposing-a-2d-array-in-javascript
 * @param {*[][]} nestedArray A 2D array (array of arrays of primitives)
 * @returns {*[][]} transposed Transposed transformation of nestedArray
 */
export const transpose = (nestedArray: any[]): any => {
  const transposed = nestedArray[0].map((_: any, colIndex: number) =>
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
export const fileListContainsFileOfName = (fileList: File[], targetFileName: string): any => {
  const isFileOfTargetName = (candidateFile: File) =>
    candidateFile.name == targetFileName;
  return fileList.filter(isFileOfTargetName).length > 0;
};

/**
 * Given the content returned by PapaParse on our csv file, provide a dfjs Dataframe
 * @param {Object} parsedContent .csv file as parsed by PapaParse
 * @returns {dfjs.DataFrame}
 */
export const dataframeFromPapaParsed = (parsedContent: any): any => {
  const parsedData = parsedContent.data;
  // Transpose, to get from Denis's row-major convention to the usual column-major
  const transposed = parsedData[0].map((_: any, colIndex: number) =>
    parsedData.map((row: any) => row[colIndex])
  );

  // Separate out the column names from rows of values
  const data = transposed.slice(1); // Rows
  const columns = transposed[0]; // Header
  // Create and return the DataFrame
  return new DataFrame(data, columns);
};

/**
 * Robust check for whether a file is a CSV file
 * https://developer.mozilla.org/en-US/docs/Web/API/File
 * @param {File} file File object to be checked
 * @returns {Boolean}
 */
export const isCsvFile = (file: File): any => {
  // https://stackoverflow.com/questions/11832930/html-input-file-accept-attribute-file-type-csv
  // https://stackoverflow.com/questions/190852/how-can-i-get-file-extensions-with-javascript/1203361#1203361
  return (
    file.type === "text/csv" ||
    file.type === "application/csv" ||
    file.type === "application/vnd.ms-excel" ||
    file.name.split(".").pop() === "csv"
  );
};

/**
 * Damerau–Levenshtein of two strings
 * @see https://stackoverflow.com/questions/11919065/sort-an-array-by-the-levenshtein-distance-with-best-performance-in-javascript
 * @author James Westgate (https://stackoverflow.com/users/305319/james-westgate)
 * @param {String} s
 * @param {String} t
 * @returns
 */
export const levDist = (s: any, t: any): any => {
  var d: any = []; //2d matrix

  // Step 1
  var n = s.length;
  var m = t.length;

  if (n == 0) return m;
  if (m == 0) return n;

  //Create an array of arrays in javascript (a descending loop is quicker)
  for (var i = n; i >= 0; i--) d[i] = [];

  // Step 2
  for (var i = n; i >= 0; i--) d[i][0] = i;
  for (var j = m; j >= 0; j--) d[0][j] = j;

  // Step 3
  for (var i: any = 1; i <= n; i++) {
    var s_i = s.charAt(i - 1);

    // Step 4
    for (var j: any = 1; j <= m; j++) {
      //Check the jagged ld total so far
      if (i == j && d[i][j] > 4) return n;

      var t_j = t.charAt(j - 1);
      var cost = s_i == t_j ? 0 : 1; // Step 5

      //Calculate the minimum
      var mi = d[i - 1][j] + 1;
      var b = d[i][j - 1] + 1;
      var c = d[i - 1][j - 1] + cost;

      if (b < mi) mi = b;
      if (c < mi) mi = c;

      d[i][j] = mi; // Step 6

      //Damerau transposition
      if (i > 1 && j > 1 && s_i == t.charAt(j - 2) && s.charAt(i - 2) == t_j) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + cost);
      }
    }
  }

  // Step 7
  return d[n][m];
};
