import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App, { normalizeRecruitmentInformation } from "../App";
import Running from "../Running";
import { formatLocalDeploymentTime } from "../freshness/formatLocalDeploymentTime";

jest.mock("firebase/database", () => ({
  set: jest.fn(),
  ref: jest.fn(),
  get: jest.fn().mockResolvedValue({ val: () => ({ count: 0 }) }),
}));

jest.mock("@firebase/util", () => ({
  uuidv4: jest.fn(() => "test-uuid"),
}));

jest.mock("sweetalert2", () => ({
  fire: jest.fn(),
  showLoading: jest.fn(),
  close: jest.fn(),
}));

jest.mock("../Step", () => () => null);
jest.mock("../StatusLines", () => () => null);

jest.mock("../components/steps", () => ({
  allSteps: jest.fn(() => ["login", "table", "upload", "running"]),
}));

jest.mock("../../threshold/preprocess/gitlabUtils", () => ({
  getCompatibilityRequirementsForProject: jest.fn(),
  getExperimentStatus: jest.fn(),
  getOriginalFileNameForProject: jest.fn(),
  getRecruitmentServiceConfig: jest.fn(),
  getDurationForProject: jest.fn(),
  getProlificStudyConfig: jest.fn(),
  getProlificStudyId: jest.fn(),
  getDataFolderCsvLength: jest.fn(),
  runExperiment: jest.fn(),
  getAllProjects: jest.fn(),
  User: jest.fn(() => ({})),
  copyUser: jest.fn((u) => ({ ...u })),
  getCommonResourcesNames: jest.fn(),
}));

jest.mock("../../threshold/preprocess/retry", () => ({
  getRetryDelayMs: jest.fn(() => 0),
}));

jest.mock("../../threshold/preprocess/constants", () => ({
  resourcesFileTypes: ["fonts", "images"],
}));

jest.mock("../components/firebase", () => ({
  auth: {},
  db: {},
}));

jest.mock("../components/prolificIntegration", () => ({
  getProlificAccount: jest.fn(),
  getProlificStudySubmissions: jest.fn(),
}));

jest.mock("../../threshold/components/compatibilityCheck", () => ({
  getCompatibilityRequirements: jest.fn(),
}));

jest.mock("../../threshold/preprocess/global", () => ({
  compatibilityRequirements: { t: [] },
}));

jest.mock("firebase/auth", () => ({
  signInAnonymously: jest.fn().mockResolvedValue({}),
}));

jest.mock("../components/firebase_soundProfile", () => ({
  getSoundProfileStatement: jest.fn(),
}));

jest.mock("../sentry", () => ({
  captureError: jest.fn(),
  captureCompilerFailure: jest.fn(),
  recordCompilerPhase: jest.fn(),
  startCompilerOperation: jest.fn(() => ({
    operation: "experiment-retrieval",
    operationId: "test-operation",
  })),
}));

jest.mock("../components/phrasesApi", () => ({
  fetchPhrasesVersion: jest.fn(),
  fetchPhrasesByVersion: jest.fn(),
}));

jest.mock("../components/glossaryApi", () => ({
  startGlossaryPrefetch: jest.fn(),
  fetchGlossaryVersion: jest.fn().mockResolvedValue({
    version: null,
    publishedAt: null,
  }),
}));

jest.mock("../../threshold/parameters/phrasesRegistry", () => ({
  initPhrases: jest.fn(),
}));

global.fetch = jest.fn().mockResolvedValue({ ok: false });

const mockPhrasesData = {
  version: "1.0",
  phrases: { greeting: { en: "Hello", fr: "Bonjour" } },
};

describe("normalizeRecruitmentInformation", () => {
  it("uses empty recruitment metadata when an experiment repository has no files", () => {
    expect(normalizeRecruitmentInformation(null)).toEqual({
      recruitmentServiceName: null,
      recruitmentServiceCompletionCode: null,
      recruitmentServiceURL: null,
      recruitmentProlificWorkspace: null,
    });
  });

  it("preserves recruitment metadata returned for a compiled experiment", () => {
    expect(
      normalizeRecruitmentInformation({
        recruitmentServiceName: "Prolific",
        recruitmentServiceCompletionCode: "COMPLETE",
      }),
    ).toEqual({
      recruitmentServiceName: "Prolific",
      recruitmentServiceCompletionCode: "COMPLETE",
      recruitmentServiceURL: null,
      recruitmentProlificWorkspace: null,
    });
  });
});

