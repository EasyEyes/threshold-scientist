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

jest.mock("../../threshold/preprocess/gitlabSearch", () => ({
  searchProjectsByName: jest.fn(),
}));

import React from "react";
import { render, waitFor, fireEvent, act } from "@testing-library/react";
import { Dropdown } from "../components/Dropdown";
import Swal from "sweetalert2";
import { getProjectsPage } from "../../threshold/preprocess/gitlabUtils";
import { searchProjectsByName } from "../../threshold/preprocess/gitlabSearch";

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

afterEach(() => {
  jest.useRealTimers();
});

describe("Dropdown – search filtering", () => {
  it("hides rows that do not match the search term (client-side filter, no user)", async () => {
    const { container } = render(
      <Dropdown
        projectList={PAGE_1}
        selected={null}
        setSelectedProject={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const searchInput = document.getElementById("experiment-search");
    await act(async () => {
      fireEvent.input(searchInput, { target: { value: "Experiment A" } });
    });

    const rowA = document.querySelector("[data-project-id='1']");
    const rowB = document.querySelector("[data-project-id='2']");
    expect(rowA.style.display).not.toBe("none");
    expect(rowB.style.display).toBe("none");
  });

  it("calls searchProjectsByName (not client-side filter) when user is provided", async () => {
    jest.useFakeTimers();
    searchProjectsByName.mockResolvedValue([
      { id: 99, name: "API Result", created_at: "2024-01-01T00:00:00Z" },
    ]);

    const user = makeUser(1);
    const { container } = render(
      <Dropdown
        projectList={PAGE_1}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const searchInput = document.getElementById("experiment-search");
    fireEvent.input(searchInput, { target: { value: "API" } });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() =>
      expect(searchProjectsByName).toHaveBeenCalledWith(user, "API"),
    );
    jest.useRealTimers();
  });
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

describe("Dropdown – debounced API search", () => {
  it("fires searchProjectsByName after the 300ms debounce delay", async () => {
    jest.useFakeTimers();
    searchProjectsByName.mockResolvedValue([]);

    const user = makeUser(1);
    const { container } = render(
      <Dropdown
        projectList={PAGE_1}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const searchInput = document.getElementById("experiment-search");
    fireEvent.input(searchInput, { target: { value: "Exp" } });

    expect(searchProjectsByName).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(299);
    });
    expect(searchProjectsByName).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(searchProjectsByName).toHaveBeenCalledWith(user, "Exp");

    jest.useRealTimers();
  });

  it("shows a spinner row while the API call is in flight and removes it after", async () => {
    jest.useFakeTimers();
    let resolveSearch;
    const pending = new Promise((res) => {
      resolveSearch = res;
    });
    searchProjectsByName.mockReturnValueOnce(pending);

    const user = makeUser(1);
    const { container } = render(
      <Dropdown
        projectList={PAGE_1}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const searchInput = document.getElementById("experiment-search");
    fireEvent.input(searchInput, { target: { value: "test" } });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(
      document.getElementById("experiment-spinner-row"),
    ).toBeInTheDocument();

    await act(async () => {
      resolveSearch([]);
    });

    expect(
      document.getElementById("experiment-spinner-row"),
    ).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  it("renders search results and excludes EasyEyesResources", async () => {
    jest.useFakeTimers();
    searchProjectsByName.mockResolvedValue([
      { id: 5, name: "My Experiment", created_at: "2024-01-01T00:00:00Z" },
      { id: 6, name: "EasyEyesResources", created_at: "2024-01-01T00:00:00Z" },
    ]);

    const user = makeUser(1);
    const { container } = render(
      <Dropdown
        projectList={PAGE_1}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const searchInput = document.getElementById("experiment-search");
    fireEvent.input(searchInput, { target: { value: "My" } });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() =>
      expect(document.querySelector("[data-project-id='5']")).toBeInTheDocument(),
    );
    expect(document.querySelector("[data-project-id='6']")).not.toBeInTheDocument();

    jest.useRealTimers();
  });

  it("restores the cached list and does not call searchProjectsByName when input is cleared", async () => {
    jest.useFakeTimers();
    searchProjectsByName.mockResolvedValue([
      { id: 99, name: "API Result", created_at: "2024-01-01T00:00:00Z" },
    ]);

    const user = makeUser(1);
    const { container } = render(
      <Dropdown
        projectList={PAGE_1}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const searchInput = document.getElementById("experiment-search");

    // Type a term to trigger the API
    fireEvent.input(searchInput, { target: { value: "API" } });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => expect(searchProjectsByName).toHaveBeenCalledTimes(1));

    // Now clear the field
    searchProjectsByName.mockClear();
    fireEvent.input(searchInput, { target: { value: "" } });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(searchProjectsByName).not.toHaveBeenCalled();

    await waitFor(() =>
      expect(document.querySelector("[data-project-id='1']")).toBeInTheDocument(),
    );
    expect(document.querySelector("[data-project-id='2']")).toBeInTheDocument();

    jest.useRealTimers();
  });

  it("scroll near bottom while search term is active does not call getProjectsPage", async () => {
    jest.useFakeTimers();
    searchProjectsByName.mockResolvedValue([]);

    const user = makeUser(2);
    const { container } = render(
      <Dropdown
        projectList={PAGE_1}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const tableContainer = document.querySelector(
      ".experiment-table-container",
    );
    const searchInput = document.getElementById("experiment-search");

    // Fire debounce with non-empty term — sets isSearchActive = true
    fireEvent.input(searchInput, { target: { value: "Exp" } });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    // Scroll near bottom while search is active
    await act(async () => {
      scrollNearBottom(tableContainer);
    });

    expect(getProjectsPage).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it("calls getProjectsPage after the search field is cleared", async () => {
    jest.useFakeTimers();
    searchProjectsByName.mockResolvedValue([]);
    getProjectsPage.mockResolvedValue(PAGE_2);

    const user = makeUser(2);
    const { container } = render(
      <Dropdown
        projectList={PAGE_1}
        selected={null}
        setSelectedProject={jest.fn()}
        user={user}
      />,
    );

    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const tableContainer = document.querySelector(
      ".experiment-table-container",
    );
    const searchInput = document.getElementById("experiment-search");

    // Activate search (isSearchActive = true)
    fireEvent.input(searchInput, { target: { value: "Exp" } });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await waitFor(() => expect(searchProjectsByName).toHaveBeenCalledTimes(1));

    // Clear the field (isSearchActive = false, cache restored)
    fireEvent.input(searchInput, { target: { value: "" } });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    // Scroll near bottom — page load should proceed
    await act(async () => {
      scrollNearBottom(tableContainer);
    });

    await waitFor(() => expect(getProjectsPage).toHaveBeenCalledWith(user, 2));

    jest.useRealTimers();
  });

  it("clicking a row in search results calls setSelectedProject with the correct project", async () => {
    jest.useFakeTimers();
    const searchResult = {
      id: 77,
      name: "Clicked Experiment",
      created_at: "2024-03-01T00:00:00Z",
    };
    searchProjectsByName.mockResolvedValue([searchResult]);

    const setSelectedProject = jest.fn();
    const user = makeUser(1);
    const { container } = render(
      <Dropdown
        projectList={PAGE_1}
        selected={null}
        setSelectedProject={setSelectedProject}
        user={user}
      />,
    );

    await act(async () => {
      fireEvent.click(container.querySelector("button"));
    });
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledTimes(1));

    const searchInput = document.getElementById("experiment-search");
    fireEvent.input(searchInput, { target: { value: "Clicked" } });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() =>
      expect(document.querySelector("[data-project-id='77']")).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(document.querySelector("[data-project-id='77']"));
    });

    expect(setSelectedProject).toHaveBeenCalledWith(searchResult);

    jest.useRealTimers();
  });
});
