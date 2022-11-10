import { commonSteps } from "./definition";

var currentStepValue;

export const allSteps = () => {
  // console.log(
  //   commonSteps.filter((step) => !step.disabled).map((step) => step.name)
  // );
  return commonSteps.filter((step) => !step.disabled).map((step) => step.name);
};

export const currentStepName = () => {
  // console.log(commonSteps);
  const currentStep = commonSteps.find((step) => step.name === currentStepName);
  // console.log(currentStep);
  // return currentStep.name;
};

export const nextStep = (currentStepName) => {
  console.log(currentStepName);
  const currentStep = commonSteps.find((step) => step.name === currentStepName);
  const nextStep = commonSteps.find(
    (step) => step.order === currentStep.order + 1
  );
  return nextStep.name;
};
