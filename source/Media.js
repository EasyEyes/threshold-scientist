import React, { Component, createRef } from "react";

import {
  MediaError,
  formatFileSize,
  formatMediaDate,
  listMedia,
  uploadMedia,
} from "./components/mediaLibrary";
import {
  compressImageFile,
  isCompressibleImage,
} from "./components/mediaCompression";
import { VIEWER_ACCESS, fetchMediaAccess } from "./components/mediaAuthApi";

import "./css/Media.scss";

const ACCEPTED_TYPES = ["image/", "audio/", "video/"];

const isAccepted = (file) =>
  ACCEPTED_TYPES.some((prefix) => (file.type || "").startsWith(prefix));

export default class Media extends Component {
  constructor(props) {
    super(props);

    this.state = {
      files: [],
      errors: [],
      compress: true,
      busy: false,
      loading: false,
      showFiles: false,
      copiedPath: null,
      access: null,
    };

    this.fileInput = createRef();
    this.onFilesChosen = this.onFilesChosen.bind(this);
  }

  componentDidMount() {
    this.refreshAccess();
    this.refreshFiles();
  }

  // Opening the page from the Media menu mounts this panel before the stored
  // Pavlovia session has finished logging in, so the first check runs with no
  // user. Re-check once login lands, or the panel would keep reporting the
  // rights of nobody.
  componentDidUpdate(prevProps) {
    if (!prevProps.user && this.props.user) this.refreshAccess();
  }

  async refreshAccess() {
    if (!this.props.user) {
      this.setState({ access: VIEWER_ACCESS });
      return;
    }

    const access = await fetchMediaAccess();
    if (!this.unmounted) this.setState({ access });
  }

  async refreshFiles() {
    this.setState({ loading: true });

    try {
      const files = await listMedia();
      if (!this.unmounted) this.setState({ files, loading: false });
    } catch (err) {
      if (!this.unmounted)
        this.setState({ loading: false, errors: [err.message] });
    }
  }

  componentWillUnmount() {
    this.unmounted = true;
    clearTimeout(this.copyTimer);
  }

  onFilesChosen(event) {
    const chosen = Array.from(event.target.files ?? []);
    // Cleared so that choosing the same file again still fires a change event.
    event.target.value = "";
    this.addFiles(chosen);
  }

  async addFiles(chosenFiles) {
    if (!chosenFiles.length) return;

    this.setState({ busy: true, errors: [] });

    const errors = [];

    for (const file of chosenFiles) {
      if (!isAccepted(file)) {
        errors.push(`${file.name} is not a supported media file.`);
        continue;
      }

      let blob = file;
      if (this.state.compress && isCompressibleImage(file)) {
        try {
          ({ blob } = await compressImageFile(file));
        } catch {
          errors.push(
            `${file.name} could not be compressed, so it was uploaded unchanged.`,
          );
          blob = file;
        }
      }

      try {
        await uploadMedia(file, blob);
      } catch (err) {
        errors.push(
          err instanceof MediaError
            ? err.message
            : `${file.name} could not be uploaded.`,
        );
      }
    }

    this.setState({ errors, busy: false, showFiles: true });

    // Re-read rather than append: the server decides the final name, date, and
    // uploader, and one of those may differ from what was sent.
    await this.refreshFiles();
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

  renderUploadAccess() {
    const { user } = this.props;
    const { access, compress } = this.state;

    if (!user)
      return (
        <p className="media-note">
          Anyone can browse these files and copy their links. Log into Pavlovia
          on the compiler page to upload media files.
        </p>
      );

    if (!access)
      return <p className="media-note">Checking your Pavlovia account …</p>;

    if (!access.permissions.upload) {
      const account = access.username
        ? `The Pavlovia account "${access.username}"`
        : "Your Pavlovia account";

      return (
        <p className="media-note">
          {access.error ??
            `${account} can browse and copy links, but not upload. Ask the EasyEyes team for upload access.`}
        </p>
      );
    }

    return (
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
    );
  }

  render() {
    const { files, errors, busy, loading, showFiles, access } = this.state;
    const canUpload = !!access?.permissions?.upload;

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
            {canUpload && (
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
              onClick={() => {
                const opening = !showFiles;
                this.setState({ showFiles: opening });
                if (opening) this.refreshFiles();
              }}
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

          {this.renderUploadAccess()}

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
            (loading ? (
              <p className="media-note">Loading media files …</p>
            ) : files.length === 0 ? (
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
