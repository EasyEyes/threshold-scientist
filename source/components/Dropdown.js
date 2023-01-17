import React, { Component } from "react";

export default class Dropdown extends Component {
  shortenProjectName(name) {
    // if the name length is greater than 20, keep the first 10 characters and the last 10 characters
    if (name.length > 20) {
      return name.slice(0, 10) + "..." + name.slice(-10);
    }
    return name;
  }

  render() {
    const { selected, setSelectedProject, projectList } = this.props;

    return (
      <select
        className="history-dropdown"
        name="projects"
        id="projects"
        defaultValue={selected?.id || undefined}
        onChange={(e) => {
          if (e.target.value === "__NEW_EXPERIMENT__") {
            setSelectedProject(null);
            return;
          }

          const selectedProject = projectList.find((project) => {
            return project.id.toString() === e.target.value;
          });
          setSelectedProject(selectedProject);
        }}
      >
        {(function () {
          const optionList = projectList.map((project) => {
            return (
              <option key={project.id} value={project.id}>
                {/* {`${this.shortenProjectName(project.name)}`} ( */}
                {`${project.name}`} (
                {new Date(project.created_at).toLocaleString()})
              </option>
            );
          });

          optionList.unshift(
            <option key={"__NEW_EXPERIMENT__"} value={"__NEW_EXPERIMENT__"}>
              📑 New experiment
            </option>
          );

          return optionList;
        })()}
      </select>
    );
  }
}
