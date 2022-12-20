import React, { Component } from "react";

import { getUserInfo, redirectToOauth2 } from "./components/user";
import { handleDrop } from "./components/dropzone";

import "./css/StatusLines.scss";

export default class StatusLines extends Component {
  constructor(props) {
    super(props);
  }

  isLineActivated(step) {
    return this.props.completedSteps.includes(step);
  }

  render() {
    const { currentStep, completedSteps, futureSteps, user } = this.props;

    return (
      <ul className="status-lines">
        <StatusLine
          activated={this.isLineActivated("login")}
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
          activated={this.isLineActivated("table")}
          title={"Experiment Filename"}
        />
        <StatusLine
          activated={this.isLineActivated("upload")}
          title={"Experiment Name"}
        />
        <StatusLine
          activated={this.isLineActivated("running")}
          title={"Experiment Mode"}
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
