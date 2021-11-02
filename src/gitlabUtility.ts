import { getGitlabBodyForThreshold } from "./assetUtil";
import {
  acceptableExtensions,
  EasyEyesResources,
  env,
  user,
} from "./CONSTANTS";
import {
  getFileExtension,
  hideDialogBox,
  showDialogBox,
} from "./dropzoneHandler";
import { _loadFiles } from "./files";
import { setTab } from "./tab";

export const gitlabRoutine = async (uploadedFiles: any) => {
  console.log(uploadedFiles);
  // empty file list check
  if (
    uploadedFiles.others == null ||
    uploadedFiles.others == undefined ||
    uploadedFiles.others.length == 0
  ) {
    window.alert("Please upload required files.");
    return;
  }

  showDialogBox(`Creating Experiment`, `Uploading experiment files: 0%`, false);

  const gitlabRepoNameEl = document.getElementById(
    "new-gitlab-repo-name"
  ) as HTMLInputElement;
  const newRepoName = gitlabRepoNameEl.value;
  var isRepoValid = await validateRepoName(newRepoName);

  // if repo is valid
  if (isRepoValid) {
    // upload fonts and forms to EasyEyesResources repo
    await populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment(
      uploadedFiles.others
    );

    // create new experiment repo
    const gitlabRepo = await createRepo(newRepoName);
    user.newRepo = gitlabRepo;

    await populateThresholdRepoOnExperiment(gitlabRepo);

    // filter and get all .csv files
    // var blockFiles = files.filter( f => {
    //   var extension = f.name.split('.');
    //   extension = extension[extension.length - 1];
    //   return extension.includes('csv');
    // });

    // await commitNewFilesToGitlab(gitlabRepo, files)
    await commitNewFilesToGitlab(gitlabRepo, uploadedFiles);
    // await commitFilesToGitlabFromGithubAndEasyEyes(gitlabRepo, files);

    // download all consent forms and fonts from resources repo, and commit to new expeiment repo in 2nd commit
    await populateResourcesOnExperiment(gitlabRepo);

    // update resources info
    setTab("font-tab", EasyEyesResources.fonts.length, "Fonts");
    setTab(
      "form-tab",
      EasyEyesResources.forms.length,
      "Consent and Debrief Forms"
    );

    // window.alert(
    //   "New Repo " + newRepoName + " has been successfully initiated"
    // );
    hideDialogBox();
    showDialogBox(`Sucess!`, `${newRepoName} has been created.`, true);

    // update repo name input field and btn
    document
      .getElementById("new-gitlab-repo-name")!
      .setAttribute("disabled", "disabled");
    document.getElementById("gitlab-file-submit")!.className =
      "btn btn-success disabled";
    document.getElementById("gitlab-file-submit")!.innerText =
      "Files have been uploaded.";

    const actEl = document.getElementById("pavlovia-activate-div");
    actEl!.style.visibility = "visible";

    const pavloviaExperimentUrlElement = document.getElementById(
      "pavlovia-experiment-url-div"
    );
    pavloviaExperimentUrlElement!.style.visibility = "visible";

    // display "run" experiement link
    const pavExpLinkEl = document.getElementById(
      "pavlovia-experiment-url"
    ) as HTMLInputElement;
    pavExpLinkEl.value =
      "https://run.pavlovia.org/" +
      user.userData.username +
      "/" +
      newRepoName.toLowerCase() +
      "/";

    if (
      user.currentExperiment.participantRecruitmentServiceName == "Prolific"
    ) {
      handleParticipantRecruitmentUrl();
    }

    // document.getElementById("activate-experiment-btn");
  }

  // else if repo name is invalid, display response
  else {
    showDialogBox(
      "Duplicate Repository Name",
      "Please enter a new repository name.",
      true
    );
    const waitingEl = document.getElementById("waiting-div");
    waitingEl!.style.visibility = "hidden";
  }
};

const validateRepoName = async (newRepoName: string) => {
  if (newRepoName == "") return false;
  var userRepos: any = await fetch(
    `https://gitlab.pavlovia.org/api/v4/users/${user.userData.id}/projects?access_token=` +
      user.accessToken
  );
  userRepos = await userRepos.json();
  return (
    userRepos.map((i: any) => i.name).find((i: any) => i == newRepoName) ==
    undefined
  );
};

