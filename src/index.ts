import { openTab } from "../components/tab";
import {
  redirectToOauth2,
  redirectToPalvoliaActivation,
} from "../components/user";
import { clearDropzone } from "../components/dropzoneHandler";
import { gitlabRoutine } from "../components/gitlabUtility";
import { uploadedFiles } from "../components/CONSTANTS";

const addOnClickToEl = (elementId: string, handler: any) => {
  const el = document.getElementById(elementId);
  if (el)
    el.addEventListener("click", async (evt: any) => {
      handler();
    });
};

addOnClickToEl("gitlab-connect-btn", redirectToOauth2);
addOnClickToEl("activate-experiment-btn", redirectToPalvoliaActivation);
addOnClickToEl("activate-experiment-btn", redirectToPalvoliaActivation);
const fontsTab = document.getElementById("font-tab");
if (fontsTab) {
  fontsTab.addEventListener("click", async (evt: any) => {
    openTab(evt, "fonts");
  });
}

const formsTab = document.getElementById("form-tab");
if (formsTab) {
  formsTab.addEventListener("click", async (evt: any) => {
    openTab(evt, "fonts");
  });
}

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
