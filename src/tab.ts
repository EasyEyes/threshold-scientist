import { EasyEyesResources } from "./constants";

export const setTab = (cat: string) => {
  const easyEyesButton: HTMLElement = document.getElementById(
    `easyeyes-${cat}s`
  ) as HTMLElement;

  easyEyesButton.innerText = `${EasyEyesResources[`${cat}s`]!.length} ${cat}${
    EasyEyesResources[`${cat}s`]!.length > 1 ? "s" : ""
  }`;
  easyEyesButton.classList.remove("no-display");
};
