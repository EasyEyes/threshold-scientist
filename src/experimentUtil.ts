import Papa from "papaparse";
import { GLOSSARY } from "../threshold/parameters/glossary";

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
  let foundTargetFontSourceRow = false;

  for (let i = 0; i < parsedContent.data.length; i++) {
    if (parsedContent.data[i][0] == "targetFont") {
      targetFontRow = parsedContent.data[i];
    } else if (parsedContent.data[i][0] == "targetFontSource") {
      targetFontSourceRow = parsedContent.data[i];
      foundTargetFontSourceRow = true;
    }
  }

  // read default value if it is absent
  if (!foundTargetFontSourceRow) {
    let defaultValue = GLOSSARY["targetFontSource"].default;
    if (Array.isArray(defaultValue)) defaultValue = defaultValue[0];
    for (let i = 0; i < targetFontRow.length; i++)
      targetFontSourceRow[i] = defaultValue;
    targetFontSourceRow[0] = "";
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

  if (consentFormRow[1]) formList.push(consentFormRow[1]);
  if (debriefFormRow[1]) formList.push(debriefFormRow[1]);
  externalCallback(formList);
};
