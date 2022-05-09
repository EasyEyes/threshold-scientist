import React, { Component, createRef } from "react";
import { createPavloviaExperiment } from "./components/gitlabUtils";

import "./css/Upload.scss";

export default class Upload extends Component {
  constructor(props) {
    super(props);
    this.inputRef = createRef();
  }

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
            ref={this.inputRef}
          ></input>
          <button
            className="button-green button-small"
            onClick={async (e) => {
              e.target.setAttribute("disabled", true);
              if (
                await createPavloviaExperiment(
                  this.props.user,
                  this.props.projectName,
                  this.props.functions.handleGetNewRepo
                )
              ) {
                e.target.removeAttribute("disabled");
                e.target.classList.add("button-disabled");
                this.inputRef.current.setAttribute("disabled", true);
              }
            }}
          >
            Upload
          </button>
        </div>
      </>
    );
  }
}
