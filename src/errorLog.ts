import { uploadedFiles } from "./constants";
import { EasyEyesError } from "./errorMessages";

export const logError = (error: EasyEyesError, parent: HTMLElement) => {
  const errorParameters = error.parameters
    ? `<span class="error-parameter">${error.parameters.join("<br/>")}</span>`
    : "";
  const errorTitle = `${errorParameters}<br/>${error.name}`;
  const errorBody =
    error.message +
    "<br/>" +
    (error.hint ? `<p class="error-hint">${error.hint}</p>` : "");
  newLog(parent, errorTitle, errorBody, error.kind || "error");
};

export const newLog = (
  parent: HTMLElement,
  keyMessage: string,
  message: string,
  kind: string = "error"
) => {
  const now: Date = new Date();

  const errorBox: HTMLElement = document.createElement("div");
  errorBox.className = `error-box ${
    kind === "warning"
      ? "error-warning"
      : kind === "correct"
      ? "error-correct"
      : "error-error"
  }`;
  errorBox.innerHTML = `<p class="error-line">
  <p class="error-key">${keyMessage}</p>
  <p class="error-body">${message}</p>
</p>
<p class="error-time">${
    uploadedFiles.experimentFile.name
  } at ${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}</p>`;

  const errorOK: HTMLElement = document.createElement("p");
  errorOK.className = "error-ok";
  errorOK.innerHTML = "OK";
  errorOK.onclick = (e) => {
    // (e.target! as HTMLElement).parentElement?.remove()
    removeFadeOut((e.target! as HTMLElement).parentElement!);
  };

  errorBox.appendChild(errorOK);
  parent.appendChild(errorBox);

  return errorBox;
};

export const clearLogs = (parent: HTMLElement) => {
  while (parent.firstChild) parent.removeChild(parent.firstChild);
};

function removeFadeOut(e: HTMLElement) {
  e.style.transition = "opacity 0.5s ease";
  e.style.opacity = "0";
  setTimeout(function () {
    e.parentNode!.removeChild(e);
  }, 500);
}
