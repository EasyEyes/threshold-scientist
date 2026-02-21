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

  const openModal = useCallback(() => {
    const filtered = resolvedList.filter((p) => p.name !== "EasyEyesResources");

    Swal.fire({
      title: "Select an Experiment",
      width: "800px",
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: "Cancel",
      confirmButtonColor: "#019267",
      customClass: {
        htmlContainer: "experiment-modal-html-container",
        popup: "experiment-modal-popup",
      },
      html: buildModalHTML(filtered),
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
            const proj = filtered.find((p) => p.id.toString() === id);
            if (proj) {
              Swal.close();
              setSelectedProject(proj);
            }
          });
        });

        searchInput.focus();
      },
    });
  }, [resolvedList, setSelectedProject]);

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
        onClick={isLoading ? undefined : openModal}
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
  const rows = projects
    .map((proj) => {
      const date = new Date(proj.created_at).toLocaleString();
      // Sanitize to prevent XSS from project names/dates
      const safeName = proj.name.replace(
        /[<>"&]/g,
        (c) => `&#${c.charCodeAt(0)};`,
      );
      return `
        <tr data-project-id="${proj.id}" class="experiment-row">
          <td class="experiment-name-cell">${safeName}</td>
          <td class="experiment-date-cell">${date}</td>
        </tr>`;
    })
    .join("");

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
