import React, { Component } from "react";
import Dropdown from "./components/Dropdown";
// import PavloviaIcon from './media/pavlovia.svg';

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
      activeExperiment,
      previousExperimentViewed: { originalFileName, previousExperimentStatus },
      // currentStep,
      // completedSteps,
      // futureSteps,
      user,
      filename,
      projectName,
      experimentStatus,
      functions,
    } = this.props;

    const viewingPreviousExperiment = activeExperiment !== "new";

    const showExperimentURL =
      !!(user && projectName && experimentStatus === "RUNNING") ||
      (viewingPreviousExperiment && previousExperimentStatus === "RUNNING");
    const effectiveProjectNameLowerCase = viewingPreviousExperiment
      ? activeExperiment.name?.toLocaleLowerCase()
      : projectName?.toLocaleLowerCase();

    return (
      <ul className="status-lines">
        <StatusLine
          activated={!!user}
          title={"Pavlovia account"}
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
        {/* <StatusLine
          activated={!!filename}
          title={(
            <>
              <PavloviaIcon className="line-title-icon" />
              <span>Pavlovia account</span>
            </>
          )}
          content={"Unconnected"}
        /> */}

        <StatusLine
          activated={!!user}
          title={"Experiment"}
          content={
            user ? (
              <Dropdown
                selected={activeExperiment}
                setSelectedProject={functions.handleSetActivateExperiment}
                projectList={user.projectList}
                newExperimentProjectName={projectName}
              />
            ) : (
              ""
            )
          }
        />
        <StatusLine
          activated={!!filename || viewingPreviousExperiment}
          title={"Experiment file"}
          content={
            viewingPreviousExperiment
              ? originalFileName
              : filename
              ? this.getStatusLineFilename(filename)
              : ""
          }
        />
        {/* <StatusLine
          activated={!!projectName || viewingPreviousExperiment}
          title={"Experiment name"}
          content={
            viewingPreviousExperiment ? activeExperiment.name : projectName
          }
        /> */}
        <StatusLine
          activated={
            !!(user && filename && projectName) || viewingPreviousExperiment
          }
          title={"Experiment mode"}
          content={
            viewingPreviousExperiment
              ? previousExperimentStatus
              : user && filename && projectName
              ? experimentStatus
              : ""
          }
        />
        <StatusLine
          activated={showExperimentURL}
          title={"Experiment URL"}
          content={
            (user && projectName && experimentStatus === "RUNNING") ||
            (viewingPreviousExperiment &&
              previousExperimentStatus === "RUNNING") ? (
              <a
                href={`https://run.pavlovia.org/${user.username}/${effectiveProjectNameLowerCase}`}
                target="_blank"
                rel="noopenner noreferrer"
                style={{
                  color: "#666",
                }}
              >{`https://run.pavlovia.org/${user.username}/${effectiveProjectNameLowerCase}`}</a>
            ) : (
              ""
            )
          }
        />

        {/* <hr
          style={{
            margin: "0.75rem 0",
            opacity: "0.15",
          }}
        /> */}

        <StatusLine
          activated={false}
          title={"Prolific account"}
          content={"Please connect to Pavlovia first"}
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
        <span className="line-title">{title}:</span>
        {/* <span>: </span> */}
        <span className="line-content">{content}</span>
      </li>
    );
  }
}
