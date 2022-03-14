import React, { Component } from "react";

import Login from "./Login";
import Deploy from "./Deploy";
import Running from "./Running";
import Table from "./Table";
import Upload from "./Upload";

import "./css/Step.scss";

export default class Step extends Component {
  constructor(props) {
    super(props);

    this.state = {
      status: "disabled",
    };
  }

  render() {
    const { name, isCurrentStep, isCompletedStep } = this.props;
    if (isCurrentStep && isCompletedStep) throw "STEP ERROR";
    if (!isCurrentStep && !isCompletedStep) return <></>;

    let component;
    switch (name) {
      case "login":
        component = <Login {...this.props} />;
        break;
      case "table":
        component = <Table {...this.props} />;
        break;
      case "running":
        component = <Running />;
        break;
      case "deploy":
        component = <Deploy />;
        break;
      case "upload":
        component = <Upload />;
        break;

      default:
        break;
    }

    return (
      <div
        className={`step step-${name}${isCurrentStep ? " step-current" : ""}${
          isCompletedStep ? " step-completed" : ""
        }`}
      >
        {isCurrentStep && <p className="step-current-indicator">now</p>}
        {component}
      </div>
    );
  }
}
