import React, { Component } from "react";
import Dropzone from "react-dropzone";
import { handleDrop } from "./components/dropzone";

import "./css/Table.scss";
import ResourceButton from "./ResourceButton";

export default class Table extends Component {
  constructor(props) {
    super(props);

    this.onDrop = this.onDrop.bind(this);
  }

  onDrop(files) {
    const { user, functions } = this.props;
    handleDrop(user, functions.handleAddResources, files);
  }

  render() {
    const resourceButtons = [];
    for (const fileType in this.props.resources) {
      resourceButtons.push(
        <ResourceButton
          key={`resource-button-${fileType}`}
          name={fileType}
          resourceList={this.props.resources[fileType]}
        />
      );
    }

    return (
      <div className="table">
        <p className="dropzone-around-text emphasize">
          Submit any missing fonts, consent / debrief forms, and other
          resources.
        </p>
        <div className="file-zone">
          <Dropzone onDrop={this.onDrop}>
            {({ getRootProps, getInputProps }) => (
              <div {...getRootProps({ className: "dropzone" })}>
                <input {...getInputProps()} />
                {/* <p className="dropzone-main-text emphasize"></p> */}
                <p className="dropzone-sub-text">
                  <i className="bi bi-download download-icon-box"></i> Drop
                  files here, or click to browse for them.
                </p>
              </div>
            )}
          </Dropzone>
          <div className="resource-buttons">{resourceButtons}</div>
        </div>
        <p className="dropzone-around-text emphasize">
          Then, submit ↑ your experiment table, to be checked now.
        </p>
      </div>
    );
  }
}
