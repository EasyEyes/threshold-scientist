import React, { Component } from "react";
import Swal from "sweetalert2";

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
        {this.props.resourceList.length} {this.props.name}
      </button>
    );
  }
}
