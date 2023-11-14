import React, { Component } from "react";

export default class Dropdown extends Component {
  shortenProjectName(name) {
    // if the name length is greater than 20, keep the first 10 characters and the last 10 characters
    if (name.length > 20) {
      return name.slice(0, 10) + "..." + name.slice(-10);
    }
    return name;
  }

  async componentDidMount() {
    if (this.props.newExperimentProjectName) {
      await this.props.getProjectsList();
    }
  }

  render() {
    const {
      selected,
      setSelectedProject,
      projectList,
      newExperimentProjectName,
      style,
      pavloviaIsReady,
      isFromStartTable,
    } = this.props;

    return (
      <select
        className="history-dropdown"
        name="projects"
        id="projects"
        value={selected === "new" ? "__NEW_EXPERIMENT__" : selected?.id}
        onChange={(e) => {
          if (e.target.value === "__NEW_EXPERIMENT__") {
            setSelectedProject(null);
            return;
          } else if (e.target.value === "__FRESH_NEW_EXPERIMENT__") {
            setSelectedProject("REFRESH");
            return;
          }

          const selectedProject = projectList.find((project) => {
            return project.id.toString() === e.target.value;
          });
          setSelectedProject(selectedProject);
        }}
        style={style}
      >
        {(function () {
          const optionList = projectList.map((project) => {
            if (project.name !== "EasyEyesResources") {
              return (
                <option key={project.id} value={project.id}>
                  {/* {`${this.shortenProjectName(project.name)}`} ( */}
                  {`${project.name}`} (
                  {new Date(project.created_at).toLocaleString()})
                </option>
              );
            }
          });

          if (!newExperimentProjectName) {
            optionList.unshift(
              <option key={"__NEW_EXPERIMENT__"} value={"__NEW_EXPERIMENT__"}>
                {`Select a compiled experiment`}
              </option>
            );
          }
          if (pavloviaIsReady || isFromStartTable) {
            return optionList;
          } else {
            const optionList = [];
            if (!newExperimentProjectName) {
              optionList.unshift(
                <option key={"__NEW_EXPERIMENT__"} value={"__NEW_EXPERIMENT__"}>
                  {`Select a compiled experiment`}
                </option>
              );
            } else {
              optionList.unshift(
                <option
                  key={"__FRESH_NEW_EXPERIMENT__"}
                  value={"__FRESH_NEW_EXPERIMENT__"}
                >
                  {selected == "new"
                    ? `${newExperimentProjectName}`
                    : `Select a compiled experiment`}
                </option>
              );
            }
            return optionList;
          }
        })()}
      </select>
    );
  }
}
