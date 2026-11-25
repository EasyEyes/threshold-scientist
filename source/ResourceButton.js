import React, { Component } from "react";
import { openResourceDialog } from "./components/ResourceDialog";
import { makeResourceLoader } from "./components/resourcePreviewLoader";

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
    case "images":
      return "bi bi-image";
    case "phrases":
      return "bi bi-translate";
    case "impulseResponses":
      return "bi bi-sound-wave";
    case "frequencyResponses":
      return "bi bi-graph-up";
    default:
      return "bi bi-question-circle";
  }
};

// A folder is a zip file of sounds or of images. Folders have no button of
// their own and the word is not in any button's name: a scientist should not
// have to look in a different place for one file and for a folder of files
// (Denis). A folder of images is listed under Images and a folder of sounds
// under Sound; ResourceButtons.js decides which folders each button is given.
const processNameForSinglePlural = (name, length) => {
  if (name === "sound") return length <= 1 ? "sound file" : "sound files";
  return length <= 1 ? name.replace(/s$/, "") : name;
};

const namesOf = (listing) => (listing.kind === "ready" ? listing.names : []);

export default class ResourceButton extends Component {
  render() {
    const { name, onRetry, folderListing } = this.props;
    // Sound: folders, impulse responses, frequency responses, target sound
    // lists. Images: the images, then the folders. Anything else: one list.
    const listings =
      name === "sound"
        ? this.props.listings
        : folderListing
        ? [this.props.listing, folderListing]
        : [this.props.listing];
    const lists = listings.map(namesOf);
    const [
      resourceList,
      secondaryResourceList,
      tertiaryResourceList,
      targetSoundListList,
    ] = lists;
    // `counting`: the lists are here, but the number is not final yet (the
    // folders are still being sorted into Images and Sound), so the spinner
    // stays in its place. The button can be clicked meanwhile.
    const isLoading =
      this.props.counting ||
      listings.some(
        (listing) => listing.kind === "idle" || listing.kind === "loading",
      );
    const isFailed = listings.some((listing) => listing.kind === "failed");
    const totalItems = lists.reduce((sum, list) => sum + list.length, 0);

    return (
      <button
        className="button-grey button-small resource-button"
        title={isFailed ? `Couldn’t load ${name}. Click to retry.` : undefined}
        onClick={() => {
          if (isFailed) {
            onRetry?.();
            return;
          }
          // Fonts, forms, images and texts open with a preview beside the
          // list. Code (its files are too large), phrases and sound open as
          // a plain list. See components/ResourceDialog.js.
          const canPreview = ["fonts", "forms", "images", "texts"].includes(
            name,
          );
          const loadFile =
            canPreview && this.props.user
              ? makeResourceLoader(this.props.user)
              : undefined;
          if (name === "sound") {
            // Four lists in one dialog. Their contents are not previewed.
            // The first list is the folders; as before, it alone says so
            // when it is empty, and the other three are simply empty.
            openResourceDialog({
              title: "Sound Files",
              emptyText: "No sounds found",
              groups: [
                {
                  heading: "Sounds",
                  folder: null,
                  files: resourceList,
                  emptyText: "No sounds found",
                },
                {
                  heading: "Impulse Responses",
                  folder: null,
                  files: secondaryResourceList,
                },
                {
                  heading: "Frequency Responses",
                  folder: null,
                  files: tertiaryResourceList,
                },
                {
                  heading: "targetSoundList",
                  folder: null,
                  files: targetSoundListList,
                },
              ],
            });
          } else {
            // Images are followed, in the same list, by the folders.
            const groups = [{ folder: name, files: resourceList }];
            if (folderListing)
              groups.push({ folder: "folders", files: secondaryResourceList });
            openResourceDialog({
              title: name.charAt(0).toUpperCase() + name.slice(1),
              emptyText: `No ${name} found :(`,
              groups,
              loadFile,
            });
          }
        }}
      >
        <i
          className={`resource-button-icon ${matchIcon(name)}`}
          aria-hidden="true"
        ></i>
        {/* While the list is on its way the button already says what it is
            ("fonts"); only the number is missing, and a small spinning ring
            holds its place. */}
        <span aria-busy={isLoading ? "true" : undefined}>
          {isLoading ? (
            <>
              <span
                className="resource-count-spinner"
                aria-hidden="true"
              ></span>{" "}
              {processNameForSinglePlural(name, 2)}
            </>
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