describe("App - handleSetActivateExperiment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not request repository files when a failed compilation left an empty repository", async () => {
    const Swal = require("sweetalert2");
    const {
      getCompatibilityRequirementsForProject,
      getDurationForProject,
      getExperimentStatus,
      getOriginalFileNameForProject,
      getRecruitmentServiceConfig,
    } = require("../../threshold/preprocess/gitlabUtils");
    getExperimentStatus.mockResolvedValue("INACTIVE");
    Swal.fire.mockImplementation(async ({ didOpen }) => {
      await didOpen();
    });

    const fakeThis = {
      state: { user: { username: "testuser" } },
      setState: jest.fn((update) => {
        fakeThis.state = { ...fakeThis.state, ...update };
      }),
    };
    const emptyExperiment = {
      id: 533761,
      name: "failed-compilation",
      path_with_namespace: "testuser/failed-compilation",
      empty_repo: true,
      default_branch: null,
    };

    await App.prototype.handleSetActivateExperiment.call(
      fakeThis,
      emptyExperiment,
    );

    expect(getDurationForProject).not.toHaveBeenCalled();
    expect(getCompatibilityRequirementsForProject).not.toHaveBeenCalled();
    expect(getOriginalFileNameForProject).not.toHaveBeenCalled();
    expect(getRecruitmentServiceConfig).not.toHaveBeenCalled();
    expect(getExperimentStatus).toHaveBeenCalledWith(fakeThis.state.user, {
      id: emptyExperiment.id,
    });
    expect(fakeThis.state.previousExperimentViewed).toEqual({
      originalFileName: null,
      previousExperimentStatus: "INACTIVE",
      previousRecruitmentInformation: {
        recruitmentServiceName: null,
        recruitmentServiceCompletionCode: null,
        recruitmentServiceURL: null,
        recruitmentProlificWorkspace: null,
      },
      previousCompatibilityRequirements: null,
      previousExperimentDuration: null,
      previousExperimentLanguage: null,
      previousProlificConfig: null,
    });
  });
});

describe("empty repository view lifecycle", () => {
  const emptyExperiment = {
    id: 533761,
    name: "failed-compilation",
    empty_repo: true,
    default_branch: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not query results or activate an empty repository when Running mounts", async () => {
    const {
      getDataFolderCsvLength,
    } = require("../../threshold/preprocess/gitlabUtils");
    const fakeThis = {
      props: {
        activeExperiment: emptyExperiment,
        scrollToCurrentStep: jest.fn(),
        functions: {
          handleSetCompileCount: jest.fn(),
        },
      },
      setState: jest.fn(),
      setModeToRun: jest.fn(),
    };

    await Running.prototype.componentDidMount.call(fakeThis);

    expect(getDataFolderCsvLength).not.toHaveBeenCalled();
    expect(fakeThis.setModeToRun).not.toHaveBeenCalled();
  });

  it("does not allow direct activation of an empty repository", async () => {
    const Swal = require("sweetalert2");
    const { runExperiment } = require("../../threshold/preprocess/gitlabUtils");
    const fakeThis = {
      props: { activeExperiment: emptyExperiment },
      _isActivating: false,
    };

    await Running.prototype.setModeToRun.call(fakeThis);

    expect(Swal.fire).not.toHaveBeenCalled();
    expect(runExperiment).not.toHaveBeenCalled();
  });

  it("offers recovery actions for an empty repository", () => {
    const handleSetActivateExperiment = jest.fn();
    const { container, getByRole } = render(
      <Running
        activeExperiment={emptyExperiment}
        compileWarnings={[]}
        experimentStatus="INACTIVE"
        functions={{
          handleSetActivateExperiment,
          handleSetCompileCount: jest.fn(),
        }}
        previousExperimentViewed={{
          previousExperimentStatus: "RUNNING",
          previousRecruitmentInformation: null,
        }}
        projectName={emptyExperiment.name}
        scrollToCurrentStep={jest.fn()}
        user={{
          username: "testuser",
          projectList: Promise.resolve([]),
          currentExperiment: {
            participantRecruitmentServiceName: "",
            pavloviaPreferRunningModeBool: true,
          },
        }}
        viewingPreviousExperiment={true}
      />,
    );

    expect(getByRole("button", { name: "Go to Pavlovia" })).toBeInTheDocument();
    expect(getByRole("button", { name: "Download source" })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: "Run" }),
    ).not.toBeInTheDocument();
    expect(getByRole("button", { name: "Download results" })).toBeEnabled();
    expect(getByRole("button", { name: "Analyze" })).toBeEnabled();
    expect(getByRole("button", { name: "Refresh" })).toBeEnabled();
    expect(container.querySelectorAll(".icon-holder")).toHaveLength(2);

    fireEvent.click(getByRole("button", { name: "New" }));
    expect(handleSetActivateExperiment).toHaveBeenCalledWith("REFRESH");
  });
});

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { get } = require("firebase/database");
    const {
      fetchPhrasesVersion,
      fetchPhrasesByVersion,
    } = require("../components/phrasesApi");
    fetchPhrasesVersion.mockResolvedValue({ version: mockPhrasesData.version });
    fetchPhrasesByVersion.mockResolvedValue(mockPhrasesData);
    get.mockResolvedValue({ val: () => ({ count: 0 }) });
    global.fetch.mockResolvedValue({ ok: false });
  });

  it("calls startGlossaryPrefetch unconditionally on mount", async () => {
    const { startGlossaryPrefetch } = require("../components/glossaryApi");

    render(<App />);

    await waitFor(() => {
      expect(startGlossaryPrefetch).toHaveBeenCalledTimes(1);
    });
  });

  it("checks the latest version, then fetches that specific version and calls initPhrases", async () => {
    const {
      fetchPhrasesVersion,
      fetchPhrasesByVersion,
    } = require("../components/phrasesApi");
    const {
      initPhrases,
    } = require("../../threshold/parameters/phrasesRegistry");

    render(<App />);

    await waitFor(() => {
      expect(initPhrases).toHaveBeenCalledWith(mockPhrasesData);
    });
    expect(fetchPhrasesVersion).toHaveBeenCalledTimes(1);
    expect(fetchPhrasesByVersion).toHaveBeenCalledWith(mockPhrasesData.version);
  });

  it("renders a phrases error message when the version probe rejects", async () => {
    const { fetchPhrasesVersion } = require("../components/phrasesApi");
    fetchPhrasesVersion.mockRejectedValue(new Error("network error"));

    const { getByText } = render(<App />);

    await waitFor(() => {
      expect(getByText(/failed to load phrases/i)).toBeInTheDocument();
    });
  });
});

