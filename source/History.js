import React, { Component } from "react";
import { downloadDataFolder } from "./components/gitlabUtils";

// import log from 'log-here-now';
import Dropdown from "./components/Dropdown";

export default class History extends Component {
  constructor(props) {
    super(props);

    this.state = {
      selected: props.user.projectList[0],
    };

    this.changeSelectedExperiment = this.changeSelectedExperiment.bind(this);
  }

  // componentDidMount() {
  //   this.setState({
  //     selected: this.props.user.projectList[0]
  //   })
  // }

  // getProjectDict = (projectList) => {
  //   const projectDict = {}
  //   projectList.forEach(project => {
  //     projectDict[project.name] = project
  //   })
  //   return projectDict
  // }

  changeSelectedExperiment = (experiment) => {
    this.setState({
      selected: experiment,
    });
  };

  render() {
    const {
      user: { username, projectList },
      user,
    } = this.props;

    // const projectDict = this.getProjectDict(projectList)

    return (
      <div className="step">
        <div
          className="link-set"
          style={{
            marginTop: 0,
          }}
        >
          <div className="history-header">
            <p
              className="emphasize"
              style={{
                whiteSpace: "nowrap",
              }}
            >
              Recent experiments
            </p>
            {/* <Dropdown options={Object.keys(projectDict)} onChange={this.changeSelectedExperiment} value={Object.keys(projectDict)[0]} placeholder="Recent experiments" /> */}
            <Dropdown
              selected={this.state.selected}
              setSelectedProject={this.changeSelectedExperiment}
              projectList={projectList}
            />
          </div>

          {this.state.selected && (
            <div className="link-set-buttons">
              <button
                className="button-grey button-small"
                onClick={() => {
                  window.open(
                    `https://pavlovia.org/${username}/${this.state.selected.name.toLowerCase()}`
                  );
                }}
              >
                See on Pavlovia
              </button>
              <button
                className="button-grey button-small"
                onClick={async () => {
                  await downloadDataFolder(user, this.state.selected);
                }}
              >
                Download results
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
}
