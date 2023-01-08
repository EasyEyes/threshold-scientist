import React, { Component } from "react";
import Swal from "sweetalert2";

const matchIcon = (name) => {
  switch (name) {
    case "fonts":
      return "bi bi-fonts";
    case "forms":
      return "bi bi-file-pdf";
    case "texts":
      return "bi bi-blockquote-left";
    case "folders":
      return "bi bi-file-zip";
    case "code":
      return "bi bi-file-code";
    default:
      return "bi bi-question-circle";
  }
};

export default class ResourceButton extends Component {
  render() {
    const { resourceList, name } = this.props;

    return (
      <button
        className="button-grey button-small resource-button"
        onClick={() => {
          Swal.fire({
            icon: undefined,
            title: name.charAt(0).toUpperCase() + name.slice(1),
            html: resourceList.length
              ? "<ul>" +
                resourceList
                  .map((resource) => {
                    return `<li key=${resource}>${resource}</li>`;
                  })
                  .join("") +
                "</ul>"
              : `No ${name} found :(`,
            confirmButtonColor: "#019267",
            customClass: {
              htmlContainer: "popup-text-container smaller-text",
            },
          });
        }}
      >
        <i className={`resource-button-icon ${matchIcon(name)}`}></i>
        <span>
          {resourceList.length} {name}
        </span>
      </button>
    );
  }
}
