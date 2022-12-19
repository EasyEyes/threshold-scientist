import React, { Component, PureComponent } from "react";
import "./css/StatusBar.scss";

export default class StatusBar extends Component {
  constructor(props) {
    super(props);
    //initialise states
  }
  render() {
    const cStep = this.props.currentStep;
    let component;
    switch (cStep) {
      case "login":
        component = (
          <div className="status-bar">
            Please Connect to Your Pavlovia Account
          </div>
        );
        break;
      case "table":
        component = (
          <div className="status-bar">
            Please Submit Your Files and Experiment Here
          </div>
        );
        break;
      case "upload":
        component = <div className="status-bar">Uploading..</div>;
        break;
      case "running":
        component = (
          <div className="status-bar">Your Experiment is Ready to Run</div>
        );
        break;
      case "deploy":
        component = <div className="status-bar"></div>;
        break;

      default:
        break;
    }
    return <div>{component}</div>;
  }
}
