import { Buffer } from "buffer";
import JSZip from "jszip";
import { saveAs } from "file-saver";
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
import { getDateAndTimeString } from "./utils";

export class User {
  public username = "";
  public name = "";
  public id = "";
  public avatar_url = "";

  public projectList: any[] = [];

  public currentExperiment = {
    participantRecruitmentServiceName: "",
    participantRecruitmentServiceUrl: "",
    participantRecruitmentServiceCode: "",
    experimentUrl: "",
    pavloviaOfferPilotingOptionBool: false, // ?
    pavloviaPreferRunningModeBool: true, // ?
    /* -------------------------------------------------------------------------- */
    prolificWorkspaceModeBool: false,
    prolificWorkspaceProjectId: "",
  };

  constructor(public accessToken: string) {
    this.accessToken = accessToken;
  }

  async initUserDetails(): Promise<void> {
    const response = await fetch(
      `https://gitlab.pavlovia.org/api/v4/user?access_token=${this.accessToken}`
    );
    const responseBody = await response.json();

    this.username = responseBody.username;
    this.name = responseBody.name;
    this.id = responseBody.id;
    this.avatar_url = responseBody.avatar_url;
  }

  async initProjectList(): Promise<void> {
    this.projectList = await getAllProjects(this);
  }
}

export const copyUser = (user: User): User => {
  const newUser = new User(user.accessToken);
  newUser.username = user.username;
  newUser.name = user.name;
  newUser.id = user.id;
  newUser.avatar_url = user.avatar_url;
  newUser.projectList = [...user.projectList];
  newUser.currentExperiment = { ...user.currentExperiment };
  return newUser;
};

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
  console.log(`fetching projects page 1`);
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
    console.log(`fetching projects page ${curPage}`);
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
      // TODO switch to Swal interface
      alert("[ERROR] Failed to creat a new repo.");
    });

  return await newRepo;
};

export const setRepoName = async (
  user: User,
  name: string
): Promise<string> => {
  // if (!isProjectNameExistInProjectList(user.projectList, name)) return name;
  name = complianceProjectName(name);
  const upToDateProjectList = await getAllProjects(user);

  for (let i = 1; i < 9999999; i++)
    // if (!isProjectNameExistInProjectList(user.projectList, `${name}${i}`))
    if (!isProjectNameExistInProjectList(upToDateProjectList, `${name}${i}`))
      return `${name}${i}`;
  return `${name}${Date.now()}`;
};

const complianceProjectName = (name: string): string => {
  return name.replace(/[^\w\s']|_/g, "").replace(/ /g, "-");
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
      `https://gitlab.pavlovia.org/api/v4/projects/${easyEyesResourcesRepo.id}/repository/tree/?path=${type}&per_page=100`,
      requestOptions
    )
      .then((response) => {
        return response.text();
      })
      .then((result) => {
        return result;
      })
      .catch((error) => {
        const skipError = (err: any) => {
          return err;
        };
        skipError(error);
      });
    const typeList = !prevFontListResponse.includes(`404 Tree Not Found`)
      ? JSON.parse(prevFontListResponse)
      : new Array<string>();
    resourcesNameByType[type] = new Array<string>();
    for (const t of typeList) resourcesNameByType[type].push(t.name);
  }

  return resourcesNameByType;
};

/**
 * Download data folder as a ZIP file from gitlab repository
 */
export const downloadDataFolder = async (user: User, project: any) => {
  const headers = new Headers();
  headers.append("Authorization", `bearer ${user.accessToken}`);
  const requestOptions: any = {
    method: "GET",
    headers: headers,
    redirect: "follow",
  };

  await Swal.fire({
    title: `Downloading data from ${project.name} ...`,
    // html: `<p>This might take a while, depending on the number of participants and the length of the experiment.</p>`,
    allowOutsideClick: false,
    allowEscapeKey: false,
    didOpen: async () => {
      Swal.showLoading();

      const dataFolder = await fetch(
        `https://gitlab.pavlovia.org/api/v4/projects/${project.id}/repository/tree/?path=data`,
        requestOptions
      )
        .then((response) => {
          return response.json();
        })
        .then((result) => {
          return result;
        });

      if (dataFolder.length === 0) {
        Swal.close();
        Swal.fire({
          icon: "error",
          title: `No data found for ${project.name}.`,
          text: `We can't find any data for the experiment. This might due to an error, or the Pavlovia server is down. Please refresh the page or try again later.`,
          confirmButtonColor: "#666",
        });
        return;
      }

      const zip = new JSZip();
      const zipFileName = `${project.name}_${getDateAndTimeString()}.zip`;

      for (const file of dataFolder) {
        const fileName = file.name;

        const fileContent = await fetch(
          `https://gitlab.pavlovia.org/api/v4/projects/${project.id}/repository/blobs/${file.id}`,
          requestOptions
        )
          .then((response) => {
            return response.json();
          })
          .then((result) => {
            return Buffer.from(result.content, "base64");
          });

        zip.file(fileName, fileContent);
      }

      zip.generateAsync({ type: "blob" }).then((content) => {
        saveAs(content, zipFileName);
        Swal.close();
      });
    },
  });
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
        title: `Uploading failed.`,
        text: `Please try again. We are working on providing more detailed error messages.`,
        confirmButtonColor: "#666",
      });
      // location.reload();
      return null;
    }
    return response.json();
  });

  return await response;
};

