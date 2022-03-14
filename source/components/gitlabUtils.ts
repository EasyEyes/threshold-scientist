import Swal from "sweetalert2";
import {
  acceptableExtensions,
  acceptableResourcesExtensionsOfTextDataType,
  resourcesFileTypes,
  resourcesRepoName,
} from "./constants";
import { getBase64Data, getFileExtension, getFileTextData } from "./fileUtils";

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

  await pushCommits(
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
      location.reload();
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
