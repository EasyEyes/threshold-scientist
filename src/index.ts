import { openTab } from "./tab";
import {
  populateUserInfo,
  redirectToOauth2,
  redirectToPalvoliaActivation,
} from "./user";
import { clearDropzone } from "./dropzoneHandler";
import {
  copyUrl,
  gitlabRoutine,
  handleGeneratedURLSubmission,
  redirectToProlific,
  uploadCompletionURL,
} from "./gitlabUtility";
import { uploadedFiles } from "./CONSTANTS";
import { newLog } from "./errorLog";

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
addOnClickToEl("copy-pavlovia-url-btn", copyUrl);
addOnClickToEl("prolific-redirect-btn", redirectToProlific);
addOnClickToEl("return-to-prolific", redirectToProlific);
addOnClickToEl(
  "participant-recruitment-completion-url-submit",
  uploadCompletionURL
);
addOnClickToEl("new-url-submit", handleGeneratedURLSubmission);

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

populateUserInfo();

// Sample error messages

// const errors = document.getElementById("errors")!;
// newLog(errors, "author", "The author name is missing.", "warning");
// newLog(
//   errors,
//   "targetFont",
//   "Your targetFont is set incorrectly. Ignore this, this is only for demo purposes. You are all good.",
//   "error"
// );
// newLog(
//   errors,
//   "Done",
//   "Your experiment.csv file is error free. Upload to Pavlovia now.",
//   "correct"
// );
