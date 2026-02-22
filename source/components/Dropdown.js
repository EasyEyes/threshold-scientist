import React, { useState, useEffect, useRef, useCallback } from "react";
import Swal from "sweetalert2";

function getButtonText(selected, newExperimentProjectName) {
  const fallback = "Select a compiled experiment";
  if (selected === "new") return newExperimentProjectName || fallback;
  if (selected?.id) {
    return `${selected.name} (${new Date(
      selected.created_at,
    ).toLocaleString()})`;
  }
  return fallback;
}

export default function Dropdown({
  projectList,
  selected,
  newExperimentProjectName,
  setSelectedProject,
  style,
  user,
}) {
  const [resolvedList, setResolvedList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastPromiseRef = useRef(null);

  useEffect(() => {
    if (projectList === lastPromiseRef.current) return;
    lastPromiseRef.current = projectList;

    if (!projectList) {
      setResolvedList([]);
      return;
    }

    if (typeof projectList.then === "function") {
      setIsLoading(true);
      projectList
        .then((resolved) => setResolvedList(resolved ?? []))
        .catch(() => setResolvedList([]))
        .finally(() => setIsLoading(false));
    } else {
      setResolvedList(Array.isArray(projectList) ? projectList : []);
    }
  }, [projectList]);

  const isExperiment = (project) => project.name !== "EasyEyesResources";

  const fetchFreshList = useCallback(async () => {
    if (!user?.initProjectList) return resolvedList.filter(isExperiment);
    setIsLoading(true);
    try {
      await user.initProjectList(true);
      const freshList = (await user.projectList) ?? [];
      const experiments = freshList.filter(isExperiment);
      setResolvedList(experiments);
      return experiments;
    } catch {
      return resolvedList.filter(isExperiment);
    } finally {
      setIsLoading(false);
    }
  }, [user, resolvedList]);

  const openModal = useCallback(
    (list) => {
      Swal.fire({
        title: "Select an Experiment",
        width: "800px",
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: "Close",
        confirmButtonColor: "#019267",
        customClass: {
          htmlContainer: "experiment-modal-html-container",
          popup: "experiment-modal-popup",
        },
        html: buildModalHTML(list),
        didOpen: () => {
          const searchInput = document.getElementById("experiment-search");
          const tableBody = document.getElementById("experiment-table-body");

          searchInput.addEventListener("input", (e) => {
            const term = e.target.value.toLowerCase();
            tableBody.querySelectorAll(".experiment-row").forEach((row) => {
              const name = row
                .querySelector(".experiment-name-cell")
                .textContent.toLowerCase();
              const date = row
                .querySelector(".experiment-date-cell")
                .textContent.toLowerCase();
              row.style.display =
                name.includes(term) || date.includes(term) ? "" : "none";
            });
          });

          tableBody.querySelectorAll(".experiment-row").forEach((row) => {
            row.addEventListener("click", () => {
              const id = row.getAttribute("data-project-id");
              const proj = list.find((p) => p.id.toString() === id);
              if (proj) {
                Swal.close();
                setSelectedProject(proj);
              }
            });
          });

          searchInput.focus();
        },
      });
    },
    [setSelectedProject],
  );

  const handleClick = useCallback(async () => {
    const list = await fetchFreshList();
    openModal(list);
  }, [fetchFreshList, openModal]);

  const wrapperClass =
    selected && selected !== "new"
      ? "history-dropdown-wrapper history-dropdown-wrapper-fit-content"
      : "history-dropdown-wrapper history-dropdown-wrapper-fixed";

  return (
    <div
      className={wrapperClass}
      style={isLoading ? { pointerEvents: "none", userSelect: "none" } : {}}
    >
      <button
        className="history-dropdown"
        onClick={isLoading ? undefined : handleClick}
        disabled={isLoading}
        style={{
          ...style,
          ...(isLoading ? { pointerEvents: "none", cursor: "default" } : {}),
        }}
      >
        {isLoading ? (
          <i
            className="bi bi-arrow-repeat icon-spin"
            style={{ color: "white" }}
          />
        ) : (
          getButtonText(selected, newExperimentProjectName)
        )}
      </button>
    </div>
  );
}

function buildModalHTML(projects) {
  const sanitize = (str) =>
    str.replace(/[<>"&]/g, (c) => `&#${c.charCodeAt(0)};`);

  const createProjectRow = (proj) => {
    const date = new Date(proj.created_at).toLocaleString();
    const safeName = sanitize(proj.name);
    return `
    <tr data-project-id="${proj.id}" class="experiment-row">
      <td class="experiment-name-cell">${safeName}</td>
      <td class="experiment-date-cell">${date}</td>
    </tr>`;
  };

  const emptyRow = `
  <tr>
    <td colspan="2" class="experiment-empty-cell">No experiments found.</td>
  </tr>`;

  const rows = projects.length
    ? projects.map(createProjectRow).join("")
    : emptyRow;

  return `
    <div class="experiment-modal-container">
      <input type="text" id="experiment-search" class="swal2-input experiment-search-input" placeholder="Search experiments..." />
      <div class="experiment-table-container">
        <table class="experiment-table">
          <thead><tr><th>Experiment name</th><th>Date</th></tr></thead>
          <tbody id="experiment-table-body">${rows}</tbody>
        </table>
      </div>
    </div>`;
}
