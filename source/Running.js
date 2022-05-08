import React, { Component } from "react";
import Question from "./components";
import {
  generateAndUploadCompletionURL,
  runExperiment,
} from "./components/gitlabUtils";

import "./css/Running.scss";

export default class Running extends Component {
  componentDidMount() {
    this.props.scrollToCurrentStep();
  }

  render() {
    const { user, projectName, newRepo } = this.props;

    const hasRecruitmentService =
      !!user.currentExperiment.participantRecruitmentServiceName;
    const recruitName =
      user.currentExperiment.participantRecruitmentServiceName;
    console.log(user.currentExperiment);

    return (
      <>
        <p className="emphasize">Upload successful!</p>
        <div className="link-set">
          <div>
            <button
              className="button-green button-small"
              onClick={async (e) => {
                e.target.setAttribute("disabled", true);
                const result = await runExperiment(
                  user,
                  newRepo,
                  user.currentExperiment.experimentUrl
                );

                if (result.newStatus === "RUNNING") {
                  e.target.onClick = null;
                  e.target.innerHTML = "Status set to RUNNING";
                  e.target.classList.replace("button-green", "button-grey");
                  e.target.classList.add("button-disabled");
                  e.target.removeAttribute("disabled");
                }
              }}
            >
              Set status to RUNNING
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
          </div>
          <Question
            title={"Set status to RUNNING"}
            text={`In Pavlovia, you need to set the experiment status to RUNNING before you can start the experiment.<br /><br />If your university doesn't have an unlimited Pavlovia license, then Pavlovia will charge you 20 pence per participant. Pavlovia allows you to avoid that fee during evaluation - Go to Pavlovia, hit PILOTING instead of RUNNING, and use their PILOT button, instead of clicking your study URL, to run your study. Their (reasonable) fee cannot be avoided when you run participants on Prolific. In that case use RUNNING.`}
          />
        </div>
        {hasRecruitmentService && (
          <div className="recruit-service">
            <p>Use {recruitName} to recruit participants.</p>
            <div className="link-set">
              <div>
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
