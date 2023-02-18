import Swal from "sweetalert2";
import "../css/ExperimentNeeds.css";
import { compatibilityRequirements } from "./global";

export const displayExperimentNeedsPopup = (
  previousT = "",
  setSelectedLanguage,
  isViewingPreviousExperiment
) => {
  const selected = isViewingPreviousExperiment
    ? compatibilityRequirements.previousL
    : compatibilityRequirements.L;
  const text = isViewingPreviousExperiment
    ? previousT
    : compatibilityRequirements.t;
  Swal.fire({
    title: "Experiment Needs",
    html: getHtml(
      text,
      selected,
      setSelectedLanguage,
      isViewingPreviousExperiment
    ),
    showCloseButton: true,
    showCancelButton: false,
    focusConfirm: false,
    confirmButtonText: "Ok",
    confirmButtonAriaLabel: "Ok",
    cancelButtonText: "Cancel",
    cancelButtonAriaLabel: "Cancel",
    customClass: "swalWide",
  });
};

const getHtml = (
  text,
  selected,
  setSelectedLanguage,
  isViewingPreviousExperiment
) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.className = "textArea";
  textArea.setAttribute("readonly", "");

  const copyButton = document.createElement("button");
  copyButton.innerHTML = "Copy to clipboard";
  copyButton.className = "copyButton";
  copyButton.addEventListener("click", () => {
    textArea.select();
    textArea.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(textArea.value);
  });

  const buttonsContainer = document.createElement("div");
  buttonsContainer.className = "buttonsContainer";

  const Language = document.createElement("div");
  Language.innerHTML = "Language: ";
  Language.style.display = "flex";
  Language.style.alignItems = "center";

  const LanguageDropdownContainer = document.createElement("select");

  Object.keys(Languages).forEach((language) => {
    const option = document.createElement("option");
    option.key = language;
    option.value = Languages[language];
    option.innerHTML = language;
    LanguageDropdownContainer.appendChild(option);
  });

  LanguageDropdownContainer.className =
    "history-dropdown LanguageDropdownContainer";
  LanguageDropdownContainer.name = "languageDropdown";
  LanguageDropdownContainer.id = "languageDropdown";
  LanguageDropdownContainer.value = selected
    ? selected
    : Object.values(Languages)[0];
  LanguageDropdownContainer.addEventListener("change", (e) => {
    setSelectedLanguage(e.target.value, isViewingPreviousExperiment);
    textArea.value = isViewingPreviousExperiment
      ? compatibilityRequirements.previousT
      : compatibilityRequirements.t;
  });

  Language.appendChild(LanguageDropdownContainer);
  buttonsContainer.appendChild(copyButton);
  buttonsContainer.appendChild(Language);

  const explanation = document.createElement("div");
  explanation.innerHTML = `STATE NEEDS. To conform to Prolific policy, you should copy the text above and include it in your experiment’s description for participants in <strong>_online2Description</strong> in your experiment spreadsheet.\n
EXPLANATION. Each EasyEyes study begins with a compatibility page that only accepts participant devices that meet the experiment’s needs (e.g. Chrome browser and at least 2000 pixel-wide screen). Prolific policy demands up-front presentation of all inclusion criteria in the study’s Description, which is read by participants before they accept the study. When EasyEyes creates the Prolific study, it copies your experiment’s <strong>_online2Description</strong> to the Prolific study’s Description.`;

  explanation.style.marginTop = "10px";
  explanation.style.textAlign = "left";
  explanation.style.whiteSpace = "pre-wrap";

  const container = document.createElement("div");
  container.appendChild(textArea);
  container.appendChild(buttonsContainer);
  container.appendChild(explanation);

  return container;
};

// Languages map from language name to language code (From EasyEyes Phrases doc)
export const Languages = {
  English: "en-US",
  Deutsch: "de",
  Français: "fr",
  Español: "es",
  Português: "pt",
  Italiano: "it",
  Română: "ro",
  Polski: "pl",
  Русский: "ru",
  հայերեն: "hy",
  Suomalainen: "fi",
  ქართული: "ka",
  עִברִית: "he",
  عربي: "ar",
  اردو: "ur",
  हिंदी: "hi",
  தமிழ்: "ta",
  മലയാളം: "ml",
  తెలుగు: "te",
  ಕನ್ನಡ: "kn",
  বাংলা: "bn",
  "bahasa Indonesia": "id",
  简体中文: "zh-CN",
  繁體中文: "zh-HK",
  日本: "ja",
  한국인: "ko",
};
