export const resourcesFileTypes: string[] = [
  "fonts",
  "forms",
  "texts",
  "folders",
];

export const addOnClickToEle = (elementId: string, handler: any) => {
  const el = document.getElementById(elementId);
  if (el)
    el.addEventListener("click", async (evt: any) => {
      handler();
    });
};
