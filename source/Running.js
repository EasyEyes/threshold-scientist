import React, { Component } from "react";
import { Question } from "./components";
import {
  generateAndUploadCompletionURL,
  getExperimentStatus,
  runExperiment,
} from "./components/gitlabUtils";

import "./css/Running.scss";

export default class Running extends Component {
  constructor(props) {
    super(props);

    this.state = {
      status: "INACTIVE",
    };

    this.setModeToRun = this.setModeToRun.bind(this);
  }

  componentDidMount() {
    this.props.scrollToCurrentStep();

    // if (!this.props.user.currentExperiment.pavloviaOfferPilotingOptionBool) {
    //   this.setModeToRun();
    // }
    if (this.props.user.currentExperiment.pavloviaPreferRunningModeBool)
      this.setModeToRun();
  }

  async setModeToRun(e = null) {
    const { user, newRepo } = this.props;

    const result = await runExperiment(
      user,
      newRepo,
      user.currentExperiment.experimentUrl
    );

    if (result.newStatus === "RUNNING") {
      if (e !== null) e.target.removeAttribute("disabled");
      this.setState({ status: "RUNNING" });
    }
  }

  render() {
    const { user, projectName, newRepo } = this.props;
    const { status } = this.state;

    const isRunning = status === "RUNNING";

    const hasRecruitmentService =
      !!user.currentExperiment.participantRecruitmentServiceName;
    const recruitName =
      user.currentExperiment.participantRecruitmentServiceName;

    // const offerPilotingOption =
    //   this.props.user.currentExperiment.pavloviaOfferPilotingOptionBool;
    const offerPilotingOption =
      !this.props.user.currentExperiment.pavloviaPreferRunningModeBool;

    console.log("hasRecruitmentService", hasRecruitmentService);
    console.log("isRunning", isRunning);
    console.log(user);

    const smallButtonExtraStyle = {
      whiteSpace: "nowrap",
      fontSize: "0.7rem",
      padding: "0.6rem",
      borderRadius: "0.3rem",
    };

    const buttonGoToPavlovia = (
      displayText = "Go to Pavlovia",
      extraStyle = {}
    ) => (
      <button
        className={`button-grey button-small`}
        onClick={() => {
          window.open(
            `https://pavlovia.org/${
              user.username
            }/${projectName.toLocaleLowerCase()}`,
            "_blank"
          );
        }}
        style={extraStyle}
      >
        {displayText}
      </button>
    );

    const buttonSetToRunning = (extraStyle = {}) => (
      <button
        // className={`button-small${
        //   isRunning || !offerPilotingOption
        //     ? " button-disabled"
        //     : " button-green"
        // }`}
        className={`button-grey button-small`}
        onClick={
          isRunning
            ? null
            : async (e) => {
                e.target.setAttribute("disabled", true);
                await this.setModeToRun(e);
              }
        }
        style={extraStyle}
      >
        Set to RUNNING mode
      </button>
    );

    return (
      <>
        <p className="emphasize">
          {isRunning
            ? "Experiment compiled, uploaded, and in RUNNING mode, ready to run."
            : `Upload successful! ${
                offerPilotingOption
                  ? "You can go to Pavlovia and set it to PILOTING or RUNNING mode."
                  : "Setting mode to RUNNING ..."
              }`}
        </p>
        <div className="link-set">
          <div className="link-set-buttons">
            {isRunning ? (
              <button
                className="button-grey button-small"
                onClick={() => {
                  window.open(
                    `https://run.pavlovia.org/${
                      user.username
                    }/${projectName.toLocaleLowerCase()}`,
                    "_blank"
                  );
                }}
              >
                Try the experiment in RUNNING mode
              </button>
            ) : (
              <>
                {buttonGoToPavlovia(
                  "Go to Pavlovia to run in PILOTING mode",
                  {}
                )}
                <button
                  className="button-grey button-small"
                  onClick={async (e) => {
                    e.target.classList.add("button-disabled");
                    e.target.classList.add("button-wait");
                    const result = await getExperimentStatus(user, newRepo);
                    e.target.classList.remove("button-disabled");
                    e.target.classList.remove("button-wait");

                    if (result === "RUNNING")
                      this.setState({ status: "RUNNING" });
                  }}
                >
                  Refresh experiment status
                </button>
              </>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            {isRunning
              ? buttonGoToPavlovia("Go to Pavlovia", smallButtonExtraStyle)
              : buttonSetToRunning(smallButtonExtraStyle)}

            <Question
              title={"Set status to RUNNING"}
              text={`In Pavlovia, you need to set the experiment status to RUNNING before you can start the experiment.<br /><br />If your university doesn't have an unlimited Pavlovia license, then Pavlovia will charge you 20 pence per participant. Pavlovia allows you to avoid that fee during evaluation - Go to Pavlovia, hit PILOTING instead of RUNNING, and use their PILOT button, instead of clicking your study URL, to run your study. Their (reasonable) fee cannot be avoided when you run participants on Prolific. In that case use RUNNING.`}
            />
          </div>
        </div>

        {isRunning && (
          <p
            style={{
              fontSize: "1rem",
            }}
          >
            Your study URL:{" "}
            <a
              href={`https://run.pavlovia.org/${
                user.username
              }/${projectName.toLocaleLowerCase()}`}
              target="_blank"
              rel="noopenner noreferrer"
              style={{
                color: "#666",
              }}
            >{`https://run.pavlovia.org/${
              user.username
            }/${projectName.toLocaleLowerCase()}`}</a>
          </p>
        )}

        {hasRecruitmentService && isRunning && (
          <div
            className="recruit-service"
            style={{
              marginTop: "1.6rem",
            }}
          >
            <p>Use {recruitName} to recruit participants.</p>
            <div className="link-set">
              <div
                className="link-set-buttons"
                style={{
                  flexDirection: "row",
                }}
              >
                <button
                  className="button-grey button-small"
                  onClick={async () => {
                    await generateAndUploadCompletionURL(user, newRepo);

                    // hardcoded for Prolific
                    const url =
                      "https://app.prolific.co/studies/new?" +
                      "external_study_url=" +
                      encodeURIComponent(user.currentExperiment.experimentUrl) +
                      "&completion_code=" +
                      encodeURIComponent(
                        user.currentExperiment.participantRecruitmentServiceCode
                      ) +
                      "&completion_option=url" +
                      "&prolific_id_option=url_parameters";

                    window.open(url, "_blank");
                  }}
                >
                  Go to {recruitName} to finalize and run your study
                </button>
                <button
                  className="button-grey button-small"
                  onClick={() => {
                    window.open(
                      "https://app.prolific.co/researcher/studies/active",
                      "_blank"
                    );
                  }}
                >
                  Go to {recruitName} to view active studies
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}
