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
  <span class="error-key">${keyMessage}</span>
  <span class="error-body">${message}</span>
</p>
<p class="error-time">${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}</p>`;

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

function removeFadeOut(e: HTMLElement) {
  e.style.transition = "opacity 0.5s ease";
  e.style.opacity = "0";
  setTimeout(function () {
    e.parentNode!.removeChild(e);
  }, 500);
}
