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
    };

    this.functions = {
      handleLogin: this.handleLogin.bind(this),
      handleAddResources: this.handleAddResources.bind(this),
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

  handleLogin(user, resources) {
    this.setState({
      user: user,
      resources: resources,
      ...this.nextStepStatus(),
    });
  }

  handleAddResources(newResources) {
    this.setState({
      resources: { ...newResources },
    });
  }

  render() {
    const { currentStep, completedSteps, futureSteps, user, resources } =
      this.state;
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
        />
      );

    return <div className="threshold-app">{steps}</div>;
  }
}
