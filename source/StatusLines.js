import React, { Component } from "react";
import Swal from "sweetalert2";

import { Question } from "./components";
import { createOrUpdateProlificToken } from "../threshold/preprocess/gitlabUtils";
import { compatibilityRequirements as globalCompatibilityReq } from "../threshold/preprocess/global";
import { displayExperimentNeedsPopup } from "./components/ExperimentNeeds";
import { durations } from "../threshold/preprocess/getDuration";

import "./css/StatusLines.scss";

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

  getProlificStudyStatus = async () => {
    const { prolificToken, user, activeExperiment } = this.props;
    const repo = activeExperiment !== "new" ? activeExperiment : null;
    await this.props.functions.getProlificStudySubmissionDetails(
      user,
      prolificToken,
      repo?.id,
    );
  };

  async componentDidUpdate(prevProps) {
    if (this.props.activeExperiment !== prevProps.activeExperiment) {
      await this.getProlificStudyStatus();
    }
    // await this.props.functions.getprofileStatement();
  }

  async componentDidMount() {
    if (this.props.profileStatement === "Loading...")
      await this.props.functions.getprofileStatement();
  }

  popToUploadProlificToken() {
    Swal.fire({
      title: "Paste Prolific token string here",
      html:
        '<input id="prolific-token-text-input" class="swal2-input">' +
        `<div style="margin-top: 20px;">  Prolific integration requires that you get a 
    token from the Prolific website and save it in your Pavlovia account. 
    When you log into your Prolific account, you'll see a blue navigation bar on the left of the screen. 
    At the bottom, click "Settings". On the Settings page, scroll down to the bottom, 
    and click the "Go to API token page" button. There, hit the "Create API token" 
    and "Copy" buttons to copy the Prolific token. Then paste that token into the text box above, 
    and click "Save". Your Pavlovia account will retain this link to your Prolific account, 
    offering tight EasyEyes integration. 
    You can change it at any time by using the "Change Prolific acct." button.</div>`,
      inputAttributes: {
        autocapitalize: "off",
      },
      showCancelButton: true,
      confirmButtonText: "Save",
      cancelButtonText: "Cancel",
      customClass: {
        confirmButton: "btn-success-prolific-token",
      },
      showLoaderOnConfirm: true,
      didOpen: () => {
        document
          .querySelector(".btn-success-prolific-token")
          .setAttribute("disabled", true);
        const textElement = document.getElementById(
          "prolific-token-text-input",
        );
        textElement.addEventListener("keyup", () => {
          if (textElement.value === "") {
            document
              .querySelector(".btn-success-prolific-token")
              .setAttribute("disabled", true);
          } else {
            document.querySelector(
              ".btn-success-prolific-token",
            ).disabled = false;
          }
        });
      },
      preConfirm: async () => {
        const token = document.getElementById(
          "prolific-token-text-input",
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

  getExperimentStatus = (status) => {
    if (status === "RUNNING") {
      return "RUNNING MODE. Experiment ready to run online.";
    } else if (status === "INACTIVE") {
      return "INACTIVE. Go to Pavlovia to assign credits and set RUNNING mode, or to set PILOTING mode and Pilot the experiment there.";
    } else {
      return "PILOTING MODE. Use Pavlovia’s Pilot button to run here.";
    }
  };

  render() {
    const {
      activeExperiment,
      previousExperimentViewed: {
        originalFileName,
        previousExperimentStatus,
        previousCompatibilityRequirements,
        previousExperimentDuration,
        previousRecruitmentInformation,
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
      // compatibilityRequirements,
      // compatibilityLanguage,
      prolificStudyStatus,
      profileStatement,
    } = this.props;
    const viewingPreviousExperiment = activeExperiment !== "new";

    const showExperimentURL =
      !!(user && projectName && experimentStatus === "RUNNING") ||
      (viewingPreviousExperiment && previousExperimentStatus === "RUNNING");
    const effectiveProjectNameLowerCase = viewingPreviousExperiment
      ? activeExperiment.name?.toLocaleLowerCase()
      : projectName?.toLocaleLowerCase();
    const hasRecruitmentService = viewingPreviousExperiment
      ? previousRecruitmentInformation.recruitmentServiceName !== null
      : !!user?.currentExperiment?.participantRecruitmentServiceName;

    const effectiveUsingProlificWorkspace =
      viewingPreviousExperiment && hasRecruitmentService
        ? previousRecruitmentInformation.recruitmentProlificWorkspace
        : user?.currentExperiment?.prolificWorkspaceModeBool;

    return (
      <ul className="status-lines" style={{ marginBottom: "8px" }}>
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
                  style={{
                    height: "18px",
                    width: "18px",
                  }}
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
                <>
                  <span className="status-line-content prolific-account">
                    {prolificAccount
                      ? `${prolificAccount.name} (${prolificAccount.email})`
                      : "Failed to connect, please check if your Prolific token is correct."}
                    {effectiveUsingProlificWorkspace ? (
                      <span style={{ fontSize: "0.9rem" }}>
                        {` (Using `}
                        <a
                          style={{
                            color: "#666",
                          }}
                          href="https://researcher-help.prolific.co/hc/en-gb/sections/4500136384412-Workspaces"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Prolific Workspace
                        </a>
                        {`.)`}
                      </span>
                    ) : (
                      ""
                    )}
                  </span>
                  <div className="prolific-account-button">
                    <button
                      className="button-small button-grey"
                      onClick={async () => {
                        this.popToUploadProlificToken();
                      }}
                    >
                      Change Prolific acct.
                    </button>
                    <div style={{ visibility: "hidden" }}>
                      <Question title={""} text={``} />
                    </div>
                  </div>
                </>
              ) : (
                <button
                  className="button-small button-grey"
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
        <StatusLine
          activated={!!filename || viewingPreviousExperiment}
          title={"File"}
          content={
            viewingPreviousExperiment
              ? originalFileName
              : filename
              ? this.getStatusLineFilename(filename)
              : ""
          }
        />
        {/* Status Line for Compatibility Requirements */}
        <StatusLine
          activated={!!filename || viewingPreviousExperiment}
          title={"Needs"}
          content={
            <>
              <span className="experiment-needs">
                {viewingPreviousExperiment
                  ? previousCompatibilityRequirements
                  : globalCompatibilityReq.t}
              </span>
              <i
                className="bi bi-question-circle icon-i"
                onClick={() =>
                  displayExperimentNeedsPopup(
                    previousCompatibilityRequirements,
                    functions.handleSetCompatibilityLanguage,
                    viewingPreviousExperiment,
                  )
                }
              ></i>
            </>
          }
        />
        <StatusLine
          activated={
            !!(user && filename && experimentStatus === "RUNNING") ||
            viewingPreviousExperiment
          }
          title={"Estimated minutes"}
          content={
            viewingPreviousExperiment
              ? previousExperimentDuration
              : user && filename && experimentStatus === "RUNNING"
              ? durations.durationForStatusline
              : ""
          }
        />

        <StatusLine
          activated={showExperimentURL}
          title={"URL"}
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
                  wordBreak: "break-all",
                }}
              >{`https://run.pavlovia.org/${user.username}/${effectiveProjectNameLowerCase}`}</a>
            ) : (
              ""
            )
          }
        />

        <StatusLine
          activated={
            !!(user && filename && projectName) || viewingPreviousExperiment
          }
          title={"Pavlovia"}
          content={
            viewingPreviousExperiment
              ? this.getExperimentStatus(
                  experimentStatus ?? previousExperimentStatus,
                )
              : user && filename && projectName
              ? this.getExperimentStatus(experimentStatus)
              : ""
          }
        />

        <StatusLine
          activated={showExperimentURL}
          title={"Prolific"}
          content={
            (user && projectName && experimentStatus === "RUNNING") ||
            (viewingPreviousExperiment &&
              previousExperimentStatus === "RUNNING")
              ? prolificStudyStatus
              : ""
          }
        />

        <StatusLine
          activated={showExperimentURL}
          title={"Profiles"}
          content={profileStatement}
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
