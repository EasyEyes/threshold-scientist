import { commonSteps } from "./definition";

export const allSteps = () => {
  return commonSteps.filter((step) => !step.disabled).map((step) => step.name);
};

export const nextStep = (currentStepName) => {
  const currentStep = commonSteps.find((step) => step.name === currentStepName);
  const nextStep = commonSteps.find(
    (step) => step.order === currentStep.order + 1
  );
  return nextStep.name;
};
