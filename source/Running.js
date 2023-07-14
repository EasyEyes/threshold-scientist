import React, { Component } from "react";
import { get, ref } from "firebase/database";
import Swal from "sweetalert2";

import { Question } from "./components";
import { db } from "./components/firebase";
import {
  prolificCreateDraft,
  downloadDemographicData,
} from "./components/prolificIntegration";
import {
  downloadDataFolder,
  generateAndUploadCompletionURL,
  getDataFolderCsvLength,
  getExperimentStatus,
  runExperiment,
  createProlificStudyIdFile,
  getProlificStudyId,
} from "../threshold/preprocess/gitlabUtils";

import "./css/Running.scss";

export default class Running extends Component {
  constructor(props) {
    super(props);

    this.state = {
      pavloviaIsReady:
        props.previousExperiment || props.experimentStatus === "RUNNING",
      completionCode: undefined,
      dataFolderLength: 0,
    };

    this.setModeToRun = this.setModeToRun.bind(this);
  }

  async componentDidMount() {
    this.props.scrollToCurrentStep();

    const dataFolderLength = await getDataFolderCsvLength(
      this.props.user,
      this.props.newRepo
    );
    this.setState({ dataFolderLength });

    // get total compile counts
    get(ref(db, "compileCounts/")).then((snapshot) => {
      const compileCounts = snapshot.val();
      // sum all values
      const totalCompileCounts =
        Object.values(compileCounts).reduce((a, b) => a + b, 0) + 1;
      this.props.functions.handleSetCompileCount(totalCompileCounts);
    });

    if (
      !this.props.previousExperiment &&
      this.props.user.currentExperiment.pavloviaPreferRunningModeBool
    )
      this.setModeToRun();
  }

  async componentDidUpdate(prevProps) {
    if (this.props.newRepo !== prevProps.newRepo) {
      const dataFolderLength = await getDataFolderCsvLength(
        this.props.user,
        this.props.newRepo
      );
      this.setState({ dataFolderLength });
    }
  }

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

  getProlificStudyStatus = async () => {
    const { prolificToken, user, newRepo } = this.props;
    await this.props.functions.getProlificStudySubmissionDetails(
      user,
      prolificToken,
      newRepo?.id
    );
  };

  goToProlificOnClick = async (user, repoId) => {
    let link = "https://app.prolific.co/researcher/studies/active";
    const studyId = await getProlificStudyId(user, repoId);
    if (studyId) {
      link = `https://app.prolific.co/researcher/workspaces/studies/${studyId}/submissions`;
    }
    window.open(link, "_blank");
  };

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
    const { pavloviaIsReady, completionCode, dataFolderLength } = this.state;

