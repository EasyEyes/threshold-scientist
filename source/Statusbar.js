import React, { Component, PureComponent } from "react";
import "./css/Statusbar.scss";

export default class Statusbar extends Component {
  constructor(props) {
    super(props);
    //initialise states
  }
  render() {
    const cStep = this.props.currentStep;
    // console.log(cStep);
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
    // console.log(this.props);
    return <div>{component}</div>;
  }
}
