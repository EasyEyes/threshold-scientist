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
    width: "38.4em",
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
    customClass: {
      popup: "swalWide",
      confirmButton: "needsPopupConfirm",
    },
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
  textArea.rows = 4;
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
  Language.style.justifyContent = "flex-end";
  Language.style.width = "100%";
  Language.style.paddingLeft = "3px";

  const LanguageDropdownContainer = document.createElement("select");

  const langCodes = Object.keys(readi18nPhrases("EE_LanguageNativeName"));
  const nativeName = (code) => readi18nPhrases("EE_LanguageNativeName", code);
  const englishName = (code) => readi18nPhrases("EE_LanguageEnglishName", code);

  // Order the menu with English first, then alphabetically by English name.
  const sortedLangCodes = [...langCodes].sort((a, b) => {
    if (a === "en") return -1;
    if (b === "en") return 1;
    return englishName(a).localeCompare(englishName(b));
  });

  sortedLangCodes.forEach((code) => {
    const option = document.createElement("option");
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
  explanation.innerHTML = `1. Specify your study's needs in your spreadsheet using the <strong>_needXXX</strong> and <strong>needXXX</strong> parameters.\n2. Choose a language from the menu above.\n3. Copy the translated, participant-friendly needs statement provided in the box above.\n4. Include that in your spreadsheet's <strong>_online2Description</strong>. This becomes your study's Prolific Description, which participants see before deciding whether to join.\n\n✅ This ensures that only compatible devices participate (e.g., Chrome browser, ≥4 CPU cores) and keeps you compliant with Prolific's policy that all study requirements must be included in the Description.`;

  explanation.style.marginTop = "10px";
  explanation.style.textAlign = "left";
  explanation.style.whiteSpace = "pre-wrap";

  const container = document.createElement("div");
  container.appendChild(textArea);
  container.appendChild(buttonsContainer);
  container.appendChild(explanation);

  return container;
};
