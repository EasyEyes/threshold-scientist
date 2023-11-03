import React, { Component, Suspense } from "react";
import { set, ref, get } from "firebase/database";
import { uuidv4 } from "@firebase/util";
import Swal from "sweetalert2";

import Step from "./Step";
const Glossary = React.lazy(() => import("./Glossary"));

// import StatusBar from "./StatusBar";
import StatusLines from "./StatusLines";

import { allSteps } from "./components/steps";
import {
  getAllProjects,
  getCompatibilityRequirementsForProject,
  getExperimentStatus,
  getOriginalFileNameForProject,
  getRecruitmentServiceConfig,
  getDurationForProject,
  getProlificStudyId,
} from "../threshold/preprocess/gitlabUtils";
import { auth, db } from "./components/firebase";
import {
  getProlificAccount,
  getProlificStudySubmissions,
} from "./components/prolificIntegration";

import { getCompatibilityRequirements } from "../threshold/components/compatibilityCheck";
import { compatibilityRequirements } from "../threshold/preprocess/global";

import "./css/App.scss";
import { signInAnonymously } from "firebase/auth";

export default class App extends Component {
  constructor(props) {
    super(props);

    this.allSteps = allSteps();

    this.state = {
      websiteRepoLastCommitDeploy: null,
      websiteRepoLastCommitURL: null,
      readingGlossary: false,
      /* -------------------------------------------------------------------------- */
      activeExperiment: "new",
      previousExperimentViewed: {
        originalFileName: null,
        previousExperimentStatus: null,
        previousRecruitmentInformation: {
          recruitmentServiceName: null,
          recruitmentServiceCompletionCode: null,
          recruitmentServiceURL: null,
          recruitmentProlificWorkspace: null,
        },
        previousCompatibilityRequirements: null,
        previousExperimentDuration: null,
      },
      /* -------------------------------------------------------------------------- */
      currentStep: "login", // 'login', 'table', 'upload', 'running', 'deploy', ('download')
      completedSteps: [],
      futureSteps: [...this.allSteps].slice(1),
      // USER
      user: null,
      accessToken: null,
      prolificToken: null,
      prolificAccount: null,
      resources: {
        fonts: [],
        forms: [],
        texts: [],
        folders: [],
        code: [],
      },
      filename: null,
      projectName: null,
      newRepo: null,
      experimentStatus: "INACTIVE",
      compatibilityRequirements: compatibilityRequirements.t,
      compatibilityLanguage: "en-US",
      previousExperimentDuration: null,
      prolificStudyStatus: "",
      totalCompileCounts: 0,
    };

    this.functions = {
      handleSetCompatibilityLanguage:
        this.handleSetCompatibilityLanguage.bind(this),
      handleSetCompatibilityRequirements:
        this.handleSetCompatibilityRequirements.bind(this),
      handleSetActivateExperiment: this.handleSetActivateExperiment.bind(this),
      handleReset: this.handleReset.bind(this),
      handleNextStep: this.handleNextStep.bind(this),
      handleReturnToStep: this.handleReturnToStep.bind(this),
      handleUpdateUser: this.handleUpdateUser.bind(this),
      handleLogin: this.handleLogin.bind(this),
      handleUploadProlificToken: this.handleUploadProlificToken.bind(this),
      handleAddResources: this.handleAddResources.bind(this),
      handleSetFilename: this.handleSetFilename.bind(this),
      handleSetProjectName: this.handleSetProjectName.bind(this),
      handleSetExperiment: this.handleSetExperiment.bind(this),
      handleGetNewRepo: this.handleGetNewRepo.bind(this),
      handleSetExperimentStatus: this.handleSetExperimentStatus.bind(this),
      handleSetExperimentDuration: this.handleSetExperimentDuration.bind(this),
      getProlificStudySubmissionDetails:
        this.getProlificStudySubmissionDetails.bind(this),
      /* -------------------------------------------------------------------------- */
      handleUpdateCompileCount: this.handleUpdateCompileCount.bind(this),
      handleSetCompileCount: this.handleSetCompileCount.bind(this),
    };

    this.closeGlossary = this.closeGlossary.bind(this);
  }

