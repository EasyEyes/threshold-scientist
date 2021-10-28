import { EasyEyesResources, env, user } from "./CONSTANTS";
import { setTab } from "./tab";

(async function () {
  await populateUserInfo();
})();

if (window.location.hash != "") {
  document.getElementById("gitlab-connect-btn").className =
    "btn btn-success disabled";
  document.getElementById("gitlab-connect-btn").innerText =
    "Connected to Pavlovia. Ready to upload.";
  document.getElementById("gitlab-file-submit").className = document
    .getElementById("gitlab-file-submit")
    .className.replace("disabled", "");
  /*document.getElementById("threshold-content").style.visibility = '';
    document.getElementById("gitlab-login-div").style.visibility = 'hidden';
    document.getElementById('old-content').style.visibility = 'hidden';
    document.getElementById('gitlab-stuff').style.visibility = '';*/
}

const populateUserInfo = async () => {
  user.accessToken = window.location.hash.split("&")[0].split("=")[1];
  var userData = await fetch(
    "https://gitlab.pavlovia.org/api/v4/user?access_token=" +
      window.location.hash.split("&")[0].split("=")[1]
  );
  if (user.accessToken)
    //TODO after dropzone conversion
    /*showDialogBox(
        "Initializing",
        "Please while we fetch your existing resources.",
        false
    );*/

    userData = await userData.json();
  user.userData = userData;
  var projectData = await fetch(
    "https://gitlab.pavlovia.org/api/v4/users/" +
      user.userData.id +
      "/projects?access_token=" +
      user.accessToken +
      "&per_page=100"
  );
  projectData = await projectData.json();
  user.userData.projects = projectData;
  // if user doesn't have a repo named EasyEyesResources, create one and add folders fonts and consent-forms
  if (
    !user.userData.projects
      .map((i: any) => i.name)
      .includes("EasyEyesResources")
  ) {
    var easyEyesResourcesRepo = null; //TODO : await createRepo("EasyEyesResources");
    user.userData.projects.push(easyEyesResourcesRepo);
  }
  document.getElementById("gitlab-user-info").textContent =
    "Account : " + user.userData.name + "(" + user.userData.username + ")";

  // get initial resources info
  var easyEyesResourcesRepo = user.userData.projects.find(
    (i: any) => i.name == "EasyEyesResources"
  );
  const resourcesList: any =
    null; /* TODO : await getResourcesListFromRepository(
      easyEyesResourcesRepo.id,
      user.accessToken
  );*/
  //hideDialogBox();
  EasyEyesResources.forms = resourcesList.forms;
  EasyEyesResources.fonts = resourcesList.fonts;
  console.log("EasyEyesResources", EasyEyesResources);

  // display inital resources info
  setTab("font-tab", EasyEyesResources.fonts.length, "Fonts");
  setTab("form-tab", EasyEyesResources.forms.length, "Consent Forms");
};

export const redirectToOauth2 = async () => {
  // TODO switch this for production
  //location.href = env.PRODUCTION;
  location.href = env.DEVELOPMENT;
};

export const redirectToPalvoliaActivation = async () => {
  window.open(
    "https://pavlovia.org/" + user.userData.username + "/" + user.newRepo.name,
    "_blank"
  );
};
