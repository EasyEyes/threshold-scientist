import React, { Component, Suspense } from "react";
import { renderToString } from "react-dom/server";

import Step from "./Step";
const Glossary = React.lazy(() => import("./Glossary"));

import Statusbar from "./Statusbar";
import StatusLines from "./StatusLines";

import { allSteps } from "./components/steps";
import { currentStepName } from "./components/steps";

import "./css/App.scss";
import Swal from "sweetalert2";
import { Compatibility } from "./components";
import { getAllProjects } from "./components/gitlabUtils";

export default class App extends Component {
  constructor(props) {
    super(props);

    this.allSteps = allSteps();
    this.currentStepName = currentStepName();

    this.state = {
      readingGlossary: false,
      /* -------------------------------------------------------------------------- */
      currentStep: "login", // 'login', 'table', 'upload', 'running', 'deploy', ('download')
      completedSteps: [],
      futureSteps: [...this.allSteps].slice(1),
      // USER
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
    };

    this.functions = {
      handleReset: this.handleReset.bind(this),
      handleNextStep: this.handleNextStep.bind(this),
      handleReturnToStep: this.handleReturnToStep.bind(this),
      handleUpdateUser: this.handleUpdateUser.bind(this),
      handleLogin: this.handleLogin.bind(this),
      handleAddResources: this.handleAddResources.bind(this),
      handleSetProjectName: this.handleSetProjectName.bind(this),
      handleSetExperiment: this.handleSetExperiment.bind(this),
      handleGetNewRepo: this.handleGetNewRepo.bind(this),
    };

    this.closeGlossary = this.closeGlossary.bind(this);
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
      });
  }

  handleUpdateUser(newUser) {
    this.setState({
      user: newUser,
    });
  }

  handleLogin(user, resources, accessToken) {
    this.setState({
      user: user,
      accessToken: accessToken,
      resources: resources,
      ...this.nextStepStatus("table"),
    });
  }

  handleAddResources(newResources) {
    // override the resources in the state
    this.setState({
      resources: { ...newResources },
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

  closeGlossary() {
    this.setState({
      readingGlossary: false,
    });
  }

  render() {
    const {
      readingGlossary,
      currentStep,
      completedSteps,
      futureSteps,
      user,
      resources,
      projectName,
      newRepo,
    } = this.state;
    const steps = [];

    steps.push(
      <Step
        key={this.state.currentStep}
        name={this.state.currentStep}
        isCurrentStep={currentStep === this.state.currentStep}
        isCompletedStep={completedSteps.includes(this.state.currentStep)}
        futureSteps={futureSteps}
        functions={this.functions}
        user={user}
        resources={resources}
        projectName={projectName}
        newRepo={newRepo}
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
            <h1>EasyEyes</h1>
          </div>
          <p className="description">
            Welcome to EasyEyes, a PsychoJS-based experiment compiler designed
            to help you measure perceptual thresholds online.
          </p>
        </div>

        <Suspense>
          <div className="threshold-app">
            <div className="buttons">
              <button
                className="intro-button"
                onClick={() => {
                  Swal.fire({
                    title: "Welcome to EasyEyes!",
                    html: `<p>
            All you need to run your experiment is a few accounts (<a
              href="https://pavlovia.org/"
              rel="noopener noreferrer"
              target="_blank"
              >Pavlovia</a
            >
            and probably
            <a
              href="https://prolific.co/"
              rel="noopener noreferrer"
              target="_blank"
              >Prolific</a
            >) and a table that you create in any spreadsheet app, e.g., Google
            Sheets. The
            <a
              href="https://docs.google.com/document/d/12zZOEN7se437ueBZuGhyBC7HGhwgZe2OROatEyaRvoM/edit#heading=h.6h3xdiqhq593"
              rel="noopener noreferrer"
              target="_blank"
              >Manual</a
            >
            and
            <a
              href="https://docs.google.com/spreadsheets/d/1x65NjykMm-XUOz98Eu_oo6ON2xspm_h0Q0M2u6UGtug/edit#gid=1287694458"
              rel="noopener noreferrer"
              target="_blank"
              >Parameter Glossary</a
            >
            explain how to create your experiment table, compile it into a
            participant web app, and run it. You can download
            <a href="./resources/EasyEyes_demo.zip" download>our demo</a>
            with all the files you need (table, fonts, forms, and a README of
            instructions) to run an experiment.
          </p>
          <p>
            You can online test yourself, and people you personally recruit, with
            just a Pavlovia account. To recruit and test participants online,
            you'll need both Pavlovia and Prolific accounts. We hope to offer
            MTurk support as well, as an alternative to Prolific.
          </p>`,
                    confirmButtonColor: "#019267",
                    customClass: {
                      htmlContainer: "popup-text-container smaller-text",
                    },
                  });
                }}
              >
                🤔&nbsp;&nbsp;How to use EasyEyes?
              </button>

              <button
                className="intro-button"
                onClick={() => {
                  this.setState({
                    readingGlossary: true,
                  });
                }}
              >
                📘&nbsp;&nbsp;Parameter Glossary
              </button>

              <button
                className="intro-button"
                onClick={() => {
                  window.open(
                    `https://docs.google.com/document/d/12zZOEN7se437ueBZuGhyBC7HGhwgZe2OROatEyaRvoM/edit`,
                    "_blank"
                  );
                }}
              >
                📚&nbsp;&nbsp;Manual
              </button>

              <button
                className="intro-button"
                onClick={() => {
                  Swal.fire({
                    title: "Compatibility",
                    html: renderToString(<Compatibility />),
                    confirmButtonColor: "#019267",
                    customClass: {
                      htmlContainer: "popup-text-container smaller-text",
                    },
                  });
                }}
              >
                💻📱&nbsp;&nbsp;Compatibility
              </button>
            </div>
            <StatusLines
              key={this.state.currentStep}
              name={this.state.currentStep}
              futureSteps={this.state.futureSteps}
              functions={this.state.functions}
              isCompletedStep={completedSteps.includes(this.state.stepName)}
              completedSteps={completedSteps}
              user={this.state.user}
              resources={this.state.resources}
              projectName={this.state.projectName}
              newRepo={this.state.newRepo}
              currentStep={this.state.currentStep}
            />
            <Statusbar currentStep={this.state.currentStep} />
            {steps}
          </div>
        </Suspense>
      </>
    );
  }
}
