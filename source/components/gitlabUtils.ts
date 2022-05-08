import Swal from "sweetalert2";
import {
  acceptableExtensions,
  acceptableResourcesExtensionsOfTextDataType,
  resourcesFileTypes,
  resourcesRepoName,
  ThresholdRepoFiles,
  userRepoFiles,
} from "./constants";
import { _loadDir, _loadFiles } from "./files";
import {
  assetUsesBase64,
  encodeGitlabFilePath,
  getAssetFileContent,
  getAssetFileContentBase64,
  getBase64Data,
  getBase64FileDataFromGitLab,
  getFileExtension,
  getFileTextData,
  getTextFileDataFromGitLab,
} from "./fileUtils";

export class User {
  public username = "";
  public name = "";
  public id = "";

  public projectList: any[] = [];

  constructor(public accessToken: string) {}

  async initUserDetails(): Promise<void> {
    const response = await fetch(
      `https://gitlab.pavlovia.org/api/v4/user?access_token=${this.accessToken}`
    );
    const responseBody = await response.json();
    this.id = responseBody.id;
    this.username = responseBody.username;
    this.name = responseBody.name;
  }

  async initProjectList(): Promise<void> {
    this.projectList = await getAllProjects(this);
  }
}

export interface ICommitAction {
  action: "create" | "delete" | "move" | "update" | "chmod";
  file_path: string;
  content: string;
  previous_path?: string;
  encoding?: "text" | "base64";
  last_commit_id?: string;
  execute_filemode?: boolean;
}

/* -------------------------------------------------------------------------- */

/**
 * @param user queried users
 * @returns returns list of all gitlab projects created by user
 */
export const getAllProjects = async (user: User) => {
  const projectList: any[] = [];

  // get first page separately to fetch page count
  const firstResponse = await fetch(
    `https://gitlab.pavlovia.org/api/v4/users/${user.id}/projects?access_token=${user.accessToken}&per_page=100`
  );
  const firstResponseData = await firstResponse.json();
  projectList.push(...firstResponseData);

  // check if header is present
  const pageCountHeader = await firstResponse.headers.get("x-total-pages");
  if (!pageCountHeader) {
    throw new Error(
      "x-total-pages header is missing. Gitlab API probably updated."
    );
  }

  // get remaining pages
  const pageCount = parseInt(pageCountHeader);
  const pageList: Promise<any>[] = [];
  for (let curPage = 2; curPage <= pageCount; curPage++) {
    const paginationResponse = fetch(
      `https://gitlab.pavlovia.org/api/v4/users/${user.id}/projects?access_token=${user.accessToken}&page=${curPage}&per_page=100`
    );
    pageList.push(paginationResponse);
  }

  const paginationResponseList = await Promise.all(pageList);
  for (let idx = 0; idx < paginationResponseList.length; idx++) {
    const ithResponseData = await paginationResponseList[idx].json();
    projectList.push(...ithResponseData);
  }

  return projectList;
};

/**
 * @param projectList list of projects returned by gitlab API
 * @param keyProjectName project name to search for
 * @returns project with given project name
 */
export const getProjectByNameInProjectList = (
  projectList: any[],
  keyProjectName: string
): any => {
  return projectList.find((i: any) => i.name === keyProjectName);
};

/**
 * @param projectList list of projects returned by gitlab API
 * @param keyProjectName project name to search for
 * @returns true if keyProjectName exists in given project list
 */
export const isProjectNameExistInProjectList = (
  projectList: any[],
  keyProjectName: string
): boolean => {
  return projectList
    .map((i: any) => {
      return i ? i.name : "null";
    })
    .includes(keyProjectName);
};

/* -------------------------------------------------------------------------- */

/**
 * creates a new project with given project name on Gitlab
 * @param repoName new project or repository name
 * @param gitlabUser project will be created on behalf of this userFont
 * @returns API response
 */
export const createEmptyRepo = async (
  repoName: string,
  user: User
): Promise<any> => {
  const newRepo = await fetch(
    "https://gitlab.pavlovia.org/api/v4/projects?name=" +
      repoName +
      "&access_token=" +
      user.accessToken,
    {
      method: "POST",
    }
  )
    .then((response) => {
      return response.json();
    })
    .catch((error) => {
      console.error(error);
      alert("[ERROR] Failed to creat a new repo.");
    });

  return await newRepo;
};

export const setRepoName = (user: User, name: string): string => {
  if (!isProjectNameExistInProjectList(user.projectList, name)) return name;
  for (let i = 1; i < 9999999; i++)
    if (!isProjectNameExistInProjectList(user.projectList, name + "_" + i))
      return name + "_" + i;
  return name + "_" + Date.now();
};

/* -------------------------------------------------------------------------- */

export interface Repository {
  id: string;
}

/**
 * @param user queried user
 * @returns names of resource files in common "EasyEyesResources" repository (fonts and forms)
 */
