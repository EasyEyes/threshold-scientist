import { EasyEyesResources, user } from "./constants";
import { showDialogBox } from "./dropzoneHandler";
import { createRepo, getResourcesListFromRepository } from "./gitlabUtility";
import { setTab, setTabList } from "./tab";

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

export const populateUserInfo = async () => {
  console.log(document.getElementById("form-tab"));
  //document.getElementById("form-tab")!.click();

  user.accessToken = window.location.hash.split("&")[0].split("=")[1];
  var userData = await fetch(
    "https://gitlab.pavlovia.org/api/v4/user?access_token=" +
      window.location.hash.split("&")[0].split("=")[1]
  );

  let hideDialogBox;
  if (user.accessToken) {
    // after dropzone conversion
    hideDialogBox = showDialogBox("Initializing...", "", false, false, false);
    user.userData = await userData.json();
  } else {
    return;
  }

  var projectData: any = await fetch(
    "https://gitlab.pavlovia.org/api/v4/users/" +
      user.userData.id +
      "/projects?access_token=" +
      user.accessToken +
      "&per_page=500"
  );
  projectData = await projectData.json();
  user.userData.projects = projectData;
  // if user doesn't have a repo named EasyEyesResources, create one and add folders fonts and consent-forms
  if (
    !user.userData.projects
      .map((i: any) => {
        return i ? i.name : "null";
      })
      .includes("EasyEyesResources")
  ) {
    let easyEyesResourcesRepo = await createRepo("EasyEyesResources");
    user.userData.projects.push(easyEyesResourcesRepo);
  }
  const gitlabUserInfoEl = document.getElementById("gitlab-user-info");
  if (gitlabUserInfoEl)
    gitlabUserInfoEl.innerHTML = `Pavlovia account : ${user.userData.name} (${user.userData.username})`;

  // get initial resources info
  let easyEyesResourcesRepo = user.userData.projects.find(
    (i: any) => i.name == "EasyEyesResources"
  );
  const resourcesList: any = await getResourcesListFromRepository(
    easyEyesResourcesRepo.id,
    user.accessToken
  );
  hideDialogBox();
  EasyEyesResources.forms = resourcesList.forms;
  EasyEyesResources.fonts = resourcesList.fonts;
  console.log("EasyEyesResources", EasyEyesResources);

  let easyEyesFormsButton: HTMLElement = document.getElementById(
    "easyeyes-forms"
  ) as HTMLElement;
  easyEyesFormsButton.textContent =
    EasyEyesResources.forms.length + " " + easyEyesFormsButton.textContent;

  let easyEyesFontsButton: HTMLElement = document.getElementById(
    "easyeyes-fonts"
  ) as HTMLElement;
  easyEyesFontsButton.textContent =
    EasyEyesResources.fonts.length + " " + easyEyesFontsButton.textContent;
  /*// display inital resources info
  setTab("font-tab", EasyEyesResources.fonts.length, "Fonts");
  setTabList("fonts", EasyEyesResources.fonts);
  setTab("form-tab", EasyEyesResources.forms.length, "Forms");
  setTabList("forms", EasyEyesResources.forms);
  document.getElementById("form-tab")!.click();*/
};

export const redirectToOauth2 = () => {
  location.href =
    process.env.REDIRECT_URL! + `&state=${encodeURI(window.location.href)}`;
};

export const redirectToPalvoliaActivation = async () => {
  window.open(
    "https://pavlovia.org/" +
      user.userData.username +
      "/" +
      user.newRepo.name.toLowerCase(),
    "_blank"
  );
};
