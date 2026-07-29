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
  getCompatibilityRequirementsForProject,
  getExperimentStatus,
  getOriginalFileNameForProject,
  getRecruitmentServiceConfig,
  getDurationForProject,
  getProlificStudyId,
  copyUser,
  getCommonResourcesNames,
} from "../threshold/preprocess/gitlabUtils";
import { getRetryDelayMs } from "../threshold/preprocess/retry";
import { resourcesFileTypes } from "../threshold/preprocess/constants";
import { auth, db } from "./components/firebase";
import {
  getProlificAccount,
  getProlificStudySubmissions,
} from "./components/prolificIntegration";

import { getCompatibilityRequirements } from "../threshold/components/compatibilityCheck";
import { compatibilityRequirements } from "../threshold/preprocess/global";

import "./css/App.scss";
import { signInAnonymously } from "firebase/auth";
import { getSoundProfileStatement } from "./components/firebase_soundProfile";
import {
  captureCompilerFailure,
  captureError,
  recordCompilerPhase,
  startCompilerOperation,
} from "./sentry";
import { getGlossaryFull } from "../threshold/parameters/glossaryRegistry";
import {
  fetchPhrasesVersion,
  fetchPhrasesByVersion,
} from "./components/phrasesApi";
import { initPhrases } from "../threshold/parameters/phrasesRegistry";
import { startGlossaryPrefetch } from "./components/glossaryApi";
import { fetchGitHubStats } from "./components/githubStatsApi";

// Utility function to create empty resources object from constants
const createEmptyResourcesObject = () => {
  const resources = {};
  resourcesFileTypes.forEach((type) => {
    resources[type] = [];
  });
  return resources;
};

// Utility function to create resources object from loaded data
const createResourcesObjectFromData = (loadedResources) => {
  const resources = {};
  resourcesFileTypes.forEach((type) => {
    resources[type] = loadedResources[type] || [];
  });
  return resources;
};

export default class App extends Component {
  constructor(props) {
    super(props);

    this.allSteps = allSteps();

    this.state = {
      websiteRepoLastCommitDeploy: null,
      websiteRepoLastCommitURL: null,
      githubStars: null,
      githubLicense: null,
      readingGlossary: false,
      phrasesError: false,
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
      resources: createEmptyResourcesObject(),
      filename: null,
      projectName: null,
      newRepo: null,
      experimentStatus: "INACTIVE",
      compatibilityRequirements: compatibilityRequirements.t,
      compatibilityLanguage: "en",
      previousExperimentDuration: null,
      prolificStudyStatus: "",
      totalCompileCounts: 0,
      profileStatement: "Loading ...",
      isCompiledFromArchiveBool: false,
      archivedZip: null,
      compileWarnings: [],
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
      handleUpdateProlificToken: this.handleUpdateProlificToken.bind(this),
      handleAddResources: this.handleAddResources.bind(this),
      handleSetFilename: this.handleSetFilename.bind(this),
      handleSetProjectName: this.handleSetProjectName.bind(this),
      handleSetExperiment: this.handleSetExperiment.bind(this),
      handleGetNewRepo: this.handleGetNewRepo.bind(this),
      handleSetExperimentStatus: this.handleSetExperimentStatus.bind(this),
      handleSetPrevExperimentStatus:
        this.handleSetPrevExperimentStatus.bind(this),
      handleArchivedExperimentBool:
        this.handleArchivedExperimentBool.bind(this),
      handleZipArchive: this.handleZipArchive.bind(this),
      handleSetExperimentDuration: this.handleSetExperimentDuration.bind(this),
      getProlificStudySubmissionDetails:
        this.getProlificStudySubmissionDetails.bind(this),
      handleSetProjectList: this.handleSetProjectList.bind(this),
      /* -------------------------------------------------------------------------- */
      handleUpdateCompileCount: this.handleUpdateCompileCount.bind(this),
      handleSetCompileCount: this.handleSetCompileCount.bind(this),
      handleSetCompileWarnings: this.handleSetCompileWarnings.bind(this),
      getprofileStatement: this.getprofileStatement.bind(this),
    };

    this.closeGlossary = this.closeGlossary.bind(this);
  }

