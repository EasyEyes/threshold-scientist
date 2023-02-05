export const getDateAndTimeString = () => {
  // new Date() -> e.g., 2022-6-13_12-34-56
  return new Date()
    .toLocaleString("zh-CN", { hour12: false })
    .replace(/\//g, "-")
    .replace(/:/g, "-")
    .replace(/ /g, "_");
};

// https://stackoverflow.com/a/13627586
export function ordinalSuffixOf(i: number) {
  const j = i % 10,
    k = i % 100;
  if (j == 1 && k != 11) {
    return i + "st";
  }
  if (j == 2 && k != 12) {
    return i + "nd";
  }
  if (j == 3 && k != 13) {
    return i + "rd";
  }
  return i + "th";
}
