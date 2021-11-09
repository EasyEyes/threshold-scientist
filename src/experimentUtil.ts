import Papa from "papaparse";

let externalCallback: any;

export const getExperimentFontList = (experimentFile: File, callback: any) => {
  // init callback for returning values
  externalCallback = callback;

  Papa.parse(experimentFile, {
    dynamicTyping: false,
    complete: processFontList,
  });
};

export const getExperimentFormList = (experimentFile: File, callback: any) => {
  // init callback for returning values
  externalCallback = callback;

  Papa.parse(experimentFile, {
    dynamicTyping: false,
    complete: processFormList,
  });
};

export const processFontList = (parsedContent: any) => {
  const fontList: string[] = [];
  let targetFontRow: string[] = [];
  let targetFontSourceRow: string[] = [];

  for (let i = 0; i < parsedContent.data.length; i++) {
    if (parsedContent.data[i][0] == "targetFont") {
      targetFontRow = parsedContent.data[i];
    } else if (parsedContent.data[i][0] == "targetFontSource") {
      targetFontSourceRow = parsedContent.data[i];
    }
  }

  for (let i = 0; i < targetFontRow.length; i++) {
    if (targetFontSourceRow[i].trim() == "file")
      fontList.push(targetFontRow[i]);
  }

  externalCallback(fontList);
};

export const processFormList = (parsedContent: any) => {
  const formList: string[] = [];
  let consentFormRow: string[] = [];
  let debriefFormRow: string[] = [];

  for (let i = 0; i < parsedContent.data.length; i++) {
    if (parsedContent.data[i][0] == "_consentForm") {
      consentFormRow = parsedContent.data[i];
    } else if (parsedContent.data[i][0] == "_debriefForm") {
      debriefFormRow = parsedContent.data[i];
    }
  }

  formList.push(consentFormRow[1]);
  formList.push(debriefFormRow[1]);
  externalCallback(formList);
};
