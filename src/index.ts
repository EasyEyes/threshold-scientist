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
  showForms,
  showFonts,
} from "./pavloviaController";
import "../css/errors.css";
import { disableAllSteps, enableStep } from "./thresholdState";
import {
  createPavloviaExperiment,
  runPavloviaExperiment,
} from "./pavloviaController";

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

// ThresholdState
disableAllSteps();
enableStep(1);

// -----------------------------------------
// dropzone
// -----------------------------------------

const runPavlovia = async () => {
  await runPavloviaExperiment();
};

const runExperimentButton: Element = document.querySelector(
  "#running-experiment-btn"
)!;
runExperimentButton.addEventListener("click", async () => {
  await runPavlovia();
});

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
