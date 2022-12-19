import React, { Component } from "react";
import "regenerator-runtime";

import "./css/Statusbar.scss";

import { getUserInfo, redirectToOauth2 } from "./components/user";
import { handleDrop } from "./components/dropzone";
// import { preprocessExperimentFile } from "../threshold/preprocess/main";

import { tempAccessToken } from "./components/global";

export default class StatusLines extends Component {
  constructor(props) {
    super(props);
    this.state = {
      login: null,
    };

    this.state = {
      mode: null,
    };

    this.onDrop = this.onDrop.bind(this);
    this.login = this.login.bind(this);
    this.assignMode = this.assignMode.bind(this);
  }

  assignMode() {
    if (this.props.completedSteps.includes("table")) {
      this.setState({
        mode: "INACTIVE",
      });
    } else if (this.props.completedSteps.includes("upload")) {
      this.setState({
        mode: "RUNNING",
      });
    } else {
      this.setState({
        mode: "...",
      });
    }
  }

  nextStepStatus(targetNextStep = null) {
    if (this.props.futureSteps.length === 0)
      return {
        currentStep: "",
        completedSteps: [...this.props.completedSteps, this.props.currentStep],
        futureSteps: [],
      };
    const nextStep = this.props.futureSteps[0];
    if (targetNextStep && targetNextStep !== nextStep) {
      return {
        currentStep: this.props.currentStep,
        completedSteps: [...this.props.completedSteps],
        futureSteps: [...this.props.futureSteps],
      };
    }

    return {
      currentStep: nextStep,
      completedSteps: [...this.props.completedSteps, this.props.currentStep],
      futureSteps: [...this.props.futureSteps].slice(1),
    };
  }

  onDrop(files) {
    const { user, functions } = this.props;
    handleDrop(
      user,
      files,
      functions.handleAddResources,
      this.handleTable.bind(this)
    );
  }

  async handleTable(file) {
    this.setState({
      tableName: file.name,
    });
  }

  async componentDidMount() {
    if (
      window.location.hash.length &&
      window.location.hash.includes("#access_token")
    ) {
      const accessToken = window.location.hash
        .split("&")[0]
        .split("#access_token=")[1];
      // clear address bar parameters
      // eslint-disable-next-line no-undef
      if (!process.env.debug)
        window.history.replaceState(null, null, window.location.pathname);

      this.setState({
        login: "loading",
      });

      // // temporarily assign access token here for temporaryLog
      tempAccessToken.t = accessToken;

      const [user, resources] = await getUserInfo(accessToken);

      this.setState({
        user: user,
        accessToken: accessToken,
        resources: resources,
        ...this.nextStepStatus("table"),
      });
    }
  }

  login() {
    redirectToOauth2();
  }

  render() {
    let url;
    this.props.projectName && this.state.user
      ? (url =
          "https://run.pavlovia.org/" +
          this.state.user.username +
          "/" +
          this.props.projectName.toLocaleLowerCase())
      : (url = "");
    return (
      <>
        <div>
          {this.state.user ? (
            <p>
              {this.props.currentStep == "login" ? (
                <span> ➤</span>
              ) : (
                <span></span>
              )}{" "}
              Pavlovia Account : {this.state.user.username}
            </p>
          ) : (
            <p>Pavlovia Account :</p>
          )}
          <p>
            {this.props.currentStep == "table" ? (
              <span> ➤</span>
            ) : (
              <span></span>
            )}{" "}
            Experiment Filename :
          </p>
          {this.state.user ? (
            <p>
              {this.props.currentStep == "upload" ? (
                <span> ➤</span>
              ) : (
                <span></span>
              )}
              Experiment Name : {this.props.projectName}
            </p>
          ) : (
            <p>Experiment Name :</p>
          )}
          {this.props.completedSteps.includes("table") &&
          this.props.completedSteps.includes("upload") ? (
            <p>Experiment Mode : RUNNING</p>
          ) : (
            <p>Experiment Mode : INACTIVE</p>
          )}
          {this.props.projectName ? (
            <p>
              {this.props.currentStep == "running" ? (
                <span> ➤</span>
              ) : (
                <span></span>
              )}
              Experiment URL : <a href={url}>{url}</a>
            </p>
          ) : (
            <p>URL :</p>
          )}
        </div>
      </>
    );
  }
}
