import React, { Component } from "react";

export default class StatusBar extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { currentStep } = this.props;

    switch (currentStep) {
      case "login":
        return (
          <div className="status-bar">
            Please connect to your Pavlovia account
          </div>
        );

      case "table":
        return (
          <div className="status-bar">
            Please submit your files and experiment table here
          </div>
        );

      case "upload":
        return <div className="status-bar">Uploading ...</div>;

      case "running":
        return (
          <div className="status-bar">Your experiment is ready to run</div>
        );

      case "deploy":
        return <div className="status-bar"></div>;

      default:
        return <></>;
    }
  }
}
