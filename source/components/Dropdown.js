import React, { Component, createRef } from "react";
import { setDynamicSelectWidth } from "./DynamicSelectWidth";

export default class Dropdown extends Component {
  constructor(props) {
    super(props);
    this.state = {
      resolvedProjectList: [],
      isLoadingProjects: false,
    };
    this.selectRef = createRef();
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
    this.measureWidth(); // measure once we have the real list
  }

  async componentDidUpdate(prevProps, prevState) {
    //  if the parent handed a brand-new projectList prop…
    if (this.props.projectList !== prevProps.projectList) {
      await this.resolveProjectList();
      this.measureWidth();
    }

    // if selected project list changes
    if (
      prevProps.selected !== this.props.selected &&
      !this.state.isLoadingProjects
    ) {
      this.measureWidth();
    }
  }

  measureWidth() {
    const selectEl = this.selectRef.current;
    if (selectEl) setDynamicSelectWidth(selectEl);
  }

  async resolveProjectList() {
    const { projectList } = this.props;

    // guard  not to re-enter “loading…” for every identical Promise
    if (projectList === this._lastPromise) return;
    this._lastPromise = projectList;

    if (projectList && typeof projectList.then === "function") {
      this.setState({ isLoadingProjects: true });
      try {
        const resolved = await projectList;
        this.setState({
          resolvedProjectList: resolved || [],
          isLoadingProjects: false,
        });
      } catch {
        this.setState({
          resolvedProjectList: [],
          isLoadingProjects: false,
        });
      }
    } else {
      this.setState({
        resolvedProjectList: Array.isArray(projectList) ? projectList : [],
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

    const loadingStyle = isLoadingProjects
      ? { pointerEvents: "none", userSelect: "none" }
      : {};

    return (
      <div className="history-dropdown-wrapper" style={loadingStyle}>
        {isLoadingProjects ? (
          <button
            className="history-dropdown"
            disabled
            style={{ ...style, pointerEvents: "none", cursor: "default" }}
          >
            <i
              className="bi bi-arrow-repeat icon-spin"
              style={{ color: "white" }}
            ></i>
          </button>
        ) : (
          <select
            disabled={isLoadingProjects}
            ref={this.selectRef}
            className="history-dropdown"
            name="projects"
            id="projects"
            value={selected === "new" ? "__NEW_EXPERIMENT__" : selected?.id}
            onChange={(e) => {
              if (e.target.value === "__NEW_EXPERIMENT__") {
                setSelectedProject(null);
              } else if (e.target.value === "__FRESH_NEW_EXPERIMENT__") {
                setSelectedProject("REFRESH");
              } else {
                const proj = resolvedProjectList.find(
                  (p) => p.id.toString() === e.target.value,
                );
                setSelectedProject(proj);
              }
            }}
            style={style}
          >
            {(() => {
              const opts = resolvedProjectList
                .filter((p) => p.name !== "EasyEyesResources")
                .map((project) => (
                  <option key={project.id} value={project.id}>
                    {`${project.name}`} (
                    {new Date(project.created_at).toLocaleString()})
                  </option>
                ));

              // unshift either the “Select a compiled experiment” or “Fresh new” placeholder…
              if (!newExperimentProjectName) {
                opts.unshift(
                  <option key="__NEW_EXPERIMENT__" value="__NEW_EXPERIMENT__">
                    Select a compiled experiment
                  </option>,
                );
              } else {
                opts.unshift(
                  <option
                    key="__FRESH_NEW_EXPERIMENT__"
                    value="__FRESH_NEW_EXPERIMENT__"
                  >
                    {selected === "new"
                      ? newExperimentProjectName
                      : "Select a compiled experiment"}
                  </option>,
                );
              }

              return opts;
            })()}
          </select>
        )}
      </div>
    );
  }
}
