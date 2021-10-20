const gitlabRoutine = async (uploadedFiles) => {
  // empty file list check
  if (
    uploadedFiles.others == null ||
    uploadedFiles.others == undefined ||
    uploadedFiles.others.length == 0
  ) {
    window.alert("Please upload required files.");
    return;
  }

  // document.getElementById("waiting-div").style.visibility = "";
  showDialogBox(
    `Uploading files...`,
    `Please wait while your experiment is being created.`,
    false
  );

  const newRepoName = document.getElementById("new-gitlab-repo-name").value;
  var isRepoValid = await validateRepoName(newRepoName);

  // if repo is valid
  if (isRepoValid) {
    // upload fonts and forms to EasyEyesResources repo
    console.log("creating resources");
    await populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment(
      uploadedFiles.others
    );

    // create new experiment repo
    console.log("creating experiment-repo");
    const gitlabRepo = await createRepo(newRepoName);
    user.newRepo = newRepoName;

    console.log("initializing threshold");
    await populateThresholdRepoOnExperiment(gitlabRepo);

    // filter and get all .csv files
    // var blockFiles = files.filter( f => {
    //   var extension = f.name.split('.');
    //   extension = extension[extension.length - 1];
    //   return extension.includes('csv');
    // });

    // await commitNewFilesToGitlab(gitlabRepo, files)
    console.log("uploading experiment files");
    await commitNewFilesToGitlab(gitlabRepo, uploadedFiles);
    // await commitFilesToGitlabFromGithubAndEasyEyes(gitlabRepo, files);

    // download all consent forms and fonts from resources repo, and commit to new expeiment repo in 2nd commit
    console.log("syncing resources");
    await populateResourcesOnExperiment(gitlabRepo);

    // update resources info
    setTab("font-tab", EasyEyesResources.fonts.length, "Fonts");
    setTab("form-tab", EasyEyesResources.forms.length, "Consent Forms");

    // window.alert(
    //   "New Repo " + newRepoName + " has been successfully initiated"
    // );
    hideDialogBox();
    showDialogBox(`Sucess!`, `${newRepoName} has been created.`, true);

    // update repo name input field and btn
    document
      .getElementById("new-gitlab-repo-name")
      .setAttribute("disabled", "disabled");
    document.getElementById("gitlab-file-submit").className =
      "btn btn-success disabled";
    document.getElementById("gitlab-file-submit").innerText =
      "Files have been uploaded.";
    document.getElementById("waiting-div").style.visibility = "hidden";

    // display "run" experiement link
    document.getElementById("palvolia-experiment-link").href =
      "https://run.pavlovia.org/" +
      user.userData.username +
      "/" +
      newRepoName.toLowerCase() +
      "/";
    document.getElementById("palvolia-experiment-link").text =
      "https://run.pavlovia.org/" +
      user.userData.username +
      "/" +
      newRepoName.toLowerCase() +
      "/";

    // document.getElementById("activate-experiment-btn");

    document.getElementById("pavlovia-div").style.visibility = "";
  }

  // else if repo name is invalid, display response
  else {
    window.alert(
      "Repo name is either invalid or already taken. Please enter a new repo name."
    );
    document.getElementById("waiting-div").style.visibility = "hidden";
  }
};

const validateRepoName = async (newRepoName) => {
  if (newRepoName == "") return false;
  var userRepos = await fetch(
    "https://gitlab.pavlovia.org/api/v4/users/22058/projects?access_token=" +
      user.accessToken
  );
  userRepos = await userRepos.json();
  return (
    userRepos.map((i) => i.name).find((i) => i == newRepoName) == undefined
  );
};

const createRepo = async (repoName) => {
  var newRepo = await fetch(
    "https://gitlab.pavlovia.org/api/v4/projects?name=" +
      repoName +
      "&access_token=" +
      user.accessToken,
    {
      method: "POST",
    }
  );
  newRepo = await newRepo.json();
  return newRepo;
};

const populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment = async (
  files
) => {
  // get EasyEyesResources repository from gitlab
  var easyEyesResourcesRepo = user.userData.projects.find(
    (i) => i.name == "EasyEyesResources"
  );
  user.easyEyesResourcesRepo = easyEyesResourcesRepo;

  // get pre-existing resources list
  const resourcesList = await getResourcesListFromRepository(
    easyEyesResourcesRepo.id,
    user.accessToken
  );
  const prevFormList = resourcesList.forms;
  const prevFontList = resourcesList.fonts;

  var jsonFiles = [];

  // filter and get all font files
  var fonts = files.filter((i) => {
    var extension = i.name.split(".");
    extension = extension[extension.length - 1];
    return acceptableExtensions.fonts.includes(extension);
  });

  // filter and get all form files
  var consentForms = files.filter((i) => {
    var extension = i.name.split(".");
    extension = extension[extension.length - 1];
    return acceptableExtensions.forms.includes(extension);
  });

  // generate Gitlab API body to commit form files
  for (var i = 0; i < consentForms.length; i++) {
    var consentFormm = consentForms[i];
    var content = await consentFormm.text();
    let actionValue = prevFormList.includes(consentFormm.name)
      ? "update"
      : "create";
    jsonFiles.push({
      action: actionValue,
      file_path: "forms/" + consentFormm.name,
      content: content,
    });
  }

  // generate Gitlab API body to commit font files
  for (var i = 0; i < fonts.length; i++) {
    var userFont = fonts[i];
    var content = await userFont.text();
    let actionValue = prevFontList.includes(userFont.name)
      ? "update"
      : "create";
    jsonFiles.push({
      action: actionValue,
      file_path: "fonts/" + userFont.name,
      content: content,
    });
  }

  console.log("resources: ", jsonFiles);
  // commit files to EasyEyesResources repository
  var commitBody = {
    branch: "master",
    commit_message: "Update EasyEyes Resources",
    actions: [...jsonFiles],
  };
  var commitFile = await fetch(
    "https://gitlab.pavlovia.org/api/v4/projects/" +
      easyEyesResourcesRepo.id +
      "/repository/commits?access_token=" +
      user.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commitBody),
    }
  );
  await commitFile.json();
};

const populateResourcesOnExperiment = async (gitlabRepo) => {
  // get EasyEyesResources repository from gitlab
  var easyEyesResourcesRepo = user.userData.projects.find(
    (i) => i.name == "EasyEyesResources"
  );

  // get shared resources list
  const resourcesList = await getResourcesListFromRepository(
    easyEyesResourcesRepo.id,
    user.accessToken
  );
  const formList = resourcesList.forms;
  const fontList = resourcesList.fonts;

  var jsonFiles = [];

  // update global inventory
  EasyEyesResources.fonts = fontList;
  EasyEyesResources.forms = formList;

  // generate Gitlab API body to commit form files
  for (var i = 0; i < formList.length; i++) {
    var consentFormm = formList[i];
    const resourcesRepoFilePath = encodeGitlabFilePath(`forms/${consentFormm}`);
    var consentFormContent = await getFileRawFromGitlab(
      easyEyesResourcesRepo.id,
      resourcesRepoFilePath,
      user.accessToken
    );

    // ignore 404s
    if (
      consentFormContent.trim().indexOf(`{"message":"404 File Not Found"}`) !=
      -1
    )
      continue;

    // update gitlab commit
    jsonFiles.push({
      action: "create",
      file_path: "forms/" + consentFormm,
      content: consentFormContent,
    });
  }

  // generate Gitlab API body to commit font files
  for (var i = 0; i < fontList.length; i++) {
    var userFont = fontList[i];
    var content = "";
    const resourcesRepoFilePath = encodeGitlabFilePath(`fonts/${userFont}`);
    var content = await getFileRawFromGitlab(
      easyEyesResourcesRepo.id,
      resourcesRepoFilePath,
      user.accessToken
    );

    // ignore 404s
    if (content.trim().indexOf(`{"message":"404 File Not Found"}`) != -1)
      continue;

    // update gitlab commit
    jsonFiles.push({
      action: "create",
      file_path: "fonts/" + userFont,
      content: content,
    });
  }

  // commit files to EasyEyesResources repository
  console.log("resources-sync", jsonFiles);
  var commitBody = {
    branch: "master",
    commit_message: "Add EasyEyes Resources",
    actions: [...jsonFiles],
  };
  var commitFile = await fetch(
    "https://gitlab.pavlovia.org/api/v4/projects/" +
      gitlabRepo.id +
      "/repository/commits?access_token=" +
      user.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commitBody),
    }
  );
  await commitFile.json();
};

