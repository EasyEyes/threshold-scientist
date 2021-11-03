import Papa from "papaparse";
import { user } from "./CONSTANTS";
import { dataframeFromPapaParsed } from "./utilities";

let externalCallback: any;

export const getExperimentFontList = (experimentFile: File, callback: any) => {
  // init callback for returning values
  externalCallback = callback;

  Papa.parse(experimentFile, {
    dynamicTyping: false,
    complete: processFontList,
  });
};

export const processFontList = (parsedContent: any) => {
  const fontList: string[] = [];
  for (let i = 0; i < parsedContent.data.length; i++) {
    // if current row is font row
    if (parsedContent.data[i][0] == "targetFont") {
      const fontRow = parsedContent.data[i];
      for (let j = 1; j < fontRow.length; j++) {
        fontList.push(fontRow[j]);
      }

      break;
    }
  }

  externalCallback(fontList);
};
