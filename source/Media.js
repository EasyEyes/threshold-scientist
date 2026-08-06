import React, { Component, createRef } from "react";

import {
  addMedia,
  formatFileSize,
  formatMediaDate,
  isNameTaken,
  listMedia,
  mediaUrlForPath,
  sanitizeMediaFileName,
} from "./components/mediaLibrary";
import {
  compressImageFile,
  isCompressibleImage,
} from "./components/mediaCompression";

import "./css/Media.scss";

const ACCEPTED_TYPES = ["image/", "audio/", "video/"];

const isAccepted = (file) =>
  ACCEPTED_TYPES.some((prefix) => (file.type || "").startsWith(prefix));

export default class Media extends Component {
  constructor(props) {
    super(props);

    this.state = {
      files: listMedia(),
      errors: [],
      compress: true,
      busy: false,
      showFiles: false,
      copiedPath: null,
    };

    this.fileInput = createRef();
    this.onFilesChosen = this.onFilesChosen.bind(this);
  }

  componentWillUnmount() {
    clearTimeout(this.copyTimer);
  }

  onFilesChosen(event) {
    const chosen = Array.from(event.target.files ?? []);
    // Cleared so that choosing the same file again still fires a change event.
    event.target.value = "";
    this.addFiles(chosen);
  }

  async addFiles(droppedFiles) {
    if (!droppedFiles.length) return;

    this.setState({ busy: true, errors: [] });

    const errors = [];
    const added = [];

    for (const file of droppedFiles) {
      if (!isAccepted(file)) {
        errors.push(`${file.name} is not a supported media file.`);
        continue;
      }

      const path = sanitizeMediaFileName(file.name);

      if (isNameTaken(path) || added.some((record) => record.path === path)) {
        errors.push(
          `${file.name} matches a file already in the library. Rename it before adding, since existing media is never replaced.`,
        );
        continue;
      }

      let finalSize = file.size;
      if (this.state.compress && isCompressibleImage(file)) {
        try {
          const { blob } = await compressImageFile(file);
          finalSize = blob.size;
        } catch {
          errors.push(
            `${file.name} could not be compressed, so it was added unchanged.`,
          );
        }
      }

      added.push(
        addMedia({
          path,
          name: file.name,
          url: mediaUrlForPath(path),
          type: file.type,
          size: finalSize,
          originalSize: file.size,
          addedAt: Date.now(),
        }),
      );
    }

    this.setState({
      files: listMedia(),
      errors,
      busy: false,
      showFiles: true,
    });
  }

  async copyLink(record) {
    try {
      await navigator.clipboard.writeText(record.url);
    } catch {
      const field = document.createElement("textarea");
      field.value = record.url;
      document.body.appendChild(field);
      field.select();
      document.execCommand("copy");
      document.body.removeChild(field);
    }

    clearTimeout(this.copyTimer);
    this.setState({ copiedPath: record.path });
    this.copyTimer = setTimeout(
      () => this.setState({ copiedPath: null }),
      1600,
    );
  }

  renderRow(record) {
    const saved = record.originalSize - record.size;

    return (
      <tr key={record.path}>
        <td className="cell name">
          <p>
            {record.path}
            <span className="media-sub-value">{record.name}</span>
          </p>
        </td>
        <td className="cell size">
          <p>
            {formatFileSize(record.size)}
            {saved > 0 && (
              <span className="media-sub-value">
                was {formatFileSize(record.originalSize)}
              </span>
            )}
          </p>
        </td>
        <td className="cell added">
          <p>{formatMediaDate(record.addedAt)}</p>
        </td>
        <td className="cell link">
          <p className="media-url">{record.url}</p>
          <button
            className="button-small button-grey"
            onClick={() => this.copyLink(record)}
          >
            {this.state.copiedPath === record.path ? "Copied" : "Copy link"}
          </button>
        </td>
      </tr>
    );
  }

  render() {
    const { user } = this.props;
    const { files, errors, compress, busy, showFiles } = this.state;

    return (
      <div className="media-manager media-fadeInUp">
        <div id="header">
          <div id="header-title">
            <h1>EasyEyes Media Library</h1>
          </div>
        </div>

        <div className="media-body">
          <div className="green-status-banner">
            To add a media file for use in an international phrase:
            <ul>
              <li>Click UPLOAD MEDIA FILES to add your media files.</li>
              <li>
                Then click SHOW MEDIA FILES, and click COPY LINK to paste the
                link into the respective phrase.
              </li>
            </ul>
            Media files are never replaced or deleted here, so a link that works
            today keeps working.
          </div>

          <div className="media-actions">
            {user && (
              <button
                className="button-green"
                disabled={busy}
                onClick={() => this.fileInput.current.click()}
              >
                {busy ? "Uploading …" : "Upload media files"}
              </button>
            )}
            <button
              className="button-grey"
              onClick={() =>
                this.setState((state) => ({ showFiles: !state.showFiles }))
              }
            >
              {showFiles ? "Hide media files" : "Show media files"}
            </button>
          </div>

          <input
            ref={this.fileInput}
            type="file"
            multiple
            accept="image/*,audio/*,video/*"
            hidden
            onChange={this.onFilesChosen}
          />

          {user ? (
            <label className="media-option">
              <input
                type="checkbox"
                checked={compress}
                onChange={(event) =>
                  this.setState({ compress: event.target.checked })
                }
              />
              Compress media file
            </label>
          ) : (
            <p className="media-empty">
              Log into Pavlovia on the compiler page to upload media files. You
              can still copy links to media that is already here.
            </p>
          )}

          {errors.length > 0 && (
            <div className="errors">
              {errors.map((message, index) => (
                <div className="error-item error-error" key={index}>
                  <p className="error-hint">{message}</p>
                </div>
              ))}
            </div>
          )}

          {showFiles &&
            (files.length === 0 ? (
              <p className="media-empty">
                No media files yet. Anything you upload will be listed here with
                its size, the date you added it, and its link.
              </p>
            ) : (
              <table className="media-table">
                <thead>
                  <tr className="table-header">
                    <th className="header-cell name">Name</th>
                    <th className="header-cell size">Size</th>
                    <th className="header-cell added">Added</th>
                    <th className="header-cell link">Link</th>
                  </tr>
                </thead>
                <tbody>{files.map((record) => this.renderRow(record))}</tbody>
              </table>
            ))}
        </div>
      </div>
    );
  }
}
