import React, { Component } from "react";

import "./css/StatusLines.scss";

export default class StatusLines extends Component {
  constructor(props) {
    super(props);
  }

  isLineActivated(step) {
    return this.props.completedSteps.includes(step);
  }

  getStatusLineFilename(filename) {
    return (
      <span className="status-line-content">
        {filename}
        <button
          className="button-small button-grey"
          style={{
            whiteSpace: "nowrap",
            fontSize: "0.7em",
            padding: "0.6em",
            borderRadius: "0.3em",
            color: "#fff",
          }}
          onClick={async (e) => {
            // change this button class to button-wait
            e.target.classList.add("button-wait");

            await this.props.functions.handleReturnToStep("table");
            this.props.functions.handleSetFilename("");
            this.props.functions.handleSetProjectName("");
          }}
        >
          Upload a new file
        </button>
      </span>
    );
  }

  render() {
    const {
      // currentStep,
      // completedSteps,
      // futureSteps,
      user,
      filename,
      projectName,
      experimentStatus,
    } = this.props;

    return (
      <ul className="status-lines">
        <StatusLine
          activated={!!user}
          title={"Pavlovia Account"}
          content={
            user ? (
              <span className="pavlovia-account-name">
                <img
                  className="pavlovia-avatar"
                  src={user.avatar_url}
                  alt="Pavlovia Avatar"
                ></img>
                {user.name} ({user.username})
              </span>
            ) : (
              "Unconnected"
            )
          }
        />
        <StatusLine
          activated={!!filename}
          title={"Experiment File"}
          content={filename ? this.getStatusLineFilename(filename) : ""}
        />
        <StatusLine
          activated={!!projectName}
          title={"Experiment Name"}
          content={projectName}
        />
        <StatusLine
          activated={!!(user && filename && projectName)}
          title={"Experiment Mode"}
          content={user && filename && projectName ? experimentStatus : ""}
        />
        <StatusLine
          activated={!!(user && projectName && experimentStatus === "RUNNING")}
          title={"Experiment URL"}
          content={
            user && projectName && experimentStatus === "RUNNING" ? (
              <a
                href={`https://run.pavlovia.org/${
                  user.username
                }/${projectName.toLocaleLowerCase()}`}
                target="_blank"
                rel="noopenner noreferrer"
                style={{
                  color: "#666",
                }}
              >{`https://run.pavlovia.org/${
                user.username
              }/${projectName.toLocaleLowerCase()}`}</a>
            ) : (
              ""
            )
          }
        />
      </ul>
    );
  }
}

class StatusLine extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    const { activated, title, content } = this.props;

    return (
      <li
        className={`status-line ${
          activated ? "status-line-activated" : "status-line-inactivated"
        }`}
      >
        <span className="line-title">{title}</span>
        <span> : </span>
        <span className="line-content">{content}</span>
      </li>
    );
  }
}
