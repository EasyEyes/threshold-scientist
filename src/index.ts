import { openTab } from "./tab";
import {
  populateUserInfo,
  redirectToOauth2,
  redirectToPalvoliaActivation,
} from "./user";
import { clearDropzone } from "./dropzoneHandler";
import {
  gitlabRoutine,
  redirectToProlific,
  generateAndUploadCompletionURL,
  showPavloviaAdvice,
  redirectToProlificToViewActiveStudies,
} from "./gitlabUtility";
import { uploadedFiles } from "./constants";

import "../css/errors.css";

const addOnClickToEl = (elementId: string, handler: any) => {
  const el = document.getElementById(elementId);
  if (el)
    el.addEventListener("click", async (evt: any) => {
      handler();
    });
};

addOnClickToEl("gitlab-connect-btn", redirectToOauth2);
addOnClickToEl("activate-experiment-btn", redirectToPalvoliaActivation);
addOnClickToEl("prolific-redirect-btn", redirectToProlific);
addOnClickToEl("return-to-prolific", redirectToProlificToViewActiveStudies);
addOnClickToEl("pavlovia-advice", showPavloviaAdvice);

document
  .getElementById("font-tab")!
  .addEventListener("click", async (evt: any) => {
    openTab(evt, "fonts");
  });
document
  .getElementById("form-tab")!
  .addEventListener("click", async (evt: any) => {
    openTab(evt, "forms");
  });

// -----------------------------------------
// dropzone
// -----------------------------------------
const gitlabFileSubmit: any = document.querySelector("#gitlab-file-submit");
if (gitlabFileSubmit) {
  gitlabFileSubmit.addEventListener("click", async (e: any) => {
    // call gitlab routine
    await gitlabRoutine(uploadedFiles);

    // clear dropzone
    clearDropzone();
  });
}

const gitlabNewFileNameInput: any = document.querySelector(
  "#new-gitlab-repo-name"
);
gitlabNewFileNameInput.addEventListener("keydown", async (e: any) => {
  // call gitlab routine
  if (e.key == "Enter") {
    await gitlabRoutine(uploadedFiles);

    // clear dropzone
    clearDropzone();
  }
});

// -----------------------------------------
// tabs
// -----------------------------------------
document.getElementById("form-tab")!.click();

// -----------------------------------------
// gitlab
// -----------------------------------------
populateUserInfo();
