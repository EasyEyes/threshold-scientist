import { addOnClickToEle, resourcesFileTypes } from "./utils";
import {
  populateUserInfo,
  redirectToOauth2,
  redirectToPalvoliaActivation,
} from "./user";
import {
  clearDropzone,
  isUserLoggedIn,
  showDialogBox,
} from "./dropzoneHandler";
import {
  redirectToProlific,
  // generateAndUploadCompletionURL,
  showPavloviaAdvice,
  redirectToProlificToViewActiveStudies,
  showResourcesPopup,
} from "./pavloviaController";
import { disableAllSteps, enableStep } from "./thresholdState";
import { createPavloviaExperiment } from "./pavloviaController";

import "../css/errors.css";

addOnClickToEle("gitlab-connect-btn", redirectToOauth2);
addOnClickToEle("activate-experiment-btn", redirectToPalvoliaActivation);
addOnClickToEle("prolific-redirect-btn", redirectToProlific);
addOnClickToEle("return-to-prolific", redirectToProlificToViewActiveStudies);
addOnClickToEle("pavlovia-advice", showPavloviaAdvice);
for (let type of resourcesFileTypes)
  addOnClickToEle(`easyeyes-${type}`, () => {
    showResourcesPopup(type);
  });

// ThresholdState
disableAllSteps();
enableStep(1);

// -----------------------------------------
// dropzone
// -----------------------------------------
const pushToGitLab = async () => {
  if (!isUserLoggedIn()) {
    showDialogBox(
      "Error",
      "Not connected to Pavlovia, so nothing can be uploaded.",
      true
    );
    clearDropzone();
    return;
  }

  await createPavloviaExperiment();
  clearDropzone();
};

const gitlabFileSubmit: Element = document.querySelector(
  "#gitlab-file-submit"
)!;
gitlabFileSubmit.addEventListener("click", async () => {
  await pushToGitLab();
});

const gitlabNewFileNameInput: Element = document.querySelector(
  "#new-gitlab-repo-name"
)!;
gitlabNewFileNameInput.addEventListener("keydown", async (e: any) => {
  if (e.key === "Enter") {
    await pushToGitLab();
  }
});

// -----------------------------------------
// gitlab
// -----------------------------------------
populateUserInfo();
