import React, { useState, useEffect, useRef, useCallback } from "react";
import Swal from "sweetalert2";
import { User } from "../../threshold/preprocess/gitlabUtils";

export type Project = {
  id: number;
  name: string;
  created_at: string;
};

export type DropdownProps = {
  projectList: Promise<Project[]> | Project[] | null;
  selected: Project | null;
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
  selected: Project | null,
  newExperimentProjectName?: string,
): string => {
  const fallback = "Select a compiled experiment";
  if (selected === null) return newExperimentProjectName || fallback;
  if (selected?.id) {
    return `${selected.name} (${formatProjectDate(selected.created_at)})`;
  }
  return fallback;
};

const attachRowHandlers = (
  tableBody: Element,
  rows: Project[],
  onSelect: (proj: Project) => void,
) => {
  tableBody.querySelectorAll(".experiment-row").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.getAttribute("data-project-id");
      const proj = rows.find((p) => p.id.toString() === id);
      if (proj) {
        Swal.close();
        onSelect(proj);
      }
    });
  });
};

const sanitize = (str: string): string =>
  str.replace(/[<>"&]/g, (c) => `&#${c.charCodeAt(0)};`);

const buildTableRows = (projects: Project[]): string =>
  projects.length
    ? projects
        .map(
          (proj) => `
    <tr data-project-id="${proj.id}" class="experiment-row">
      <td class="experiment-name-cell">${sanitize(proj.name)}</td>
      <td class="experiment-date-cell">${formatProjectDate(proj.created_at)}</td>
    </tr>`,
        )
        .join("")
    : `<tr><td colspan="2" class="experiment-empty-cell">No experiments found.</td></tr>`;

const buildModalHTML = (projects: Project[]): string => {
  const rows = buildTableRows(projects);

  return `
    <div class="experiment-modal-container">
      <div class="experiment-modal-toolbar">
        <input type="text" id="experiment-search" class="swal2-input experiment-search-input" placeholder="Search experiments..." />
        <button id="experiment-refresh-btn" class="experiment-refresh-btn">Refresh</button>
      </div>
      <div class="experiment-table-container">
        <table class="experiment-table">
          <thead><tr><th>Experiment name</th><th>Date</th></tr></thead>
          <tbody id="experiment-table-body">${rows}</tbody>
        </table>
      </div>
    </div>`;
};

const openModal = (
  list: Project[],
  onSelect: (proj: Project) => void,
  onRefresh: () => Promise<Project[]>,
) => {
  void Swal.fire({
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
      const refreshBtn = document.getElementById(
        "experiment-refresh-btn",
      ) as HTMLButtonElement;

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

      attachRowHandlers(tableBody, list, onSelect);

      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="bi bi-arrow-clockwise icon-spin"></i>';

        const freshList = await onRefresh();
        tableBody.innerHTML = buildTableRows(freshList);
        attachRowHandlers(tableBody, freshList, onSelect);

        const term = searchInput.value.toLowerCase();
        if (term) {
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
        }

        refreshBtn.innerHTML = "Refresh";
        refreshBtn.disabled = false;
      });

      searchInput.focus();
    },
  });
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

  // Stable ref so the BroadcastChannel handler always calls the latest fetchFreshList
  // without needing to re-create the channel on every resolvedList change
  const fetchFreshListRef = useRef(fetchFreshList);
  useEffect(() => {
    fetchFreshListRef.current = fetchFreshList;
  }, [fetchFreshList]);

  // Refresh the list when another tab compiles a new experiment
  useEffect(() => {
    if (!user?.initProjectList) return;
    const channel = new BroadcastChannel("easyeyes_experiments");
    channel.onmessage = (e) => {
      if (e.data?.type === "experiments:updated")
        void fetchFreshListRef.current();
    };
    return () => channel.close();
  }, [user]);

  const handleClick = useCallback(() => {
    openModal(
      resolvedList.filter(isExperiment),
      (proj) => {
        if (!(selected && selected.id === proj.id)) setSelectedProject(proj);
      },
      fetchFreshList,
    );
  }, [resolvedList, fetchFreshList, selected, setSelectedProject]);

  const wrapperClass = selected
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