const getResourcesListFromRepository = async (repoId, accessToken) => {
  // get list of fonts and forms
  var gitlabHeaders = new Headers();
  gitlabHeaders.append("Authorization", `bearer ${accessToken}`);

  var gitlabRequestOptions = {
    method: "GET",
    headers: gitlabHeaders,
    redirect: "follow",
  };

  // get font list
  let prevFontListResponse = await fetch(
    `https://gitlab.pavlovia.org/api/v4/projects/${repoId}/repository/tree/?path=fonts`,
    gitlabRequestOptions
  )
    .then((response) => {
      return response.text();
    })
    .then((result) => {
      return result;
    })
    .catch((error) => {
      return console.log("error", error);
    });
  prevFontListResponse = JSON.parse(prevFontListResponse);
  let prevFontList = [];
  for (let i = 0; i < prevFontListResponse.length; i++) {
    prevFontList.push(prevFontListResponse[i].name);
  }

  // get form list
  let prevFormListResponse = await fetch(
    `https://gitlab.pavlovia.org/api/v4/projects/${repoId}/repository/tree/?path=forms`,
    gitlabRequestOptions
  )
    .then((response) => {
      return response.text();
    })
    .then((result) => {
      return result;
    })
    .catch((error) => {
      return console.log("error", error);
    });
  prevFormListResponse = JSON.parse(prevFormListResponse);
  let prevFormList = [];
  for (let i = 0; i < prevFormListResponse.length; i++) {
    prevFormList.push(prevFormListResponse[i].name);
  }

  return {
    fonts: prevFontList,
    forms: prevFormList,
  };
};

const commitFilesToGitlabFromGithubAndEasyEyes = async (gitlabRepo, files) => {
  // get threshold files from Github: EasyEyes/threshold
  var rootContent = await fetch(
    "https://api.github.com/repos/EasyEyes/threshold/contents",
    {
      headers: {
        Authorization: `token ${env.GITHUB_PAT}`,
      },
    }
  );
  rootContent = await rootContent.json();

  // get Gitlab API format data for files
  var jsonBody = await populateCommitBody(rootContent, files);

  // create single commit payload for multiple files
  var commitBody = {
    branch: "master",
    commit_message: "Add experiment and threshold files",
    actions: [...jsonBody],
  };
  var commitFile = await fetch(
    "https://gitlab.pavlovia.org/api/v4/projects/" +
      gitlabRepo.id +
      "/repository/commits?access_token=" +
      user.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commitBody),
    }
  );
  await commitFile.json();
  //alert('Repo has been successfully initiated. Please add your easy eyes table to add your experiment');
};

const populateThresholdRepoOnExperiment = async (gitlabRepo) => {
  const promiseList = [];
  for (let i = 0; i < pathList.length; i += 20) {
    let startIdx = i;
    let endIdx = Math.min(i + 20 - 1, pathList.length - 1);
    const rootContent = await getGitlabBodyForThreshold(startIdx, endIdx);
    const commitBody = {
      branch: "master",
      commit_message: "Initialise repository with threshold",
      actions: rootContent,
    };

    const commitFile = await fetch(
      "https://gitlab.pavlovia.org/api/v4/projects/" +
        gitlabRepo.id +
        "/repository/commits?access_token=" +
        user.accessToken,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(commitBody),
      }
    );
    promiseList.push(commitFile);
  }
  await Promise.all(promiseList);
};

const commitNewFilesToGitlab = async (gitlabRepo, uploadedFiles) => {
  // get Gitlab API format data for files
  var jsonBody = await convertFilesToGitlabObjects(uploadedFiles);

  // create single commit payload for multiple files
  var commitBody = {
    branch: "master",
    commit_message: "Easy Eyes to Gitlab INIT",
    actions: [...jsonBody],
  };
  var commitFile = await fetch(
    "https://gitlab.pavlovia.org/api/v4/projects/" +
      gitlabRepo.id +
      "/repository/commits?access_token=" +
      user.accessToken,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commitBody),
    }
  );
  await commitFile.json();
  //alert('Repo has been successfully initiated. Please add your easy eyes table to add your experiment');
};