    const isRunning = experimentStatus === "RUNNING";
    console.log(pavloviaIsReady, isRunning, "debug pav ready; isRunning");

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
        <div className="green-status-banner">
          {isRunning
            ? pavloviaIsReady
              ? "Experiment ready to run."
              : "Local. Experiment compiled and uploaded. Waiting for Pavlovia's approval to run ... Unless your university has a Pavlovia license, to run your new experiment, you need to assign tokens to it in Pavlovia."
            : `Local. Upload successful! ${
                offerPilotingOption
                  ? "You can go to Pavlovia and set it to PILOTING or RUNNING mode."
                  : "Setting mode to RUNNING ..."
              }`}
        </div>
        <div className="link-set">
          <div className="link-set-buttons">
            {isRunning && pavloviaIsReady && (
              <>
                <button
                  className="button-green button-small"
                  onClick={() => {
                    window.open(this._getPavloviaExperimentUrl(), "_blank");
                  }}
                >
                  Run here
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

        {hasRecruitmentService && isRunning && (
          <>
            <div className="recruit-service">
              <div className="link-set">
                <div
                  className="link-set-buttons"
                  style={{
                    flexDirection: "row",
                  }}
                >
                  <>
                    <button
                      className="button-green button-small"
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
                        const result = await prolificCreateDraft(
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
                          await createProlificStudyIdFile(
                            newRepo,
                            user,
                            result.id
                          );
                        }
                        e.target.classList.remove("button-disabled");
                        e.target.classList.remove("button-wait");
                      }}
                    >
                      Create {recruitName} study to run online
                    </button>
                  </>
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
                    style={smallButtonExtraStyle}
                    onClick={async () => {
                      await this.goToProlificOnClick(user, newRepo?.id);
                    }}
                  >
                    Go to {recruitName}
                  </button>
                  <Question
                    title={"Why go to Prolific?"}
                    text={`Prolific can recruit participants to take your study. 
              The EasyEyes "Create Prolific study" button creates a new study in Prolific and fills in as many fields as possible for your experiment, 
              using your experiment URL and values for _onlineXXX parameters specified in your experiment. 
              It also takes you to Prolific, allowing you to publish the study to recruit participants, 
              who Prolific will pay and charge you for. Once the study has begun, 
              you might want to use the "Go to Prolific" button to check your study's progress. 
              You'll soon be able to monitor progress here (with less detail) through a file counter next to the "Download results" button at the bottom of the page.`}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        {isRunning && pavloviaIsReady && (
          <>
            <div className="link-set">
              <div
                className="link-set-buttons"
                style={{ display: "inline-block" }}
              >
                <button
                  className="button-green button-small"
                  onClick={async () => {
                    await downloadDataFolder(user, newRepo);
                    const prolificStudyId = await getProlificStudyId(
                      user,
                      newRepo?.id
                    );
                    if (prolificStudyId) {
                      await downloadDemographicData(
                        prolificToken,
                        prolificStudyId,
                        newRepo.name
                      );
                    }
                  }}
                >
                  Download results
                </button>

                <button
                  style={{ marginLeft: "10px" }}
                  className="button-grey button-small"
                  onClick={async () => {
                    window.open(" https://easyeyes.shinyapps.io/easyeyes_app/");
                    // if (dataFolderLength == 0) {
                    //   Swal.fire({
                    //     icon: "error",
                    //     title: `No data found for ${newRepo.name}.`,
                    //     text: `We can't find any data for the experiment. This might due to an error, or the Pavlovia server is down. Please refresh the page or try again later.`,
                    //     confirmButtonColor: "#666",
                    //   });
                    // } else {
                    //   Swal.fire({
                    //     title: `Reading data ...`,
                    //     allowOutsideClick: true,
                    //     allowEscapeKey: true,
                    //     didOpen: async () => {
                    //       Swal.showLoading(null);
                    //       const dataframes = await getExperimentDataFrames(
                    //         this.props.user,
                    //         this.props.newRepo
                    //       );
                    //       displayErrorReportPopup(
                    //         dataframes,
                    //         this.props.newRepo
                    //       );
                    //       Swal.close();
                    //     },
                    //   });
                    // }
                  }}
                >
                  Analyze
                </button>

                <span style={{ marginLeft: "10px" }}>
                  {`${dataFolderLength}`} CSV file(s) ready
                </span>
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
                  style={smallButtonExtraStyle}
                  onClick={async () => {
                    const {
                      user,
                      activeExperiment,
                      previousExperimentViewed,
                      projectName,
                    } = this.props;
                    const dataFolderLength = await getDataFolderCsvLength(
                      this.props.user,
                      this.props.newRepo
                    );
                    this.setState({ dataFolderLength });
                    await this.getProlificStudyStatus();
                    const result = await getExperimentStatus(user, newRepo);
                    functions.handleSetExperimentStatus(result);
                  }}
                >
                  Refresh
                </button>

                <Question
                  title={"Refresh button"}
                  text={`Every 10 sec, EasyEyes counts the number of result files ready for download from Pavlovia and checks the status of the Prolific study, if any. Press Refresh to count and check now. Note that the file count can exceed the request for two reasons. Firstly, the (Pavlovia) file count includes local runs and the (Prolific) request does not. Secondly, if an experiment terminates prematurely, the participant might try again, generating several CSV files with the same Prolific ID and unique Pavlovia IDs.`}
                />
              </div>
            </div>
          </>
        )}
      </>
    );
  }
}
