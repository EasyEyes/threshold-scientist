import { getGitlabBodyForThreshold } from "./assetUtil";
import {
  acceptableExtensions,
  acceptableResourcesExtensionsOfTextDataType,
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
import { getBase64Data, getFileExtension, getFileTextData } from "./fileUtil";
import {
  commitMessages,
  createEmptyRepo,
  defaultBranch,
  encodeGitlabFilePath,
  getBase64FileDataFromGitLab,
  getProjectByNameInProjectList,
  getTextFileDataFromGitLab,
  GitlabUser,
  ICommitAction,
  isProjectNameExistInProjectList,
  pushCommits,
  Repository,
  runExperiment,
} from "./gitlabUtil";
import { completeStep, enableStep } from "./thresholdState";
import { resourcesFileTypes } from "./utils";

// ----------------------------------------------------------------
//                      Exported Functions
// ----------------------------------------------------------------
export const runPavloviaExperiment = async () => {
  showDialogBox("Setting experiment to running...", "", false, false, false);
  const experimentRunning = await runExperiment(
    user.gitlabData,
    user.newRepo,
    user.currentExperiment
  );
  showDialogBox(
    `Success!`,
    `Pavlovia Experiment is running.`,
    false,
    true,
    false
  );
};

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

    enableStep(3); // ? Potential merge conflict
    return;
  }

  // create experiment repo
  const newRepo = await createEmptyRepo(newRepoName, user.gitlabData);
  console.log(newRepo);
  user.newRepo = newRepo;

  // create threshold core files
  await createThresholdCoreFilesOnRepo({ id: newRepo.id }, user.gitlabData);

  // create user-uploaded files
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

  completeStep(3);
  enableStep(4);

  document
    .getElementById("activate-experiment-btn")
    ?.addEventListener("click", () => {
      completeStep(4);
      // enableStep(5);
    });
};

/**
 * @param user queried user
 * @returns names of resource files in common "EasyEyesResources" repository (fonts and forms)
 */
export const getCommonResourcesNames = async (
  user: GitlabUser
): Promise<{ [key: string]: string[] }> => {
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

  const resourcesNameByType: any = {};

  for (let type of resourcesFileTypes) {
    let prevFontListResponse: any = await fetch(
      `https://gitlab.pavlovia.org/api/v4/projects/${easyEyesResourcesRepo.id}/repository/tree/?path=${type}`,
      requestOptions
    )
      .then((response) => {
        return response.text();
      })
      .then((result) => {
        return result;
      })
      .catch((error) => {
        console.error(error);
      });
    const typeList = JSON.parse(prevFontListResponse);
    resourcesNameByType[type] = new Array<string>();
    for (let t of typeList) resourcesNameByType[type].push(t.name);
  }

  return resourcesNameByType;
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

  const prevResourcesList = await getCommonResourcesNames(user);
  const jsonFiles: ICommitAction[] = [];

  // Update each type of resources one by one
  for (let type of resourcesFileTypes) {
    let filesOfType = resourceFileList.filter((file) =>
      acceptableExtensions[type].includes(getFileExtension(file))
    );
    for (const file of filesOfType) {
      const useBase64 = !acceptableResourcesExtensionsOfTextDataType.includes(
        getFileExtension(file)
      );
      const content = useBase64
        ? await getBase64Data(file)
        : await getFileTextData(file);

      jsonFiles.push({
        action: prevResourcesList[type].includes(file.name)
          ? "update"
          : "create",
        file_path: `${type}/${file.name}`,
        content,
        encoding: useBase64 ? "base64" : "text",
      });
    }
  }

  await pushCommits(
    user,
    commonResourcesRepo,
    jsonFiles,
    commitMessages.newResourcesUploaded,
    defaultBranch
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

  completeStep(5);
  enableStep(6);
};
export const showPavloviaAdvice = () => {
  showDialogBox(
    `USING PAVLOVIA WITHOUT A UNIVERSITY LICENSE`,
    `If your university doesn't have an unlimited Pavlovia license, then Pavlovia will charge you 20 pence per participant. Pavlovia allows you to avoid that fee during evaluation: In Pavlovia, hit PILOTING instead of RUNNING, and use their PILOT button, instead of clicking your study URL, to run your study. Their (reasonable) fee cannot be avoided when you run participants on Prolific. In that case use RUNNING.`,
    false
  );
};

/**
 * Updates DOM fonts/forms/texts/folders etc. list and shows popup
 */
export const showResourcesPopup = (type: string) => {
  let body = "<ul>";
  EasyEyesResources[type].forEach((i: String) => {
    body += `<li>${i}</li>`;
  });
  body += "</ul>";
  showDialogBox(type, body, true, false, false);
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
      )
        .then((response) => {
          return response.json();
        })
        .catch((error) => {
          alert("Error uploading. Please try again");
          location.reload();
        });
      await commitFile;
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
  if (
    !userRepoFiles.requestedFonts ||
    !userRepoFiles.requestedForms ||
    !userRepoFiles.requestedTexts
  )
    throw new Error("Requested resource names are undefined.");

  const easyEyesResourcesRepo = getProjectByNameInProjectList(
    user.projectList,
    "EasyEyesResources"
  );
  const commitActionList: ICommitAction[] = [];

  for (let resourceType of ["fonts", "forms", "texts"]) {
    let requestedFiles: string[];
    switch (resourceType) {
      case "fonts":
        requestedFiles = userRepoFiles.requestedFonts;
        break;
      case "forms":
        requestedFiles = userRepoFiles.requestedForms;
        break;
      case "texts":
        requestedFiles = userRepoFiles.requestedTexts;
        break;
      default:
        requestedFiles = [];
        break;
    }

    for (const fileName of requestedFiles) {
      const resourcesRepoFilePath = encodeGitlabFilePath(
        `${resourceType}/${fileName}`
      );

      const content: string =
        resourceType === "texts"
          ? await getTextFileDataFromGitLab(
              parseInt(easyEyesResourcesRepo.id),
              resourcesRepoFilePath,
              user.accessToken
            )
          : await getBase64FileDataFromGitLab(
              parseInt(easyEyesResourcesRepo.id),
              resourcesRepoFilePath,
              user.accessToken
            );

      // Ignore 404s
      if (content.trim().indexOf(`{"message":"404 File Not Found"}`) != -1)
        continue;

      commitActionList.push({
        action: "create",
        file_path: `${resourceType}/${fileName}`,
        content,
        encoding: resourceType === "texts" ? "text" : "base64",
      });
    }
  }

  await pushCommits(
    user,
    repo,
    commitActionList,
    commitMessages.resourcesTransferred,
    defaultBranch
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
        commitMessages.thresholdCoreFileUploaded,
        defaultBranch
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
    commitMessages.addExperimentFile,
    defaultBranch
  );
};
