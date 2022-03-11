import {
  STEP_COMPLETED,
  STEP_DEFAULT,
  STEP_ENABLED,
  TOTAL_STEPS,
  user,
} from "./constants";

import { runPavloviaExperiment } from "./pavloviaController";

export const enableStep = async (stepNumber: number) => {
  if (stepNumber != 4) {
    const uploadSection = document.getElementById(`step${stepNumber}`);
    uploadSection!.style.visibility = `visible`;
  } else {
    if (user.currentExperiment.pavloviaOfferPilotingOptionBool) {
      const uploadSection = document.getElementById(`step${stepNumber}`);
      uploadSection!.style.visibility = `visible`;
      const pilotButton = document.getElementById(`piloting-option`);
      pilotButton!.style.display = `block`;
    } else {
      await runPavloviaExperiment();
      const uploadSection = document.getElementById(`step${stepNumber}`);
      uploadSection!.style.visibility = `visible`;
      const pilotButton = document.getElementById(`running-option`);
      pilotButton!.style.display = `block`;
      const uploadSection1 = document.getElementById(`step5-8`);
      uploadSection1!.style.visibility = `visible`;
    }
  }

  const arrowElWrapper = document.getElementById(`state-step${stepNumber}`);
  arrowElWrapper!.innerHTML = `${STEP_ENABLED}`;
};

export const disableStep = (stepNumber: number): void => {
  const arrowEleWrapper = document.getElementById(`state-step${stepNumber}`);
  arrowEleWrapper!.innerHTML = `${STEP_DEFAULT}`;
};

export const completeStep = (stepNumber: number): void => {
  const arrowEleWrapper = document.getElementById(`state-step${stepNumber}`);
  arrowEleWrapper!.innerHTML = `${STEP_COMPLETED}`;
};

export const enableAllSteps = (): void => {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    enableStep(i);
  }
};

export const disableAllSteps = (): void => {
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    disableStep(i);
  }
};

export const disableStepsAfter = (stepNumber: number): void => {
  for (let i = stepNumber + 1; i <= TOTAL_STEPS; i++) {
    disableStep(i);
  }
};
