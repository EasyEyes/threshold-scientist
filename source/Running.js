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
  downloadCommonResources,
  getRetryDelayMs,
  getAllProjects,
} from "../threshold/preprocess/gitlabUtils";
import { captureError } from "./sentry";

import "./css/Running.scss";
import Dropdown from "./components/Dropdown";

export default class Running extends Component {
  constructor(props) {
    super(props);

    this.state = {
      pavloviaIsReady:
        props.viewingPreviousExperiment || props.experimentStatus === "RUNNING",
      completionCode: undefined,
      dataFolderLength: 0,
      latestDateForDataCollection: false,
      useLowercaseProjectName: false,
    };

    this._isActivating = false;
    this.setModeToRun = this.setModeToRun.bind(this);
  }

  async componentDidMount() {
    this.props.scrollToCurrentStep();

    const [dataFolderLength, latestDateForDataCollection] =
      await getDataFolderCsvLength(
        this.props.user,
        this.props.activeExperiment,
      );
    this.setState({ dataFolderLength, latestDateForDataCollection });

    // get total compile counts
    get(ref(db, "compileCounts/")).then((snapshot) => {
      const compileCounts = snapshot.val();
      // sum all values
      const totalCompileCounts =
        Object.values(compileCounts).reduce((a, b) => a + b, 0) + 1;
      this.props.functions.handleSetCompileCount(totalCompileCounts);
    });
    console.log(this.props);
    await this.setModeToRun();
  }

  async componentDidUpdate(prevProps) {
    if (this.props.activeExperiment !== prevProps.activeExperiment) {
      const [dataFolderLength, latestDateForDataCollection] =
        await getDataFolderCsvLength(
          this.props.user,
          this.props.activeExperiment,
        );
      this.setState({ dataFolderLength, latestDateForDataCollection });
    }

    const needSetModeToRun =
      // this.props.name === "running" &&
      (this.props.viewingPreviousExperiment &&
        this.props.previousExperimentViewed.previousExperimentStatus ===
          "INACTIVE") ||
      (!this.props.viewingPreviousExperiment &&
        this.props.experimentStatus === "INACTIVE");
    // &&
    // this.props.newRepo !== null;
    if (needSetModeToRun) {
      await this.setModeToRun();
    }
  }

