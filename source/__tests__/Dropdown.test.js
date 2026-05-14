jest.mock("sweetalert2", () => ({
  __esModule: true,
  default: {
    fire: jest.fn(),
    close: jest.fn(),
  },
}));

jest.mock("../../threshold/preprocess/auth/ensureValidToken", () => ({
  ensureValidToken: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../threshold/preprocess/user", () => ({
  redirectToOauth2: jest.fn(),
}));

jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  getProjectsPage: jest.fn(),
}));

import React from "react";
import { render, waitFor, fireEvent, act } from "@testing-library/react";
import { Dropdown } from "../components/Dropdown";
import Swal from "sweetalert2";
import { getProjectsPage } from "../../threshold/preprocess/gitlabUtils";

// jsdom does not ship BroadcastChannel
global.BroadcastChannel = jest.fn(() => ({ onmessage: null, close: jest.fn() }));

const PAGE_1 = [
  { id: 1, name: "Experiment A", created_at: "2024-01-01T00:00:00Z" },
  { id: 2, name: "Experiment B", created_at: "2024-01-02T00:00:00Z" },
];

const PAGE_2 = [
  { id: 10, name: "Page2 Experiment X", created_at: "2024-02-01T00:00:00Z" },
];

/** Captures opts from Swal.fire, inserts the HTML, and calls didOpen immediately. */
function mockSwalOpen() {
  let capturedOpts = null;
  Swal.fire.mockImplementation((opts) => {
    capturedOpts = opts;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = opts.html;
    document.body.appendChild(wrapper);
    opts.didOpen?.();
    return Promise.resolve({ isConfirmed: false, isDismissed: false });
  });
  return () => capturedOpts;
}

/** Simulates a scroll event that is within 200px of the bottom. */
function scrollNearBottom(container) {
  Object.defineProperty(container, "scrollHeight", {
    configurable: true,
    get: () => 1000,
  });
  Object.defineProperty(container, "clientHeight", {
    configurable: true,
    get: () => 400,
  });
  container.scrollTop = 450; // 1000 - 450 - 400 = 150 < 200
  fireEvent.scroll(container);
}

function makeUser(totalProjectPages = 2) {
  return {
    initProjectList: jest.fn().mockResolvedValue(true),
    projectList: Promise.resolve(PAGE_1),
    totalProjectPages,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  document.body.innerHTML = "";
  mockSwalOpen();
});