describe("App - handleReturnToStep", () => {
  const STEPS = ["login", "table", "upload", "running"];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("preserves the projectList promise reference on the refreshed User", async () => {
    const { copyUser } = require("../../threshold/preprocess/gitlabUtils");
    const existingProjectList = Promise.resolve([{ name: "MyExperiment" }]);

    // Capture this.projectList at the moment initProjectList is called, so we
    // can confirm the refreshed User keeps the original promise rather than
    // triggering a fresh project-list fetch.
    let projectListAtCallTime;
    const initProjectList = jest.fn(function () {
      projectListAtCallTime = this.projectList;
      return Promise.resolve();
    });
    // Mimic a freshly constructed User: projectList starts empty, so the only
    // way it can equal the original promise at initProjectList time is if
    // handleReturnToStep explicitly carries it over.
    copyUser.mockImplementation((u) => ({
      ...u,
      projectList: Promise.resolve([]),
      initProjectList,
    }));

    const currentUser = {
      accessToken: "test-token",
      username: "testuser",
      name: "Test User",
      id: "42",
      avatar_url: "https://example.com/avatar.png",
      projectList: existingProjectList,
    };

    // Call the method directly on a fake 'this', avoiding full App construction
    const fakeThis = {
      state: { user: currentUser, currentStep: "running" },
      setState: jest.fn((update) => {
        fakeThis.state = { ...fakeThis.state, ...update };
      }),
      allSteps: STEPS,
    };

    await App.prototype.handleReturnToStep.call(fakeThis, "table");

    // initProjectList must have been called with force-refresh = true
    expect(initProjectList).toHaveBeenCalledWith(true);

    // At the time initProjectList ran, this.projectList must be the original promise
    expect(projectListAtCallTime).toBe(existingProjectList);
  });
});

