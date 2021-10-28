// will compensate for getEnviroment through CONSTANTS now
/*const getEnvironment = async () => {
    let response = await getAssetFileContent("/threshold/environment.json");
    response = JSON.parse(response);
    return response;
};*/

import { _loadDir, _loadFiles } from "./CONSTANTS";

const getGitlabBodyForThreshold = async (
  startIndex: number,
  endIndex: number
) => {
  const res = [];

  for (let i = startIndex; i <= endIndex; i++) {
    const path = _loadFiles[i];
    const content = await getAssetFileContent(_loadDir + path);
    res.push({
      action: "create",
      file_path: path,
      content,
    });
  }
  return res;
};

const getAssetFileContent = async (filePath: string) => {
  return await fetch(filePath)
    .then((response) => {
      return response.text();
    })
    .then((result) => {
      return result;
    })
    .catch((error) => {
      return error;
    });
};
