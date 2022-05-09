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
  }

  componentDidMount() {
    this.props.scrollToCurrentStep();
  }

  render() {
    const { user, projectName, newRepo } = this.props;
    const { status } = this.state;
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const that = this;

    const isRunning = status === "RUNNING";

    const hasRecruitmentService =
      !!user.currentExperiment.participantRecruitmentServiceName;
    const recruitName =
      user.currentExperiment.participantRecruitmentServiceName;

    return (
      <>
        <p className="emphasize">
          Upload successful!
          {status === "RUNNING" ? " And the experiment is running!" : ""}
        </p>
        <div className="link-set">
          <div className="link-set-buttons">
            <button
              className={`button-small${
                isRunning ? " button-disabled" : " button-green"
              }`}
              onClick={
                isRunning
                  ? null
                  : async (e) => {
                      e.target.setAttribute("disabled", true);
                      const result = await runExperiment(
                        user,
                        newRepo,
                        user.currentExperiment.experimentUrl
                      );

                      if (result.newStatus === "RUNNING") {
                        e.target.removeAttribute("disabled");
                        that.setState({ status: "RUNNING" });
                      }
                    }
              }
            >
              {isRunning ? "Status set to RUNNING" : "Set status to RUNNING"}
            </button>
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
            >
              Go to Pavlovia
            </button>
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
          <Question
            title={"Set status to RUNNING"}
            text={`In Pavlovia, you need to set the experiment status to RUNNING before you can start the experiment.<br /><br />If your university doesn't have an unlimited Pavlovia license, then Pavlovia will charge you 20 pence per participant. Pavlovia allows you to avoid that fee during evaluation - Go to Pavlovia, hit PILOTING instead of RUNNING, and use their PILOT button, instead of clicking your study URL, to run your study. Their (reasonable) fee cannot be avoided when you run participants on Prolific. In that case use RUNNING.`}
          />
        </div>
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
