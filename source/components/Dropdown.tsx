import React, { useState, useEffect, useRef, useCallback } from "react";
import Swal from "sweetalert2";
import { User } from "../../threshold/preprocess/gitlabUtils";

export type Project = {
  id: number;
  name: string;
  created_at: string;
};

export type DropdownProps = {
  projectList: Promise<Project[]> | Project[] | null | undefined;
  selected: Project | "new" | null | undefined;
  newExperimentProjectName?: string;
  setSelectedProject: (project: Project) => void;
  style?: React.CSSProperties;
  user?: User;
};

const isExperiment = (project: Project): boolean =>
  project.name !== "EasyEyesResources";

const formatProjectDate = (dateStr: string): string =>
  new Date(dateStr).toLocaleString(undefined, {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

const getButtonText = (
  selected: Project | "new" | null | undefined,
  newExperimentProjectName?: string,
): string => {
  const fallback = "Select a compiled experiment";
  if (selected === "new") return newExperimentProjectName || fallback;
  if (selected?.id) {
    return `${selected.name} (${formatProjectDate(selected.created_at)})`;
  }
  return fallback;
};

const buildModalHTML = (projects: Project[]): string => {
  const sanitize = (str: string): string =>
    str.replace(/[<>"&]/g, (c) => `&#${c.charCodeAt(0)};`);

  const createProjectRow = (proj: Project): string => {
    const date = formatProjectDate(proj.created_at);
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
};

export const Dropdown = ({
  projectList,
  selected,
  newExperimentProjectName,
  setSelectedProject,
  style,
  user,
}: DropdownProps) => {
  const [resolvedList, setResolvedList] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const lastPromiseRef = useRef<Promise<Project[]> | Project[] | null>(null);

  useEffect(() => {
    if (projectList === lastPromiseRef.current) return;
    lastPromiseRef.current = projectList ?? null;

    if (!projectList) {
      setResolvedList([]);
      return;
    }

    const asPromise = projectList as Promise<Project[]>;
    if (typeof asPromise.then === "function") {
      setIsLoading(true);
      asPromise
        .then((resolved) => setResolvedList(resolved ?? []))
        .catch(() => setResolvedList([]))
        .finally(() => setIsLoading(false));
    } else {
      setResolvedList(Array.isArray(projectList) ? projectList : []);
    }
  }, [projectList]);

  const fetchFreshList = useCallback(async (): Promise<Project[]> => {
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
    (list: Project[]) => {
      Swal.fire({
        title: "Select an Experiment",
        width: "800px",
        showConfirmButton: true,
        confirmButtonText: "Close",
        confirmButtonColor: "#019267",
        customClass: {
          htmlContainer: "experiment-modal-html-container",
          popup: "experiment-modal-popup",
        },
        html: buildModalHTML(list),
        didOpen: () => {
          const searchInput = document.getElementById(
            "experiment-search",
          ) as HTMLInputElement;
          const tableBody = document.getElementById("experiment-table-body")!;

          searchInput.addEventListener("input", (e) => {
            const term = (e.target as HTMLInputElement).value.toLowerCase();
            tableBody.querySelectorAll(".experiment-row").forEach((row) => {
              const name = row
                .querySelector(".experiment-name-cell")!
                .textContent!.toLowerCase();
              const date = row
                .querySelector(".experiment-date-cell")!
                .textContent!.toLowerCase();
              (row as HTMLElement).style.display =
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
};