describe("Dropdown – infinite scroll", () => {
  it("shows a spinner row while the next page is loading, then removes it", async () => {
    let resolveLoad;
    const pendingLoad = new Promise((res) => {
      resolveLoad = res;
    });
    getProjectsPage.mockReturnValueOnce(pendingLoad);

    const user = makeUser(2);
    const { container } = render(
      <Dropdown
        projectList={user.projectList}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    await waitFor(() =>
      expect(container.querySelector("button")).not.toBeDisabled(),
    );
    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const tableContainer = document.querySelector(
      ".experiment-table-container",
    );
    await act(async () => {
      scrollNearBottom(tableContainer);
    });

    // Spinner must appear before the promise resolves
    await waitFor(() =>
      expect(
        document.getElementById("experiment-spinner-row"),
      ).toBeInTheDocument(),
    );

    // Resolve the load and confirm spinner disappears, rows appear
    await act(async () => {
      resolveLoad(PAGE_2);
    });

    await waitFor(() =>
      expect(
        document.getElementById("experiment-spinner-row"),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        document.querySelector("[data-project-id='10']"),
      ).toBeInTheDocument(),
    );
  });

  it("does not fetch again after hasMore becomes false", async () => {
    // totalProjectPages = 2, so after loading page 2 there are no more pages
    getProjectsPage.mockResolvedValue(PAGE_2);

    const user = makeUser(2);
    const { container } = render(
      <Dropdown
        projectList={user.projectList}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    await waitFor(() =>
      expect(container.querySelector("button")).not.toBeDisabled(),
    );
    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const tableContainer = document.querySelector(
      ".experiment-table-container",
    );

    // First scroll – loads page 2, exhausts pages
    await act(async () => {
      scrollNearBottom(tableContainer);
    });
    await waitFor(() => expect(getProjectsPage).toHaveBeenCalledTimes(1));

    // Second scroll – should NOT trigger another fetch
    await act(async () => {
      fireEvent.scroll(tableContainer);
    });

    expect(getProjectsPage).toHaveBeenCalledTimes(1);
  });

  it("Refresh button resets pagination so the next scroll loads page 2 again", async () => {
    getProjectsPage.mockResolvedValue(PAGE_2);
    let resolveRefresh;
    const user = makeUser(2);
    user.initProjectList = jest.fn().mockImplementation(() => {
      user.projectList = new Promise((res) => {
        resolveRefresh = res;
      });
      return Promise.resolve(true);
    });

    const { container } = render(
      <Dropdown
        projectList={Promise.resolve(PAGE_1)}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    await waitFor(() =>
      expect(container.querySelector("button")).not.toBeDisabled(),
    );
    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const tableContainer = document.querySelector(
      ".experiment-table-container",
    );

    // Load page 2 (exhausts pages, hasMore → false); wait for rows to confirm loadMore completed
    await act(async () => {
      scrollNearBottom(tableContainer);
    });
    await waitFor(() =>
      expect(
        document.querySelector("[data-project-id='10']"),
      ).toBeInTheDocument(),
    );

    // Click Refresh
    const refreshBtn = document.getElementById("experiment-refresh-btn");
    await act(async () => {
      fireEvent.click(refreshBtn);
      resolveRefresh(PAGE_1);
    });

    // Scroll again – pagination must have reset so page 2 is fetched once more
    await act(async () => {
      scrollNearBottom(tableContainer);
    });
    await waitFor(() =>
      expect(getProjectsPage).toHaveBeenCalledTimes(2),
    );
    expect(getProjectsPage).toHaveBeenNthCalledWith(2, user, 2);
  });

  it("closing and reopening the modal shows only the page-1 list (no stale rows)", async () => {
    getProjectsPage.mockResolvedValue(PAGE_2);

    const user = makeUser(2);
    const { container } = render(
      <Dropdown
        projectList={user.projectList}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    await waitFor(() =>
      expect(container.querySelector("button")).not.toBeDisabled(),
    );

    // First open + scroll to load page 2
    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const tableContainer = document.querySelector(
      ".experiment-table-container",
    );
    await act(async () => {
      scrollNearBottom(tableContainer);
    });
    await waitFor(() =>
      expect(
        document.querySelector("[data-project-id='10']"),
      ).toBeInTheDocument(),
    );

    // Simulate close: remove the modal DOM that our Swal mock inserted
    document
      .querySelector(".experiment-modal-container")
      ?.parentElement?.remove();

    // Reopen
    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(2));

    // Only page-1 rows must be present; page-2 row must not exist
    expect(document.querySelector("[data-project-id='10']")).not.toBeInTheDocument();
    expect(document.querySelector("[data-project-id='1']")).toBeInTheDocument();
    expect(document.querySelector("[data-project-id='2']")).toBeInTheDocument();
  });

  it("triggers getProjectsPage(user, 2) and appends new rows when scrolled near bottom", async () => {
    getProjectsPage.mockResolvedValue(PAGE_2);

    const user = makeUser(2);
    const { container } = render(
      <Dropdown
        projectList={user.projectList}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    // Wait for page-1 list to resolve (button becomes enabled)
    await waitFor(() =>
      expect(container.querySelector("button")).not.toBeDisabled(),
    );

    // Open the modal
    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    // Scroll near the bottom of the table container
    const tableContainer = document.querySelector(
      ".experiment-table-container",
    );
    await act(async () => {
      scrollNearBottom(tableContainer);
    });

    // getProjectsPage must have been called with page 2
    await waitFor(() =>
      expect(getProjectsPage).toHaveBeenCalledWith(user, 2),
    );

    // The new row must appear in the DOM
    await waitFor(() =>
      expect(
        document.querySelector("[data-project-id='10']"),
      ).toBeInTheDocument(),
    );
  });
});