describe("App - compileFromStudio after a classic compile", () => {
  // After a compile the page shows the Run step of the experiment it just
  // made (activeExperiment = that repo). A Studio compile must be a fresh
  // compilation from there — not "Compiler not ready".
  const fakeApp = (state) => {
    const table = { compileFiles: jest.fn() };
    const app = {
      state: {
        accessToken: "t",
        user: { username: "u" },
        currentStep: "table",
        activeExperiment: "new",
        ...state,
      },
      tableRef: { current: table },
      closeStudio: jest.fn(),
      handleSetActivateExperiment: jest.fn(async function (which) {
        // The real one resets activeExperiment and returns to the table step.
        if (which === "REFRESH")
          app.state = {
            ...app.state,
            activeExperiment: "new",
            currentStep: "table",
          };
      }),
      resetCompilerForNewExperiment:
        App.prototype.resetCompilerForNewExperiment,
      waitForTable: App.prototype.waitForTable,
    };
    return { app, table };
  };
  const files = [new File(["a"], "exp.csv")];

  beforeEach(() => jest.clearAllMocks());
  afterEach(() => {
    // The Fast compile progress dialog each of these opens.
    require("../studio/fastCompileProgress").hideFastCompileProgress();
  });

  it("resets the compiler (as 'new experiment' does) when the Run step of a compiled experiment is showing", async () => {
    const { app, table } = fakeApp({
      currentStep: "running",
      activeExperiment: "my_exp_1",
      newRepo: "my_exp_1",
    });
    expect(await App.prototype.compileFromStudio.call(app, files)).toBe(true);
    expect(app.handleSetActivateExperiment).toHaveBeenCalledWith("REFRESH");
    expect(table.compileFiles).toHaveBeenCalledWith(files, "studio");
  });

  it("opens the Fast compile progress dialog before handing the files over", async () => {
    const Swal = require("sweetalert2");
    const { app, table } = fakeApp({});
    table.compileFiles.mockImplementation(() => {
      // Already up when the compile starts, so the first phases land on it.
      expect(Swal.fire).toHaveBeenCalledTimes(1);
    });
    expect(await App.prototype.compileFromStudio.call(app, files)).toBe(true);
    expect(table.compileFiles).toHaveBeenCalledTimes(1);
    const options = Swal.fire.mock.calls[0][0];
    expect(options.title).toContain("Fast compile");
    expect(options.html).toContain("ee-fast-compile-time");
    expect(options.showConfirmButton).toBe(false);
  });

  it("a preview opens the dialog labelled Preview", async () => {
    const Swal = require("sweetalert2");
    const { app } = fakeApp({});
    await App.prototype.previewFromStudio.call(app, files, null);
    expect(Swal.fire.mock.calls[0][0].title).toContain("Preview");
    expect(Swal.fire.mock.calls[0][0].title).not.toContain("Fast compile");
  });

  it("still rethrows if handing the files over throws", async () => {
    const { app, table } = fakeApp({});
    table.compileFiles.mockImplementation(() => {
      throw new Error("no table");
    });
    await expect(
      App.prototype.compileFromStudio.call(app, files),
    ).rejects.toThrow("no table");
  });

  it("also resets when a previous experiment is being viewed", async () => {
    const { app } = fakeApp({ activeExperiment: "older_exp" });
    await App.prototype.previewFromStudio.call(app, files, null);
    expect(app.handleSetActivateExperiment).toHaveBeenCalledWith("REFRESH");
  });

  it("does not reset a compiler already on a fresh table step", async () => {
    const { app, table } = fakeApp({});
    expect(await App.prototype.compileFromStudio.call(app, files)).toBe(true);
    expect(app.handleSetActivateExperiment).not.toHaveBeenCalled();
    expect(table.compileFiles).toHaveBeenCalledWith(files, "studio");
  });
});

describe("App - studioPastExperiments", () => {
  // The Studio's "Open past experiment…" gets one api object per signed-in
  // User (a stable prop), and nothing when signed out.
  it("is null when signed out", () => {
    expect(
      App.prototype.studioPastExperiments.call({
        state: { accessToken: null, user: null },
      }),
    ).toBeNull();
    expect(
      App.prototype.studioPastExperiments.call({
        state: { accessToken: "t", user: null },
      }),
    ).toBeNull();
  });

  it("is built once per User object and lists that user's experiments", async () => {
    const user = {
      projectList: Promise.resolve([
        { id: 1, name: "reading", created_at: "2026-01-01T00:00:00Z" },
      ]),
      totalProjectPages: 1,
    };
    const fakeThis = { state: { accessToken: "t", user } };
    const api = App.prototype.studioPastExperiments.call(fakeThis);
    expect(App.prototype.studioPastExperiments.call(fakeThis)).toBe(api);
    await expect(api.list()).resolves.toEqual({
      experiments: [
        { id: 1, name: "reading", created_at: "2026-01-01T00:00:00Z" },
      ],
      totalPages: 1,
    });

    fakeThis.state = { accessToken: "t", user: { ...user } };
    expect(App.prototype.studioPastExperiments.call(fakeThis)).not.toBe(api);
  });
});

