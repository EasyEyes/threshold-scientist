import {
  STEP_COMPLETED,
  STEP_DEFAULT,
  STEP_ENABLED,
  TOTAL_STEPS,
} from "./constants";

export const enableStep = (stepNumber: number): void => {
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
