// closeMenuListOnChoice (source/components/menuList.js): on a narrow screen,
// choosing an item in the opened top-menu list closes the list by pressing
// the menu button.
import { closeMenuListOnChoice } from "../components/menuList";

const buildMenu = ({ open }) => {
  document.body.innerHTML = `
    <nav class="navbar">
      <button class="navbar-toggler"></button>
      <div id="navbarNav" class="collapse navbar-collapse${
        open ? " show" : ""
      }">
        <ul class="navbar-nav">
          <li class="nav-item"><a class="nav-link" id="media"><span id="inner">Media</span></a></li>
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle" id="docs">Docs</a>
            <div class="dropdown-menu"><a class="dropdown-item" id="intro">Intro</a></div>
          </li>
        </ul>
      </div>
    </nav>`;
  const presses = jest.fn();
  document.querySelector(".navbar-toggler").addEventListener("click", presses);
  return presses;
};

describe("closeMenuListOnChoice", () => {
  it("presses the menu button when an item of the open list is chosen", () => {
    const presses = buildMenu({ open: true });
    closeMenuListOnChoice();
    document.getElementById("media").click();
    expect(presses).toHaveBeenCalledTimes(1);
  });

  it("counts a click on something inside an item", () => {
    const presses = buildMenu({ open: true });
    closeMenuListOnChoice();
    document.getElementById("inner").click();
    expect(presses).toHaveBeenCalledTimes(1);
  });

  it("closes for an item inside Docs, but not for opening Docs itself", () => {
    const presses = buildMenu({ open: true });
    closeMenuListOnChoice();
    document.getElementById("docs").click();
    expect(presses).not.toHaveBeenCalled();
    document.getElementById("intro").click();
    expect(presses).toHaveBeenCalledTimes(1);
  });

  it("does nothing while the list is not open (a wide screen)", () => {
    const presses = buildMenu({ open: false });
    closeMenuListOnChoice();
    document.getElementById("media").click();
    expect(presses).not.toHaveBeenCalled();
  });

  it("does nothing on a page without the menu button", () => {
    document.body.innerHTML = `<div id="navbarNav" class="show"><a id="x">x</a></div>`;
    expect(() => closeMenuListOnChoice()).not.toThrow();
    expect(() => document.getElementById("x").click()).not.toThrow();
  });
});