  async componentDidMount() {
    // get the actual changes from GitHub
    const websiteGitHubRepo = await fetch(
      "https://api.github.com/repos/EasyEyes/website/commits"
    );
    websiteGitHubRepo.json().then((data) => {
      this.setState({
        websiteRepoLastCommitURL: data[0].html_url,
      });
    });

    // get the deployed time from Netlify
    const websiteNetlifySite = await fetch(
      "https://api.netlify.com/api/v1/sites/7ef5bb5a-2b97-4af2-9868-d3e9c7ca2287/"
    );
    websiteNetlifySite.json().then((data) => {
      this.setState({
        websiteRepoLastCommitDeploy: data.published_deploy.published_at,
      });
    });

    // auth anonymous user for firebase
    signInAnonymously(auth)
      .then(() => {
        // get total compile counts
        get(ref(db, "compileCounts/")).then((snapshot) => {
          const compileCounts = snapshot.val();
          // sum all values
          const totalCompileCounts =
            Object.values(compileCounts).reduce((a, b) => a + b, 0) + 1;
          this.setState({ totalCompileCounts });
        });
      })
      .catch((error) => {
        console.log(error);
      });
  }

  /* -------------------------------------------------------------------------- */

  async handleSetActivateExperiment(activeExperiment) {
    activeExperiment = activeExperiment || "new";

    if (activeExperiment === "REFRESH") {
      await this.handleReturnToStep("table");
      this.handleSetFilename(null);
      this.handleSetProjectName(null);
      this.handleSetCompatibilityRequirements("");
      this.handleSetExperimentDuration(null);
      this.handleSetExperimentStatus("INACTIVE");
      this.functions.handleSetActivateExperiment("new");

      return;
    }

    let originalFileName = null;
    let previousExperimentStatus = null;
    let previousRecruitmentInformation = {
      recruitmentServiceName: null,
      recruitmentServiceCompletionCode: null,
      recruitmentServiceURL: null,
      recruitmentProlificWorkspace: null,
    };
    let previousCompatibilityRequirements = null;
    let previousExperimentDuration = null;
    if (activeExperiment !== "new") {
      // viewing a previous experiment
      const { user } = this.state;

      await Swal.fire({
        title: "Retrieving experiment ...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: async () => {
          Swal.showLoading(null);
          previousExperimentDuration = await getDurationForProject(
            user,
            activeExperiment.name
          );
          previousCompatibilityRequirements =
            await getCompatibilityRequirementsForProject(
              user,
              activeExperiment.name
            );
          originalFileName = await getOriginalFileNameForProject(
            user,
            activeExperiment.name
          );
          previousExperimentStatus = await getExperimentStatus(user, {
            id: activeExperiment.id,
          });
          previousRecruitmentInformation = await getRecruitmentServiceConfig(
            user,
            activeExperiment.name
          );

          Swal.close();
        },
      });
      this.setState({
        activeExperiment,
        previousExperimentViewed: {
          originalFileName,
          previousExperimentStatus,
          previousRecruitmentInformation,
          previousCompatibilityRequirements: previousCompatibilityRequirements,
          previousExperimentDuration,
        },
        compatibilityLanguage: "en-US",
      });
    } else {
      await Swal.fire({
        title: "Getting ready ...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: async () => {
          Swal.showLoading(null);
          this.setState({
            activeExperiment,
            previousExperimentViewed: {
              originalFileName,
              previousExperimentStatus,
              previousRecruitmentInformation,
              previousCompatibilityRequirements:
                previousCompatibilityRequirements,
              previousExperimentDuration,
            },
            compatibilityLanguage: "en-US",
          });

          Swal.close();
        },
      });
    }
  }

  /* -------------------------------------------------------------------------- */

  nextStepStatus(targetNextStep = null) {
    if (this.state.futureSteps.length === 0)
      return {
        currentStep: "",
        completedSteps: [...this.state.completedSteps, this.state.currentStep],
        futureSteps: [],
      };

    const nextStep = this.state.futureSteps[0];
    if (targetNextStep && targetNextStep !== nextStep) {
      return {
        currentStep: this.state.currentStep,
        completedSteps: [...this.state.completedSteps],
        futureSteps: [...this.state.futureSteps],
      };
    }

    return {
      currentStep: nextStep,
      completedSteps: [...this.state.completedSteps, this.state.currentStep],
      futureSteps: [...this.state.futureSteps].slice(1),
    };
  }

  /* -------------------------------------------------------------------------- */

  handleReset() {
    this.setState({
      currentStep: "login",
      completedSteps: [],
      futureSteps: [...this.allSteps].slice(1),
      user: null,
      accessToken: null,
      resources: {
        fonts: [],
        forms: [],
        texts: [],
        folders: [],
        code: [],
      },
      projectName: null,
      newRepo: null,
      compatibilityRequirements: "",
      previousExperimentDuration: null,
      prolificStudyStatus: "",
    });
  }

  handleNextStep(targetNextStep = null) {
    this.setState({
      ...this.nextStepStatus(targetNextStep),
    });
  }

  async handleReturnToStep(step) {
    if (this.state.currentStep !== step)
      this.setState({
        currentStep: step,
        completedSteps: [...this.allSteps].slice(
          0,
          this.allSteps.indexOf(step)
        ),
        futureSteps: [...this.allSteps].slice(this.allSteps.indexOf(step) + 1),
        user: {
          ...this.state.user,
          currentExperiment: {
            participantRecruitmentServiceName: "",
            participantRecruitmentServiceUrl: "",
            participantRecruitmentServiceCode: "",
            experimentUrl: "",
            // by default, we streamline the uploading process
            pavloviaOfferPilotingOptionBool: false, // deprecated
            pavloviaPreferRunningModeBool: true,
          },
          projectList: await getAllProjects(this.state.user),
        },
        projectName: null,
        newRepo: null,
        compatibilityRequirements: "",
      });
  }

  handleUpdateUser(newUser) {
    this.setState({
      user: newUser,
    });
  }

  async handleLogin(user, resources, accessToken, prolificToken) {
    this.setState({
      user: user,
      accessToken: accessToken,
      prolificToken: prolificToken,
      prolificAccount: prolificToken
        ? await getProlificAccount(prolificToken)
        : null,
      resources: resources,
      ...this.nextStepStatus("table"),
    });
  }

  async handleUploadProlificToken(prolificToken) {
    this.setState({
      prolificToken: prolificToken,
      prolificAccount: prolificToken
        ? await getProlificAccount(prolificToken)
        : null,
    });
  }

  async getProlificStudySubmissionDetails(user, prolificToken, repoId) {
    const prolificStudyId = await getProlificStudyId(user, repoId);
    const submissionDetails = await getProlificStudySubmissions(
      prolificToken,
      prolificStudyId
    );
    this.setState({ prolificStudyStatus: submissionDetails });
  }

  handleAddResources(newResources) {
    // override the resources in the state
    this.setState({
      resources: { ...newResources },
    });
  }

  handleSetCompatibilityLanguage(
    language,
    isViewingPreviousExperiment = false
  ) {
    const parsed = isViewingPreviousExperiment
      ? compatibilityRequirements.previousParsedInfo
      : compatibilityRequirements.parsedInfo;
    const text = getCompatibilityRequirements(
      null,
      language,
      true,
      null,
      parsed
    ).compatibilityRequirements[0];
    if (!isViewingPreviousExperiment) {
      compatibilityRequirements.t = text;
      compatibilityRequirements.L = language;
      this.handleSetCompatibilityRequirements(text);
    } else {
      compatibilityRequirements.previousT = text;
      compatibilityRequirements.previousL = language;
      this.setState({
        previousExperimentViewed: {
          ...this.state.previousExperimentViewed,
          previousCompatibilityRequirements: text,
        },
      });
    }
    this.setState({
      compatibilityLanguage: language,
    });
  }
  handleSetCompatibilityRequirements(req) {
    this.setState({
      compatibilityRequirements: req,
    });
  }
  handleSetFilename(filename) {
    this.setState({
      filename: filename,
    });
  }

  handleSetProjectName(projectName) {
    this.setState({
      projectName: projectName,
    });
  }

  handleSetExperiment(experiment) {
    this.setState({
      user: {
        ...this.state.user,
        currentExperiment: {
          ...this.state.user.currentExperiment,
          ...experiment,
        },
      },
    });
  }

  handleGetNewRepo(newRepo, experimentUrl, serviceUrl) {
    // end of 'upload'
    this.setState({
      newRepo: newRepo,
      user: {
        ...this.state.user,
        currentExperiment: {
          ...this.state.user.currentExperiment,
          experimentUrl: serviceUrl,
          participantRecruitmentServiceUrl: serviceUrl,
        },
      },
      ...this.nextStepStatus("running"),
    });
  }

  handleSetExperimentStatus(newStatus) {
    this.setState({
      experimentStatus: newStatus,
    });
  }

  handleSetCompileCount(count) {
    const totalCompileCounts = count;
    this.setState({
      totalCompileCounts,
    });
  }

  handleSetExperimentDuration(newDuration) {
    this.setState({
      previousExperimentDuration: newDuration,
    });
  }

  /* -------------------------------------------------------------------------- */

  handleUpdateCompileCount() {
    const compileId = uuidv4();
    const user = this.state.user.username;

    set(ref(db, "compiles/" + compileId), {
      id: compileId,
      user: user,
      timestamp: Date.now().toString(),
      timeZone: getTimezoneName(),
    });

    // update compileCounts by 1
    get(ref(db, "compileCounts/" + user)).then((snapshot) => {
      if (snapshot.exists()) {
        const count = snapshot.val();
        set(ref(db, "compileCounts/" + user), count + 1);
      } else {
        set(ref(db, "compileCounts/" + user), 1);
      }
    });
  }

  /* -------------------------------------------------------------------------- */

  closeGlossary() {
    this.setState({
      readingGlossary: false,
    });
  }

  render() {
    const {
      websiteRepoLastCommitDeploy,
      websiteRepoLastCommitURL,
      readingGlossary,
      activeExperiment,
      previousExperimentViewed,
      currentStep,
      completedSteps,
      futureSteps,
      user,
      prolificToken,
      prolificAccount,
      resources,
      filename,
      projectName,
      newRepo,
      experimentStatus,
      prolificStudyStatus,
      totalCompileCounts,
      accessToken,
    } = this.state;
    const steps = [];

    const viewingPreviousExperiment = activeExperiment !== "new";

    // if (user) steps.push(<History key={"history"} user={user} />);

    if (viewingPreviousExperiment)
      steps.push(
        <Step
          key={"prev-running"}
          name={"prev-running"}
          isCurrentStep={true}
          isCompletedStep={false}
          futureSteps={futureSteps}
          functions={this.functions}
          user={user}
          prolificToken={prolificToken}
          resources={resources}
          projectName={activeExperiment.name}
          newRepo={activeExperiment}
          activeExperiment={activeExperiment}
          experimentStatus={
            experimentStatus ??
            previousExperimentViewed.previousExperimentStatus
          }
          previousExperimentViewed={previousExperimentViewed}
          prolificStudyStatus={prolificStudyStatus}
        />
      );
    else
      steps.push(
        <Step
          key={currentStep}
          name={currentStep}
          isCurrentStep={currentStep === currentStep}
          isCompletedStep={completedSteps.includes(currentStep)}
          futureSteps={futureSteps}
          functions={this.functions}
          user={user}
          prolificToken={prolificToken}
          resources={resources}
          projectName={projectName}
          newRepo={newRepo}
          experimentStatus={experimentStatus}
          prolificStudyStatus={prolificStudyStatus}
          activeExperiment={activeExperiment}
        />
      );

    return (
      <>
        {readingGlossary && (
          <Suspense fallback={<></>}>
            <Glossary closeGlossary={this.closeGlossary} />
          </Suspense>
        )}

        <div id="header">
          <div id="header-title">
            <h1>EasyEyes Compile</h1>
          </div>
        </div>

        {!accessToken && (
          <div className="description">
            Welcome to EasyEyes, an experiment compiler that helps you
            accurately test vision and hearing online, including crowding,
            acuity, sensitivity, and reading.
          </div>
        )}

        <Suspense>
          <div className="threshold-app">
            <StatusLines
              key={currentStep}
              activeExperiment={activeExperiment}
              previousExperimentViewed={previousExperimentViewed}
              /* -------------------------------------------------------------------------- */
              futureSteps={futureSteps}
              completedSteps={completedSteps}
              functions={this.functions}
              user={user}
              prolificToken={prolificToken}
              prolificAccount={prolificAccount}
              resources={resources}
              filename={filename}
              projectName={projectName}
              newRepo={newRepo}
              currentStep={currentStep}
              experimentStatus={experimentStatus}
              prolificStudyStatus={prolificStudyStatus}
            />
            {/* <StatusBar currentStep={currentStep} /> */}
            {steps}
          </div>

          {websiteRepoLastCommitDeploy && websiteRepoLastCommitURL && (
            <>
              <div className="copyright-info">
                <p style={{ lineHeight: "normal" }}>
                  {totalCompileCounts} experiments compiled since 1 February,
                  2023.
                  <br />
                  Compiler updated{" "}
                  <a
                    href={websiteRepoLastCommitURL}
                    style={{
                      color: "inherit",
                      textDecoration: "none",
                      fontWeight: "500",
                      borderBottom: "1px solid #ddd",
                      marginLeft: "0",
                    }}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {new Date(websiteRepoLastCommitDeploy).toLocaleDateString(
                      undefined,
                      {
                        dateStyle: "medium",
                      }
                    )}{" "}
                    {new Date(websiteRepoLastCommitDeploy).toLocaleString(
                      undefined,
                      {
                        timeStyle: "short",
                      }
                    )}{" "}
                    {getTimezoneName()}
                  </a>
                  .
                  <br />
                  Copyright © 2020 - 2023 New York University.
                  <br />
                  Created by Denis Pelli and the EasyEyes team.
                  <br />
                  <div style={{ marginTop: "5px" }}></div>
                  <a href="https://github.com/EasyEyes/threshold/stargazers">
                    <img
                      alt="GitHub stars"
                      src="https://img.shields.io/github/stars/EasyEyes/threshold?style=flat-square"
                    />
                  </a>
                  <a href="https://github.com/EasyEyes/threshold/blob/main/LICENSE">
                    <img
                      alt="GitHub license"
                      src="https://img.shields.io/github/license/EasyEyes/threshold?style=flat-square"
                    />
                  </a>
                  <a href="https://app.netlify.com/sites/easyeyes/deploys">
                    <img
                      alt="Netlify Status"
                      src="https://api.netlify.com/api/v1/badges/7ef5bb5a-2b97-4af2-9868-d3e9c7ca2287/deploy-status"
                    />
                  </a>
                </p>
              </div>
            </>
          )}
        </Suspense>
      </>
    );
  }
}

/* -------------------------------------------------------------------------- */

// https://stackoverflow.com/a/56490104
function getTimezoneName() {
  const today = new Date();
  const short = today.toLocaleDateString(undefined);
  const full = today.toLocaleDateString(undefined, { timeZoneName: "short" });

  // Trying to remove date from the string in a locale-agnostic way
  const shortIndex = full.indexOf(short);
  if (shortIndex >= 0) {
    const trimmed =
      full.substring(0, shortIndex) + full.substring(shortIndex + short.length);

    // by this time `trimmed` should be the timezone's name with some punctuation -
    // trim it from both sides
    return trimmed.replace(/^[\s,.\-:;]+|[\s,.\-:;]+$/g, "");
  } else {
    // in some magic case when short representation of date is not present in the long one, just return the long one as a fallback, since it should contain the timezone's name
    return full;
  }
}
