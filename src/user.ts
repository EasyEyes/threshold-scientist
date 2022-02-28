import { EasyEyesResources, user } from "./constants";
import { showDialogBox } from "./dropzoneHandler";
import {
  createEmptyRepo,
  GitlabUser,
  isProjectNameExistInProjectList,
} from "./gitlabUtil";
import { getCommonResourcesNames } from "./pavloviaController";
import { setTab } from "./tab";
import { completeStep, enableStep } from "./thresholdState";
import { resourcesFileTypes } from "./utils";

/**
 * initializes pavlovia account info and updates DOM with new info
 */
export const populateUserInfo = async () => {
  if (window.location.hash != "") {
    const gitlabConnBtn = document.getElementById("gitlab-connect-btn");
    const gitlabFileBtn = document.getElementById("gitlab-file-submit");
    if (gitlabConnBtn) {
      gitlabConnBtn.className = "btn btn-success disabled";
      gitlabConnBtn.style.color = "white";
      gitlabConnBtn.innerText = "Connected to Pavlovia. Ready to upload.";
    }

    if (gitlabFileBtn)
      gitlabFileBtn.className = gitlabFileBtn.className.replace("disabled", "");
  }

  // initialise user details
  const gitlabUser = new GitlabUser(
    window.location.hash.split("&")[0].split("=")[1]
  );
  user.gitlabData = gitlabUser;
  user.accessToken = window.location.hash.split("&")[0].split("=")[1];
  let hideDialogBox;
  if (user.gitlabData.accessToken) {
    // after dropzone conversion
    hideDialogBox = showDialogBox("Initializing...", "", false, false, false);
  } else {
    return;
  }
  // initalize account details
  await gitlabUser.initUserDetails();

  // initalize project list
  await gitlabUser.initProjectList();
  // update steps
  completeStep(1);
  enableStep(2);
  enableStep(3);

  // if user doesn't have a repo named EasyEyesResources, create one and add folders fonts and consent-forms
  if (
    !isProjectNameExistInProjectList(
      user.gitlabData.projectList,
      "EasyEyesResources"
    )
  ) {
    console.log("Creating EasyEyesResources repository...");
    let easyEyesResourcesRepo = await createEmptyRepo(
      "EasyEyesResources",
      user.gitlabData
    );
    user.gitlabData.projectList.push(easyEyesResourcesRepo);
  }

  // Update DOM with user info
  const pavloviaHeaderEle = document.getElementById("pavlovia-header");
  if (pavloviaHeaderEle) pavloviaHeaderEle.style.display = "block";
  const gitlabUserInfoEle = document.getElementById("gitlab-user-info");
  if (gitlabUserInfoEle)
    gitlabUserInfoEle.innerHTML = `<b>Pavlovia account</b> ${user.gitlabData.name} (${user.gitlabData.username})`;

  // Fetch common resources
  const resources = await getCommonResourcesNames(user.gitlabData);
  for (let i in resources) EasyEyesResources[i] = [...resources[i]];
  // Update resources buttons
  for (let cat of resourcesFileTypes) setTab(cat.substring(0, cat.length - 1));

  hideDialogBox();
};

export const redirectToOauth2 = () => {
  location.href =
    process.env.REDIRECT_URL! + `&state=${encodeURI(window.location.href)}`;
};

export const redirectToPalvoliaActivation = async () => {
  window.open(
    "https://pavlovia.org/" +
      user.gitlabData.username +
      "/" +
      user.newRepo.name.toLowerCase(),
    "_blank"
  );
};
