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

export const getFileBinaryData = (file: File) => {
  return new Promise((resolve) => {
    const fileReader = new FileReader();
    fileReader.readAsDataURL(file);

    fileReader.onload = (e: any) => {
      if (
        typeof fileReader.result === "string" &&
        fileReader!.result!.includes(";base64,")
      ) {
        var splitResult = fileReader!.result!.split(";base64,");
        resolve(splitResult![1]);
      } else resolve(<string>fileReader.result);
    };

    fileReader.onerror = (e: any) => {
      console.error("Unable to get BINARY data", file, e);
    };
  });
};

export const getFileTextData = (file: File) => {
  return new Promise((resolve) => {
    const fileReader = new FileReader();
    fileReader.onload = (e: any) => {
      resolve(e.target.result);
    };

    fileReader.onerror = (e: any) => {
      console.error("Unable to get TEXT data", file, e);
    };

    fileReader.readAsText(file, "UTF-8");
  });
};
