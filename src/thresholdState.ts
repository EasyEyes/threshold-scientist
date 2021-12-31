import {
  RIGHT_ARROW_DISABLED,
  RIGHT_ARROW_ENABLED,
  TOTAL_STEPS,
} from "./constants";

export const enableStep = (stepNumber: number): void => {
  const arrowElWrapper = document.getElementById(`state-step${stepNumber}`);
  arrowElWrapper!.innerHTML = `${RIGHT_ARROW_ENABLED}`;
};

export const disableStep = (stepNumber: number): void => {
  const arrowElWrapper = document.getElementById(`state-step${stepNumber}`);
  arrowElWrapper!.innerHTML = `${RIGHT_ARROW_DISABLED}`;
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
