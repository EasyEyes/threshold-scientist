import React, { Component } from "react";
import Swal from "sweetalert2";

const processNameForSinglePlural = (name, length) => {
  if (name === "sound") return "folders and sound files";
  return length <= 1 ? name.replace(/s$/, "") : name;
};

const namesOf = (listing) => (listing.kind === "ready" ? listing.names : []);

export default class ResourceButton extends Component {
  render() {
    const { name, onRetry } = this.props;
    const listings =
      name === "sound" ? this.props.listings : [this.props.listing];
    const [
      resourceList,
      secondaryResourceList,
      tertiaryResourceList,
      targetSoundListList,
    ] = listings.map(namesOf);
    const isLoading = listings.some(
      (listing) => listing.kind === "idle" || listing.kind === "loading",
    );
    const isFailed = listings.some((listing) => listing.kind === "failed");
    const totalItems =
      name === "sound"
        ? resourceList.length +
          secondaryResourceList.length +
          tertiaryResourceList.length +
          targetSoundListList.length
        : resourceList.length;

    return (
      <button
        className="button-grey button-small resource-button"
        title={isFailed ? `Couldn’t load ${name}. Click to retry.` : undefined}
        onClick={() => {
          if (isFailed) {
            onRetry?.();
            return;
          }
          if (name === "sound") {
            const foldersHtml = resourceList.length
              ? "<h4>Folders</h4><ul>" +
                resourceList
                  .map((resource) => {
                    return `<li key=${resource}>${resource}</li>`;
                  })
                  .join("") +
                "</ul>"
              : "<h4>Folders</h4><p>No folders found</p>";

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

            const targetSoundListsHtml = targetSoundListList.length
              ? "<br><h4>targetSoundList</h4><ul>" +
                targetSoundListList
                  .map((resource) => {
                    return `<li key=${resource}>${resource}</li>`;
                  })
                  .join("") +
                "</ul>"
              : "<br><h4>targetSoundList</h4><p></p>";

            Swal.fire({
              icon: undefined,
              title: "Folders and Sound Files",
              html:
                foldersHtml +
                impulseResponsesHtml +
                frequencyResponsesHtml +
                targetSoundListsHtml,
              confirmButtonColor: "#019267",
              customClass: {
                htmlContainer: "popup-text-container smaller-text",
              },
            });
          } else {
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
        <span>
          {isLoading ? (
            <i className="bi bi-arrow-repeat icon-spin"></i>
          ) : isFailed ? (
            `Retry ${name}`
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
