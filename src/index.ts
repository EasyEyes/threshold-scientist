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

const hoverButton: Element = document.querySelector("#hover-button")!;

hoverButton.addEventListener("click", async () => {
  showDialogBox(
    `EXPLANATION: +
    Which button to press?`,
    `RUNNING: This button, by remote control, tells Pavlovia to activate your study into RUNNING mode. Most users want this. In RUNNING mode you get a study URL, which you’ll need for recruitment, e.g. through Prolific. If your institution does not have a Pavlovia license, then you’ll be charged 20 pence (as of 1/2022) per participant. \n

    Go to Pavlovia: This button takes you to the Pavlovia dashboard, which can do many things. You can activate your study into PILOTING or RUNNING mode. You can PILOT or RUN it. Or click the “View code” button to go to the GitLab browser to examine the files in your experiment’s Pavlovia repository. \n

    PILOTING: In Pavlovia, first hit the PILOTING button, then hit the PILOT button. There is no study URL. Your study will run immediately on this screen. This is always free. \n

    NO PILOTING: In your experiment table set _pavloviaOfferPILOTINGOptionBool TRUE if you want the PILOTING option. Otherwise set it FALSE to allow EasyEyes to streamline the compile-upload-activate sequence. \n

    Misleading error message in Pavlovia: If you go to Pavlovia, and you're not already signed into Pavlovia, then you'll be greeted by the alarming message, "No information available for this experiment: it may not exist or you may not have access to it." Don't worry. Just sign in, using the rightmost item in the Pavlovia menu bar. Then return here and try again.`,
    true,
    false,
    true
  );
});

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
