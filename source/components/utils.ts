export const getDateAndTimeString = () => {
  // new Date() -> e.g., 2022-6-13_12-34-56
  return new Date()
    .toLocaleString("zh-CN", { hour12: false })
    .replace(/\//g, "-")
    .replace(/:/g, "-")
    .replace(/ /g, "_");
};
