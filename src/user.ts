import { EasyEyesResources, user } from "./constants";
import { showDialogBox } from "./dropzoneHandler";
import {
  createEmptyRepo,
  GitlabUser,
  isProjectNameExistInProjectList,
} from "./gitlabUtil";
import { getCommonResourcesNames } from "./pavloviaController";
import { completeStep, enableStep } from "./thresholdState";

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
    console.log("creating resources repo");
    let easyEyesResourcesRepo = await createEmptyRepo(
      "EasyEyesResources",
      user.gitlabData
    );
    user.gitlabData.projectList.push(easyEyesResourcesRepo);
  }

  // update DOM with user info
  const gitlabUserInfoEl = document.getElementById("gitlab-user-info");
  if (gitlabUserInfoEl)
    gitlabUserInfoEl.innerHTML = `Pavlovia account : ${user.gitlabData.name} (${user.gitlabData.username})`;

  // fetch common resources
  const resources = await getCommonResourcesNames(user.gitlabData);
  EasyEyesResources.forms = resources.forms;
  EasyEyesResources.fonts = resources.fonts;
  console.log("EasyEyesResources", EasyEyesResources);

  hideDialogBox();

  // update DOM forms button
  let easyEyesFormsButton: HTMLElement = document.getElementById(
    "easyeyes-forms"
  ) as HTMLElement;
  easyEyesFormsButton.textContent =
    EasyEyesResources.forms.length + " " + easyEyesFormsButton.textContent;
  easyEyesFormsButton.className = easyEyesFormsButton.className.replace(
    "no-display",
    ""
  );

  // update DOM fonts button
  let easyEyesFontsButton: HTMLElement = document.getElementById(
    "easyeyes-fonts"
  ) as HTMLElement;
  easyEyesFontsButton.textContent =
    EasyEyesResources.fonts.length + " " + easyEyesFontsButton.textContent;
  easyEyesFontsButton.className = easyEyesFontsButton.className.replace(
    "no-display",
    ""
  );
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
