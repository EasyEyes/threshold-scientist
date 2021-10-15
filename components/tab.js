const EasyEyesResources = {
  fonts: [''],
  forms: ['']
};

let currentTabId = 'fonts';


const openTab = (evt, tabId) => {
  currentTabId = tabId;

  var i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablinks");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].className = tablinks[i].className.replace(" active", "");
  }
  document.getElementById(tabId).style.display = "block";
  evt.currentTarget.className += " active";

  // display list
  setTabList(tabId, EasyEyesResources[tabId]);
}

const setTab = (id, count, label) => {
  const el = document.getElementById(id);
  el.innerHTML = `${count} ${label}`;
}

const setTabList = (tabId, list) => {
  const listEl = document.querySelector(`#${tabId} ol`);
  htmlContent = '';
  list.map((name) => {
    htmlContent += `<li>${name}</li>\n`
  });
  listEl.innerHTML = htmlContent;
}