export const getCommonResourcesNames = async (
  user: User
): Promise<{ [key: string]: string[] }> => {
  const easyEyesResourcesRepo = getProjectByNameInProjectList(
    user.projectList,
    resourcesRepoName
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

  for (const type of resourcesFileTypes) {
    const prevFontListResponse: any = await fetch(
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
    for (const t of typeList) resourcesNameByType[type].push(t.name);
  }

  return resourcesNameByType;
};

/**
 * creates or overrides resources in EasyEyesResources repository
 * @param user target user
 * @param resourceFileList list of all resources to be uploaded
 */
export const createOrUpdateCommonResources = async (
  user: User,
  resourceFileList: File[]
): Promise<void> => {
  const easyEyesResourcesRepo: any = getProjectByNameInProjectList(
    user.projectList,
    resourcesRepoName
  );
  const commonResourcesRepo: Repository = { id: easyEyesResourcesRepo.id };

  const prevResourcesList = await getCommonResourcesNames(user);
  const jsonFiles: ICommitAction[] = [];

  // Update each type of resources one by one
  for (const type of resourcesFileTypes) {
    const filesOfType = resourceFileList.filter((file) =>
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

  return await pushCommits(
    user,
    commonResourcesRepo,
    jsonFiles,
    commitMessages.newResourcesUploaded,
    defaultBranch
  );
};

/* -------------------------------------------------------------------------- */

/**
 * makes given commits to Gitlab repository
 * @returns response from API call made to push commits
 */
export const pushCommits = async (
  user: User,
  repo: Repository,
  commits: ICommitAction[],
  commitMessage: string,
  branch: string
): Promise<any> => {
  const commitBody = {
    branch,
    commit_message: commitMessage,
    actions: commits,
  };

  const response = await fetch(
    `https://gitlab.pavlovia.org/api/v4/projects/${repo.id}/repository/commits?access_token=${user.accessToken}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commitBody),
    }
  ).then(async (response) => {
    if (!response.ok) {
      Swal.fire({
        icon: "error",
        title: `Uploading Failed.`,
        text: `Please try again. We are working on providing more detailed error messages.`,
      });
      // location.reload();
      return null;
    }
    return response.json();
  });

  return await response;
};

export const commitMessages = {
  newResourcesUploaded: "⚡ new EasyEyes resources",
  resourcesTransferred: "📦 load EasyEyes resources from resources repo",
  thresholdCoreFileUploaded: "🔮 create threshold core components",
  addExperimentFile: "🖼️ add experiment file",
};

export const defaultBranch = "master";

/* -------------------------------------------------------------------------- */
/* -------------------------- CORE CREATE NEW REPO -------------------------- */
/* -------------------------------------------------------------------------- */

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

// helper
const updateSwalUploadingCount = (count: number, totalCount: number) => {
  const progressCount = document.getElementById("uploading-count");

  if (progressCount)
    (progressCount as HTMLSpanElement).innerHTML = `${Math.round(
      Math.min(count / totalCount, 1) * 100
    )}`;
};

/**
 * creates threshold core files on specified gitlab repository
 * It assumes that the repository is empty
 * @param gitlabRepo target repository
 * @param user gitlabRepo is owned by this user
 */
const createThresholdCoreFilesOnRepo = async (
  gitlabRepo: Repository,
  user: User,
  uploadedFileCount: { current: number },
  totalFileCount: number
): Promise<any> => {
  const promiseList = [];
  const batchSize = 10; // !
  const results: any[] = [];

  for (let i = 0; i < _loadFiles.length; i += batchSize) {
    const startIdx = i;
    const endIdx = Math.min(i + batchSize - 1, _loadFiles.length - 1);

    // eslint-disable-next-line no-async-promise-executor
    const promise = new Promise(async (resolve) => {
      const rootContent = await getGitlabBodyForThreshold(startIdx, endIdx);

      pushCommits(
        user,
        gitlabRepo,
        rootContent,
        commitMessages.thresholdCoreFileUploaded,
        defaultBranch
      ).then((commitResponse: any) => {
        uploadedFileCount.current += endIdx - startIdx + 1;
        updateSwalUploadingCount(uploadedFileCount.current, totalFileCount);

        resolve(commitResponse);
        results.push(commitResponse);
      });
    });

    promiseList.push(promise);
  }

  await Promise.all(promiseList);
  return results;
};

/**
 * creates user-uploaded files on specified gitlab repository
 * @param gitlabRepo target repository
 * @param user gitlabRepo is owned by this user
 */
const createUserUploadedFilesOnRepo = async (
  gitlabRepo: Repository,
  user: User,
  repoFiles: ThresholdRepoFiles,
  uploadedFileCount: { current: number },
  totalFileCount: number
): Promise<void> => {
  const commitActionList: ICommitAction[] = [];

  // add experiment file to root
  let fileData = await getFileTextData(repoFiles.experiment!);
  commitActionList.push({
    action: "create",
    file_path: repoFiles.experiment!.name,
    content: fileData,
  });
  uploadedFileCount.current++;
  updateSwalUploadingCount(uploadedFileCount.current, totalFileCount);

  // add experiment file to conditions
  commitActionList.push({
    action: "create",
    file_path: `conditions/${repoFiles.experiment!.name}`,
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
    uploadedFileCount.current++;
    updateSwalUploadingCount(uploadedFileCount.current, totalFileCount);
  }

  return await pushCommits(
    user,
    gitlabRepo,
    commitActionList,
    commitMessages.addExperimentFile,
    defaultBranch
  );
};

/**
 * transfers requested resources from EasyEyesResources repository to given repository.
 * It assumes there are no pre-exisiting resources on destination repository.
 * @param repo
 * @param user target user
 */
const createRequestedResourcesOnRepo = async (
  repo: Repository,
  user: User,
  uploadedFileCount: { current: number },
  totalFileCount: number
): Promise<void> => {
  if (
    !userRepoFiles.requestedFonts ||
    !userRepoFiles.requestedForms ||
    !userRepoFiles.requestedTexts ||
    !userRepoFiles.requestedFolders
  )
    throw new Error("Requested resource names are undefined.");

  const easyEyesResourcesRepo = getProjectByNameInProjectList(
    user.projectList,
    "EasyEyesResources"
  );
  const commitActionList: ICommitAction[] = [];

  for (const resourceType of ["fonts", "forms", "texts", "folders"]) {
    let requestedFiles: string[] = [];
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
      case "folders":
        requestedFiles = userRepoFiles.requestedFolders || [];
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
      if (content?.trim().indexOf(`{"message":"404 File Not Found"}`) != -1)
        continue;

      commitActionList.push({
        action: "create",
        file_path: `${resourceType}/${fileName}`,
        content,
        encoding: resourceType === "texts" ? "text" : "base64",
      });
      uploadedFileCount.current++;
      updateSwalUploadingCount(uploadedFileCount.current, totalFileCount);
    }
  }

  return await pushCommits(
    user,
    repo,
    commitActionList,
    commitMessages.resourcesTransferred,
    defaultBranch
  );
};

export const createPavloviaExperiment = async (
  user: User,
  projectName: string,
  callback: () => void
) => {
  // auth check
  if (user.id === undefined) {
    return;
  }

  // block files check
  if (userRepoFiles.blockFiles.length == 0) {
    Swal.fire({
      icon: "error",
      title: `Failed to create block files.`,
      text: `We failed to create experiment block files from your table. Try refresh the page. If the problem persists, please contact us.`,
    });
  }

  // let hideDialogBox = showDialogBox(
  //   `Creating Experiment`,
  //   `Uploading experiment files: 0%`,
  //   false
  // );

  // unique repo name check
  const isRepoValid = !isProjectNameExistInProjectList(
    user.projectList,
    projectName
  );
  if (!isRepoValid) {
    Swal.fire({
      icon: "error",
      title: `Duplicated project name.`,
      text: `${projectName} has existed in your Pavlovia repository list.`,
    });
    return;
  }

  // create experiment repo
  const newRepo = await createEmptyRepo(projectName, user);
  // user.newRepo = newRepo;

  const totalFileCount =
    _loadFiles.length +
    1 +
    userRepoFiles.blockFiles.length +
    userRepoFiles.requestedFonts.length +
    userRepoFiles.requestedForms.length +
    userRepoFiles.requestedTexts.length +
    userRepoFiles.requestedFolders.length;
  const uploadedFileCount = { current: 0 };

  await Swal.fire({
    title: "We are creating Pavlovia project for you ...",
    html: `<p>Uploaded <span id="uploading-count">${Math.round(
      Math.min(uploadedFileCount.current / totalFileCount, 1) * 100
    )}</span>%</p>`,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: async () => {
      Swal.showLoading();
      let finalClosing = true;

      // create threshold core files
      // console.log("Creating threshold core files...");
      const a = await createThresholdCoreFilesOnRepo(
        { id: newRepo.id },
        user,
        uploadedFileCount,
        totalFileCount
      );
      for (const i of a) if (i === null) finalClosing = false;

      // create user-uploaded files
      // console.log("Creating user-uploaded files...");
      const b = await createUserUploadedFilesOnRepo(
        { id: newRepo.id },
        user,
        userRepoFiles,
        uploadedFileCount,
        totalFileCount
      );
      if (b === null) finalClosing = false;

      // transfer resources
      // console.log("Transferring resources...");
      const c = await createRequestedResourcesOnRepo(
        { id: newRepo.id },
        user,
        uploadedFileCount,
        totalFileCount
      );
      if (c === null) finalClosing = false;

      if (finalClosing) Swal.close();
    },
  });

  callback();

  // display "run" experiement link
  // let expUrl = `https://run.pavlovia.org/${
  //   user.username
  // }/${projectName.toLocaleLowerCase()}`;
  // // const tryExp: any = document.getElementById("try-study-url");

  // if (user.currentExperiment.participantRecruitmentServiceName == "Prolific") {
  //   expUrl +=
  //     "?participant={{%PROLIFIC_PID%}}&study_id={{%STUDY_ID%}}&session={{%SESSION_ID%}}";
  //   handleParticipantRecruitmentUrl();
  // }
  // user.currentExperiment.experimentUrl = expUrl;
};