  async setModeToRun(e = null) {
    if (this._isActivating) {
      return;
    }
    this._isActivating = true;
    try {
      await Swal.fire({
        title: "Activating ...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: async () => {
          Swal.showLoading(null);
          getAllProjects(this.props.user).then((updatedProjects) => {
            this.props.functions.handleSetProjectList(updatedProjects);
          });
          const { user, activeExperiment, newRepo, functions } = this.props;
          const result = await runExperiment(
            user,
            activeExperiment,
            user.currentExperiment.experimentUrl,
          );
          if (result && result.newStatus === "RUNNING") {
            await this.waitForPavloviaReady();
            if (e !== null) e.target.removeAttribute("disabled");
          }
          Swal.close();
        },
      });
    } catch (error) {
      captureError(error, "Failed to setModeToRun", {
        step: "setModeToRun",
        info: "Experiment Activation",
      });
    } finally {
      this._isActivating = false;
    }
  }

  _getPavloviaExperimentUrl() {
    const projectName = this.state.useLowercaseProjectName
      ? this.props.projectName.toLowerCase()
      : this.props.projectName;
    return `https://run.pavlovia.org/${this.props.user.username}/${projectName}`;
  }

  async waitForPavloviaReady(
    maxTries = 60,
    delay = 1000,
    initialDelayMs = 5000,
  ) {
    const { newRepo, functions } = this.props;

    // Wait for Pavlovia deployment before first check
    if (initialDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, initialDelayMs));
    }

    for (let tries = 0; tries < maxTries; tries++) {
      try {
        const silentMode = tries !== maxTries - 1;
        await this.checkPavloviaReady(silentMode);
        if (newRepo) {
          functions.handleSetExperimentStatus("RUNNING");
        } else {
          functions.handleSetPrevExperimentStatus("RUNNING");
        }
        return;
      } catch (error) {
        if (tries === maxTries - 1) {
          captureError(error, "Pavlovia Readiness Check", {
            step: "checkPavloviaReady",
            tries: tries,
            maxTries: maxTries,
          });
        }
        if (tries !== maxTries - 1) {
          await new Promise((res) => setTimeout(res, delay));
        }
      } finally {
        await new Promise((resolve) =>
          setTimeout(resolve, getRetryDelayMs(tries)),
        );
      }
    }
    throw new Error(
      `Failed to verify Pavlovia is ready, after ${maxTries} attempts`,
    );
  }

  checkPavloviaReady(silentMode = false) {
    return new Promise((resolve, reject) => {
      fetch(this._getPavloviaExperimentUrl())
        .then((response) => response.text())
        .then((data) => {
          if (data.includes("403")) {
            if (this.state.pavloviaIsReady)
              this.setState({
                pavloviaIsReady: false,
              });
            reject(new Error("403 - Forbidden"));
          } else if (data.includes("404")) {
            if (this.state.pavloviaIsReady)
              this.setState({
                pavloviaIsReady: false,
                useLowercaseProjectName: true,
              });
            else if (!this.state.useLowercaseProjectName)
              this.setState({
                useLowercaseProjectName: true,
              });
            if (!silentMode) {
              Swal.fire({
                icon: "error",
                title: `Experiment unavailable`,
                text: `Pavlovia makes each experiment unavailable unless you either have an institutional license or you have assigned tokens to that experiment, and the experiment is in the RUNNING state. If this is due to temporary internet outage, you might succeed if you try again.`,
                confirmButtonColor: "#666",
              });
            }
            reject(new Error("404 - Experiment Unavailable"));
          } else {
            if (!this.state.pavloviaIsReady)
              this.setState({
                pavloviaIsReady: true,
              });
            resolve();
          }
        })
        .catch((error) => {
          captureError(error, "Pavlovia Availability Check", {
            step: "isPavloviaAvailable",
          });
          if (this.state.pavloviaIsReady)
            this.setState({ pavloviaIsReady: false });
          reject(error);
        });
    });
  }

  getProlificStudyStatus = async () => {
    const { prolificToken, user, activeExperiment } = this.props;
    await this.props.functions.getProlificStudySubmissionDetails(
      user,
      prolificToken,
      activeExperiment?.id,
    );
  };

  goToProlificOnClick = async (user, repoId) => {
    let link = "https://app.prolific.com/researcher/studies/active";
    const studyId = await getProlificStudyId(user, repoId);
    if (studyId) {
      link = `https://app.prolific.com/researcher/workspaces/studies/${studyId}/submissions`;
    }
    window.open(link, "_blank");
  };

  render() {
    const {
      user,
      prolificToken,
      projectName,
      activeExperiment,
      functions,
      experimentStatus,
      previousExperimentViewed: {
        previousRecruitmentInformation,
        previousExperimentStatus,
      },
      viewingPreviousExperiment,
    } = this.props;
    const {
      pavloviaIsReady,
      completionCode,
      dataFolderLength,
      latestDateForDataCollection,
    } = this.state;
    const isRunning = viewingPreviousExperiment
      ? previousExperimentStatus === "RUNNING"
      : experimentStatus === "RUNNING";

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
      extraStyle = {},
    ) => (
      <button
        className={`button-grey button-small`}
        onClick={() => {
          window.open(
            `https://pavlovia.org/${user.username}/${
              this.state.useLowercaseProjectName
                ? projectName.toLowerCase()
                : projectName
            }`,
            "_blank",
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
            : viewingPreviousExperiment
            ? "Experiment not running. Please go to Pavlovia to set it to RUNNING mode."
            : `Local. Upload successful! ${
                offerPilotingOption
                  ? "You can go to Pavlovia and set it to PILOTING or RUNNING mode."
                  : "Setting mode to RUNNING ..."
              }`}
        </div>
        <div style={{ marginTop: "8px", marginBottom: "10px" }}>
          <span
            style={{
              display: "flex",
              justifyContent: "flex-start",
              gap: "0.3rem",
            }}
          >
            <Dropdown
              selected={this.props.activeExperiment}
              setSelectedProject={
                this.props.functions.handleSetActivateExperiment
              }
              projectList={this.props.user.projectList}
              newExperimentProjectName={this.props.projectName}
              style={{
                padding: "0.3rem 1rem",
                backgroundColor: "#999",
              }}
              user={this.props.user}
              pavloviaIsReady={this.state.pavloviaIsReady}
            />
          </span>
        </div>
        <div className="link-set">
          <div className="link-set-buttons">
            {isRunning && pavloviaIsReady && (
              <button
                id="new-button"
                className="button-large-font button-grey resource-button"
                style={{
                  fontSize: "1rem",
                  color: "#fff",
                  fontWeight: "unset",
                }}
                onClick={() => {
                  this.props.functions.handleSetActivateExperiment("REFRESH");
                  document.getElementById("new-button").style.visibility =
                    "hidden";
                }}
              >
                {" "}
                New{" "}
              </button>
            )}

            {isRunning && pavloviaIsReady && (
              <>
                <button
                  className="button-green button-large-font"
                  onClick={() => {
                    window.open(this._getPavloviaExperimentUrl(), "_blank");
                  }}
                >
                  Run
                </button>
              </>
            )}

            {isRunning && pavloviaIsReady && (
              <button
                className="button-large-font button-grey resource-button"
                style={{
                  fontSize: "1rem",
                  color: "#fff",
                }}
                onClick={async () => {
                  await downloadCommonResources(
                    user,
                    activeExperiment.id,
                    activeExperiment.name,
                  );
                }}
              >
                Export
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
                  {},
                )}
                <button
                  className="button-grey button-small"
                  onClick={async (e) => {
                    e.target.classList.add("button-disabled");
                    e.target.classList.add("button-wait");
                    const result = await getExperimentStatus(
                      user,
                      activeExperiment,
                    );

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
              text={`
                <p>The "Go to Pavlovia" button takes you to the Pavlovia dashboard for the current repository. If the EasyEyes compiler seems stuck, you might learn something helpful by looking at the Pavlovia dashboard.</p>

                <p>There are four ways to run your Pavlovia experiment:</p>

                <p><strong>1. LICENSED. RUNNING WITH LICENSE.</strong> We recommend having a Pavlovia license. Scientists using EasyEyes with a Pavlovia license hardly ever visit Pavlovia. You already have a Pavlovia license if your university pays for a site license. Otherwise, EasyEyes has a Pavlovia site license that we can add your email to, at no charge:<br/>
                Write to Denis &lt;denis.pelli@nyu.edu&gt; and Sasha &lt;aleksandra.igdalova@gmail.com&gt; with Subject:<br/>
                <strong>"EasyEyes Pavlovia license"</strong><br/>
                Use the same email address for the license as you use to log into Pavlovia.</p>

                <p><strong>2. UNLICENSED. PILOTING.</strong> Without that license, you have two ways to run your experiment. For free, you can go to Pavlovia and run your experiment in PILOTING mode, which is strictly local, not online. For online testing, you need RUNNING mode.</p>

                <p><strong>3. UNLICENSED. RUNNING WITH TOKENS.</strong> Or you can buy tokens from Pavlovia, assign some to this experiment, and run it in RUNNING mode. Pavlovia currently charges 20 pence per participant.</p>

                <p><strong>4. UNLICENSED. RUNNING WITH TOKENS. REUSING OLD REPOSITORY.</strong> Normally, every time you compile, it's a new experiment. Tokens don't transfer automatically to a new experiment, so you have to assign tokens to each new experiment, every time you compile. To minimize this hassle, EasyEyes allows you to set<br/>
                <code>_pavloviaNewExperimentBool = FALSE</code><br/>
                In that case, the EasyEyes compiler will reuse the most recent repository for this experiment spreadsheet. Thus any assigned tokens will remain assigned to the current experiment, saving you a trip to Pavlovia. However, all your data from multiple versions of the experiment will all share one repository. Every download of results will download all the data. And you won't be able to go back to an old version.</p>
              `}
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
                      className="button-green button-large-font"
                      onClick={async (e) => {
                        e.target.classList.add("button-disabled");
                        e.target.classList.add("button-wait");

                        // Handle preexisting prolific study
                        const existingStudyId = await getProlificStudyId(
                          user,
                          activeExperiment?.id,
                        );
                        if (existingStudyId) {
                          // Study already exists, open it
                          window
                            .open(
                              "https://app.prolific.com/researcher/workspaces/studies/" +
                                existingStudyId,
                              "_blank",
                            )
                            ?.focus();
                          e.target.classList.remove("button-disabled");
                          e.target.classList.remove("button-wait");
                          return;
                        }

                        // ! generate completion code
                        const hasCompletionCode = !!completionCode;
                        const {
                          code,
                          incompatibleCompletionCode,
                          abortedCompletionCode,
                        } =
                          completionCode ??
                          (await generateAndUploadCompletionURL(
                            user,
                            activeExperiment,
                            functions.handleUpdateUser,
                          ));
                        if (!hasCompletionCode)
                          this.setState({
                            completionCode: code,
                          });

                        // ! create draft study on prolific
                        const result = await prolificCreateDraft(
                          user,
                          `${this.props.projectName}`,
                          code,
                          incompatibleCompletionCode,
                          abortedCompletionCode,
                          prolificToken,
                        );

                        if (result.status === "UNPUBLISHED") {
                          window
                            .open(
                              "https://app.prolific.com/researcher/workspaces/studies/" +
                                result.id,
                              "_blank",
                            )
                            ?.focus();
                          await createProlificStudyIdFile(
                            activeExperiment,
                            user,
                            result.id,
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
                      await this.goToProlificOnClick(
                        user,
                        activeExperiment?.id,
                      );
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
              <div className="link-set-buttons">
                <button
                  className="button-grey button-small button-download"
                  onClick={async () => {
                    const prolificStudyId = await getProlificStudyId(
                      user,
                      activeExperiment?.id,
                    );
                    await downloadDataFolder(
                      user,
                      activeExperiment,
                      prolificStudyId,
                      prolificToken,
                      downloadDemographicData,
                    );
                  }}
                >
                  Download results
                </button>

                <button
                  className="button-grey button-small button-analyze"
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

                <span className="csv-ready">
                  {`${dataFolderLength}`} CSV file(s){" "}
                  {latestDateForDataCollection !== false
                    ? "as of " + latestDateForDataCollection
                    : ""}
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
                    const [dataFolderLength, latestDateForDataCollection] =
                      await getDataFolderCsvLength(
                        this.props.user,
                        this.props.activeExperiment,
                      );
                    this.setState({
                      dataFolderLength,
                      latestDateForDataCollection,
                    });
                    await this.getProlificStudyStatus();
                    const result = await getExperimentStatus(
                      user,
                      activeExperiment,
                    );
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

        <div
          style={{
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "0.5rem",
            padding: "1rem",
            marginTop: "1rem",
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: "bold",
              color: "#856404",
              marginBottom: "0.5rem",
            }}
          >
            ⚠️ WARNING. February 10, 2026.
          </div>
          <div style={{ color: "#856404", lineHeight: "1.5" }}>
            Today Prolific changed their API, no longer accepting
            &quot;eligibility_requirements&quot;, and it will take a few days to update
            EasyEyes to this API change. Until then, when you use the
            &quot;Create Prolific study&quot; button, the EasyEyes compiler will
            ignore your study&apos;s settings of the EasyEyes parameters below.
            You can set them manually in Prolific.
          </div>
          <ul
            style={{
              marginTop: "0.5rem",
              fontFamily: "monospace",
              fontSize: "0.95rem",
              paddingLeft: "1.5rem",
            }}
          >
            <li style={{ color: "#856404" }}>_online3PhoneOperatingSystem</li>
            <li style={{ color: "#856404" }}>_online4Location</li>
            <li style={{ color: "#856404" }}>_online5CochlearImplant</li>
            <li style={{ color: "#856404" }}>_online5Dyslexia</li>
            <li style={{ color: "#856404" }}>_online5HearingDifficulties</li>
            <li style={{ color: "#856404" }}>_online5LanguageFirst</li>
            <li style={{ color: "#856404" }}>_online5LanguageFluent</li>
            <li style={{ color: "#856404" }}>_online5LanguagePrimary</li>
            <li style={{ color: "#856404" }}>
              _online5LanguageRelatedDisorders
            </li>
            <li style={{ color: "#856404" }}>
              _online5MusicalInstrumentExperience
            </li>
            <li style={{ color: "#856404" }}>_online5Vision</li>
            <li style={{ color: "#856404" }}>_online5VisionCorrection</li>
            <li style={{ color: "#856404" }}>_online5VRExperiences</li>
            <li style={{ color: "#856404" }}>_online5VRHeadset</li>
            <li style={{ color: "#856404" }}>_online5VRHeadsetUsage</li>
          </ul>
        </div>
      </>
    );
  }
}
