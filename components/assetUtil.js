const getEnvironment = async () => {
  let response = await getAssetFileContent("/threshold/environment.json");
  response = JSON.parse(response);
  return response;
};

const getGitlabBodyForThreshold = async (startIndex, endIndex) => {
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

const getAssetFileContent = async (filePath) => {
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
