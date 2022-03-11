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
    const uploadsection = document.getElementById(`step${stepNumber}`);
    uploadsection!.style.visibility = `visible`;
  } else {
    if (user.currentExperiment.pavloviaOfferPilotingOptionBool) {
      const uploadsection = document.getElementById(`step${stepNumber}`);
      uploadsection!.style.visibility = `visible`;
      const pilotbutton = document.getElementById(`piloting-option`);
      pilotbutton!.style.display = `block`;
    } else {
      await runPavloviaExperiment();
      const uploadsection = document.getElementById(`step${stepNumber}`);
      uploadsection!.style.visibility = `visible`;
      const pilotbutton = document.getElementById(`running-option`);
      pilotbutton!.style.display = `block`;
      const uploadsection1 = document.getElementById(`step5-8`);
      uploadsection1!.style.visibility = `visible`;
    }
  }

  const arrowElWrapper = document.getElementById(`state-step${stepNumber}`);
  arrowElWrapper!.innerHTML = `${STEP_ENABLED}`;
};
export const disableStep = (stepNumber: number): void => {
  const arrowElWrapper = document.getElementById(`state-step${stepNumber}`);
  arrowElWrapper!.innerHTML = `${STEP_DEFAULT}`;
};
export const completeStep = (stepNumber: number): void => {
  const arrowElWrapper = document.getElementById(`state-step${stepNumber}`);
  arrowElWrapper!.innerHTML = `${STEP_COMPLETED}`;
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
