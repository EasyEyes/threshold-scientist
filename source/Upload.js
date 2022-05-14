import React, { Component, createRef } from "react";
import { createPavloviaExperiment } from "./components/gitlabUtils";

import "./css/Upload.scss";

export default class Upload extends Component {
  constructor(props) {
    super(props);
    this.inputRef = createRef();
    this.upload = this.upload.bind(this);
  }

  componentDidMount() {
    this.props.scrollToCurrentStep();

    if (!this.props.user.currentExperiment.pavloviaOfferPilotingOptionBool) {
      this.upload();
    }
  }

  async upload(e = null) {
    if (e !== null) e.target.setAttribute("disabled", true);
    if (
      (await createPavloviaExperiment(
        this.props.user,
        this.props.projectName,
        this.props.functions.handleGetNewRepo
      )) &&
      e !== null
    ) {
      e.target.removeAttribute("disabled");
      e.target.classList.add("button-disabled");
      this.inputRef.current.setAttribute("disabled", true);
    }
  }

  render() {
    const offerPilotingOption =
      this.props.user.currentExperiment.pavloviaOfferPilotingOptionBool;

    return (
      <>
        <p className="emphasize">
          {offerPilotingOption
            ? `Name the experiment and upload to Pavlovia.`
            : `Uploading the compiled experiment to Pavlovia with the following name ...`}
        </p>
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
