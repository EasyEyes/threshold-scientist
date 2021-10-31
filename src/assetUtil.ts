import { _loadDir, _loadFiles } from "./files";

export const getGitlabBodyForThreshold = async (
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

export const getAssetFileContent = async (filePath: string) => {
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
