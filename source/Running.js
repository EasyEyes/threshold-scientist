import React, { Component } from "react";
import { Question } from "./components";
import {
  generateAndUploadCompletionURL,
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

    if (!this.props.user.currentExperiment.pavloviaOfferPilotingOptionBool) {
      this.setModeToRun();
    }
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

    const offerPilotingOption =
      this.props.user.currentExperiment.pavloviaOfferPilotingOptionBool;

    return (
      <>
        <p className="emphasize">
          {status === "RUNNING"
            ? "Experiment compiled, uploaded, and in RUNNING mode, ready to run."
            : `Upload successful!${
                offerPilotingOption ? "" : " Setting mode to RUNNING ..."
              }`}
        </p>
        <div className="link-set">
          <div className="link-set-buttons">
            <button
              className={`button-small${
                isRunning || !offerPilotingOption
                  ? " button-disabled"
                  : " button-green"
              }`}
              onClick={
                isRunning
                  ? null
                  : async (e) => {
                      e.target.setAttribute("disabled", true);
                      await this.setModeToRun(e);
                    }
              }
            >
              {isRunning ? "Mode set to RUNNING" : "Set mode to RUNNING"}
            </button>
            {/* <button
              className="button-grey button-small"
              onClick={() => {
                window.open(
                  `https://pavlovia.org/${
                    user.username
                  }/${projectName.toLocaleLowerCase()}`,
                  "_blank"
                );
              }}
            >
              Go to Pavlovia
            </button> */}
            {isRunning && (
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
                Try the experiment
              </button>
            )}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <button
              className="button-grey button-small"
              onClick={() => {
                window.open(
                  `https://pavlovia.org/${
                    user.username
                  }/${projectName.toLocaleLowerCase()}`,
                  "_blank"
                );
              }}
              style={{
                whiteSpace: "nowrap",
                fontSize: "0.7rem",
                padding: "0.6rem",
                borderRadius: "0.3rem",
              }}
            >
              Go to Pavlovia
            </button>
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
                    let url =
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
