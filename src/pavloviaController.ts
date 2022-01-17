import { getGitlabBodyForThreshold } from "./assetUtil";
import {
  acceptableExtensions,
  EasyEyesResources,
  ThresholdRepoFiles,
  user,
  userRepoFiles,
} from "./constants";
import {
  clearDropzone,
  isUserLoggedIn,
  showDialogBox,
  updateDialog,
} from "./dropzoneHandler";
import { _loadFiles } from "./files";
import { getBase64Data, getFileTextData } from "./fileUtil";
import {
  createEmptyRepo,
  encodeGitlabFilePath,
  getBase64FileData,
  getProjectByNameInProjectList,
  GitlabUser,
  ICommitAction,
  isProjectNameExistInProjectList,
  pushCommits,
  Repository,
} from "./gitlabUtil";
import { completeStep, enableStep } from "./thresholdState";

// ----------------------------------------------------------------
//                      Exported Functions
// ----------------------------------------------------------------

export const createPavloviaExperiment = async () => {
  // auth check
  if (!isUserLoggedIn()) {
    showDialogBox(
      "Error",
      "Not connected to Pavlovia, so nothing can be uploaded.",
      true
    );
    clearDropzone();
    return;
  }

  // block files check
  if (userRepoFiles.blockFiles.length == 0) {
    throw new Error("block files are missing.");
  }

  let hideDialogBox = showDialogBox(
    `Creating Experiment`,
    `Uploading experiment files: 0%`,
    false
  );

  // get repo name from DOM
  const gitlabRepoNameEl = document.getElementById(
    "new-gitlab-repo-name"
  ) as HTMLInputElement;
  const newRepoName = gitlabRepoNameEl.value;

  // unique repo name check
  const isRepoValid = !isProjectNameExistInProjectList(
    user.gitlabData.projectList,
    newRepoName
  );
  if (!isRepoValid) {
    await hideDialogBox();
    showDialogBox(
      "Duplicate Repository Name",
      "Please enter a new repository name.",
      true
    );
    enableStep(4);
  }

  // create experiment repo
  const newRepo = await createEmptyRepo(newRepoName, user.gitlabData);
  user.newRepo = newRepo;

  // create threshold core files
  await createThresholdCoreFilesOnRepo({ id: newRepo.id }, user.gitlabData);

  // create user-uplaoded files
  await createUserUploadedFilesOnRepo(
    { id: newRepo.id },
    user.gitlabData,
    userRepoFiles
  );

  // transfer resources
  await createRequestedResourcesOnRepo({ id: newRepo.id }, user.gitlabData);

  hideDialogBox();
  hideDialogBox = showDialogBox(
    `Success!`,
    `${newRepoName} has been created.`,
    false,
    true,
    false
  );

  // update repo name input field and btn
  document
    .getElementById("new-gitlab-repo-name")!
    .setAttribute("disabled", "disabled");
  document.getElementById("gitlab-file-submit")!.className =
    "btn btn-success disabled";
  document.getElementById("gitlab-file-submit")!.innerText = "Uploaded";

  const actEl = document.getElementById("pavlovia-activate-div");
  actEl!.className = actEl!.className.replace("no-display", "");

  // display "run" experiement link
  let expUrl = `https://run.pavlovia.org/${
    user.gitlabData.username
  }/${newRepoName.toLocaleLowerCase()}`;
  const tryExp: any = document.getElementById("try-study-url");
  tryExp!.innerText = expUrl;
  tryExp!.href = expUrl;
  if (user.currentExperiment.participantRecruitmentServiceName == "Prolific") {
    expUrl +=
      "?participant={{%PROLIFIC_PID%}}&study_id={{%STUDY_ID%}}&session={{%SESSION_ID%}}";
    handleParticipantRecruitmentUrl();
  }
  user.currentExperiment.experimentUrl = expUrl;

  completeStep(4);
  enableStep(5);

  document
    .getElementById("activate-experiment-btn")
    ?.addEventListener("click", () => {
      completeStep(5);
      enableStep(6);
    });
};

/**
 * @param user queried user
 * @returns names of resource files in common "EasyEyesResources" repository (fonts and forms)
 */