  async componentDidMount() {
    startGlossaryPrefetch();
    // Check the latest version first (uncached), then download that specific
    // version (cached immutably in the browser), so an unchanged version is
    // not re-downloaded on subsequent visits.
    fetchPhrasesVersion()
      .then(({ version }) => {
        if (!version) throw new Error("No current phrases version");
        return fetchPhrasesByVersion(version);
      })
      .then((data) => {
        initPhrases(data);
      })
      .catch((error) => {
        console.error("Failed to load phrases:", error);
        this.setState({ phrasesError: true });
      });

    // get the GitHub footer values (latest commit URL, stars, license) via our
    // cached Netlify proxy instead of calling GitHub directly. Not critical, so
    // it degrades silently.
    fetchGitHubStats()
      .then((stats) => {
        if (!stats || stats.available === false) return;
        this.setState({
          websiteRepoLastCommitURL: stats.lastCommitUrl,
          githubStars: stats.stars,
          githubLicense: stats.license,
        });
      })
      .catch((error) => {
        console.warn("Failed to fetch GitHub stats:", error);
      });

    // get the deployed time from Netlify. Not critical, so it runs
    // fire-and-forget (no await) and degrades silently.
    fetch(
      "https://api.netlify.com/api/v1/sites/7ef5bb5a-2b97-4af2-9868-d3e9c7ca2287/",
    )
      .then((websiteNetlifySite) => {
        if (!websiteNetlifySite.ok) return;
        return websiteNetlifySite.json().then((data) => {
          this.setState({
            websiteRepoLastCommitDeploy: data.published_deploy.published_at,
          });
        });
      })
      .catch((error) => {
        // Silently fail - this is not critical for app functionality
        console.warn("Failed to fetch Netlify deployment info:", error);
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

  handleSetProjectList(projectList) {
    // Mutate directly to preserve User class prototype (spread operator loses it)
    const updatedUser = this.state.user;
    updatedUser.projectList = Promise.resolve(projectList);
    this.setState({ user: updatedUser });
  }

  async handleSetActivateExperiment(activeExperiment) {
    activeExperiment = activeExperiment || "new";
    if (activeExperiment === "REFRESH") {
      this.setState({ activeExperiment: "new" });
      this.handleSetFilename(null);
      this.handleSetProjectName(null);
      this.handleSetCompatibilityRequirements("");
      this.handleSetExperimentDuration(null);
      this.handleSetExperimentStatus("INACTIVE");
      await this.functions.handleReturnToStep("table");
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
      const retrieval = startCompilerOperation("experiment-retrieval", {
        projectId: activeExperiment.id,
        projectPath: activeExperiment.path_with_namespace,
      });

      await Swal.fire({
        title: "Retrieving study ...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: async () => {
          Swal.showLoading(null);
          const retrieveMetadata = async (phase, task) => {
            recordCompilerPhase(retrieval, phase);
            try {
              return await task();
            } catch (error) {
              captureCompilerFailure(
                error,
                retrieval,
                phase,
                {
                  projectId: activeExperiment.id,
                  responseStatus: error?.status,
                  responseStatusText: error?.statusText,
                  endpoint: error?.endpoint,
                  method: error?.method,
                },
                "external-service",
              );
              throw error;
            }
          };
          previousExperimentDuration = await retrieveMetadata(
            "duration-requested",
            () => getDurationForProject(user, activeExperiment.name),
          );
          previousCompatibilityRequirements = await retrieveMetadata(
            "compatibility-requested",
            () =>
              getCompatibilityRequirementsForProject(
                user,
                activeExperiment.name,
              ),
          );
          originalFileName = await getOriginalFileNameForProject(
            user,
            activeExperiment.name,
            retrieval,
          );
          previousExperimentStatus = await retrieveMetadata(
            "status-requested",
            () =>
              getExperimentStatus(user, {
                id: activeExperiment.id,
              }),
          );
          previousRecruitmentInformation = await retrieveMetadata(
            "recruitment-requested",
            () => getRecruitmentServiceConfig(user, activeExperiment.name),
          );
          recordCompilerPhase(retrieval, "completed", {
            originalFilePresent: Boolean(originalFileName),
          });

          Swal.close();
        },
      });
      this.setState({
        activeExperiment: activeExperiment,
        previousExperimentViewed: {
          originalFileName,
          previousExperimentStatus,
          previousRecruitmentInformation,
          previousCompatibilityRequirements: previousCompatibilityRequirements,
          previousExperimentDuration,
        },
        compatibilityLanguage: "en",
      });
    } else {
      await Swal.fire({
        title: "Getting ready ...",
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => {
          Swal.showLoading(null);
          this.setState({
            activeExperiment: activeExperiment,
            previousExperimentViewed: {
              originalFileName,
              previousExperimentStatus,
              previousRecruitmentInformation,
              previousCompatibilityRequirements:
                previousCompatibilityRequirements,
              previousExperimentDuration,
            },
            compatibilityLanguage: "en",
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
      resources: createEmptyResourcesObject(),
      projectName: null,
      newRepo: null,
      compatibilityRequirements: "",
      previousExperimentDuration: null,
      prolificStudyStatus: "",
      profileStatement: "Loading ...",
      compileWarnings: [],
    });
  }

  handleNextStep(targetNextStep = null) {
    this.setState({
      ...this.nextStepStatus(targetNextStep),
    });
  }

  async handleReturnToStep(step) {
    if (this.state.currentStep !== step) {
      // Create a fresh User instance and refresh project list
      const currentUser = this.state.user;
      const refreshedUser = copyUser(currentUser);

      // Copy existing user properties
      refreshedUser.username = currentUser.username;
      refreshedUser.name = currentUser.name;
      refreshedUser.id = currentUser.id;
      refreshedUser.avatar_url = currentUser.avatar_url;

      refreshedUser.projectList = currentUser.projectList;
      refreshedUser.initProjectList(true);

      // Reset experiment settings
      refreshedUser.currentExperiment = {
        participantRecruitmentServiceName: "",
        participantRecruitmentServiceUrl: "",
        participantRecruitmentServiceCode: "",
        experimentUrl: "",
        // by default, we streamline the uploading process
        pavloviaOfferPilotingOptionBool: false, // deprecated
        pavloviaPreferRunningModeBool: true,
      };

      this.setState({
        currentStep: step,
        completedSteps: [...this.allSteps].slice(
          0,
          this.allSteps.indexOf(step),
        ),
        futureSteps: [...this.allSteps].slice(this.allSteps.indexOf(step) + 1),
        user: refreshedUser,
        projectName: null,
        newRepo: null,
        compatibilityRequirements: "",
      });
    }
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
      prolificToken: prolificToken || null,
      prolificAccount: null, // Load asynchronously via handleUpdateProlificToken
      resources: createEmptyResourcesObject(), // Initialize with empty arrays while resources load
      resourcesLoaded: false,
      ...this.nextStepStatus("table"),
    });

    // Load resources in background and update when ready
    this.handleResourcesLoaded(resources, user);

    // Note: Prolific account loading is handled by handleUpdateProlificToken
    // when the prolificTokenPromise resolves in Login.js
  }

  handleResourcesLoaded(resourcesPromise, user, attempt = 0) {
    resourcesPromise
      .then((r) => {
        // Check if any resource type failed to fetch (null values)
        const failedTypes = Object.entries(r)
          .filter(([_, value]) => value === null)
          .map(([key, _]) => key);

        if (failedTypes.length > 0) {
          if (attempt >= 3) {
            Swal.fire({
              title: "Pavlovia server troubles",
              text: "Failed to fetch some resources. Try refreshing the page.",
              confirmButtonColor: "#666",
            });
          } else {
            // Retry with exponential backoff - keep spinner showing
            setTimeout(() => {
              const retryPromise = getCommonResourcesNames(user);
              this.handleResourcesLoaded(retryPromise, user, attempt + 1);
            }, getRetryDelayMs(attempt));
            return;
          }
        }

        this.setState({
          resources: createResourcesObjectFromData(r),
          resourcesLoaded: true,
        });
        return r;
      })
      .catch((error) => {
        // getCommonResourcesNames should always resolve (catches per-type errors internally).
        // If we're here, it's an unexpected bug.
        captureError(error, "Unexpected error loading resources", {
          type: "resources",
        });
        throw error;
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

  async handleUpdateProlificToken(prolificToken) {
    this.setState({
      prolificToken: prolificToken,
    });

    // Load prolific account in background if token exists
    if (prolificToken) {
      try {
        const account = await getProlificAccount(prolificToken);
        this.setState({ prolificAccount: account });
      } catch (error) {
        captureError(error, "Error loading prolific account", {
          type: "prolific",
        });
      }
    } else {
      this.setState({ prolificAccount: null });
    }
  }

  async getProlificStudySubmissionDetails(user, prolificToken, repoId) {
    const prolificStudyId = await getProlificStudyId(user, repoId);
    const submissionDetails = await getProlificStudySubmissions(
      prolificToken,
      prolificStudyId,
    );
    this.setState({ prolificStudyStatus: submissionDetails });
  }

  async getprofileStatement() {
    const profileStatement = await getSoundProfileStatement();
    this.setState({ profileStatement: profileStatement });
  }

  handleAddResources(newResources) {
    // override the resources in the state
    this.setState({
      resources: { ...newResources },
    });
  }

  handleSetCompatibilityLanguage(
    language,
    isViewingPreviousExperiment = false,
  ) {
    const parsed = isViewingPreviousExperiment
      ? compatibilityRequirements.previousParsedInfo
      : compatibilityRequirements.parsedInfo;
    const text = getCompatibilityRequirements(
      null,
      language,
      true,
      null,
      parsed,
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

  handleSetCompileWarnings(warnings) {
    this.setState({
      compileWarnings: Array.isArray(warnings) ? warnings : [],
    });
  }

  handleSetExperiment(experiment) {
    // Mutate directly to preserve User class prototype (spread operator loses it)
    const updatedUser = this.state.user;
    updatedUser.currentExperiment = {
      ...this.state.user.currentExperiment,
      ...experiment,
    };
    this.setState({ user: updatedUser });
  }

  handleGetNewRepo(newRepo, experimentUrl, serviceUrl) {
    // end of 'upload'
    // Mutate directly to preserve User class prototype (spread operator loses it)
    const updatedUser = this.state.user;
    updatedUser.currentExperiment = {
      ...this.state.user.currentExperiment,
      experimentUrl: serviceUrl,
      participantRecruitmentServiceUrl: serviceUrl,
    };
    this.setState({
      newRepo: newRepo,
      activeExperiment: newRepo,
      experimentStatus: "INACTIVE",
      user: updatedUser,
      projectName: newRepo.path,
      ...this.nextStepStatus("running"),
    });
    // Notify other open tabs that the experiment list has changed
    new BroadcastChannel("easyeyes_experiments").postMessage({
      type: "experiments:updated",
    });
  }

  handleSetExperimentStatus(newStatus) {
    this.setState({
      experimentStatus: newStatus,
    });
  }

  handleSetPrevExperimentStatus(newStatus) {
    this.setState({
      previousExperimentViewed: {
        ...this.state.previousExperimentViewed,
        previousExperimentStatus: newStatus,
      },
    });
  }

  handleArchivedExperimentBool(isCompiledFromArchiveBool) {
    this.setState({
      isCompiledFromArchiveBool: isCompiledFromArchiveBool,
    });
  }

  handleZipArchive(archivedZip) {
    this.setState({
      archivedZip: archivedZip,
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
      githubStars,
      githubLicense,
      readingGlossary,
      phrasesError,
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
      profileStatement,
      isCompiledFromArchiveBool,
      archivedZip,
      resourcesLoaded,
      compileWarnings,
    } = this.state;

    if (phrasesError)
      return <div>Failed to load phrases. Please refresh the page.</div>;

    const steps = [];

    const viewingPreviousExperiment =
      activeExperiment !== "new" && activeExperiment !== newRepo;

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
          newRepo={null}
          activeExperiment={activeExperiment}
          experimentStatus={
            experimentStatus ??
            previousExperimentViewed.previousExperimentStatus
          }
          previousExperimentViewed={previousExperimentViewed}
          prolificStudyStatus={prolificStudyStatus}
          isCompiledFromArchiveBool={isCompiledFromArchiveBool}
          archivedZip={archivedZip}
          resourcesLoaded={resourcesLoaded}
        />,
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
          isCompiledFromArchiveBool={isCompiledFromArchiveBool}
          archivedZip={archivedZip}
          resourcesLoaded={resourcesLoaded}
          compileWarnings={compileWarnings}
        />,
      );

    return (
      <>
        {readingGlossary && (
          <Suspense fallback={<></>}>
            <Glossary
              closeGlossary={this.closeGlossary}
              glossaryFull={getGlossaryFull()}
            />
          </Suspense>
        )}

        <div id="header">
          <div id="header-title">
            <h1>EasyEyes Compiler</h1>
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
              profileStatement={profileStatement}
            />
            {/* <StatusBar currentStep={currentStep} /> */}
            {steps}
          </div>

          {websiteRepoLastCommitDeploy && websiteRepoLastCommitURL && (
            <>
              <div className="copyright-info">
                <div className="info-paragraph">
                  <div className="item">
                    {totalCompileCounts} studies compiled since 1 February,
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
                          timeZone: "UTC",
                        },
                      )}{" "}
                      {new Date(websiteRepoLastCommitDeploy).toLocaleString(
                        undefined,
                        {
                          timeStyle: "short",
                          timeZone: "UTC",
                        },
                      )}{" "}
                      UTC
                    </a>
                    .{" "}
                  </div>

                  <div className="item">
                    <div style={{ marginTop: "5px" }}></div>
                    {githubStars != null && (
                      <a href="https://github.com/EasyEyes/threshold/stargazers">
                        <img
                          alt="GitHub stars"
                          src={`https://img.shields.io/badge/stars-${encodeURIComponent(
                            githubStars,
                          )}-blue?style=flat-square&logo=github&logoColor=white`}
                        />
                      </a>
                    )}{" "}
                    {githubLicense && (
                      <a href="https://github.com/EasyEyes/threshold/blob/main/LICENSE">
                        <img
                          alt="GitHub license"
                          src={`https://img.shields.io/badge/license-${encodeURIComponent(
                            githubLicense,
                          )}-green?style=flat-square`}
                        />
                      </a>
                    )}{" "}
                    <a href="https://app.netlify.com/sites/easyeyes/deploys">
                      <img
                        alt="Netlify Status"
                        src="https://api.netlify.com/api/v1/badges/7ef5bb5a-2b97-4af2-9868-d3e9c7ca2287/deploy-status"
                      />
                    </a>
                  </div>

                  <div className="item">
                    Copyright © 2020 - {new Date().getFullYear()} New York
                    University.
                    <br />
                    Created by Denis Pelli and the EasyEyes team.
                  </div>
                </div>
              </div>
            </>
          )}
        </Suspense>
      </>
    );
  }
}

function getTimezoneName() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
