import React, { Component } from "react";

import { setDynamicSelectWidth } from "./DynamicSelectWidth";

export default class Dropdown extends Component {
  constructor(props) {
    super(props);
    this.state = {
      resolvedProjectList: [],
      isLoadingProjects: false,
    };
  }

  shortenProjectName(name) {
    // if the name length is greater than 20, keep the first 10 characters and the last 10 characters
    if (name.length > 20) {
      return name.slice(0, 10) + "..." + name.slice(-10);
    }
    return name;
  }

  async componentDidMount() {
    await this.resolveProjectList();
    if (this.props.newExperimentProjectName) {
      await this.props.getProjectsList();
    }
    const selectDropdown = document.getElementById("projects");
    setDynamicSelectWidth(selectDropdown);
  }

  async componentDidUpdate(prevProps) {
    // // Resolve project list if it changed
    if (this.props.projectList !== prevProps.projectList) {
      await this.resolveProjectList();
    }

    if (this.props.selected !== prevProps.selected) {
      const selectDropdown = document.getElementById("projects");
      setDynamicSelectWidth(selectDropdown);
    }
  }

  async resolveProjectList() {
    const { projectList } = this.props;

    // Check if projectList is a Promise
    if (projectList && typeof projectList.then === "function") {
      this.setState({ isLoadingProjects: true });
      try {
        const resolved = await projectList;
        this.setState({
          resolvedProjectList: resolved || [],
          isLoadingProjects: false,
        });
      } catch (error) {
        console.error("Error resolving project list:", error);
        this.setState({
          resolvedProjectList: [],
          isLoadingProjects: false,
        });
      }
    } else if (Array.isArray(projectList)) {
      // projectList is already an array
      this.setState({
        resolvedProjectList: projectList,
        isLoadingProjects: false,
      });
    } else {
      // Handle case where projectList is null/undefined
      this.setState({
        resolvedProjectList: [],
        isLoadingProjects: false,
      });
    }
  }

  render() {
    const {
      selected,
      setSelectedProject,
      newExperimentProjectName,
      style,
      pavloviaIsReady,
      isFromStartTable,
    } = this.props;

    const { resolvedProjectList, isLoadingProjects } = this.state;
    // TODO disabling actions on loading is not working
    const loadingStyle = isLoadingProjects
      ? { pointerEvents: "none", userSelect: "none" }
      : {};

    return (
      <div className="history-dropdown-wrapper" style={loadingStyle}>
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

            const selectedProject = resolvedProjectList.find((project) => {
              return project.id.toString() === e.target.value;
            });
            setSelectedProject(selectedProject);
            const selectDropdown = document.getElementById("projects");
            setDynamicSelectWidth(selectDropdown);
          }}
          style={style}
        >
          {(function () {
            if (isLoadingProjects) {
              return (
                <option key="loading" value="loading">
                  Listing experiments...
                </option>
              );
            }

            const optionList = resolvedProjectList.map((project) => {
              if (project.name !== "EasyEyesResources") {
                return (
                  <option key={project.id} value={project.id}>
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
                </option>,
              );
            }
            if (pavloviaIsReady || isFromStartTable) {
              return optionList;
            } else {
              const optionList = [];
              if (!newExperimentProjectName) {
                optionList.unshift(
                  <option
                    key={"__NEW_EXPERIMENT__"}
                    value={"__NEW_EXPERIMENT__"}
                  >
                    {`Select a compiled experiment`}
                  </option>,
                );
              } else {
                optionList.unshift(
                  <option
                    key={"__FRESH_NEW_EXPERIMENT__"}
                    value={
                      selected == "new"
                        ? `${newExperimentProjectName}`
                        : `Select a compiled experiment`
                    }
                  >
                    {selected == "new"
                      ? `${newExperimentProjectName}`
                      : `Select a compiled experiment`}
                  </option>,
                );
              }
              return optionList;
            }
          })()}
        </select>
      </div>
    );
  }
}
