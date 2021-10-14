const user = {};

const populateUserInfo = async () => {
  user.accessToken = window.location.hash.split("&")[0].split("=")[1];
  var userData = await fetch(
    "https://gitlab.pavlovia.org/api/v4/user?access_token=" +
      window.location.hash.split("&")[0].split("=")[1]
  );
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
    !user.userData.projects.map((i) => i.name).includes("EasyEyesResources")
  ) {
    var easyEyesResourcesRepo = await createRepo("EasyEyesResources");
    user.userData.projects.push(easyEyesResourcesRepo);
  }
  document.getElementById("gitlab-user-info").textContent =
    "Account : " + user.userData.name + "(" + user.userData.username + ")";
};

if (window.location.hash == "") {
  /*document.getElementById("threshold-content").style.visibility = 'hidden';
    document.getElementById("gitlab-login-div").style.visibility = '';
    document.getElementById('old-content').style.visibility = 'hidden';
    document.getElementById('gitlab-stuff').style.visibility = 'hidden';*/
  /*location.href = 'https://gitlab.pavlovia.org//oauth/authorize?client_id=f43ec84eac32326bd40b28f79728bfb5ba32cace89d580662cdb46da3b7dcc8d&redirect_uri=https%3A%2F%2Feasyeyes.app%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=1587kx42hje';*/
} else {
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

  populateUserInfo();
}

const redirectToOauth2 = async () => {
  // TODO switch this for production
//   location.href =
//     "https://gitlab.pavlovia.org//oauth/authorize?client_id=f43ec84eac32326bd40b28f79728bfb5ba32cace89d580662cdb46da3b7dcc8d&redirect_uri=http%3A%2F%2Flocalhost%3A63342%2Fwebsite%2Fdocs%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=1587kx42hje";
  location.href =
        'https://gitlab.pavlovia.org//oauth/authorize?client_id=914cc931ddf67ab1b9ad8366e29c3a33a89348e09d80fe9c4bbacaa199fa2ce1&redirect_uri=http%3A%2F%2Flocalhost%3A63342%2Fwebsite%2Fdocs%2Fthreshold%2F&scope=api&response_type=token&response_mode=query&nonce=0wo5oj2oubc';
};

const redirectToPalvoliaActivation = async () => {
  window.open(
    "https://pavlovia.org/" + user.userData.username + "/" + user.newRepo,
    "_blank"
  );
};
