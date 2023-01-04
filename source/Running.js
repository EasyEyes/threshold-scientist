import React, { Component } from "react";
import Swal from "sweetalert2";
import { Question } from "./components";
import {
  downloadDataFolder,
  generateAndUploadCompletionURL,
  getExperimentStatus,
  runExperiment,
} from "./components/gitlabUtils";

import "./css/Running.scss";

export default class Running extends Component {
  constructor(props) {
    super(props);

    this.state = {
      pavloviaIsReady: false,
      completionCode: undefined,
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
    const { user, newRepo, functions } = this.props;

    const result = await runExperiment(
      user,
      newRepo,
      user.currentExperiment.experimentUrl
    );

    if (result && result.newStatus === "RUNNING") {
      if (e !== null) e.target.removeAttribute("disabled");
      functions.handleSetExperimentStatus("RUNNING");

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
        if (data.includes("403")) {
          if (this.state.pavloviaIsReady)
            this.setState({
              pavloviaIsReady: false,
            });
        } else if (data.includes("404")) {
          if (this.state.pavloviaIsReady)
            this.setState({
              pavloviaIsReady: false,
            });
          Swal.fire({
            icon: "error",
            title: `Experiment Unavailable`,
            text: `Pavlovia makes each experiment unavailable unless you either have an institutional license or you have assigned tokens to that experiment, and the experiment is in the RUNNING state. If this is due to temporary internet outage, you might succeed if you try again.`,
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
    const { user, projectName, newRepo, functions, experimentStatus } =
      this.props;
    const { completionCode } = this.state;

    const isRunning = experimentStatus === "RUNNING";
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
              <>
                <button
                  className="button-grey button-small"
                  onClick={() => {
                    window.open(this._getPavloviaExperimentUrl(), "_blank");
                  }}
                >
                  Try the experiment in RUNNING mode
                </button>
                <button
                  className="button-grey button-small"
                  onClick={async () => {
                    await downloadDataFolder(user, newRepo);
                  }}
                >
                  Download experiment data
                </button>
              </>
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
                      functions.handleSetExperimentStatus("RUNNING");
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

        {/* {isRunning && (
          <p
            style={{
              fontSize: "1rem",
            }}
          >
            Your experiment URL:{" "}
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
        )} */}

        {hasRecruitmentService && isRunning && (
          <>
            <hr />
            <div
              className="recruit-service"
              style={{
                marginTop: "1.6rem",
              }}
            >
              <p>
                Use {recruitName} to recruit participants.
                {user.currentExperiment.prolificWorkspaceModeBool ? (
                  <>
                    {`(You are using `}
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
                  </>
                ) : (
                  ""
                )}
              </p>
              <div className="link-set">
                <div
                  className="link-set-buttons"
                  style={{
                    flexDirection: "row",
                  }}
                >
                  <>
                    {completionCode ? (
                      <button
                        className="button-grey button-small"
                        onClick={async () => {
                          // this.state.completionCode = await generateAndUploadCompletionURL(
                          //   user,
                          //   newRepo,
                          //   functions.handleUpdateUser
                          // );

                          const studyParams =
                            "?external_study_url=" +
                            encodeURIComponent(
                              user.currentExperiment.experimentUrl
                            ) +
                            "&completion_code=" +
                            encodeURIComponent(completionCode) +
                            "&completion_option=url" +
                            "&prolific_id_option=url_parameters";

                          // hardcoded for Prolific
                          const url = user.currentExperiment
                            .prolificWorkspaceModeBool
                            ? `https://app.prolific.co/researcher/workspaces/projects/${user.currentExperiment.prolificWorkspaceProjectId}/new-study${studyParams}`
                            : `https://app.prolific.co/studies/new${studyParams}`;

                          window.open(url, "_blank");
                        }}
                      >
                        Go to {recruitName} to finalize and run your study
                      </button>
                    ) : (
                      <button
                        className="button-grey button-small"
                        onClick={async () => {
                          const code = await generateAndUploadCompletionURL(
                            user,
                            newRepo,
                            functions.handleUpdateUser
                          );
                          this.setState({
                            completionCode: code,
                          });
                        }}
                      >
                        Generate completion code
                      </button>
                    )}
                  </>

                  <button
                    className="button-grey button-small"
                    onClick={() => {
                      window.open(
                        user.currentExperiment.prolificWorkspaceModeBool
                          ? `https://app.prolific.co/researcher/workspaces/projects/${user.currentExperiment.prolificWorkspaceProjectId}/active`
                          : "https://app.prolific.co/researcher/studies/active",
                        "_blank"
                      );
                    }}
                  >
                    Go to {recruitName} to view active studies
                  </button>
                </div>
              </div>
              {completionCode ? (
                <>
                  <p className="smaller-text">
                    Click to copy the Prolific study URL{" "}
                    <span
                      className="text-copy"
                      onClick={
                        // copy to clipboard
                        () => {
                          navigator.clipboard.writeText(
                            user.currentExperiment.experimentUrl
                          );
                        }
                      }
                    >
                      {user.currentExperiment.experimentUrl}
                    </span>
                    .
                  </p>
                  <p className="smaller-text">
                    The completion code is{" "}
                    <span
                      className="text-copy"
                      onClick={
                        // copy to clipboard
                        () => {
                          navigator.clipboard.writeText(completionCode);
                        }
                      }
                    >
                      {completionCode}
                    </span>
                    .
                  </p>
                </>
              ) : (
                <p
                  style={{
                    fontSize: "1rem",
                  }}
                >
                  Please generate the completion code to view the Prolific study
                  URL.
                </p>
              )}
            </div>
          </>
        )}
      </>
    );
  }
}
