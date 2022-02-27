import { _loadDir, _loadFiles } from "./files";
import { ICommitAction } from "./gitlabUtil";

export const getGitlabBodyForThreshold = async (
  startIndex: number,
  endIndex: number
) => {
  const res: ICommitAction[] = [];

  for (let i = startIndex; i <= endIndex; i++) {
    const path = _loadFiles[i];
    const content = assetUsesBase64(path)
      ? await getAssetFileContentBase64(_loadDir + path)
      : await getAssetFileContent(_loadDir + path);
    res.push({
      action: "create",
      file_path: path,
      content,
      encoding: assetUsesBase64(path) ? "base64" : "text",
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

export const getAssetFileContentBase64 = async (filePath: string) => {
  return await fetch(filePath)
    .then((response) => {
      return response.blob();
    })
    .then((blob) => {
      return new Promise((resolve) => {
        const fileReader = new FileReader();
        fileReader.readAsDataURL(blob);
        fileReader.onload = function () {
          resolve(blob);
        };
      });
    })
    .catch((error) => {
      return error;
    });
};

// Now only used for favicon.ico
export const assetUsesBase64 = (filePath: string) => {
  return filePath.includes(".ico");
};
