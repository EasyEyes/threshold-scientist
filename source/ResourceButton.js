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
    case "sound":
      return "bi bi-soundwave";
    case "folders":
      return "bi bi-file-zip";
    case "code":
      return "bi bi-file-code";
    case "impulseResponses":
      return "bi bi-sound-wave";
    case "frequencyResponses":
      return "bi bi-graph-up";
    default:
      return "bi bi-question-circle";
  }
};

const processNameForSinglePlural = (name, length) => {
  // Special case for sound which is already a singular word
  if (name === "sound") {
    return length <= 1 ? "sound file" : "sound files";
  }
  // ! dangerous assumption: no 's' in any of the names
  return length <= 1 ? name.replace("s", "") : name;
};

export default class ResourceButton extends Component {
  render() {
    const { resourceList, name, secondaryResourceList, tertiaryResourceList } =
      this.props;

    // Calculate the total items for combined sound resources
    const totalItems =
      name === "sound"
        ? (resourceList ? resourceList.length : 0) +
          (secondaryResourceList ? secondaryResourceList.length : 0) +
          (tertiaryResourceList ? tertiaryResourceList.length : 0)
        : resourceList.length;

    const isLoading = this.props.isLoading;

    return (
      <button
        className="button-grey button-small resource-button"
        onClick={() => {
          // Special handling for sound to show both folders and impulse responses
          if (name === "sound") {
            const foldersHtml = resourceList.length
              ? "<h4>Sound Folders</h4><ul>" +
                resourceList
                  .map((resource) => {
                    return `<li key=${resource}>${resource}</li>`;
                  })
                  .join("") +
                "</ul>"
              : "<h4>Sound Folders</h4><p>No sound folders found</p>";

            const impulseResponsesHtml = secondaryResourceList.length
              ? "<br><h4>Impulse Responses</h4><ul>" +
                secondaryResourceList
                  .map((resource) => {
                    return `<li key=${resource}>${resource}</li>`;
                  })
                  .join("") +
                "</ul>"
              : "<br><h4>Impulse Responses</h4><p></p>";

            const frequencyResponsesHtml = tertiaryResourceList.length
              ? "<br><h4>Frequency Responses</h4><ul>" +
                tertiaryResourceList
                  .map((resource) => {
                    return `<li key=${resource}>${resource}</li>`;
                  })
                  .join("") +
                "</ul>"
              : "<br><h4>Frequency Responses</h4><p></p>";

            Swal.fire({
              icon: undefined,
              title: "Sound Files",
              html: foldersHtml + impulseResponsesHtml + frequencyResponsesHtml,
              confirmButtonColor: "#019267",
              customClass: {
                htmlContainer: "popup-text-container smaller-text",
              },
            });
          } else {
            // Standard handling for other resource types
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
          }
        }}
      >
        {/* <i className={`resource-button-icon ${matchIcon(name)}`}></i> */}
        <span>
          {isLoading ? (
            <i className="bi bi-arrow-repeat icon-spin"></i>
          ) : (
            <>
              {totalItems} {processNameForSinglePlural(name, totalItems)}
            </>
          )}
        </span>
      </button>
    );
  }
}
