import React, { Component } from "react";
import Swal from "sweetalert2";
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
      pavloviaIsReady: false,
    };

    this.setModeToRun = this.setModeToRun.bind(this);
  }

  componentDidMount() {
    this.props.scrollToCurrentStep();

    if (this.props.user.currentExperiment.pavloviaPreferRunningModeBool)
      this.setModeToRun();
  }

  // componentDidUpdate() {
  //   new Promise((resolve) => setTimeout(resolve, 100)).then(() => {
  //     if (!this.state.pavloviaIsReady) this.checkPavloviaReady();
  //   });
  // }

  async setModeToRun(e = null) {
    const { user, newRepo } = this.props;

    const result = await runExperiment(
      user,
      newRepo,
      user.currentExperiment.experimentUrl
    );

    if (result && result.newStatus === "RUNNING") {
      if (e !== null) e.target.removeAttribute("disabled");
      this.setState({ status: "RUNNING" });

      let tries = 10; // try 10 times
      const checkPavloviaReadyInterval = setInterval(() => {
        this.checkPavloviaReady(() => {
          clearInterval(checkPavloviaReadyInterval);
        });
        tries--;
        if (tries === 0) {
          clearInterval(checkPavloviaReadyInterval);
        }
      }, 2000);
    }
  }

  _getPavloviaExperimentUrl() {
    return `https://run.pavlovia.org/${
      this.props.user.username
    }/${this.props.projectName.toLocaleLowerCase()}`;
  }

  checkPavloviaReady(successfulCallback = null) {
    fetch(this._getPavloviaExperimentUrl())
      .then((response) => response.text())
      .then((data) => {
        if (data.includes("403 Forbidden")) {
          if (this.state.pavloviaIsReady)
            this.setState({
              pavloviaIsReady: false,
            });
        } else if (data.includes("404 Not Found")) {
          if (this.state.pavloviaIsReady)
            this.setState({
              pavloviaIsReady: false,
            });
          Swal.fire({
            icon: "error",
            title: `Failed to check availability.`,
            text: `We can't find the experiment on Pavlovia server. There might be a problem when uploading it, or the Pavlovia server is down. Please try to refresh the status in a while, or refresh the page to start again.`,
            confirmButtonColor: "#666",
          });
        } else {
          if (successfulCallback) successfulCallback();
          if (!this.state.pavloviaIsReady)
            this.setState({
              pavloviaIsReady: true,
            });
        }
      })
      .catch(() => {
        if (this.state.pavloviaIsReady)
          this.setState({ pavloviaIsReady: false });
      });
  }

  render() {
    const { user, projectName, newRepo } = this.props;
    const { status } = this.state;

    const isRunning = status === "RUNNING";
    const pavloviaIsReady = this.state.pavloviaIsReady;

    const hasRecruitmentService =
      !!user.currentExperiment.participantRecruitmentServiceName;
    const recruitName =
      user.currentExperiment.participantRecruitmentServiceName;

    // const offerPilotingOption =
    //   this.props.user.currentExperiment.pavloviaOfferPilotingOptionBool;
    const offerPilotingOption =
      !this.props.user.currentExperiment.pavloviaPreferRunningModeBool;

    // console.log("hasRecruitmentService", hasRecruitmentService);
    // console.log("isRunning", isRunning);
    // console.log(user);

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
            ? pavloviaIsReady
              ? "Experiment compiled, uploaded, and in RUNNING mode, ready to run."
              : "Experiment compiled and uploaded. Waiting for Pavlovia's approval to run ... Unless your university has a Pavlovia license, to run your new experiment, you need to assign tokens to it in Pavlovia."
            : `Upload successful! ${
                offerPilotingOption
                  ? "You can go to Pavlovia and set it to PILOTING or RUNNING mode."
                  : "Setting mode to RUNNING ..."
              }`}
        </p>
        <div className="link-set">
          <div className="link-set-buttons">
            {isRunning && pavloviaIsReady && (
              <button
                className="button-grey button-small"
                onClick={() => {
                  window.open(this._getPavloviaExperimentUrl(), "_blank");
                }}
              >
                Try the experiment in RUNNING mode
              </button>
            )}

            {isRunning && !pavloviaIsReady && (
              <button
                className="button-grey button-small"
                onClick={async (e) => {
                  e.target.classList.add("button-disabled");
                  e.target.classList.add("button-wait");
                  this.checkPavloviaReady();
                  e.target.classList.remove("button-disabled");
                  e.target.classList.remove("button-wait");
                }}
              >
                Refresh experiment status
              </button>
            )}

            {!isRunning && (
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

                    if (result === "RUNNING")
                      this.setState({ status: "RUNNING" });
                    else {
                      await this.setModeToRun();
                    }

                    e.target.classList.remove("button-disabled");
                    e.target.classList.remove("button-wait");
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
              title={"Why go to Pavlovia?"}
              text={`Scientists in a university with a Pavlovia site license won't need the "Go to Pavlovia" button. Without that license, you have two ways to run your experiment. For free, you can go to Pavlovia and run your experiment in PILOTING mode. Or you can buy tokens from Pavlovia, assign some to this experiment, and run it in RUNNING mode. (Every time you compile, it's a new experiment. Tokens don't transfer automatically.) Pavlovia currently charges 20 pence per participant. PILOTING mode is strictly local. For online testing, you need RUNNING mode.`}
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
              href={this._getPavloviaExperimentUrl()}
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
