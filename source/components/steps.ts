import { commonSteps } from "./definition";

export const allSteps = () => {
  // console.log(
  //   commonSteps.filter((step) => !step.disabled).map((step) => step.name)
  // );
  return commonSteps.filter((step) => !step.disabled).map((step) => step.name);
};
