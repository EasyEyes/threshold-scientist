const EasyEyesResources = {
  fonts: [''],
  forms: ['']
};

const openTab = (evt, tabId) => {
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
  const listEl = document.querySelector(`#${tabId} ol`);
  htmlContent = '';
  let nameList = EasyEyesResources[tabId];
  nameList.map((name) => {
    htmlContent += `<li>${name}</li>\n`
  });
  listEl.innerHTML = htmlContent;
}

const setTab = (id, count, label) => {
  const el = document.getElementById(id);
  el.innerHTML = `${count} ${label}`;
}