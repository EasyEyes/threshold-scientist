// The signed-in Pavlovia account, as one small icon at the far right of the
// top menu on the Compiler page. Clicking it opens a small panel that shows
// the account the same way the "Pavlovia account" line under the title does:
// the avatar, then "Name (username)".
//
// The top menu is plain HTML in the page shell (index.html), not React, so
// this is drawn into the menu's #nav-account slot. It shows nothing when
// nobody is signed in or the slot is missing. The panel is opened and closed
// by Bootstrap's dropdown, the same one the Docs and Demos menus use.
import React from "react";
import { createPortal } from "react-dom";

import "../css/NavAccount.scss";

export default function NavAccount({ user }) {
  const slot =
    typeof document !== "undefined"
      ? document.getElementById("nav-account")
      : null;
  if (!slot || !user) return null;
  return createPortal(
    <div className="dropdown">
      <button
        type="button"
        className="nav-account-button"
        data-bs-toggle="dropdown"
        aria-expanded="false"
        aria-label="Pavlovia account"
      >
        <i className="bi bi-person-circle" aria-hidden="true"></i>
      </button>
      <div className="dropdown-menu dropdown-menu-end nav-account-panel">
        <div className="nav-account-title">Pavlovia account</div>
        <div className="nav-account-name">
          <img
            className="nav-account-avatar"
            src={user.avatar_url}
            alt="Pavlovia Avatar"
          ></img>
          {user.name} ({user.username})
        </div>
      </div>
    </div>,
    slot,
  );
}
