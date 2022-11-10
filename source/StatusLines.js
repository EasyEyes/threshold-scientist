import React, { Component, PureComponent } from "react";
import "regenerator-runtime";

import "./css/Statusbar.scss";

import { downloadDataFolder } from "./components/gitlabUtils";
import { getUserInfo, redirectToOauth2 } from "./components/user";
import { handleDrop } from "./components/dropzone";
import { preprocessExperimentFile } from "../threshold/preprocess/main";

import { tempAccessToken } from "./components/global";

export default class StatusLines extends Component {
  constructor(props) {
    super(props);
    //initialise states
    // console.log(this.props.user);
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
    console.log(this.props.futureSteps);
    if (this.props.futureSteps.length === 0)
      return {
        currentStep: "",
        completedSteps: [...this.props.completedSteps, this.props.currentStep],
        futureSteps: [],
      };

    const nextStep = this.props.futureSteps[0];
    console.log(targetNextStep, nextStep);
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

  handleLogin(user, resources, accessToken) {
    console.log(user.username);
    this.setState({
      user: user,
      accessToken: accessToken,
      resources: resources,
      ...this.nextStepStatus("table"),
    });
  }

  _getPavloviaExperimentUrl() {
    return `https://run.pavlovia.org/${
      this.state.user.username
    }/${this.props.projectName.toLocaleLowerCase()}`;
  }

  onDrop(files) {
    const { user, functions } = this.props;
    handleDrop(
      user,
      files,
      functions.handleAddResources,
      this.handleTable.bind(this)
    );
    console.log(this.state.files);
  }

  async handleTable(file) {
    this.dropZoneRef.current.classList.add("drop-disabled");
    await this.reset();
    this.dropZoneRef.current.classList.remove("drop-disabled");

    this.setState({
      tableName: file.name,
    });

    const errors = [];

    await preprocessExperimentFile(
      file,
      copyUser(this.props.user),
      errors,
      this.props.resources,
      async (
        user,
        requestedForms, // : any,
        requestedFontList, // : string[],
        requestedTextList, // : string[],
        requestedFolderList, // : string[],
        requestedCodeList, // : string[],
        fileList, // : File[],
        errorList // : any[]
      ) => {
        // scroll to the top of the step block
        this.props.scrollToCurrentStep();

        const formList = [];

        if (requestedForms.debriefForm)
          formList.push(requestedForms.debriefForm);
        if (requestedForms.consentForm)
          formList.push(requestedForms.consentForm);

        userRepoFiles.requestedForms = formList;
        userRepoFiles.requestedFonts = requestedFontList;
        userRepoFiles.requestedTexts = requestedTextList;
        userRepoFiles.requestedFolders = requestedFolderList;
        userRepoFiles.requestedCode = requestedCodeList;
        userRepoFiles.blockFiles = fileList;

        if (errorList.length) {
          // sort errorList according to parameter name
          errorList.sort((errA, errB) => {
            if (errA.parameters < errB.parameters) return -1;
            else return 1;
          });

          // show errors
          this.setState({
            errors: [...errorList],
          });

          return;
        } else {
          if (user.id != undefined) {
            // user logged in
            this.props.functions.handleSetProjectName(
              await setRepoName(user, file.name.split(".")[0])
            );
            this.props.functions.handleNextStep("upload");
          }

          // show success log
          this.props.functions.handleUpdateUser(user);
          this.setState({
            errors: [
              {
                context: "preprocessor",
                kind: "correct",
                name: this.finalSuccessMessage,
              },
            ],
          });
        }
      }
      // this.props.functions.handleSetExperiment
    );

    // this.setState({
    //   errors: [...errors],
    // });
  }

  async componentDidMount() {
    if (
      window.location.hash.length &&
      window.location.hash.includes("#access_token")
    ) {
      const accessToken = window.location.hash
        .split("&")[0]
        .split("#access_token=")[1];
      console.log(accessToken);
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

      this.handleLogin(user, resources, accessToken);
    }
  }

  login() {
    redirectToOauth2();
  }

  render() {
    let node;
    console.log(this.props.currentStep);
    console.log(this.state.tableName);
    console.log(this.state.login);
    console.log(this.state.user);
    console.log(this.props.isCompletedStep);
    console.log(this.props.completedSteps);
    console.log(this.state.mode);
    console.log();
    let url;
    this.props.projectName && this.state.user
      ? (url =
          "https://run.pavlovia.org/" +
          this.state.user.username +
          "/" +
          this.props.projectName.toLocaleLowerCase())
      : (url = "");
    console.log(url);
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
