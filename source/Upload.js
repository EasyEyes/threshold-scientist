import React, { Component } from "react";
import { createPavloviaExperiment } from "./components/gitlabUtils";

import "./css/Upload.scss";

export default class Upload extends Component {
  componentDidMount() {
    this.props.scrollToCurrentStep();
  }

  render() {
    return (
      <>
        <p className="emphasize">Name the experiment and upload to Pavlovia.</p>
        <div className="upload-container">
          <input
            className="upload-input"
            type="text"
            defaultValue={this.props.projectName}
            onChange={(e) => {
              this.props.functions.handleSetProjectName(e.target.value);
            }}
          ></input>
          <button
            className="button-green button-small"
            onClick={(e) => {
              e.target.setAttribute("disabled", true);
              createPavloviaExperiment(
                this.props.user,
                this.props.projectName,
                this.props.functions.handleGetNewRepo
              );
              setTimeout(() => {
                e.target.removeAttribute("disabled");
              }, 1000);
            }}
          >
            Upload
          </button>
        </div>
      </>
    );
  }
}