const populateCommitBody = async (rootContent, externalFiles) => {
  var jsonFiles = [];
  var files = [...rootContent];
  while (files.length > 0) {
    // get dirs and files in dir
    // if file, get data and populate fileList
    var currentFile = files.pop();

    // if current object is a "Directory", get inner contents
    if (currentFile.type == "dir") {
      // get content from Github
      var innerFiles = await fetch(
        currentFile.git_url.split("/git")[0] + "/contents/" + currentFile.path,
        {
          headers: {
            Authorization: `token ${env.GITHUB_PAT}`,
          },
        }
      );
      innerFiles = await innerFiles.json();

      // update files list
      files.push(...innerFiles);
    }

    // else if current object is a "File", get inner content
    else if (currentFile.type == "file") {
      // possibility of inner folders being linked to other github projects
      // fetch them again in that case and continue
      if (currentFile.name == "psychojs" && currentFile.size == 0) {
        var innerFiles = await fetch(
          currentFile.git_url.split("/git")[0] + "/contents/",
          {
            headers: {
              Authorization: `token ${env.GITHUB_PAT}`,
            },
          }
        );
        innerFiles = await innerFiles.json();

        // update files list
        files.push(...innerFiles);
      }

      // ignore control-panel
      else if (currentFile.name == "control-panel") {
        // we don't need control-panel code in gitlab
        continue;
      }

      // create Gitlab API data for file
      else {
        var fileData = await fetch(
          currentFile.git_url.split("/git")[0] +
            "/contents/" +
            currentFile.path,
          {
            headers: {
              Authorization: `token ${env.GITHUB_PAT}`,
            },
          }
        );
        fileData = await fileData.json();
        jsonFiles.push({
          action: "create",
          file_path: fileData.git_url.split("/git")[0].includes("psychojs")
            ? "psychojs/" + fileData.path
            : fileData.path,
          content:
            fileData.encoding == "base64"
              ? atob(fileData.content)
              : fileData.content,
        });
      }
    }
  }

  // convert texternal files to Gitlab API data format
  for (var i = 0; i < externalFiles.length; i++) {
    var externalFile = externalFiles[i];
    if (externalFile.type == "text/csv") {
      var fileData = await externalFile.text();
      jsonFiles.push({
        action: "create",
        // change to blocks after threshold is modified
        file_path: "conditions/" + externalFile.name,
        content: fileData,
      });
    }
    if (externalFile.type == "application/pdf") {
      var fileData = await externalFile.text();
      jsonFiles.push({
        action: "create",
        file_path: "forms/" + externalFile.name,
        content: fileData,
      });
    } else {
      var fileData = await externalFile.text();
      jsonFiles.push({
        action: "create",
        file_path: "fonts/" + externalFile.name,
        content: fileData,
      });
    }
  }

  return jsonFiles;
};

const convertFilesToGitlabObjects = async (uploadedFiles) => {
  const jsonFiles = [];

  // convert texternal files to Gitlab API data format
  for (var i = 0; i < uploadedFiles.others.length; i++) {
    const externalFile = uploadedFiles.others[i];

    const ext = getFileExtension(externalFile);

    // experiment files
    if (acceptableExtensions.experiments.includes(ext)) {
      const fileData = await externalFile.text();
      jsonFiles.push({
        action: "create",
        file_path: "blocks/" + externalFile.name,
        content: fileData,
      });
    }

    // fonts
    else if (acceptableExtensions.fonts.includes(ext)) {
      const fileData = await externalFile.text();
      jsonFiles.push({
        action: "create",
        file_path: "fonts/" + externalFile.name,
        content: fileData,
      });
      jsonFiles.push({
        action: "update",
        file_path: "fonts/" + externalFile.name,
        content: fileData,
      });
    }

    // forms
    else if (acceptableExtensions.forms.includes(ext)) {
      const fileData = await externalFile.text();
      jsonFiles.push({
        action: "create",
        file_path: "forms/" + externalFile.name,
        content: fileData,
      });
      jsonFiles.push({
        action: "update",
        file_path: "forms/" + externalFile.name,
        content: fileData,
      });
    }
  }

  // experiment file
  const fileData = await uploadedFiles.experimentFile.text();
  jsonFiles.push({
    action: "create",
    file_path: uploadedFiles.experimentFile.name,
    content: fileData,
  });

  return jsonFiles;
};

const getFileRawFromGitlab = async (repoID, filePath, accessToken) => {
  return new Promise(async (resolve) => {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", `bearer ${accessToken}`);

    var requestOptions = {
      method: "GET",
      headers: myHeaders,
      redirect: "follow",
    };

    const encodedFilePath = encodeGitlabFilePath(filePath);
    let response = await fetch(
      `https://gitlab.pavlovia.org/api/v4/projects/${repoID}/repository/files/${encodedFilePath}/raw?ref=master`,
      requestOptions
    )
      .then((response) => {
        return response.text();
      })
      .then((result) => {
        return result;
      })
      .catch((error) => {
        return error;
      });

    resolve(response);
  });
};

const encodeGitlabFilePath = (filePath) => {
  let res = "";
  for (let i = 0; i < filePath.length; i++) {
    let c = filePath[i];
    if (c == "/") c = "%2F";
    else if (c == ".") c = "%2E";
    res = res + c;
  }

  return res;
};

const handleParticipantRecruitmentUrl = async () => {
  // check if service is Prolific
  // if Prolific, expose
};

const copyUrl = () => {
  const cb = navigator.clipboard;
  const paragraph = document.querySelector("#pavlovia-experiment-url");
  cb.writeText(paragraph.value).then(() =>
    alert("URL has been copied to clipboard")
  );
};