describe("App - handleUpdateCompileCount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("records the compile with the browser timezone", () => {
    const { set, ref, get } = require("firebase/database");
    ref.mockImplementation((_database, path) => path);
    get.mockResolvedValue({
      exists: () => true,
      val: () => 4,
    });

    const fakeThis = {
      state: { user: { username: "testuser" } },
    };

    expect(() =>
      App.prototype.handleUpdateCompileCount.call(fakeThis),
    ).not.toThrow();
    expect(set).toHaveBeenCalledWith("compiles/test-uuid", {
      id: "test-uuid",
      user: "testuser",
      timestamp: expect.any(String),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  });

  it("replaces periods in the compile count username key", async () => {
    const { set, ref, get } = require("firebase/database");
    ref.mockImplementation((_database, path) => {
      if (path.split("/").some((segment) => /[.#$[\]]/.test(segment))) {
        throw new Error(`invalid Firebase path: ${path}`);
      }
      return path;
    });
    get.mockResolvedValue({
      exists: () => false,
    });

    const fakeThis = {
      state: { user: { username: "sajjad.1156" } },
    };

    expect(() =>
      App.prototype.handleUpdateCompileCount.call(fakeThis),
    ).not.toThrow();
    await Promise.resolve();

    expect(get).toHaveBeenCalledWith("compileCounts/sajjad_1156");
    expect(set).toHaveBeenCalledWith("compileCounts/sajjad_1156", 1);
  });
});

describe("App - footnote suppression while compiler errors show", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { get } = require("firebase/database");
    const {
      fetchPhrasesVersion,
      fetchPhrasesByVersion,
    } = require("../components/phrasesApi");
    fetchPhrasesVersion.mockResolvedValue({ version: mockPhrasesData.version });
    fetchPhrasesByVersion.mockResolvedValue(mockPhrasesData);
    get.mockResolvedValue({ val: () => ({ count: 0 }) });
    global.fetch.mockResolvedValue({ ok: false });
  });

  it("hides the copyright footnote only while compiler errors are visible", async () => {
    const { act } = require("@testing-library/react");
    const ref = React.createRef();
    const { container } = render(<App ref={ref} />);

    act(() => {
      ref.current.setState({
        websiteRepoLastCommitDeploy: "2024-01-01T00:00:00Z",
      });
    });
    expect(container.querySelector(".copyright-info")).toBeTruthy();

    act(() => {
      ref.current.setState({ compileErrorsVisible: true });
    });
    expect(container.querySelector(".copyright-info")).toBeFalsy();

    act(() => {
      ref.current.setState({ compileErrorsVisible: false });
    });
    expect(container.querySelector(".copyright-info")).toBeTruthy();
  });

  it("renders the compiler update date with the non-interactive production styling", () => {
    const { act } = require("@testing-library/react");
    const ref = React.createRef();
    const { container } = render(<App ref={ref} />);

    act(() => {
      ref.current.setState({
        websiteRepoLastCommitDeploy: "2026-08-07T06:42:00.000Z",
      });
    });

    const date = container.querySelector(".compiler-update-date");
    expect(date).toBeInstanceOf(HTMLSpanElement);
    expect(date.closest(".item")).toBeTruthy();
    expect(date.closest("a")).toBeNull();
  });

  it("shows the latest date across deploy, phrases, and glossary releases", async () => {
    const { get } = require("firebase/database");
    const { fetchPhrasesVersion } = require("../components/phrasesApi");
    const { fetchGlossaryVersion } = require("../components/glossaryApi");
    fetchPhrasesVersion.mockResolvedValue({
      version: "2.0",
      publishedAt: "2026-08-07T08:00:00.000Z",
    });
    fetchGlossaryVersion.mockResolvedValue({
      version: "3.0",
      publishedAt: "2026-08-08T09:00:00.000Z",
    });
    get.mockResolvedValue({ val: () => ({ count: 0 }) });
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        published_deploy: { published_at: "2026-08-06T07:00:00.000Z" },
        lastCommitUrl: "https://example.com/commit",
      }),
    });

    const ref = React.createRef();
    const { container } = render(<App ref={ref} />);
    const { act } = require("@testing-library/react");
    await waitFor(() =>
      expect(container.querySelector(".copyright-info")).toHaveTextContent(
        formatLocalDeploymentTime("2026-08-08T09:00:00.000Z"),
      ),
    );
  });
});
