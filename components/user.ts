import { env, user } from "./CONSTANTS";

export const redirectToOauth2 = async () => {
  // TODO switch this for production
  //location.href = env.PRODUCTION;
  location.href = env.DEVELOPMENT;
};

export const redirectToPalvoliaActivation = async () => {
  window.open(
    "https://pavlovia.org/" + user.userData.username + "/" + user.newRepo.name,
    "_blank"
  );
};
