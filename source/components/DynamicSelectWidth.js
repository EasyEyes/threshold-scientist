// function getTextWidth(text, font, weight, size) {
//   const span = document.createElement("span");
//   span.style.font = font;
//   span.style.fontWeight = weight;
//   span.style.fontSize = size;
//   span.textContent = text;
//   document.body.appendChild(span);
//   const width = span.offsetWidth;
//   document.body.removeChild(span);
//   return width + 40;
// }

// export function setDynamicSelectWidth(selectDropdown) {
//   const selectedOption = selectDropdown.options[selectDropdown.selectedIndex];
//   const textWidth = getTextWidth(
//     selectedOption.text,
//     selectDropdown.style.font,
//     selectDropdown.style.fontWeight,
//     selectDropdown.style.fontSize,
//   );
//   selectDropdown.style.width = textWidth + "px";
//   selectDropdown.style.minWidth = "auto";
// }
// DynamicSelectWidth.js
let measuringSpan = null;

function getTextWidth(text, computedStyle) {
  // Create span once
  if (!measuringSpan) {
    measuringSpan = document.createElement("span");
    document.body.appendChild(measuringSpan);
  }

  // Copy over all relevant styles
  Object.assign(measuringSpan.style, {
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "nowrap",
    font: computedStyle.font, // includes size, family, weight
    letterSpacing: computedStyle.letterSpacing,
  });

  measuringSpan.textContent = text;
  const width = measuringSpan.getBoundingClientRect().width;
  return width;
}

export function setDynamicSelectWidth(selectEl) {
  if (!(selectEl instanceof HTMLSelectElement)) return;

  // Reset any previous width
  selectEl.style.width = "auto";

  // Grab the computed style off the select
  const cs = window.getComputedStyle(selectEl);

  // Measure just the text of the selected option
  const optionText = selectEl.options[selectEl.selectedIndex]?.text || "";
  const textWidth = getTextWidth(optionText, cs);

  // Calculate arrow buffer (~1.3em)
  const arrowBuffer = parseFloat(cs.fontSize) * 1.3;

  // Set width = text + padding + arrow buffer
  const padL = parseFloat(cs.paddingLeft);
  const padR = parseFloat(cs.paddingRight);
  const finalWidth = Math.ceil(textWidth + padL + padR + arrowBuffer);

  selectEl.style.width = `${finalWidth}px`;
}
