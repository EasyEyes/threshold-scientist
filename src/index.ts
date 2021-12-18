// import { openTab } from "./tab";
import {
  populateUserInfo,
  redirectToOauth2,
  redirectToPalvoliaActivation,
} from "./user";
import { clearDropzone } from "./dropzoneHandler";
import {
  gitlabRoutine,
  redirectToProlific,
  // generateAndUploadCompletionURL,
  showPavloviaAdvice,
  redirectToProlificToViewActiveStudies,
  showForms,
  showFonts,
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
addOnClickToEl("easyeyes-forms", showForms);
addOnClickToEl("easyeyes-fonts", showFonts);

/*document
  .getElementById("font-tab")!
  .addEventListener("click", async (evt: any) => {
    openTab(evt, "fonts");
  });
document
  .getElementById("form-tab")!
  .addEventListener("click", async (evt: any) => {
    openTab(evt, "forms");
  });*/

// -----------------------------------------
// dropzone
// -----------------------------------------
const pushToGitLab = async () => {
  await gitlabRoutine(uploadedFiles);
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
// tabs
// -----------------------------------------
// document.getElementById("form-tab")!.click();

// -----------------------------------------
// gitlab
// -----------------------------------------
populateUserInfo();
