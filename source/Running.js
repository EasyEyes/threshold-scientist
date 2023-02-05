import React, { Component } from "react";
import { get, ref } from "firebase/database";
import Swal from "sweetalert2";

import { Question } from "./components";
import { db } from "./components/firebase";
import { prolificCreateDraftOnClick } from "./components/prolificIntegration";
import {
  downloadDataFolder,
  generateAndUploadCompletionURL,
  getExperimentStatus,
  runExperiment,
} from "./components/gitlabUtils";
import { ordinalSuffixOf } from "./components/utils";

import "./css/Running.scss";
export default class Running extends Component {
  constructor(props) {
    super(props);

    this.state = {
      pavloviaIsReady:
        props.previousExperiment || props.experimentStatus === "RUNNING",
      completionCode: undefined,
      totalCompileCounts: 0,
    };

    this.setModeToRun = this.setModeToRun.bind(this);
  }

  componentDidMount() {
    this.props.scrollToCurrentStep();

    // get total compile counts
    get(ref(db, "compileCounts/")).then((snapshot) => {
      const compileCounts = snapshot.val();
      // sum all values
      const totalCompileCounts =
        Object.values(compileCounts).reduce((a, b) => a + b, 0) + 1;
      this.setState({ totalCompileCounts });
    });

    if (
      !this.props.previousExperiment &&
      this.props.user.currentExperiment.pavloviaPreferRunningModeBool
    )
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
            title: `Experiment unavailable`,
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
    const {
      user,
      prolificToken,
      projectName,
      newRepo,
      functions,
      experimentStatus,
      previousExperimentViewed: { previousRecruitmentInformation },
      viewingPreviousExperiment,
    } = this.props;
    const { pavloviaIsReady, completionCode, totalCompileCounts } = this.state;

    const isRunning = experimentStatus === "RUNNING";

    const hasRecruitmentService = viewingPreviousExperiment
      ? previousRecruitmentInformation.recruitmentServiceName !== null
      : !!user.currentExperiment.participantRecruitmentServiceName;
    const recruitName = viewingPreviousExperiment
      ? previousRecruitmentInformation.recruitmentServiceName
      : user.currentExperiment.participantRecruitmentServiceName;

    // const offerPilotingOption =
    //   this.props.user.currentExperiment.pavloviaOfferPilotingOptionBool;
    const offerPilotingOption = viewingPreviousExperiment
      ? false
      : !this.props.user.currentExperiment.pavloviaPreferRunningModeBool;

    // const effectiveCompletionCode =
    //   viewingPreviousExperiment && hasRecruitmentService
    //     ? previousRecruitmentInformation.recruitmentServiceCompletionCode
    //     : completionCode;
    const effectiveUsingProlificWorkspace =
      viewingPreviousExperiment && hasRecruitmentService
        ? previousRecruitmentInformation.recruitmentProlificWorkspace
        : user.currentExperiment.prolificWorkspaceModeBool;

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
              ? "Local. Experiment compiled, uploaded, and in RUNNING mode, ready to run."
              : "Local. Experiment compiled and uploaded. Waiting for Pavlovia's approval to run ... Unless your university has a Pavlovia license, to run your new experiment, you need to assign tokens to it in Pavlovia."
            : `Local. Upload successful! ${
                offerPilotingOption
                  ? "You can go to Pavlovia and set it to PILOTING or RUNNING mode."
                  : "Setting mode to RUNNING ..."
              }`}
        </p>
        <p className="compile-count">
          <i className="bi bi-stars"></i>
          <span>
            The {ordinalSuffixOf(totalCompileCounts)} experiment compiled with
            EasyEyes
          </span>
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
              // style={{
              //   marginTop: "1.6rem",
              // }}
            >
              <p className="emphasize">
                Online. Use {recruitName} to recruit participants.
                {effectiveUsingProlificWorkspace ? (
                  <>
                    {` (You are using `}
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
                    <button
                      className="button-grey button-small"
                      onClick={async (e) => {
                        e.target.classList.add("button-disabled");
                        e.target.classList.add("button-wait");

                        // ! generate completion code
                        const hasCompletionCode = !!completionCode;
                        const code =
                          completionCode ??
                          (await generateAndUploadCompletionURL(
                            user,
                            newRepo,
                            functions.handleUpdateUser
                          ));

                        if (!hasCompletionCode)
                          this.setState({
                            completionCode: code,
                          });

                        // ! create draft study on prolific
                        const result = await prolificCreateDraftOnClick(
                          user,
                          `${this.props.user.username}/${this.props.projectName}`,
                          code,
                          prolificToken
                        );

                        if (result.status === "UNPUBLISHED") {
                          window
                            .open(
                              "https://app.prolific.co/researcher/workspaces/studies/" +
                                result.id,
                              "_blank"
                            )
                            ?.focus();
                        }

                        e.target.classList.remove("button-disabled");
                        e.target.classList.remove("button-wait");
                      }}
                    >
                      Create a new study on {recruitName}
                    </button>
                    {/* {effectiveCompletionCode ? (
                      
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
                    )} */}
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
              {/* {effectiveCompletionCode ? (
                <>
                  <p className="smaller-text">
                    Click to copy the Prolific study URL{" "}
                    <span
                      className="text-copy"
                      onClick={
                        // copy to clipboard
                        () => {
                          navigator.clipboard.writeText(
                            viewingPreviousExperiment
                              ? this._getPavloviaExperimentUrl() +
                                  "?participant={{%PROLIFIC_PID%}}&study_id={{%STUDY_ID%}}&session={{%SESSION_ID%}}"
                              : user.currentExperiment.experimentUrl
                          );
                        }
                      }
                    >
                      {viewingPreviousExperiment
                        ? this._getPavloviaExperimentUrl() +
                          "?participant={{%PROLIFIC_PID%}}&study_id={{%STUDY_ID%}}&session={{%SESSION_ID%}}"
                        : user.currentExperiment.experimentUrl}
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
                          navigator.clipboard.writeText(
                            effectiveCompletionCode
                          );
                        }
                      }
                    >
                      {effectiveCompletionCode}
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
              )} */}
            </div>
          </>
        )}

        {isRunning && pavloviaIsReady && (
          <>
            <hr />
            <div className="link-set-buttons">
              <button
                className="button-grey button-small"
                onClick={async () => {
                  await downloadDataFolder(user, newRepo);
                }}
              >
                Download results
              </button>
            </div>
          </>
        )}
      </>
    );
  }
}
