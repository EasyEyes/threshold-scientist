import Swal from "sweetalert2";

import { compatibilityRequirements } from "../../threshold/preprocess/global";

import "../css/ExperimentNeeds.scss";
import { readi18nPhrases } from "../../threshold/components/readPhrases";

export const displayExperimentNeedsPopup = (
  previousT = "",
  setSelectedLanguage,
  isViewingPreviousExperiment,
) => {
  const selected = isViewingPreviousExperiment
    ? compatibilityRequirements.previousL
    : compatibilityRequirements.L;
  const text = isViewingPreviousExperiment
    ? previousT
    : compatibilityRequirements.t;
  Swal.fire({
    title: "Device Compatibility",
    html: getHtml(
      text,
      selected,
      setSelectedLanguage,
      isViewingPreviousExperiment,
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
  isViewingPreviousExperiment,
) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.className = "textArea";
  textArea.setAttribute("readonly", "");

  const copyButton = document.createElement("button");
  if (window.innerWidth <= 560) {
    copyButton.innerHTML = "Copy";
  } else {
    copyButton.innerHTML = "Copy to clipboard";
  }
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
  Language.style.width = "100%";
  Language.style.paddingLeft = "3px";

  const LanguageDropdownContainer = document.createElement("select");

  const langCodes = Object.keys(readi18nPhrases("EE_languageNameNative"));
  const nativeName = (code) => readi18nPhrases("EE_languageNameNative", code);
  const englishName = (code) => readi18nPhrases("EE_languageNameEnglish", code);

  langCodes.forEach((code) => {
    const option = document.createElement("option");
    option.key = nativeName(code);
    option.value = code;
    option.innerHTML = englishName(code) + " (" + nativeName(code) + ")";
    LanguageDropdownContainer.appendChild(option);
  });

  LanguageDropdownContainer.className =
    "language-dropdown LanguageDropdownContainer";
  LanguageDropdownContainer.name = "languageDropdown";
  LanguageDropdownContainer.id = "languageDropdown";
  LanguageDropdownContainer.value = selected ? selected : "en";
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
  explanation.innerHTML = `1. Specify your study's needs in your spreadsheet using the _needXXX and needXXX parameters.\n2. Choose a language from the menu above.\n3. Copy the translated, participant-friendly needs statement provided in the box above.\n4. Include that in your spreadsheet's _online2Description. This becomes your study's Prolific Description, which participants see before deciding whether to join.\n\n✅ This ensures that only compatible devices participate (e.g., Chrome browser, ≥4 CPU cores) and keeps you compliant with Prolific's policy that all study requirements must be included in the Description.`;

  explanation.style.marginTop = "10px";
  explanation.style.textAlign = "left";
  explanation.style.whiteSpace = "pre-wrap";

  const container = document.createElement("div");
  container.appendChild(textArea);
  container.appendChild(buttonsContainer);
  container.appendChild(explanation);

  return container;
};
