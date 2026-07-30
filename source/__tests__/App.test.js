import React from "react";
import { render, waitFor } from "@testing-library/react";
import App, { normalizeRecruitmentInformation } from "../App";
import Running from "../Running";

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
});

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const {
      fetchPhrasesVersion,
      fetchPhrasesByVersion,
    } = require("../components/phrasesApi");
    fetchPhrasesVersion.mockResolvedValue({ version: mockPhrasesData.version });
    fetchPhrasesByVersion.mockResolvedValue(mockPhrasesData);
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