export const createRepo = async (repoName: string) => {
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

export const populateFontsAndConsentFilesIntoResourcesAndGetAllForExperiment =
  async (files: File[]) => {
    // get EasyEyesResources repository from gitlab
    var easyEyesResourcesRepo = user.userData.projects.find(
      (i: any) => i.name == "EasyEyesResources"
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
    let fonts = files.filter((i) => {
      let extensionList = i.name.split(".");
      let ext = extensionList[extensionList.length - 1];
      return acceptableExtensions.fonts.includes(ext);
    });

    // filter and get all form files
    let consentForms = files.filter((i) => {
      let extensionList = i.name.split(".");
      let ext = extensionList[extensionList.length - 1];
      return acceptableExtensions.forms.includes(ext);
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

const populateResourcesOnExperiment = async (gitlabRepo: any) => {
  // get EasyEyesResources repository from gitlab
  var easyEyesResourcesRepo = user.userData.projects.find(
    (i: any) => i.name == "EasyEyesResources"
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
    let consentFormContent: string = await getFileRawFromGitlab(
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
    const resourcesRepoFilePath = encodeGitlabFilePath(`fonts/${userFont}`);
    let content: string = await getFileRawFromGitlab(
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

export const getResourcesListFromRepository = async (
  repoId: number,
  accessToken: string
) => {
  // get list of fonts and forms
  var gitlabHeaders = new Headers();
  gitlabHeaders.append("Authorization", `bearer ${accessToken}`);

  var gitlabRequestOptions: any = {
    method: "GET",
    headers: gitlabHeaders,
    redirect: "follow",
  };

  // get font list
  let prevFontListResponse: any = await fetch(
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
  let prevFormListResponse: any = await fetch(
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
  let prevFormListResponseJSON = JSON.parse(prevFormListResponse);
  let prevFormList = [];
  for (let i = 0; i < prevFormListResponseJSON.length; i++) {
    prevFormList.push(prevFormListResponseJSON[i].name);
  }

  return {
    fonts: prevFontList,
    forms: prevFormList,
  };
};

const commitFilesToGitlabFromGithubAndEasyEyes = async (
  gitlabRepo: any,
  files: any
) => {
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

const populateThresholdRepoOnExperiment = async (gitlabRepo: any) => {
  const promiseList = [];
  let progress = 0;
  const batchSize = 10;

  for (let i = 0; i < _loadFiles.length; i += batchSize) {
    let startIdx = i;
    let endIdx = Math.min(i + batchSize - 1, _loadFiles.length - 1);

    const promise = new Promise(async (resolve) => {
      const rootContent = await getGitlabBodyForThreshold(startIdx, endIdx);
      const commitBody = {
        branch: "master",
        commit_message: "Initialise repository with threshold",
        actions: rootContent,
      };

      const commitFile = fetch(
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

      commitFile.then((commitResponse) => {
        progress += endIdx - startIdx;
        const progressPercent = Math.round(
          (progress / _loadFiles.length) * 100
        );
        showDialogBox(
          "Creating Experiment",
          `Uploading experiment files: ${progressPercent}%`,
          false
        );

        resolve(commitResponse);
      });
    });

    promiseList.push(promise);
  }
  await Promise.all(promiseList);
};

const commitNewFilesToGitlab = async (gitlabRepo: any, uploadedFiles: any) => {
  // get Gitlab API format data for files
  var jsonBody = await convertFilesToGitlabObjects(uploadedFiles);
  console.log(jsonBody);

  // create single commit payload for multiple files
  var commitBody = {
    branch: "master",
    commit_message: "Easy Eyes to Gitlab INIT",
    actions: [...jsonBody],
  };
  console.log(
    "https://gitlab.pavlovia.org/api/v4/projects/" +
      gitlabRepo.id +
      "/repository/commits?access_token=" +
      user.accessToken
  );
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

const populateCommitBody = async (rootContent: any, externalFiles: any) => {
  let jsonFiles = [];
  let files = [...rootContent];
  while (files.length > 0) {
    // get dirs and files in dir
    // if file, get data and populate fileList
    let currentFile = files.pop();

    // if current object is a "Directory", get inner contents
    if (currentFile.type == "dir") {
      // get content from Github
      let innerFiles: any = await fetch(
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
        let innerFiles: any = await fetch(
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
        let fileData: any = await fetch(
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
      let fileData: any = await externalFile.text();
      jsonFiles.push({
        action: "create",
        // change to blocks after threshold is modified
        file_path: "conditions/" + externalFile.name,
        content: fileData,
      });
    }
    if (externalFile.type == "application/pdf") {
      let fileData: any = await externalFile.text();
      jsonFiles.push({
        action: "create",
        file_path: "forms/" + externalFile.name,
        content: fileData,
      });
    } else {
      let fileData: any = await externalFile.text();
      jsonFiles.push({
        action: "create",
        file_path: "fonts/" + externalFile.name,
        content: fileData,
      });
    }
  }

  return jsonFiles;
};

const convertFilesToGitlabObjects = async (uploadedFiles: any) => {
  const jsonFiles = [];

  // convert external files to Gitlab API data format
  for (var i = 0; i < uploadedFiles.others.length; i++) {
    const externalFile = uploadedFiles.others[i];

    const ext = getFileExtension(externalFile);

    // experiment files
    if (acceptableExtensions.experiments.includes(ext)) {
      const fileData = await externalFile.text();
      jsonFiles.push({
        action: "create",
        file_path: "conditions/" + externalFile.name,
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

  // add experiment file to root
  const fileData = await uploadedFiles.experimentFile.text();
  jsonFiles.push({
    action: "create",
    file_path: uploadedFiles.experimentFile.name,
    content: fileData,
  });

  // add experiment file to `/conditions`
  jsonFiles.push({
    action: "create",
    file_path: "conditions/experiment.csv",
    content: fileData,
  });

  return jsonFiles;
};

const getFileRawFromGitlab = async (
  repoID: number,
  filePath: string,
  accessToken: string
) => {
  return new Promise<string>(async (resolve) => {
    var myHeaders = new Headers();
    myHeaders.append("Authorization", `bearer ${accessToken}`);

    var requestOptions: any = {
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

const encodeGitlabFilePath = (filePath: string): string => {
  let res: string = "";
  for (let i = 0; i < filePath.length; i++) {
    let c = filePath[i];
    if (c == "/") c = "%2F";
    else if (c == ".") c = "%2E";
    res = res + c;
  }

  return res;
};

export const handleParticipantRecruitmentUrl = () => {
  // check if service is Prolific
  // if Prolific, expose
  document.getElementById(
    "participant-survey-completion-div"
  )!.style.visibility = "";
  document.getElementById("participant-survey-new-url-div")!.style.visibility =
    "";
  document.getElementById("activate-experiment-btn")!.className += " disabled";
};

export const copyUrl = () => {
  const cb = navigator.clipboard;
  const paragraph = document.querySelector(
    "#pavlovia-experiment-url"
  ) as HTMLInputElement;
  cb.writeText(paragraph.value).then(() => {
    showDialogBox(``, `Your URL has been copied to clipboard.`, true);
  });
};

export const uploadCompletionURL = async () => {
  let participantCodeElement = document.getElementById(
    "participant-code"
  ) as HTMLInputElement;
  var completionURL: string = participantCodeElement.value;
  if (completionURL != "") {
    var commitAction = {
      action: "create",
      file_path: "survey/participantRecruitmentServiceData.json",
      content: JSON.stringify({
        name: user.currentExperiment.participantRecruitmentServiceName,
        code: user.currentExperiment.participantRecruitmentServiceCode,
        url: completionURL,
      }),
    };
    var commitBody = {
      branch: "master",
      commit_message: "Easy Eyes to Gitlab INIT",
      actions: [commitAction],
    };
    showDialogBox(
      `Completion URL Update`,
      `Your Experiment Completion URL is being uploaded.`,
      true
    );
    var commitFile = await fetch(
      "https://gitlab.pavlovia.org/api/v4/projects/" +
        user.newRepo.id +
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
    document
      .getElementById("participant-code")!
      .setAttribute("disabled", "disabled");
    document.getElementById(
      "participant-recruitment-completion-url-submit"
    )!.className += " disabled";
    document.getElementById(
      "participant-recruitment-completion-url-submit"
    )!.innerText = "Completion URL Submitted";
  }
};

export const handleGeneratedURLSubmission = () => {
  let newUrlElement = document.getElementById("new-url") as HTMLInputElement;
  var generatedUrl: string = newUrlElement.value;
  if (generatedUrl != "") {
    let pavloviaExperimentUrlElement = document.getElementById(
      "pavlovia-experiment-url"
    ) as HTMLInputElement;
    pavloviaExperimentUrlElement.value = generatedUrl;
    document.getElementById(
      "participant-survey-new-url-div"
    )!.style.visibility = "hidden";
    document.getElementById("activate-experiment-btn")!.className = document
      .getElementById("activate-experiment-btn")!
      .className.replace("disabled", "");
  }
};

export const redirectToProlific = () => {
  window.open("https://www.prolific.co/auth/accounts/login/", "_blank");
};
