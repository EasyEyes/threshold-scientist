import React, { Component } from "react";
import Swal from "sweetalert2";

export default class Dropdown extends Component {
  constructor(props) {
    super(props);
    this.state = {
      resolvedProjectList: [],
      isLoadingProjects: false,
    };
    this._lastPromise = null;
    this.handleButtonClick = this.handleButtonClick.bind(this);
  }

  async componentDidMount() {
    await this.resolveProjectList();
  }

  async componentDidUpdate(prevProps) {
    //  if the parent handed a brand-new projectList prop…
    if (this.props.projectList !== prevProps.projectList) {
      await this.resolveProjectList();
    }
  }

  async resolveProjectList() {
    const { projectList } = this.props;

    // guard  not to re-enter "loading..." for every identical Promise
    if (projectList === this._lastPromise) {
      return;
    }
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

  getButtonText() {
    const { selected, newExperimentProjectName } = this.props;

    if (selected === "new") {
      return newExperimentProjectName || "Select a compiled experiment";
    }

    if (selected && selected.id) {
      const date = new Date(selected.created_at);
      return `${selected.name} (${date.toLocaleString()})`;
    }

    return "Select a compiled experiment";
  }

  generateModalHTML(projectList) {
    const filteredProjects = projectList.filter(
      (p) => p.name !== "EasyEyesResources",
    );

    const tableRows = filteredProjects
      .map((proj) => {
        const date = new Date(proj.created_at).toLocaleString();
        return `
          <tr data-project-id="${proj.id}" class="experiment-row">
            <td class="experiment-name-cell">${proj.name}</td>
            <td class="experiment-date-cell">${date}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <div class="experiment-modal-container">
        <input
          type="text"
          id="experiment-search"
          class="swal2-input experiment-search-input"
          placeholder="Search experiments..."
        />
        <div class="experiment-table-container">
          <table class="experiment-table">
            <thead>
              <tr>
                <th>Experiment name</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody id="experiment-table-body">
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  handleButtonClick(setSelectedProject) {
    Swal.fire({
      title: "Select an Experiment",
      html: this.generateModalHTML(this.state.resolvedProjectList),
      width: "800px",
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "Cancel",
      confirmButtonColor: "#019267",
      customClass: {
        htmlContainer: "experiment-modal-html-container",
        popup: "experiment-modal-popup",
      },
      didOpen: () => {
        // Search filtering
        const searchInput = document.getElementById("experiment-search");
        const tableBody = document.getElementById("experiment-table-body");

        searchInput.addEventListener("input", (e) => {
          const searchTerm = e.target.value.toLowerCase();
          const rows = tableBody.querySelectorAll(".experiment-row");

          rows.forEach((row) => {
            const name = row
              .querySelector(".experiment-name-cell")
              .textContent.toLowerCase();
            const date = row
              .querySelector(".experiment-date-cell")
              .textContent.toLowerCase();
            const matches =
              name.includes(searchTerm) || date.includes(searchTerm);
            row.style.display = matches ? "" : "none";
          });
        });

        // Row click handlers
        const rows = tableBody.querySelectorAll(".experiment-row");
        rows.forEach((row) => {
          row.addEventListener("click", () => {
            const projectId = row.getAttribute("data-project-id");
            const selectedProj = this.state.resolvedProjectList.find(
              (p) => p.id.toString() === projectId,
            );
            Swal.close();
            if (selectedProj) {
              // this.props.setSelectedProject("REFRESH");
              setSelectedProject(selectedProj);
            }
          });

          // Hover effect
          row.addEventListener("mouseenter", () => {
            row.classList.add("experiment-row-hover");
          });
          row.addEventListener("mouseleave", () => {
            row.classList.remove("experiment-row-hover");
          });
        });

        // Auto-focus search
        searchInput.focus();
      },
    });
  }

  render() {
    const { selected, style, setSelectedProject } = this.props;
    const { isLoadingProjects } = this.state;

    const loadingStyle = isLoadingProjects
      ? { pointerEvents: "none", userSelect: "none" }
      : {};

    const wrapperClass =
      selected && selected !== "new"
        ? "history-dropdown-wrapper history-dropdown-wrapper-fit-content"
        : "history-dropdown-wrapper history-dropdown-wrapper-fixed";

    return (
      <div className={wrapperClass} style={loadingStyle}>
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
          <button
            className="history-dropdown"
            onClick={() => this.handleButtonClick(setSelectedProject)}
            style={style}
          >
            {this.getButtonText()}
          </button>
        )}
      </div>
    );
  }
}
