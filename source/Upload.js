import React, { Component, createRef } from "react";

import { createPavloviaExperiment } from "../threshold/preprocess/gitlabUtils";

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
    if (e !== null) e.target.setAttribute("disabled", true);
    if (
      await createPavloviaExperiment(
        this.props.user,
        this.props.projectName,
        this.props.functions.handleGetNewRepo,
        this.props.isCompiledFromArchiveBool,
        this.props.archivedZip,
      )
    ) {
      // update firebase compile count
      this.props.functions.handleUpdateCompileCount();

      if (e !== null) {
        e.target.removeAttribute("disabled");
        e.target.classList.add("button-disabled");
        this.inputRef.current.setAttribute("disabled", true);
      }
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
            ? "Your experiment has been uploaded as"
            : offerPilotingOption
            ? `Name the experiment and upload to Pavlovia.`
            : `Uploading the compiled experiment to Pavlovia with the following name ...`}
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
