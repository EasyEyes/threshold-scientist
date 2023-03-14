import React, { PureComponent } from "react";

import Login from "./Login";
// import Deploy from "./Deploy";
import Running from "./Running";
import Table from "./Table";
import Upload from "./Upload";

import "./css/Step.scss";

export default class Step extends PureComponent {
  constructor(props) {
    super(props);

    this.state = {
      status: "disabled",
    };

    this.ref = React.createRef();
  }

  scrollToCurrentStep() {
    if (this.ref.current) {
      this.ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  render() {
    const { name, isCurrentStep, isCompletedStep } = this.props;
    if (isCurrentStep && isCompletedStep) throw "STEP ERROR";
    if (!isCurrentStep && !isCompletedStep) return <></>;

    let component;
    switch (name) {
      case "login":
        component = (
          <Login
            {...this.props}
            scrollToCurrentStep={this.scrollToCurrentStep.bind(this)}
          />
        );
        break;
      case "table":
        component = (
          <Table
            {...this.props}
            scrollToCurrentStep={this.scrollToCurrentStep.bind(this)}
          />
        );
        break;
      case "upload":
        component = (
          <Upload
            {...this.props}
            scrollToCurrentStep={this.scrollToCurrentStep.bind(this)}
          />
        );
        break;
      case "running":
        component = (
          <Running
            {...this.props}
            previousExperimentViewed={{
              previousRecruitmentInformation: null,
            }}
            viewingPreviousExperiment={false}
            scrollToCurrentStep={this.scrollToCurrentStep.bind(this)}
          />
        );
        break;
      case "prev-running":
        component = (
          <Running
            {...this.props}
            viewingPreviousExperiment={true}
            scrollToCurrentStep={this.scrollToCurrentStep.bind(this)}
          />
        );
        break;
      // case "deploy":
      //   component = (
      //     <Deploy
      //       {...this.props}
      //       scrollToCurrentStep={this.scrollToCurrentStep.bind(this)}
      //     />
      //   );
      //   break;

      default:
        break;
    }

    return (
      <div
        className={`animate__animated animate__headShake step step-${name}${
          isCurrentStep ? "" : ""
        }${isCompletedStep ? " step-completed" : ""}`}
        ref={this.ref}
      >
        {component}
      </div>
    );
  }
}
