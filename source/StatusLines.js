import React, { Component } from "react";
import Swal from "sweetalert2";
import Dropdown from "./components/Dropdown";
import { createOrUpdateProlificToken } from "./components/gitlabUtils";
import { compatibilityRequirements } from "./components/global";

// import PavloviaIcon from './media/pavlovia.svg';

import "./css/StatusLines.scss";

const inlineButtonStyle = {
  whiteSpace: "nowrap",
  fontSize: "0.7rem",
  padding: "0.6rem",
  // borderRadius: "0.3rem",
  color: "#fff",
};

export default class StatusLines extends Component {
  constructor(props) {
    super(props);

    this.popToUploadProlificToken = this.popToUploadProlificToken.bind(this);
  }

  isLineActivated(step) {
    return this.props.completedSteps.includes(step);
  }

  getStatusLineFilename(filename) {
    return <span className="status-line-content">{filename}</span>;
  }

  popToUploadProlificToken() {
    Swal.fire({
      title: "Connect Prolific account",
      html:
        '<input id="prolific-token-text-input" class="swal2-input">' +
        `<div style="margin-top: 20px;">  Prolific integration requires that you get a 
    token from the Prolific website and save it in your Pavlovia account. 
    When you log into your Prolific account, you'll see a blue navigation bar on the left of the screen. 
    At the bottom, click "Settings". On the Settings page, scroll down to the bottom, 
    and click the "Go to API token page" button. There, hit  the "Create API token" 
    and the "Copy" buttons to copy the Prolific token. Then paste that token into the text box above, 
    and click "Save". Your Pavlovia account will retain this link to your Prolific account, 
    offering tight EasyEyes integration. 
    You can change it at any time by again using the "Connect Prolific account" button.</div>`,
      inputAttributes: {
        autocapitalize: "off",
      },
      showCancelButton: true,
      confirmButtonText: "Save",
      showLoaderOnConfirm: true,
      preConfirm: async () => {
        const token = document.getElementById(
          "prolific-token-text-input"
        ).value;
        await createOrUpdateProlificToken(this.props.user, token);
        return token;
      },
      allowOutsideClick: () => !Swal.isLoading(),
    }).then((result) => {
      if (result.isConfirmed) {
        this.props.functions.handleUploadProlificToken(result.value);
        Swal.fire({
          title: "Success!",
          text: "Your Prolific token has been uploaded",
          icon: "success",
          confirmButtonText: "OK",
        });
      }
    });
  }