export const getCommonResourcesNames = async (
  user: GitlabUser
): Promise<{ fonts: string[]; forms: string[] }> => {
  const easyEyesResourcesRepo = getProjectByNameInProjectList(
    user.projectList,
    "EasyEyesResources"
  );

  // init api options
  const headers = new Headers();
  headers.append("Authorization", `bearer ${user.accessToken}`);

  const requestOptions: any = {
    method: "GET",
    headers: headers,
    redirect: "follow",
  };

  let prevFontListResponse: any = await fetch(
    `https://gitlab.pavlovia.org/api/v4/projects/${easyEyesResourcesRepo.id}/repository/tree/?path=fonts`,
    requestOptions
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
  let fontList = JSON.parse(prevFontListResponse);
  let fontNameList: string[] = [];
  for (let i = 0; i < fontList.length; i++) {
    fontNameList.push(fontList[i].name);
  }

  let prevFormListResponse: any = await fetch(
    `https://gitlab.pavlovia.org/api/v4/projects/${easyEyesResourcesRepo.id}/repository/tree/?path=forms`,
    requestOptions
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
  let formList = JSON.parse(prevFormListResponse);
  let formNameList: string[] = [];
  for (let i = 0; i < formList.length; i++) {
    formNameList.push(formList[i].name);
  }

  return {
    fonts: fontNameList,
    forms: formNameList,
  };
};
/**
 * creates or overrides resources in EasyEyesResources repository
 * @param user target user
 * @param resourceFileList list of all resources to be uploaded
 */
export const createOrUpdateCommonResources = async (
  user: GitlabUser,
  resourceFileList: File[]
): Promise<void> => {
  const easyEyesResourcesRepo: any = getProjectByNameInProjectList(
    user.projectList,
    "EasyEyesResources"
  );
  const commonResourcesRepo: Repository = { id: easyEyesResourcesRepo.id };

  const resourcesList = await getCommonResourcesNames(user);

  const prevFormList: string[] = resourcesList.forms;
  const prevFontList: string[] = resourcesList.fonts;

  const jsonFiles: ICommitAction[] = [];

  // filter and get all font files
  let fonts = resourceFileList.filter((i) => {
    let extensionList = i.name.split(".");
    let ext = extensionList[extensionList.length - 1];
    return acceptableExtensions.fonts.includes(ext);
  });

  // filter and get all form files
  let forms = resourceFileList.filter((resourceFile: File) => {
    let extensionList = resourceFile.name.split(".");
    let ext = extensionList[extensionList.length - 1];
    return acceptableExtensions.forms.includes(ext);
  });

  // generate Gitlab API body to commit form files
  for (var i = 0; i < forms.length; i++) {
    var form = forms[i];
    const content = await getBase64Data(form);

    jsonFiles.push({
      action: prevFormList.includes(form.name) ? "update" : "create",
      file_path: "forms/" + form.name,
      content: content,
      encoding: "base64",
    });
  }

  // generate Gitlab API body to commit font files
  for (var i = 0; i < fonts.length; i++) {
    const font = fonts[i];
    const content = await getBase64Data(font);

    jsonFiles.push({
      action: prevFontList.includes(font.name) ? "update" : "create",
      file_path: "fonts/" + font.name,
      content: content,
      encoding: "base64",
    });
  }

  await pushCommits(
    user,
    commonResourcesRepo,
    jsonFiles,
    "EasyEyes resources updates",
    "master"
  );
};

export const handleParticipantRecruitmentUrl = () => {
  // check if service is Prolific
  // if Prolific, expose
  document.getElementById("participant-survey-completion-div")!.className =
    document
      .getElementById("participant-survey-completion-div")!
      .className.replace("no-display", "");
  //document.getElementById("activate-experiment-btn")!.className += " disabled";
};
export const redirectToProlificToViewActiveStudies = () => {
  window.open("https://app.prolific.co/researcher/studies/active", "_blank");
};
export const redirectToProlific = async () => {
  await generateAndUploadCompletionURL();
  let url =
    "https://app.prolific.co/studies/new?" +
    "external_study_url=" +
    encodeURIComponent(user.currentExperiment.experimentUrl) +
    "&completion_code=" +
    encodeURIComponent(
      user.currentExperiment.participantRecruitmentServiceCode
    ) +
    "&completion_option=url" +
    "&prolific_id_option=url_parameters";

  window.open(url, "_blank");

  completeStep(6);
  enableStep(7);
};
export const showPavloviaAdvice = () => {
  showDialogBox(
    `USING PAVLOVIA WITHOUT A UNIVERSITY LICENSE`,
    `If your university doesn't have an unlimited Pavlovia license, then Pavlovia will charge you 20 pence per participant. Pavlovia allows you to avoid that fee during evaluation: In Pavlovia, hit PILOTING instead of RUNNING, and use their PILOT button, instead of clicking your study URL, to run your study. Their (reasonable) fee cannot be avoided when you run participants on Prolific. In that case use RUNNING.`,
    false
  );
};

/**
 * updates DOM form list and shows popup
 */
export const showForms = () => {
  let body = "<ul>";
  EasyEyesResources.forms.forEach((i: String) => {
    body += `<li>${i}</li>`;
  });
  body += "</ul>";
  showDialogBox("Forms", body, true, false, false);
};

/**
 * updates DOM font list and shows popup
 */
export const showFonts = () => {
  let body = "<ul>";
  EasyEyesResources.fonts.forEach((i: String) => {
    body += `<li>${i}</li>`;
  });
  body += "</ul>";
  showDialogBox("Fonts", body, true, false, false);
};

export const generateAndUploadCompletionURL = async () => {
  if (user.currentExperiment.participantRecruitmentServiceCode == null) {
    let completionCode: String =
      "" + Math.floor(Math.random() * (999 - 100) + 100);
    if (completionCode != "") {
      user.currentExperiment.participantRecruitmentServiceCode = completionCode;
      let completionURL =
        "https://app.prolific.co/submissions/complete?cc=" + completionCode;
      var jsonString = `name,${user.currentExperiment.participantRecruitmentServiceName}\ncode,\nurl,${completionURL}`;

      var commitAction = {
        action: "update",
        file_path: "recruitmentServiceConfig.csv",
        content: jsonString,
      };
      var commitBody = {
        branch: "master",
        commit_message: "EasyEyes initialization",
        actions: [commitAction],
      };
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
    }
  }
};

// ----------------------------------------------------------------
//                      Private Functions
// ----------------------------------------------------------------

/**
 * transfers requested resources from EasyEyesResources repository to given repository.
 * It assumes there are no pre-exisiting resources on destination repository.
 * @param repo
 * @param user target user
 */
const createRequestedResourcesOnRepo = async (
  repo: Repository,
  user: GitlabUser
): Promise<void> => {
  if (!userRepoFiles.requestedFonts || !userRepoFiles.requestedForms)
    throw new Error("requested resource names are undefined.");

  const easyEyesResourcesRepo = getProjectByNameInProjectList(
    user.projectList,
    "EasyEyesResources"
  );
  const commitActionList: ICommitAction[] = [];

  // requested fonts
  for (let i = 0; i < userRepoFiles.requestedFonts.length; i++) {
    const fileName = userRepoFiles.requestedFonts[i];
    const resourcesRepoFilePath = encodeGitlabFilePath(`fonts/${fileName}`);

    const content: string = await getBase64FileData(
      parseInt(easyEyesResourcesRepo.id),
      resourcesRepoFilePath,
      user.accessToken
    );

    // ignore 404s
    if (content.trim().indexOf(`{"message":"404 File Not Found"}`) != -1)
      continue;

    commitActionList.push({
      action: "create",
      file_path: `fonts/${fileName}`,
      content,
      encoding: "base64",
    });
  }

  // requested forms
  for (let i = 0; i < userRepoFiles.requestedForms.length; i++) {
    const fileName = userRepoFiles.requestedForms[i];
    const resourcesRepoFilePath = encodeGitlabFilePath(`forms/${fileName}`);

    const content: string = await getBase64FileData(
      parseInt(easyEyesResourcesRepo.id),
      resourcesRepoFilePath,
      user.accessToken
    );

    // ignore 404s
    if (content.trim().indexOf(`{"message":"404 File Not Found"}`) != -1)
      continue;

    commitActionList.push({
      action: "create",
      file_path: `forms/${fileName}`,
      content,
      encoding: "base64",
    });
  }

  await pushCommits(
    user,
    repo,
    commitActionList,
    "Add files from EasyEyesResources",
    "master"
  );
};

/**
 * creates threshold core files on specified gitlab repository.
 * It assumes that the repository is empty
 * @param gitlabRepo target repository
 * @param user gitlabRepo is owned by this user
 */
const createThresholdCoreFilesOnRepo = async (
  gitlabRepo: Repository,
  user: GitlabUser
): Promise<void> => {
  const promiseList = [];
  let progress = 0;
  const batchSize = 10;

  for (let i = 0; i < _loadFiles.length; i += batchSize) {
    let startIdx = i;
    let endIdx = Math.min(i + batchSize - 1, _loadFiles.length - 1);

    const promise = new Promise(async (resolve) => {
      const rootContent = await getGitlabBodyForThreshold(startIdx, endIdx);

      pushCommits(
        user,
        gitlabRepo,
        rootContent,
        "Created threshold core files",
        "master"
      ).then((commitResponse: any) => {
        progress += endIdx - startIdx;
        const progressPercent = Math.round(
          (progress / _loadFiles.length) * 100
        );
        updateDialog(`Uploading experiment files: ${progressPercent}%`);
        resolve(commitResponse);
      });
    });

    promiseList.push(promise);
  }
  await Promise.all(promiseList);
};

/**
 * creates user-uploaded files on specified gitlab repository.
 * It assumes that the repository is empty
 * @param gitlabRepo target repository
 * @param user gitlabRepo is owned by this user
 */
const createUserUploadedFilesOnRepo = async (
  gitlabRepo: Repository,
  user: GitlabUser,
  repoFiles: ThresholdRepoFiles
): Promise<void> => {
  const commitActionList: ICommitAction[] = [];

  if (!repoFiles.experiment) throw new Error("experiment file is missing.");

  // add experiment file to root
  let fileData = await getFileTextData(repoFiles.experiment);
  commitActionList.push({
    action: "create",
    file_path: repoFiles.experiment.name,
    content: fileData,
  });

  // add experiment file to conditions
  fileData = await getFileTextData(repoFiles.experiment);
  commitActionList.push({
    action: "create",
    file_path: `conditions/${repoFiles.experiment.name}`,
    content: fileData,
  });

  // add conditions
  for (let i = 0; i < repoFiles.blockFiles.length; i++) {
    const file = repoFiles.blockFiles[i];
    const content: string = await getFileTextData(file);

    commitActionList.push({
      action: "create",
      file_path: `conditions/${file.name}`,
      content,
      encoding: "text",
    });
  }

  await pushCommits(
    user,
    gitlabRepo,
    commitActionList,
    "Added experiment file",
    "master"
  );
};
