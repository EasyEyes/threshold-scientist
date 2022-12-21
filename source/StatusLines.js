import React, { Component } from "react";

import "./css/StatusLines.scss";

export default class StatusLines extends Component {
  constructor(props) {
    super(props);
  }

  isLineActivated(step) {
    return this.props.completedSteps.includes(step);
  }

  render() {
    const {
      currentStep,
      completedSteps,
      futureSteps,
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
              ""
            )
          }
        />
        <StatusLine
          activated={!!filename}
          title={"Experiment Filename"}
          content={filename}
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
          activated={this.isLineActivated("running")}
          title={"Experiment URL"}
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
