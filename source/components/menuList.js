// On a narrow screen the page's top menu is folded away behind a menu button
// (docs/uni.css); the button opens the items as a list and closes it again.
//
// Most items load another page, which closes the list by itself. On the
// Compiler page a few do not: Media, Studio, Compiler and Test Font change
// the view in place, and Docs > Intro and Compatibility open a popup. Without
// this, the open list would stay on top of whatever the item just showed.
//
// The list is closed the same way a person closes it: by pressing the menu
// button, so the button's own state stays right. Docs and Demos only unfold
// their items inside the list, so they leave it open.

/** Close the open menu list when one of its items is chosen. */
export function closeMenuListOnChoice() {
  const list = document.getElementById("navbarNav");
  const button = document.querySelector(".navbar .navbar-toggler");
  if (!list || !button) return;
  list.addEventListener("click", (event) => {
    const item = event.target.closest?.("a");
    if (!item || item.classList.contains("dropdown-toggle")) return;
    // Nothing to close on a wide screen, where there is no list to open.
    if (!list.classList.contains("show")) return;
    button.click();
  });
}