export const commitMessages = {
  newResourcesUploaded: "??? new EasyEyes resources",
  resourcesTransferred: "???? load EasyEyes resources from resources repo",
  thresholdCoreFileUploaded: "???? create threshold core components",
  addExperimentFile: "??????? add experiment file",
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
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const fileData = await getFileTextData(repoFiles.experiment!);
  commitActionList.push({
    action: "create",
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    file_path: repoFiles.experiment!.name,
    content: fileData,
  });
  uploadedFileCount.current++;
  updateSwalUploadingCount(uploadedFileCount.current, totalFileCount);

  // add experiment file to conditions
  commitActionList.push({
    action: "create",
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
    // console.log(`requested ${resourceType}`, requestedFiles);
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
  callback: (newRepo: any, experimentUrl: string, serviceUrl: string) => void
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
      confirmButtonColor: "#666",
    });
    return false;
  }

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
      confirmButtonColor: "#666",
    });
    return false;
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

  let successful = false;

  await Swal.fire({
    title: "Uploading your experiment to Pavlovia ...",
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

      if (finalClosing) {
        // uploaded without error
        Swal.close();

        const expUrl = `https://run.pavlovia.org/${
          user.username
        }/${projectName.toLocaleLowerCase()}`;

        let serviceUrl = expUrl;

        if (
          user.currentExperiment.participantRecruitmentServiceName == "Prolific"
        ) {
          serviceUrl =
            expUrl +
            "?participant={{%PROLIFIC_PID%}}&study_id={{%STUDY_ID%}}&session={{%SESSION_ID%}}";
        }

        successful = true;

        callback(
          newRepo,
          `https://run.pavlovia.org/${
            user.username
          }/${projectName.toLocaleLowerCase()}`,
          serviceUrl
        );
      }
    },
  });

  return successful;
};

/* -------------------------------------------------------------------------- */

export const runExperiment = async (
  user: User,
  newRepo: Repository,
  experimentUrl: string
) => {
  try {
    const running = await fetch(
      "https://pavlovia.org/api/v2/experiments/" + newRepo.id + "/status",
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          oauthToken: user.accessToken,
        },

        body: JSON.stringify({
          newStatus: "RUNNING",
          recruitment: {
            policy: { type: "URL", url: experimentUrl },
          },
        }),
      }
    );

    return await running.json();
  } catch (error) {
    await Swal.fire({
      icon: "error",
      title: `Failed to change mode.`,
      text: `We failed to change your experiment mode to RUNNING. There might be a problem when uploading it, or the Pavlovia server is down. Please try to refresh the status in a while, or refresh the page to start again.`,
      confirmButtonColor: "#666",
    });

    return null;
  }
};

export const getExperimentStatus = async (user: User, newRepo: Repository) => {
  const running = await fetch(
    "https://pavlovia.org/api/v2/experiments/" + newRepo.id,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        oauthToken: user.accessToken,
      },
    }
  );

  const result = await running.json();
  return result.experiment.status2;
};

/* -------------------------------------------------------------------------- */

export const generateAndUploadCompletionURL = async (
  user: User,
  newRepo: any
) => {
  if (!user.currentExperiment.participantRecruitmentServiceCode) {
    const completionCode: string =
      "" + Math.floor(Math.random() * (999 - 100) + 100);

    if (completionCode !== "") {
      user.currentExperiment.participantRecruitmentServiceCode = completionCode;

      const completionURL =
        "https://app.prolific.co/submissions/complete?cc=" + completionCode;
      const jsonString = `name,${user.currentExperiment.participantRecruitmentServiceName}\ncode,\nurl,${completionURL}`;

      const commitAction = {
        action: "update",
        file_path: "recruitmentServiceConfig.csv",
        content: jsonString,
      };
      const commitBody = {
        branch: "master",
        commit_message: "EasyEyes initialization",
        actions: [commitAction],
      };

      const commitFile = await fetch(
        "https://gitlab.pavlovia.org/api/v4/projects/" +
          newRepo.id +
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
        .catch(() => {
          Swal.fire({
            icon: "error",
            title: `Failed to upload completion code.`,
            text: `We can't upload your completion code. There might be a problem when uploading it, or the Pavlovia server is down. Please refresh the page to start again.`,
            confirmButtonColor: "#666",
          });
          // location.reload();
        });
      await commitFile;
    }
  }
};