  render() {
    const {
      activeExperiment,
      previousExperimentViewed: {
        originalFileName,
        previousExperimentStatus,
        previousCompatibilityRequirements,
      },
      // currentStep,
      // completedSteps,
      // futureSteps,
      user,
      prolificToken,
      prolificAccount,
      filename,
      projectName,
      experimentStatus,
      functions,
    } = this.props;

    const viewingPreviousExperiment = activeExperiment !== "new";

    const showExperimentURL =
      !!(user && projectName && experimentStatus === "RUNNING") ||
      (viewingPreviousExperiment && previousExperimentStatus === "RUNNING");
    const effectiveProjectNameLowerCase = viewingPreviousExperiment
      ? activeExperiment.name?.toLocaleLowerCase()
      : projectName?.toLocaleLowerCase();

    return (
      <ul className="status-lines">
        <StatusLine
          activated={!!user}
          title={"Pavlovia account"}
          content={
            user ? (
              <span className="pavlovia-account-name">
                <img
                  className="pavlovia-avatar"
                  src={user.avatar_url}
                  alt="Pavlovia Avatar"
                ></img>
                {user.name} ({user.username})
              </span>
            ) : (
              "Unconnected"
            )
          }
        />

        <StatusLine
          activated={!!user}
          title={"Prolific account"}
          content={
            user ? (
              prolificToken ? (
                <span className="status-line-content">
                  {prolificAccount
                    ? `${prolificAccount.name} (${prolificAccount.email})`
                    : "Failed to connect, please check if your Prolific token is correct."}
                  <button
                    className="button-small button-grey"
                    style={inlineButtonStyle}
                    onClick={async () => {
                      // change this button class to button-wait
                      // e.target.classList.add("button-wait");
                      this.popToUploadProlificToken();
                    }}
                  >
                    Connect to Prolific
                  </button>
                </span>
              ) : (
                <button
                  className="button-small button-grey"
                  style={inlineButtonStyle}
                  onClick={async (e) => {
                    // change this button class to button-wait
                    e.target.classList.add("button-wait");
                    this.popToUploadProlificToken();
                  }}
                >
                  Connect to Prolific
                </button>
              )
            ) : (
              "Please connect to Pavlovia first"
            )
          }
        />

        {/* <StatusLine
          activated={!!filename}
          title={(
            <>
              <PavloviaIcon className="line-title-icon" />
              <span>Pavlovia account</span>
            </>
          )}
          content={"Unconnected"}
        /> */}

        <StatusLine
          activated={!!user}
          title={"Select experiment"}
          content={
            user ? (
              <span className="status-line-content">
                <Dropdown
                  selected={activeExperiment}
                  setSelectedProject={functions.handleSetActivateExperiment}
                  projectList={user.projectList}
                  newExperimentProjectName={projectName}
                />
                {/* {((!viewingPreviousExperiment && filename) ||
                  viewingPreviousExperiment) && (
                  <button
                    className="button-small button-grey"
                    style={inlineButtonStyle}
                    onClick={async (e) => {
                      // change this button class to button-wait
                      e.target.classList.add("button-wait");

                      await this.props.functions.handleReturnToStep("table");
                      this.props.functions.handleSetFilename(null);
                      this.props.functions.handleSetProjectName(null);

                      functions.handleSetActivateExperiment("new");
                    }}
                  >
                    Create a new experiment
                  </button>
                )} */}
              </span>
            ) : (
              ""
            )
          }
        />
        <StatusLine
          activated={!!filename || viewingPreviousExperiment}
          title={"Experiment file"}
          content={
            viewingPreviousExperiment
              ? originalFileName
              : filename
              ? this.getStatusLineFilename(filename)
              : ""
          }
        />
        {/* <StatusLine
          activated={!!projectName || viewingPreviousExperiment}
          title={"Experiment name"}
          content={
            viewingPreviousExperiment ? activeExperiment.name : projectName
          }
        /> */}
        <StatusLine
          activated={
            !!(user && filename && projectName) || viewingPreviousExperiment
          }
          title={"Experiment mode"}
          content={
            viewingPreviousExperiment
              ? previousExperimentStatus
              : user && filename && projectName
              ? experimentStatus
              : ""
          }
        />
        <StatusLine
          activated={showExperimentURL}
          title={"Experiment URL"}
          content={
            (user && projectName && experimentStatus === "RUNNING") ||
            (viewingPreviousExperiment &&
              previousExperimentStatus === "RUNNING") ? (
              <a
                href={`https://run.pavlovia.org/${user.username}/${effectiveProjectNameLowerCase}`}
                target="_blank"
                rel="noopenner noreferrer"
                style={{
                  color: "#666",
                }}
              >{`https://run.pavlovia.org/${user.username}/${effectiveProjectNameLowerCase}`}</a>
            ) : (
              ""
            )
          }
        />
        {/* Status Line for Compatibility Requirements */}
        <StatusLine
          activated={!!filename || viewingPreviousExperiment}
          title={"Compatibility Requirements"}
          content={
            viewingPreviousExperiment
              ? previousCompatibilityRequirements
              : compatibilityRequirements.t
          }
        />
        {/* <hr
          style={{
            margin: "0.75rem 0",
            opacity: "0.15",
          }}
        /> */}
      </ul>
    );
  }
}

class StatusLine extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { activated, title, content } = this.props;

    return (
      <li
        className={`status-line ${
          activated ? "status-line-activated" : "status-line-inactivated"
        }`}
      >
        <span className="line-title">{title}:</span>
        {/* <span>: </span> */}
        <span className="line-content">{content}</span>
      </li>
    );
  }
}
