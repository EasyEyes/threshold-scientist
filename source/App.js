import React, { Component } from "react";

import Step from "./Step";

import { allSteps } from "./components/steps";

import "./css/App.scss";

export default class App extends Component {
  constructor(props) {
    super(props);

    this.allSteps = allSteps();

    this.state = {
      currentStep: "login", // 'login', 'table', 'upload', 'running', 'deploy', ('download')
      completedSteps: [],
      futureSteps: [...this.allSteps].slice(1),
      // USER
      user: null,
      resources: {
        fonts: [],
        forms: [],
        texts: [],
        folders: [],
      },
      projectName: null,
      newRepo: null,
    };

    this.functions = {
      handleReset: this.handleReset.bind(this),
      handleNextStep: this.handleNextStep.bind(this),
      handleLogin: this.handleLogin.bind(this),
      handleAddResources: this.handleAddResources.bind(this),
      handleSetProjectName: this.handleSetProjectName.bind(this),
      handleSetExperiment: this.handleSetExperiment.bind(this),
      handleGetNewRepo: this.handleGetNewRepo.bind(this),
    };
  }

  /* -------------------------------------------------------------------------- */

  nextStepStatus() {
    if (this.state.futureSteps.length === 0)
      return {
        currentStep: "",
        completedSteps: [...this.state.completedSteps, this.state.currentStep],
        futureSteps: [],
      };

    const nextStep = this.state.futureSteps[0];
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
      resources: {
        fonts: [],
        forms: [],
        texts: [],
        folders: [],
      },
      projectName: null,
      newRepo: null,
    });
  }

  handleNextStep() {
    this.setState({
      ...this.nextStepStatus(),
    });
  }

  handleLogin(user, resources) {
    this.setState({
      user: user,
      resources: resources,
      ...this.nextStepStatus(),
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
    this.setState({
      newRepo: newRepo,
      user: {
        ...this.state.user,
        currentExperiment: {
          ...this.state.user.currentExperiment,
          experimentUrl,
          participantRecruitmentServiceUrl: serviceUrl,
        },
      },
      ...this.nextStepStatus(),
    });
  }

  render() {
    const {
      currentStep,
      completedSteps,
      futureSteps,
      user,
      resources,
      projectName,
      newRepo,
    } = this.state;
    const steps = [];

    for (const stepName of this.allSteps)
      steps.push(
        <Step
          key={stepName}
          name={stepName}
          isCurrentStep={currentStep === stepName}
          isCompletedStep={completedSteps.includes(stepName)}
          futureSteps={futureSteps}
          functions={this.functions}
          user={user}
          resources={resources}
          projectName={projectName}
          newRepo={newRepo}
        />
      );

    return <div className="threshold-app">{steps}</div>;
  }
}
