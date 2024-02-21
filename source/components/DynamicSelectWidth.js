function getTextWidth(text, font, weight, size) {
  const span = document.createElement("span");
  span.style.font = font;
  span.style.fontWeight = weight;
  span.style.fontSize = size;
  span.textContent = text;
  document.body.appendChild(span);
  const width = span.offsetWidth;
  document.body.removeChild(span);
  return width + 40;
}

export function setDynamicSelectWidth(selectDropdown) {
  console.log(selectDropdown, "ritika");
  console.log(
    selectDropdown.selectedIndex,
    "ritika",
    selectDropdown.options[0],
  );
  const selectedOption = selectDropdown.options[selectDropdown.selectedIndex];
  console.log(selectedOption, selectedOption.text, "ritika");
  const textWidth = getTextWidth(
    selectedOption.text,
    selectDropdown.style.font,
    selectDropdown.style.fontWeight,
    selectDropdown.style.fontSize,
  );
  selectDropdown.style.width = textWidth + "px";
}
