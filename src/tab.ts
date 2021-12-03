import { EasyEyesResources, currentTabId, setCurrentTabId } from "./constants";
import { showDialogBox } from "./dropzoneHandler";

export const openTab = (evt: any, tabId: string) => {
  setCurrentTabId(tabId);

  let i: number, tabcontent: any, tablinks: any;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }

  const targetEl = document.getElementById(tabId);
  if (targetEl) targetEl.style.display = "block";
  evt.currentTarget.className += " active";

  // display list
  setTabList(tabId, EasyEyesResources[tabId]);
  let body = "";
  EasyEyesResources[tabId].forEach(
    (i: String) => (body += "<div>" + i + "</div>")
  );
  showDialogBox(
    EasyEyesResources[tabId].length + " " + tabId.toLocaleUpperCase(),
    body,
    true,
    false,
    false
  );
};

export const setTab = (id: string, count: number, label: string) => {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `${count} ${label}`;
};

export const setTabList = (tabId: string, list: string[]) => {
  const listEl = document.querySelector(`#${tabId}`);
  let htmlContent = "";
  if (list.length > 0) {
    list.map((name: string) => {
      htmlContent += `<div>${name}</div>\n`;
    });
  } else {
    htmlContent = "No files found.";
  }

  if (listEl) listEl.innerHTML = htmlContent;
};
