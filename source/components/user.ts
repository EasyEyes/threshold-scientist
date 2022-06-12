import {
  createEmptyRepo,
  isProjectNameExistInProjectList,
  pushCommits,
  User,
} from "./gitlabUtils";
import { resourcesRepoName } from "./constants";
import { getCommonResourcesNames } from "./gitlabUtils";

export const redirectToOauth2 = () => {
  location.href =
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    process.env.REDIRECT_URL! + `&state=${encodeURI(window.location.href)}`;
};

export const getUserInfo = async (accessToken: string) => {
  const user = new User(accessToken);

  // initialize account details
  await user.initUserDetails();

  // initialize project list
  await user.initProjectList();

  // if user doesn't have a repo named EasyEyesResources, create one and add folders
  if (!isProjectNameExistInProjectList(user.projectList, resourcesRepoName)) {
    console.log("Creating EasyEyesResources repository...");
    await createEmptyRepo(resourcesRepoName, user);
    await user.initProjectList();
  }

  // Fetch common resources
  const resources = await getCommonResourcesNames(user);
  // Update resources buttons
  // for (const cat of resourcesFileTypes) setTab(cat.substring(0, cat.length - 1));

  return [user, resources];
};
