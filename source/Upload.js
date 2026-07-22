import React, { Component, createRef } from "react";

import { createPavloviaExperiment } from "../threshold/preprocess/gitlabUtils";
import {
  finishCompilerOperation,
  getCurrentCompilerOperation,
  recordCompilerPhase,
  startCompilerOperation,
} from "./sentry";

import "./css/Upload.scss";

export default class Upload extends Component {
  constructor(props) {
    super(props);
    this.inputRef = createRef();
    this.upload = this.upload.bind(this);
  }

  componentDidMount() {
    this.props.scrollToCurrentStep();

    // if (!this.props.user.currentExperiment.pavloviaOfferPilotingOptionBool) {
    //   this.upload();
    // }
    if (this.props.user.currentExperiment.pavloviaPreferRunningModeBool)
      this.upload();
  }

  async upload(e = null) {
    const operation =
      getCurrentCompilerOperation()?.operation === "experiment-compilation"
        ? getCurrentCompilerOperation()
        : startCompilerOperation("pavlovia-upload", {
            source: this.props.isCompiledFromArchiveBool
              ? "archive"
              : "spreadsheet",
          });
    recordCompilerPhase(operation, "upload-started", {
      projectName: this.props.projectName,
    });
    if (e !== null) e.target.setAttribute("disabled", true);
    let uploadSucceeded = false;
    try {
      uploadSucceeded = Boolean(
        await createPavloviaExperiment(
          this.props.user,
          this.props.projectName,
          this.props.functions.handleGetNewRepo,
          this.props.isCompiledFromArchiveBool,
          this.props.archivedZip,
          operation,
        ),
      );
      if (uploadSucceeded) {
        // update firebase compile count
        this.props.functions.handleUpdateCompileCount();

        if (e !== null) {
          e.target.removeAttribute("disabled");
          e.target.classList.add("button-disabled");
          this.inputRef.current.setAttribute("disabled", true);
        }
      }
    } finally {
      finishCompilerOperation(
        operation,
        uploadSucceeded ? "completed" : "failed",
        { failedPhase: uploadSucceeded ? undefined : "pavlovia-upload" },
      );
    }
  }

  render() {
    const { isCompletedStep } = this.props;
    // const offerPilotingOption =
    //   this.props.user.currentExperiment.pavloviaOfferPilotingOptionBool;
    const offerPilotingOption =
      !this.props.user.currentExperiment.pavloviaPreferRunningModeBool;

    return (
      <>
        <div className="green-status-banner">
          {isCompletedStep
            ? "Your study has been uploaded as"
            : offerPilotingOption
            ? `Name the study and upload to Pavlovia.`
            : `Uploading the compiled study to Pavlovia with the following name ...`}
        </div>
        <div className="upload-container">
          <input
            className="upload-input"
            type="text"
            defaultValue={this.props.projectName}
            onChange={(e) => {
              this.props.functions.handleSetProjectName(e.target.value);
            }}
            ref={this.inputRef}
            disabled={!offerPilotingOption}
          ></input>
          {offerPilotingOption && (
            <button
              className="button-green button-small"
              onClick={async (e) => {
                await this.upload(e);
              }}
            >
              Upload
            </button>
          )}
        </div>
      </>
    );
  }
}
